import { apiReference } from '@scalar/express-api-reference';
import express, { type ErrorRequestHandler } from 'express';
import helmet from 'helmet';
import { z } from 'zod';
import { env } from './env';
import { existsSync } from 'node:fs';
import { join, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadUser } from './lib/auth';
import { HttpError } from './lib/http';
import { mountRoutes } from './lib/route';
import { buildOpenApi } from './openapi';
import './routes/health';
import './routes/auth';
import './routes/users';
import './routes/sports';
import './routes/courts';
import './routes/equipment';
import './routes/cart';
import './routes/bookings';
import './routes/payments';
import './routes/checkin';
import './routes/reviews';
import './routes/events';
import './routes/admin';
import './routes/coupons';
import './routes/emails';
import './routes/settings';

const pgErrors: Record<string, [number, string, string]> = {
  '23P01': [409, 'SLOT_TAKEN', 'ช่วงเวลานี้มีผู้จองแล้ว'],
  '23505': [409, 'DUPLICATE', 'ข้อมูลนี้มีอยู่แล้ว'],
  '23503': [409, 'IN_USE', 'ข้อมูลนี้ถูกใช้งานอยู่ ลบไม่ได้'],
  '23514': [400, 'VALIDATION_ERROR', 'ข้อมูลไม่ผ่านเงื่อนไขของระบบ'],
  '40P01': [409, 'CONFLICT', 'มีการทำรายการเดียวกันพร้อมกัน กรุณาลองใหม่'],
};

const onError: ErrorRequestHandler = (err, _req, res, _next) => {
  const send = (status: number, code: string, message: string, extra = {}) =>
    res.status(status).json({ error: { code, message, ...extra } });
  if (err instanceof HttpError) return send(err.status, err.code, err.message);
  if (err instanceof z.ZodError) return send(400, 'VALIDATION_ERROR', z.prettifyError(err), { issues: err.issues });
  if (err?.name === 'MulterError') return send(400, 'FILE_ERROR', err.message);
  // a foreign key that points nowhere (insert/update) is the caller's mistake, not an in-use conflict
  if (err?.code === '23503' && /is not present/.test(err.detail)) return send(400, 'INVALID_REFERENCE', 'ไม่พบข้อมูลที่อ้างถึง');
  if (pgErrors[err?.code]) return send(...pgErrors[err.code]);
  if (typeof err?.status === 'number' && err.status < 500) return send(err.status, 'BAD_REQUEST', err.message);
  console.error(err);
  send(500, 'INTERNAL', 'เกิดข้อผิดพลาดในระบบ');
};

let openapi: unknown;

export const app = express();
app.set('trust proxy', env.prod ? 1 : false);
app.get('/openapi.json', (req, res) => {
  openapi ??= buildOpenApi();
  res.json({ ...(openapi as object), servers: [{ url: `${req.protocol}://${req.get('host')}` }] });
});
// The API reference script is served from here, not a CDN, so the docs work offline at a demo.
// Mounted before helmet: the page renders with an inline bootstrap script.
// (the package does not export this file, so it is located inside our own node_modules)
// Same purple game theme as the web app (apps/web/src/styles.css): violet panels, dark wells, gold accent.
const docsTheme = `
@import url('https://fonts.googleapis.com/css2?family=Kanit:wght@400;500;600;700&display=swap');
.dark-mode {
  --scalar-font: 'Kanit', 'Prompt', sans-serif;
  --scalar-background-1: #2f2452;
  --scalar-background-2: #463774;
  --scalar-background-3: #54428a;
  --scalar-background-accent: rgb(245 197 66 / 0.15);
  --scalar-color-1: #ffffff;
  --scalar-color-2: #d6cff0;
  --scalar-color-3: #bdb3dc;
  --scalar-color-accent: #f5c542;
  --scalar-link-color: #f5c542;
  --scalar-border-color: #7a68cc;
  --scalar-button-1: #f5c542;
  --scalar-button-1-color: #2b1d05;
  --scalar-button-1-hover: #ffd975;
  --scalar-color-green: #7ac943;
  --scalar-color-red: #ff8b9b;
  --scalar-color-blue: #9db6ff;
  --scalar-color-orange: #f5a524;
  --scalar-color-purple: #a796ff;
  --scalar-sidebar-background-1: #18121f;
  --scalar-sidebar-color-1: #ffffff;
  --scalar-sidebar-color-2: #bdb3dc;
  --scalar-sidebar-color-active: #2b1d05;
  --scalar-sidebar-item-active-background: #f5c542;
  --scalar-sidebar-item-hover-background: #2f2452;
  --scalar-sidebar-item-hover-color: #ffffff;
  --scalar-sidebar-border-color: #7a68cc;
  --scalar-sidebar-search-background: #2f2452;
  --scalar-sidebar-search-border-color: #7a68cc;
  --scalar-sidebar-search-color: #bdb3dc;
}
* { scrollbar-width: none; }
*::-webkit-scrollbar { display: none; }
`;
const scalarBundle = fileURLToPath(new URL('../node_modules/@scalar/api-reference/dist/browser/standalone.js', import.meta.url));
app.get('/docs/scalar.js', (_req, res) => res.sendFile(scalarBundle, { maxAge: '1d' }));
app.use(
  '/docs',
  apiReference({
    url: '/openapi.json',
    pageTitle: 'Arena Hub API',
    cdn: '/docs/scalar.js',
    withDefaultFonts: false,
    theme: 'none',
    customCss: docsTheme,
    forceDarkModeState: 'dark',
    hideDarkModeToggle: true,
    // only our API on the page: no hosted AI chat, MCP generator, developer toolbar or telemetry
    agent: { disabled: true },
    mcp: { disabled: true },
    showDeveloperTools: 'never',
    telemetry: false,
  }),
);
// no upgrade-insecure-requests: a LAN demo over plain http must still load its own assets
app.use(helmet({ contentSecurityPolicy: { directives: { upgradeInsecureRequests: null } } }));
app.use('/uploads', express.static(join(env.uploadDir, 'public')));
app.use(express.json());
app.use(loadUser);
app.use('/api/v1', mountRoutes());
app.use('/api', (_req, _res, next) => next(new HttpError(404, 'NOT_FOUND', 'ไม่พบ endpoint นี้')));

// Production: the built web app is served from this same origin (no CORS, first-party cookies).
if (existsSync(join(env.webDist, 'index.html'))) {
  app.use(
    express.static(env.webDist, {
      index: false,
      setHeaders: (res, path) => {
        if (path.includes(`${sep}assets${sep}`)) res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      },
    }),
  );
  // client-side routes (/courts/3, /admin, ...) all boot the same index.html
  app.use((req, res, next) => {
    if ((req.method !== 'GET' && req.method !== 'HEAD') || req.path.startsWith('/uploads/') || !req.accepts('html')) return next();
    res.set('Cache-Control', 'no-cache').sendFile('index.html', { root: env.webDist });
  });
}
app.use(onError);
