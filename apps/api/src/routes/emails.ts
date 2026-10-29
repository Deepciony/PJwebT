import { z } from 'zod';
import { one, query } from '../db';
import { env } from '../env';
import { fail, found } from '../lib/http';
import { deliver } from '../lib/mail';
import { route } from '../lib/route';
import { dateTime, idParam } from '../schemas';

const kind = z.enum(['confirmed', 'approved', 'rejected', 'cancelled', 'reminder', 'fine', 'checkout']).describe('ประเภทอีเมล');
const status = z.enum(['web', 'sent', 'failed']).describe('web=อยู่ในเว็บเท่านั้น sent=ส่งออกทาง SMTP แล้ว failed=ส่ง SMTP ไม่สำเร็จ');

const EmailSummary = z
  .object({
    id: z.number().int(),
    kind,
    toAddress: z.string(),
    subject: z.string(),
    status,
    error: z.string().nullable(),
    userId: z.number().int().nullable(),
    userName: z.string().nullable(),
    bookingId: z.number().int().nullable(),
    bookingCode: z.string().nullable(),
    readAt: dateTime.nullable().describe('เวลาที่เจ้าของเปิดอ่าน'),
    createdAt: dateTime,
  })
  .meta({ id: 'EmailSummary', description: 'อีเมลที่ระบบส่ง (ไม่รวมเนื้อหา)' });

const Email = EmailSummary.extend({ html: z.string().describe('เนื้อหาอีเมล (HTML)') }).meta({ id: 'Email' });

const columns = `m.id, m.kind, m.to_address AS "toAddress", m.subject, m.status, m.error, m.user_id AS "userId", u.name AS "userName",
  m.booking_id AS "bookingId", b.code AS "bookingCode", m.read_at AS "readAt", m.created_at AS "createdAt"`;
const from = 'FROM emails m LEFT JOIN users u ON u.id = m.user_id LEFT JOIN bookings b ON b.id = m.booking_id';
const emailSelect = `SELECT ${columns} ${from}`;

const getEmail = async (id: number) => found(await one(`SELECT m.html, ${columns} ${from} WHERE m.id = $1`, [id]), 'อีเมล');

route({
  method: 'get',
  path: '/users/me/emails',
  tag: 'Emails',
  summary: 'กล่องข้อความของฉัน',
  description: 'อีเมลทุกฉบับที่ระบบส่งถึงสมาชิก ล่าสุดก่อน (100 ฉบับ) พร้อมจำนวนที่ยังไม่อ่าน เปิดอ่านด้วย `GET /api/v1/emails/{id}`',
  access: 'user',
  response: z.object({ unread: z.number().int(), items: z.array(EmailSummary) }).meta({ id: 'Inbox' }),
  handler: async ({ user }) => {
    const items = await query(`${emailSelect} WHERE m.user_id = $1 ORDER BY m.created_at DESC, m.id DESC LIMIT 100`, [user!.id]);
    return { unread: items.filter((m) => !m.readAt).length, items };
  },
});

route({
  method: 'get',
  path: '/emails',
  tag: 'Emails',
  summary: 'อีเมลทั้งหมดที่ระบบส่ง',
  description: 'ใช้แทนกล่องอีเมลภายนอก: เห็นทุกฉบับ สถานะการส่ง และค้นหาจากผู้รับ หัวเรื่อง หรือเลขที่การจอง (500 ฉบับล่าสุด)',
  access: 'admin',
  query: z.object({
    q: z.string().optional().describe('ค้นหาจากอีเมลผู้รับ ชื่อ หัวเรื่อง หรือเลขที่การจอง'),
    kind: kind.optional(),
    status: status.optional(),
  }),
  response: z.array(EmailSummary),
  handler: ({ query: q }) =>
    query(
      `${emailSelect}
       WHERE ($1::text IS NULL OR m.to_address ILIKE '%' || $1 || '%' OR m.subject ILIKE '%' || $1 || '%' OR u.name ILIKE '%' || $1 || '%')
         AND ($2::text IS NULL OR m.kind = $2) AND ($3::email_status IS NULL OR m.status = $3)
       ORDER BY m.created_at DESC, m.id DESC LIMIT 500`,
      [q.q ?? null, q.kind ?? null, q.status ?? null],
    ),
});

route({
  method: 'get',
  path: '/emails/:id',
  tag: 'Emails',
  summary: 'เปิดอ่านอีเมล 1 ฉบับ',
  description: 'เจ้าของอีเมลหรือ admin เท่านั้น การเปิดโดยเจ้าของจะบันทึกว่าอ่านแล้ว',
  access: 'user',
  params: idParam,
  response: Email,
  errors: { 404: 'ไม่พบอีเมล (NOT_FOUND)' },
  handler: async ({ user, params }) => {
    const mail = await getEmail(params.id);
    if (mail.userId !== user!.id && user!.role !== 'admin') fail(404, 'NOT_FOUND', 'ไม่พบอีเมล');
    if (mail.userId === user!.id && !mail.readAt) {
      await query('UPDATE emails SET read_at = now() WHERE id = $1', [params.id]);
      return getEmail(params.id);
    }
    return mail;
  },
});

route({
  method: 'post',
  path: '/emails/:id/resend',
  tag: 'Emails',
  summary: 'ส่งอีเมลออกทาง SMTP อีกครั้ง',
  description: 'ใช้เมื่อการส่งออกล้มเหลว ต้องตั้งค่า SMTP_URL ของเซิร์ฟเวอร์ก่อน (สมาชิกยังเห็นอีเมลในเว็บเสมอ)',
  access: 'admin',
  params: idParam,
  response: Email,
  errors: { 404: 'ไม่พบอีเมล (NOT_FOUND)', 409: 'ยังไม่ได้ตั้งค่า SMTP (SMTP_DISABLED)' },
  handler: async ({ params }) => {
    await getEmail(params.id);
    if (!env.smtpUrl) fail(409, 'SMTP_DISABLED', 'ยังไม่ได้ตั้งค่า SMTP อีเมลแสดงอยู่ในเว็บเท่านั้น');
    await deliver(params.id);
    return getEmail(params.id);
  },
});
