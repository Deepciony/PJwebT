// Admin web terminal and database browser: a fixed set of read-only commands that show what the project runs on
// (versions, database, tables, columns, migrations, endpoints) plus `sql` for one read-only query.
// Nothing here runs a shell on the server.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { arch, platform } from 'node:os';
import type pg from 'pg';
import { z } from 'zod';
import { pool, query } from '../db';
import { env } from '../env';
import { lastJobRunAt } from '../jobs';
import { route, routes } from '../lib/route';

const root = new URL('../../../../', import.meta.url); // repo root
const readJson = (url: URL) => JSON.parse(readFileSync(url, 'utf8'));
const pkgs = { api: readJson(new URL('apps/api/package.json', root)), web: readJson(new URL('apps/web/package.json', root)) };

// installed version of a dependency of apps/<app>, else the range written in its package.json
function version(app: 'api' | 'web', name: string): string {
  const file = new URL(`apps/${app}/node_modules/${name}/package.json`, root);
  if (existsSync(file)) return readJson(file).version;
  const { dependencies = {}, devDependencies = {} } = pkgs[app];
  return dependencies[name] ?? devDependencies[name] ?? '?';
}

type Grid = { columns: string[]; rows: string[][] };
type Result = { ok: boolean; output: string; table?: Grid };

const show = (v: unknown) =>
  v === null ? 'NULL' : v instanceof Date ? v.toLocaleString('sv-SE', { timeZone: 'Asia/Bangkok' }) : typeof v === 'object' ? JSON.stringify(v) : String(v);
const grid = (rows: Record<string, unknown>[], columns = Object.keys(rows[0] ?? {})): Grid => ({
  columns,
  rows: rows.map((r) => columns.map((c) => show(r[c]))),
});
const sqlNote = (...statements: string[]) => statements.map((s) => `-- SQL: ${s.replace(/\s+/g, ' ')}`).join('\n');
const uptime = () => {
  const s = Math.round(process.uptime());
  return `${Math.floor(s / 86400)}d ${Math.floor((s % 86400) / 3600)}h ${Math.floor((s % 3600) / 60)}m`;
};

const DB_INFO = `SELECT version(), current_database() AS database, current_user AS "user",
  pg_size_pretty(pg_database_size(current_database())) AS size, current_setting('TimeZone') AS timezone, now() AS server_time`;
const TABLES = `SELECT table_name, table_type FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_type, table_name`;
const COLUMNS = `SELECT column_name AS column, data_type AS type, is_nullable AS nullable, column_default AS "default"
  FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1 ORDER BY ordinal_position`;
const MIGRATIONS = 'SELECT name, run_at FROM migrations ORDER BY name';
const migrationFiles = () => readdirSync(new URL('apps/api/db/migrations/', root)).filter((f) => f.endsWith('.sql')).sort();

async function tables() {
  const rows = [];
  for (const t of await query(TABLES)) {
    // names come from information_schema, not from the user
    const n = (await query(`SELECT count(*)::int AS n FROM "${t.table_name}"`))[0].n;
    rows.push({ name: t.table_name, type: t.table_type === 'VIEW' ? 'view' : 'table', rows: n });
  }
  return rows;
}

const SQL_LIMIT = 200;

// one statement, inside a READ ONLY transaction that is always rolled back
async function readOnlySql(text: string): Promise<Result> {
  const q = text.trim().replace(/;\s*$/, '');
  if (!q) return { ok: false, output: 'ใช้: sql <คำสั่ง> เช่น sql SELECT version()' };
  const client = await pool.connect();
  try {
    await client.query('BEGIN READ ONLY');
    await client.query(`SET LOCAL statement_timeout = '5s'`);
    // extended protocol takes exactly one statement, so nothing can COMMIT this transaction and write after it
    const r = await client.query({ text: q, queryMode: 'extended' } as pg.QueryConfig);
    if (!r.fields.length) return { ok: true, output: `${sqlNote(q)}\n${r.command} ${r.rowCount ?? ''}`.trim() };
    const more = r.rows.length > SQL_LIMIT ? `\nแสดง ${SQL_LIMIT} จาก ${r.rows.length} แถว (ใส่ LIMIT เพื่อเลือกเอง)` : '';
    return {
      ok: true,
      output: `${sqlNote(q)}\n${r.rows.length} rows${more}`,
      table: grid(r.rows.slice(0, SQL_LIMIT), r.fields.map((f) => f.name)),
    };
  } catch (e) {
    return { ok: false, output: `${sqlNote(q)}\nERROR: ${(e as Error).message}` };
  } finally {
    await client.query('ROLLBACK').catch(() => {});
    client.release();
  }
}

type Command = { help: string; run: (arg: string) => Promise<Result> | Result };
const text = (output: string): Result => ({ ok: true, output });

const commands: Record<string, Command> = {
  help: {
    help: 'คำสั่งทั้งหมด',
    run: () =>
      text(
        [
          'คำสั่งที่ใช้ได้ (ทุกคำสั่งอ่านอย่างเดียว ไม่แก้ข้อมูล):',
          ...Object.entries(commands).map(([name, c]) => `  ${name.padEnd(11)} ${c.help}`),
          '  clear       ล้างหน้าจอ',
          '',
          'กดลูกศรขึ้น/ลง เพื่อเรียกคำสั่งเก่า · กดชื่อตารางทางซ้ายเพื่อดูข้อมูล',
        ].join('\n'),
      ),
  },
  info: {
    help: 'สรุปทั้งระบบ: ใช้อะไร เวอร์ชันไหน ฐานข้อมูล และจำนวนข้อมูล',
    run: async () => {
      const [db] = await query(DB_INFO);
      const t = await tables();
      const applied = (await query(MIGRATIONS)).length;
      const n = (name: string) => t.find((x) => x.name === name)?.rows ?? 0;
      const api = (name: string) => `${name} ${version('api', name)}`;
      const web = (name: string, label: string) => `${label} ${version('web', name)}`;
      const rule = '─'.repeat(64);
      return text(
        [
          'Arena Hub — ระบบจองสนามกีฬาและยืมอุปกรณ์ออนไลน์',
          rule,
          `System    ${env.prod ? 'production' : 'development'} · uptime ${uptime()} · timezone Asia/Bangkok`,
          `Runtime   Node.js ${process.version} (${platform()} ${arch()})`,
          `Backend   ${['express', 'zod', 'pg', 'argon2', 'jose', 'nodemailer', 'helmet', 'multer'].map(api).join(' · ')}`,
          `Database  ${String(db.version).split(' on ')[0]} · database ${db.database} · user ${db.user} · ${db.size}`,
          `          ${t.filter((x) => x.type === 'table').length} tables · ${t.filter((x) => x.type === 'view').length} view · migrations ${applied}/${migrationFiles().length}`,
          `Frontend  ${[
            web('react', 'React'),
            web('vite', 'Vite'),
            web('typescript', 'TypeScript'),
            web('tailwindcss', 'Tailwind CSS'),
            web('@tanstack/react-query', 'TanStack Query'),
            web('react-router', 'React Router'),
          ].join(' · ')}`,
          `API       ${routes.length} endpoints (REST /api/v1) · OpenAPI 3.1 document at /docs`,
          `Data      users ${n('users')} · courts ${n('courts')} · equipment ${n('equipment')} · bookings ${n('bookings')} · payments ${n('payments')}`,
          rule,
          'รายละเอียดเพิ่ม: versions, node, db, tables, migrations, api',
        ].join('\n'),
      );
    },
  },
  versions: {
    help: 'เวอร์ชันของทุกแพ็กเกจที่ติดตั้ง (API และหน้าเว็บ)',
    run: () => {
      const rows = (['api', 'web'] as const).flatMap((app) =>
        Object.keys({ ...pkgs[app].dependencies, ...pkgs[app].devDependencies })
          .filter((name) => !name.startsWith('@types/'))
          .sort()
          .map((name) => ({ app: app === 'api' ? 'API' : 'Web', package: name, version: version(app, name) })),
      );
      return { ok: true, output: 'อ่านจาก apps/api/package.json และ apps/web/package.json (เวอร์ชันที่ติดตั้งจริงใน node_modules)', table: grid(rows) };
    },
  },
  node: {
    help: 'Node.js และเครื่องเซิร์ฟเวอร์',
    run: () =>
      text(
        [
          `node      ${process.version}`,
          `platform  ${platform()} ${arch()}`,
          `memory    ${Math.round(process.memoryUsage().rss / 1048576)} MB`,
          `uptime    ${uptime()}`,
          `env       ${env.prod ? 'production' : 'development'}`,
        ].join('\n'),
      ),
  },
  db: {
    help: 'PostgreSQL: เวอร์ชัน ชื่อฐานข้อมูล ผู้ใช้ ขนาด เวลา',
    run: async () => {
      const [db] = await query(DB_INFO);
      return { ok: true, output: sqlNote(DB_INFO), table: grid(Object.entries(db).map(([key, value]) => ({ key, value }))) };
    },
  },
  tables: {
    help: 'ตารางและ view ทั้งหมด พร้อมจำนวนแถว',
    run: async () => ({ ok: true, output: sqlNote(TABLES, 'SELECT count(*) FROM <แต่ละตาราง>'), table: grid(await tables()) }),
  },
  columns: {
    help: 'คอลัมน์ของตาราง เช่น columns bookings',
    run: async (name) => {
      if (!name) return { ok: false, output: 'ใช้: columns <ชื่อตาราง> เช่น columns bookings' };
      const rows = await query(COLUMNS, [name]);
      if (!rows.length) return { ok: false, output: `ไม่พบตาราง "${name}" พิมพ์ tables เพื่อดูชื่อตาราง` };
      return { ok: true, output: sqlNote(COLUMNS.replace('$1', `'${name}'`)), table: grid(rows) };
    },
  },
  migrations: {
    help: 'ไฟล์ migration (โครงสร้างตาราง) ที่รันแล้ว',
    run: async () => {
      const done = await query(MIGRATIONS);
      const pending = migrationFiles().filter((f) => !done.some((d) => d.name === f));
      const status = pending.length ? `ยังไม่ได้รัน: ${pending.join(', ')}` : 'ครบทุกไฟล์ใน apps/api/db/migrations';
      return { ok: true, output: `${sqlNote(MIGRATIONS)}\n${status}`, table: grid(done, ['name', 'run_at']) };
    },
  },
  api: {
    help: 'จำนวน endpoint แยกตามหมวด',
    run: () => {
      const byTag = new Map<string, number>();
      for (const r of routes) byTag.set(r.tag, (byTag.get(r.tag) ?? 0) + 1);
      return { ok: true, output: `รวม ${routes.length} endpoints · เอกสารเต็มที่ /docs`, table: grid([...byTag].map(([tag, endpoints]) => ({ tag, endpoints }))) };
    },
  },
  endpoints: {
    help: 'endpoint ทั้งหมด: method, path, สิทธิ์ และหน้าที่',
    run: () => ({
      ok: true,
      output: `${routes.length} endpoints ใต้ /api/v1`,
      table: grid(routes.map((r) => ({ method: r.method.toUpperCase(), path: r.path, access: r.access ?? 'public', summary: r.summary }))),
    }),
  },
  health: {
    help: 'API และฐานข้อมูลตอบไหม และใช้เวลากี่ ms',
    run: async () => {
      const started = performance.now();
      await query('SELECT 1');
      return text(`api       ok (uptime ${uptime()})\ndatabase  ok (${Math.round(performance.now() - started)} ms)\n${sqlNote('SELECT 1')}`);
    },
  },
  stats: {
    help: 'การจองแยกตามสถานะ รายได้ และสมาชิก',
    run: async () => {
      const BY_STATUS = `SELECT status, count(*)::int AS bookings FROM bookings GROUP BY status ORDER BY status`;
      const REVENUE = `SELECT coalesce(sum(amount), 0) AS revenue FROM payments WHERE status = 'approved'`;
      const MEMBERS = `SELECT count(*) FILTER (WHERE role = 'member') AS members, count(*) FILTER (WHERE role = 'admin') AS admins FROM users`;
      const [{ revenue }] = await query(REVENUE);
      const [{ members, admins }] = await query(MEMBERS);
      return {
        ok: true,
        output: `${sqlNote(BY_STATUS, REVENUE, MEMBERS)}\nรายได้ที่อนุมัติแล้ว ${Number(revenue).toLocaleString('th-TH')} บาท · สมาชิก ${members} · ผู้ดูแล ${admins}`,
        table: grid(await query(BY_STATUS), ['status', 'bookings']),
      };
    },
  },
  settings: {
    help: 'ค่าตั้งระบบที่ผู้ดูแลแก้ในหน้า ระบบ',
    run: async () => {
      const SETTINGS = 'SELECT key, value, updated_at FROM settings ORDER BY key';
      const rows = await query(SETTINGS);
      return { ok: true, output: `${sqlNote(SETTINGS)}${rows.length ? '' : '\nยังไม่มีการแก้ ใช้ค่าเริ่มต้นทั้งหมด'}`, table: grid(rows, ['key', 'value', 'updated_at']) };
    },
  },
  jobs: {
    help: 'งานอัตโนมัติทุก 1 นาที ทำอะไร และรันล่าสุดเมื่อไร',
    run: () => {
      const last = lastJobRunAt();
      return text(
        [
          `last run  ${last ? show(new Date(last)) : 'ยังไม่ได้รันตั้งแต่เปิดเซิร์ฟเวอร์'}`,
          'every     1 นาที (apps/api/src/jobs.ts)',
          'does      1. ยกเลิกการจองที่ไม่แนบสลิปภายในเวลา และส่งอีเมลแจ้ง',
          '          2. เปลี่ยนการจองที่ใช้สนามเสร็จแล้วเป็น completed',
          '          3. ส่งอีเมลเตือนก่อนเวลาจอง 1 ชั่วโมง',
          '          4. ลบรายการในตะกร้าที่เลยเวลาไปแล้ว',
        ].join('\n'),
      );
    },
  },
  env: {
    help: 'ค่าตั้งของเซิร์ฟเวอร์ (ไม่แสดงรหัสผ่านหรือ secret)',
    run: () =>
      text(
        [
          `NODE_ENV       ${env.prod ? 'production' : 'development'}`,
          `PORT           ${env.port}`,
          `APP_URL        ${env.appUrl}`,
          `DATABASE_URL   ${env.databaseUrl.replace(/\/\/([^:@/]+):[^@]*@/, '//$1:***@')}`,
          `JWT_SECRET     ${process.env.JWT_SECRET ? 'ตั้งแล้ว (ซ่อนไว้)' : 'ค่าสำหรับพัฒนา'}`,
          `SMTP_URL       ${env.smtpUrl ? 'ตั้งแล้ว (ซ่อนไว้) ส่งอีเมลออกจริง' : 'ไม่ได้ตั้ง อีเมลอยู่ในเว็บอย่างเดียว'}`,
          `uploads        ${env.uploadDir}`,
          `web build      ${env.webDist}`,
        ].join('\n'),
      ),
  },
  whoami: { help: 'บัญชีที่ใช้ terminal อยู่', run: () => text('') }, // answered in the handler, which knows the user
  sql: { help: 'SQL อ่านอย่างเดียว ครั้งละ 1 คำสั่ง เช่น sql SELECT version()', run: readOnlySql },
};

route({
  method: 'post',
  path: '/admin/terminal',
  tag: 'Admin',
  summary: 'รันคำสั่งใน terminal ของผู้ดูแลระบบ',
  description:
    'คำสั่งที่กำหนดไว้ (help, info, versions, node, db, tables, columns, migrations, api) และ sql สำหรับ SQL แบบอ่านอย่างเดียวครั้งละ 1 คำสั่ง ' +
    '(รันใน transaction READ ONLY แล้ว rollback เสมอ จำกัดเวลา 5 วินาที แสดงสูงสุด 200 แถว) ไม่ได้รัน shell ของเซิร์ฟเวอร์',
  access: 'admin',
  body: z.object({ command: z.string().trim().min(1).max(4000).describe('เช่น info, columns bookings หรือ sql SELECT version()') }),
  response: z.object({
    ok: z.boolean().describe('false = ไม่รู้จักคำสั่ง หรือ SQL ผิดพลาด'),
    output: z.string().describe('ข้อความที่แสดงใน terminal รวมคำสั่ง SQL ที่ใช้'),
    table: z.object({ columns: z.array(z.string()), rows: z.array(z.array(z.string())) }).optional().describe('ผลลัพธ์แบบตาราง'),
  }),
  handler: async ({ body, user }) => {
    const name = body.command.split(/\s+/)[0];
    const key = name.toLowerCase();
    if (key === 'whoami') return text(`${user!.name} <${user!.email}> · role ${user!.role} · id ${user!.id}`);
    const cmd = Object.hasOwn(commands, key) ? commands[key] : undefined;
    if (!cmd) return { ok: false, output: `ไม่รู้จักคำสั่ง "${name}" พิมพ์ help เพื่อดูคำสั่งทั้งหมด` };
    return cmd.run(body.command.slice(name.length).trim());
  },
});
