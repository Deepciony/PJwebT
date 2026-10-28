import { type Request, type RequestHandler, type Response, Router } from 'express';
import { z } from 'zod';
import { env } from '../env';
import type { User } from '../types';
import { exampleKey, recordExample } from './examples';
import { fail } from './http';

// One definition per endpoint drives three things: the Express route, input validation,
// and its entry in the OpenAPI document (so the API docs can never miss an endpoint).

export type Access = 'user' | 'admin';

export type Ctx<P, Q, B> = { req: Request; res: Response; user: User | undefined; params: P; query: Q; body: B };

export type RouteDef<P extends z.ZodType = z.ZodType, Q extends z.ZodType = z.ZodType, B extends z.ZodType = z.ZodType> = {
  method: 'get' | 'post' | 'patch' | 'delete';
  path: string; // Express style, relative to /api/v1
  tag: string;
  summary: string;
  description?: string;
  access?: Access;
  params?: P;
  query?: Q;
  body?: B;
  middleware?: RequestHandler[]; // runs after the access check, e.g. a multipart upload
  upload?: { field: string; description: string }; // documents a multipart file field
  response: z.ZodType;
  status?: number;
  produces?: 'json' | 'image' | 'pdf' | 'sse';
  errors?: Record<number, string>;
  handler: (ctx: Ctx<z.output<P>, z.output<Q>, z.output<B>>) => unknown;
};

const empty = z.object({});
export const routes: RouteDef[] = [];

export function route<P extends z.ZodType = typeof empty, Q extends z.ZodType = typeof empty, B extends z.ZodType = typeof empty>(
  def: RouteDef<P, Q, B>,
) {
  routes.push(def as unknown as RouteDef);
}

export function checkAccess(user: User | undefined, access: Access) {
  if (!user) fail(401, 'UNAUTHORIZED', 'กรุณาเข้าสู่ระบบ');
  if (user.status === 'suspended') fail(403, 'ACCOUNT_SUSPENDED', 'บัญชีนี้ถูกระงับการใช้งาน');
  if (access === 'admin' && user.role !== 'admin') fail(403, 'FORBIDDEN', 'เฉพาะผู้ดูแลระบบเท่านั้น');
}

export function mountRoutes() {
  const router = Router();
  for (const def of routes) {
    const chain: RequestHandler[] = [];
    const access = def.access;
    if (access) {
      chain.push((req, _res, next) => {
        checkAccess(req.user, access);
        next();
      });
    }
    chain.push(...(def.middleware ?? []));
    chain.push(async (req, res) => {
      const data = await def.handler({
        req,
        res,
        user: req.user,
        params: (def.params ?? empty).parse(req.params),
        query: (def.query ?? empty).parse(req.query),
        body: (def.body ?? empty).parse(req.body ?? {}),
      });
      if (res.headersSent) return;
      const key = exampleKey(def.method, def.path);
      if (env.test) {
        const check = def.response.safeParse(JSON.parse(JSON.stringify(data ?? null)));
        if (!check.success) throw new Error(`${key} response does not match its documented schema:\n${z.prettifyError(check.error)}`);
      }
      if (env.recordExamples) recordExample(key, req, data);
      res.status(def.status ?? 200).json(data);
    });
    router[def.method](def.path, ...chain);
  }
  return router;
}
