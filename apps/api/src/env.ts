import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const envFile = new URL('../../../.env', import.meta.url);
if (process.env.NODE_ENV !== 'test' && existsSync(envFile)) process.loadEnvFile(fileURLToPath(envFile));

const prod = process.env.NODE_ENV === 'production';
if (prod && !process.env.JWT_SECRET) throw new Error('JWT_SECRET must be set in production');

export const env = {
  prod,
  test: process.env.NODE_ENV === 'test',
  port: Number(process.env.PORT ?? 3000),
  databaseUrl: process.env.DATABASE_URL ?? `postgres://sporthub:sporthub@localhost:${process.env.DB_PORT ?? 5432}/sporthub`,
  jwtSecret: new TextEncoder().encode(process.env.JWT_SECRET ?? 'dev-only-secret-do-not-use-in-prod'),
  // optional: without it emails live only in the web app (member inbox, admin mail log)
  get smtpUrl() {
    return process.env.SMTP_URL || null;
  },
  mailFrom: process.env.MAIL_FROM ?? 'SportHub <no-reply@sporthub.local>',
  appUrl: process.env.APP_URL ?? 'http://localhost:5173',
  promptpayId: process.env.PROMPTPAY_ID ?? '0812345678',
  // how early before the first slot a booking may check in (calibration knob for demos)
  get checkinEarlyMinutes() {
    return Number(process.env.CHECKIN_EARLY_MINUTES ?? 30);
  },
  recordExamples: process.env.RECORD_EXAMPLES === '1',
  uploadDir: fileURLToPath(new URL('../uploads/', import.meta.url)),
  webDist: process.env.WEB_DIST ?? fileURLToPath(new URL('../../web/dist/', import.meta.url)),
};
