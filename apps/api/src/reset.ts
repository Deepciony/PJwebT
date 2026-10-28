// Wipes the development database and rebuilds it with demo data: bun run db:reset
import { execFileSync } from 'node:child_process';
import { pool } from './db';
import { env } from './env';

if (env.prod) throw new Error('db:reset is for development only');
await pool.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
await pool.end();
for (const script of ['src/migrate.ts', 'src/seed.ts']) execFileSync(process.execPath, [script], { stdio: 'inherit' });
