import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import { one, query } from '../db';
import { fail } from '../lib/http';
import { route } from '../lib/route';
import { atBangkok, bangkokDate } from '../lib/time';
import { env } from '../env';
import { lastJobRunAt, runJobs } from '../jobs';
import { bookingStatus, dateTime } from '../schemas';

const PAID = `('paid', 'checked_in', 'completed')`;

const Stats = z
  .object({
    from: z.iso.date(),
    to: z.iso.date(),
    revenue: z.number().describe('ยอดเงินที่อนุมัติแล้วในช่วงนี้'),
    bookings: z.number().int().describe('จำนวนการจองที่ยืนยันในช่วงนี้'),
    newMembers: z.number().int(),
    totalMembers: z.number().int(),
    pendingPayments: z.number().int().describe('สลิปที่รอตรวจ (ทั้งหมด)'),
    todayBookings: z.number().int().describe('การจองที่ใช้สนามวันนี้'),
    revenueByDay: z.array(z.object({ date: z.iso.date(), revenue: z.number(), bookings: z.number().int() })),
    byStatus: z.array(z.object({ status: bookingStatus, count: z.number().int() })),
    bySport: z.array(z.object({ sportId: z.number().int(), name: z.string(), icon: z.string(), hours: z.number().int(), revenue: z.number() })),
    topCourts: z.array(z.object({ courtId: z.number().int(), name: z.string(), sportIcon: z.string(), hours: z.number().int(), revenue: z.number() })),
    peakHours: z.array(z.object({ hour: z.number().int(), bookings: z.number().int() })),
    topEquipment: z.array(z.object({ equipmentId: z.number().int(), name: z.string(), sportIcon: z.string(), qty: z.number().int(), revenue: z.number() })),
  })
  .meta({ id: 'Stats', description: 'สถิติสำหรับแดชบอร์ด' });

// court slots of paid bookings confirmed inside the period
const paidSlots = `
  booking_slots s JOIN bookings b ON b.id = s.booking_id
  JOIN courts c ON c.id = s.court_id JOIN sports sp ON sp.id = c.sport_id
  WHERE b.status IN ${PAID} AND b.confirmed_at >= $1 AND b.confirmed_at < $2`;

route({
  method: 'get',
  path: '/admin/stats',
  tag: 'Admin',
  summary: 'สถิติแดชบอร์ด',
  description: 'ค่าเริ่มต้นคือ 30 วันล่าสุด รายได้นับจากสลิปที่อนุมัติ ส่วนสถิติสนาม/อุปกรณ์นับจากการจองที่ชำระแล้วและยืนยันในช่วงนั้น',
  access: 'admin',
  query: z.object({
    from: z.iso.date().optional().describe('วันเริ่ม YYYY-MM-DD'),
    to: z.iso.date().optional().describe('วันสุดท้าย YYYY-MM-DD'),
  }),
  response: Stats,
  errors: { 400: 'ช่วงวันที่ไม่ถูกต้อง (INVALID_PERIOD)' },
  handler: async ({ query: q }) => {
    const to = q.to ?? bangkokDate(new Date());
    const from = q.from ?? bangkokDate(new Date(atBangkok(to, 0).getTime() - 29 * 24 * 3_600_000));
    if (from > to) fail(400, 'INVALID_PERIOD', 'วันเริ่มต้องไม่หลังวันสุดท้าย');
    const range = [atBangkok(from, 0), atBangkok(to, 24)];
    const [totals, revenueByDay, byStatus, bySport, topCourts, peakHours, topEquipment] = await Promise.all([
      one(
        `SELECT
           (SELECT COALESCE(sum(amount), 0) FROM payments WHERE status = 'approved' AND reviewed_at >= $1 AND reviewed_at < $2) AS revenue,
           (SELECT count(*) FROM bookings WHERE status <> 'cart' AND confirmed_at >= $1 AND confirmed_at < $2) AS bookings,
           (SELECT count(*) FROM users WHERE role = 'member' AND created_at >= $1 AND created_at < $2) AS "newMembers",
           (SELECT count(*) FROM users WHERE role = 'member') AS "totalMembers",
           (SELECT count(*) FROM payments WHERE status = 'pending') AS "pendingPayments",
           (SELECT count(DISTINCT b.id) FROM bookings b JOIN booking_slots s ON s.booking_id = b.id
             WHERE b.status IN ${PAID} AND s.start_at::date = current_date) AS "todayBookings"`,
        range,
      ),
      query(
        `SELECT to_char(d, 'YYYY-MM-DD') AS date,
           (SELECT COALESCE(sum(amount), 0) FROM payments WHERE status = 'approved' AND reviewed_at::date = d::date) AS revenue,
           (SELECT count(*) FROM bookings WHERE status <> 'cart' AND confirmed_at::date = d::date) AS bookings
         FROM generate_series($1::date, $2::date, interval '1 day') d ORDER BY d`,
        [from, to],
      ),
      query(
        `SELECT status, count(*) AS count FROM bookings WHERE status <> 'cart' AND confirmed_at >= $1 AND confirmed_at < $2
         GROUP BY status ORDER BY count DESC`,
        range,
      ),
      query(
        `SELECT sp.id AS "sportId", sp.name, sp.icon, count(s.id) AS hours, sum(s.price) AS revenue
         FROM ${paidSlots}
         GROUP BY sp.id ORDER BY revenue DESC`,
        range,
      ),
      query(
        `SELECT c.id AS "courtId", c.name, sp.icon AS "sportIcon", count(s.id) AS hours, sum(s.price) AS revenue
         FROM ${paidSlots}
         GROUP BY c.id, sp.icon ORDER BY hours DESC, revenue DESC LIMIT 5`,
        range,
      ),
      query(
        `SELECT h AS hour, count(x.id) AS bookings
         FROM generate_series(0, 23) h
         LEFT JOIN (SELECT s.id, s.start_at FROM ${paidSlots}) x ON extract(hour FROM x.start_at) = h
         GROUP BY h ORDER BY h`,
        range,
      ),
      query(
        `SELECT e.id AS "equipmentId", e.name, sp.icon AS "sportIcon", sum(be.qty) AS qty, sum(be.price) AS revenue
         FROM booking_equipment be JOIN bookings b ON b.id = be.booking_id
           JOIN equipment e ON e.id = be.equipment_id JOIN sports sp ON sp.id = e.sport_id
         WHERE b.status IN ${PAID} AND b.confirmed_at >= $1 AND b.confirmed_at < $2
         GROUP BY e.id, sp.icon ORDER BY qty DESC LIMIT 5`,
        range,
      ),
    ]);
    return { from, to, ...totals, revenueByDay, byStatus, bySport, topCourts, peakHours, topEquipment };
  },
});

route({
  method: 'get',
  path: '/admin/system',
  tag: 'Admin',
  summary: 'สถานะระบบหลังบ้าน',
  description: 'ฐานข้อมูล, migration ที่รันแล้ว, การส่งอีเมลออก (SMTP), งานอัตโนมัติครั้งล่าสุด และจำนวนข้อมูลหลัก',
  access: 'admin',
  response: z
    .object({
      db: z.boolean(),
      postgresVersion: z.string(),
      migrations: z.array(z.string()),
      smtpEnabled: z.boolean().describe('false = อีเมลอยู่ในเว็บเท่านั้น'),
      lastJobRunAt: dateTime.nullable(),
      uptimeSeconds: z.number().int(),
      nodeVersion: z.string(),
      counts: z.object({
        users: z.number().int(),
        bookings: z.number().int(),
        emails: z.number().int(),
        emailsFailed: z.number().int(),
      }),
    })
    .meta({ id: 'SystemStatus' }),
  handler: async () => ({
    db: (await one('SELECT 1 AS up'))?.up === 1,
    postgresVersion: (await one('SHOW server_version')).server_version,
    migrations: (await query('SELECT name FROM migrations ORDER BY name')).map((r) => r.name),
    smtpEnabled: Boolean(env.smtpUrl),
    lastJobRunAt: lastJobRunAt(),
    uptimeSeconds: Math.round(process.uptime()),
    nodeVersion: process.version,
    counts: await one(
      `SELECT (SELECT count(*) FROM users) AS users,
         (SELECT count(*) FROM bookings WHERE status <> 'cart') AS bookings,
         (SELECT count(*) FROM emails) AS emails,
         (SELECT count(*) FROM emails WHERE status = 'failed') AS "emailsFailed"`,
    ),
  }),
});

route({
  method: 'post',
  path: '/admin/jobs/run',
  tag: 'Admin',
  summary: 'รันงานอัตโนมัติทันที',
  description: 'ปกติระบบรันเองทุก 1 นาที: ยกเลิกการจองที่หมดเวลาชำระ ปิดการจองที่จบแล้ว ส่งอีเมลเตือนก่อนเวลา และล้างรายการในตะกร้าที่เลยเวลา',
  access: 'admin',
  response: z.object({ ok: z.literal(true), lastJobRunAt: dateTime }),
  handler: async () => {
    await runJobs();
    return { ok: true as const, lastJobRunAt: lastJobRunAt()! };
  },
});

// the printed user manual (it lists the demo accounts' passwords, so admins only)
const manualFile = fileURLToPath(new URL('../../../../docs/SportHub-manual.pdf', import.meta.url));

route({
  method: 'get',
  path: '/admin/manual',
  tag: 'Admin',
  summary: 'ดาวน์โหลดคู่มือการใช้งาน (PDF)',
  description: 'ไฟล์คู่มือการใช้งานฉบับพิมพ์ของระบบ ดาวน์โหลดเป็นชื่อ Arena-Hub-manual.pdf',
  access: 'admin',
  response: z.string(),
  produces: 'pdf',
  errors: { 404: 'ยังไม่มีไฟล์คู่มือบนเซิร์ฟเวอร์ (NOT_FOUND)' },
  handler: async ({ res }) => {
    if (!existsSync(manualFile)) fail(404, 'NOT_FOUND', 'ยังไม่มีไฟล์คู่มือบนเซิร์ฟเวอร์');
    await new Promise<void>((resolve, reject) => res.download(manualFile, 'Arena-Hub-manual.pdf', (err) => (err ? reject(err) : resolve())));
  },
});
