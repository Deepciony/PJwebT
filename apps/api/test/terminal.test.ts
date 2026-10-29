import { beforeAll, describe, expect, it } from 'vitest';
import { admin, api, bearer, member } from './helpers';

let token: string;
const run = async (command: string) => (await api().post('/api/v1/admin/terminal').set(bearer(token)).send({ command }).expect(200)).body;
const sportCount = async () => Number((await run('sql SELECT count(*) AS n FROM sports')).table.rows[0][0]);

beforeAll(async () => {
  token = (await admin()).token;
});

describe('admin terminal', () => {
  it('info sums up the stack with real versions', async () => {
    const res = await run('info');
    expect(res.ok).toBe(true);
    expect(res.output).toMatch(/Runtime\s+Node\.js v\d+/);
    expect(res.output).toMatch(/Database\s+PostgreSQL \d+/);
    expect(res.output).toMatch(/express \d+\.\d+\.\d+/);
    expect(res.output).toMatch(/React \d+\.\d+\.\d+/);
  });

  it('lists tables with row counts and the columns of one table', async () => {
    const tables = await run('tables');
    expect(tables.table.columns).toEqual(['name', 'type', 'rows']);
    expect(tables.table.rows.map((r: string[]) => r[0])).toEqual(expect.arrayContaining(['bookings', 'users', 'booking_totals']));
    const cols = await run('columns bookings');
    expect(cols.table.rows.map((r: string[]) => r[0])).toEqual(expect.arrayContaining(['code', 'status', 'user_id']));
    expect((await run('columns no_such_table')).ok).toBe(false);
  });

  it('runs a read-only SELECT and shows the SQL it ran', async () => {
    const res = await run('sql SELECT version();');
    expect(res.ok).toBe(true);
    expect(res.output).toContain('-- SQL: SELECT version()');
    expect(res.table.columns).toEqual(['version']);
    expect(res.table.rows[0][0]).toMatch(/^PostgreSQL \d+/);
  });

  it('refuses writes, including one smuggled after a COMMIT', async () => {
    const before = await sportCount();
    const insert = await run(`sql INSERT INTO sports (name, icon) VALUES ('terminal-${Date.now()}', 'x')`);
    expect(insert.ok).toBe(false);
    expect(insert.output).toContain('read-only');
    const smuggled = await run('sql SELECT 1; COMMIT; DELETE FROM sports');
    expect(smuggled.ok).toBe(false);
    expect(await sportCount()).toBe(before);
  });

  it('explains unknown commands; members cannot use it', async () => {
    expect(await run('rm -rf /')).toMatchObject({ ok: false });
    expect((await run('help')).output).toContain('sql');
    const m = await member();
    expect((await api().post('/api/v1/admin/terminal').set(bearer(m.token)).send({ command: 'info' })).status).toBe(403);
  });
});

describe('admin terminal: system checks', () => {
  it('health, stats, settings, jobs, endpoints and whoami answer', async () => {
    expect((await run('health')).output).toMatch(/database\s+ok/);
    const stats = await run('stats');
    expect(stats.table.columns).toEqual(['status', 'bookings']);
    expect((await run('settings')).ok).toBe(true);
    expect((await run('jobs')).output).toContain('jobs.ts');
    const endpoints = await run('endpoints');
    expect(endpoints.table.rows).toContainEqual(['POST', '/admin/terminal', 'admin', 'รันคำสั่งใน terminal ของผู้ดูแลระบบ']);
    expect((await run('whoami')).output).toContain('role admin');
  });

  it('env never shows secrets', async () => {
    const out = (await run('env')).output;
    expect(out).toContain('NODE_ENV');
    expect(out).not.toMatch(/sporthub:sporthub@/);
    expect(out).toContain(':***@');
  });
});
