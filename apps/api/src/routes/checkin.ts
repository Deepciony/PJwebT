import { z } from 'zod';
import { one } from '../db';
import { firstStart, getBooking, lastEnd } from '../lib/bookings';
import { notifyAvailability } from '../lib/events';
import { mail } from '../lib/mail';
import { fail, found } from '../lib/http';
import { route } from '../lib/route';
import { getSettings } from '../lib/settings';
import { Booking } from '../schemas';

route({
  method: 'post',
  path: '/checkin',
  tag: 'Bookings',
  summary: 'เช็คอินหน้าสนาม',
  description: `สแกน QR จากหน้าการจองของสมาชิก หรือพิมพ์เลขที่การจอง ใช้ได้กับการจองที่ชำระแล้ว ตั้งแต่ก่อนเวลาเริ่มตามที่ตั้งในระบบ (ค่าเริ่มต้น 30 นาที) จนถึงเวลาจบ`,
  access: 'admin',
  body: z.object({ token: z.string().trim().min(1).describe('รหัสจาก QR เช็คอิน หรือเลขที่การจอง') }),
  response: Booking,
  errors: {
    404: 'ไม่พบการจอง (NOT_FOUND)',
    409: 'ยังไม่ชำระ/เช็คอินแล้ว (INVALID_STATUS) ยังไม่ถึงเวลา (TOO_EARLY) หรือเลยเวลาแล้ว (BOOKING_ENDED)',
  },
  handler: async ({ body }) => {
    const row = found(await one('SELECT id FROM bookings WHERE checkin_token::text = $1 OR code = $1', [body.token]), 'การจอง');
    const booking = await getBooking(row.id);
    if (booking.status !== 'paid') {
      fail(409, 'INVALID_STATUS', booking.status === 'checked_in' ? 'การจองนี้เช็คอินไปแล้ว' : 'การจองนี้ยังไม่ได้ชำระเงินหรือไม่อยู่ในสถานะที่เช็คอินได้');
    }
    const early = (await getSettings()).checkinEarlyMinutes;
    if (Date.now() < firstStart(booking) - early * 60_000) fail(409, 'TOO_EARLY', `เช็คอินได้ตั้งแต่ ${early} นาทีก่อนเวลาเริ่ม`);
    if (Date.now() > lastEnd(booking)) fail(409, 'BOOKING_ENDED', 'เลยเวลาการจองแล้ว');
    await one(`UPDATE bookings SET status = 'checked_in' WHERE id = $1 AND status = 'paid'`, [booking.id]);
    return getBooking(booking.id);
  },
});

route({
  method: 'post',
  path: '/bookings/:id/equipment/:itemId/return',
  tag: 'Bookings',
  summary: 'บันทึกการคืนอุปกรณ์',
  description: 'บันทึกเวลาคืน สภาพ และค่าปรับ (หักจากมัดจำหน้างาน) อุปกรณ์ที่คืนแล้วจะว่างให้คนอื่นยืมต่อได้ทันที',
  access: 'admin',
  params: z.object({
    id: z.coerce.number().int().positive().describe('รหัสการจอง'),
    itemId: z.coerce.number().int().positive().describe('รหัสรายการอุปกรณ์ในการจอง'),
  }),
  body: z.object({
    conditionNote: z.string().trim().max(500).optional().describe('สภาพตอนคืน'),
    fine: z.number().min(0).max(100_000).default(0).describe('ค่าปรับ (บาท)'),
  }),
  response: Booking,
  errors: {
    404: 'ไม่พบรายการ (NOT_FOUND)',
    409: 'การจองยังไม่ได้รับของ (INVALID_STATUS) หรือคืนไปแล้ว (ALREADY_RETURNED)',
  },
  handler: async ({ params, body }) => {
    const item = found(
      await one(
        `SELECT be.equipment_id, be.returned_at, b.status, e.name FROM booking_equipment be JOIN bookings b ON b.id = be.booking_id
         JOIN equipment e ON e.id = be.equipment_id
         WHERE be.id = $1 AND be.booking_id = $2`,
        [params.itemId, params.id],
      ),
      'รายการอุปกรณ์',
    );
    if (!['paid', 'checked_in', 'completed'].includes(item.status)) fail(409, 'INVALID_STATUS', 'การจองนี้ยังไม่ได้รับอุปกรณ์');
    if (item.returned_at) fail(409, 'ALREADY_RETURNED', 'คืนอุปกรณ์รายการนี้แล้ว');
    await one('UPDATE booking_equipment SET returned_at = now(), condition_note = $2, fine = $3, active = false WHERE id = $1', [
      params.itemId,
      body.conditionNote ?? null,
      body.fine,
    ]);
    notifyAvailability([], [item.equipment_id]);
    const booking = await getBooking(params.id);
    // a fine does nothing unless the member hears about it: an email, and it shows on the booking
    if (body.fine > 0) await mail.fine(booking, item.name, body.fine, body.conditionNote ?? null);
    return booking;
  },
});

route({
  method: 'post',
  path: '/bookings/:id/checkout',
  tag: 'Bookings',
  summary: 'เช็คเอาท์',
  description: 'ปิดการใช้งานของการจองที่เช็คอินแล้ว ต้องรับคืนอุปกรณ์ครบทุกรายการก่อน สถานะเปลี่ยนเป็น completed (สมาชิกรีวิวได้) และส่งอีเมลสรุปพร้อมค่าปรับ (ถ้ามี)',
  access: 'admin',
  params: z.object({ id: z.coerce.number().int().positive().describe('รหัสการจอง') }),
  response: Booking,
  errors: {
    404: 'ไม่พบการจอง (NOT_FOUND)',
    409: 'ยังไม่ได้เช็คอิน (INVALID_STATUS) หรือยังคืนอุปกรณ์ไม่ครบ (UNRETURNED_EQUIPMENT)',
  },
  handler: async ({ params }) => {
    const booking = await getBooking(params.id);
    if (booking.status !== 'checked_in') fail(409, 'INVALID_STATUS', 'เช็คเอาท์ได้เฉพาะการจองที่เช็คอินแล้ว');
    const left = booking.equipment.filter((e) => !e.returnedAt);
    if (left.length) fail(409, 'UNRETURNED_EQUIPMENT', `ยังไม่ได้รับคืนอุปกรณ์: ${left.map((e) => e.name).join(', ')}`);
    await one(`UPDATE bookings SET status = 'completed' WHERE id = $1 AND status = 'checked_in'`, [booking.id]);
    const done = await getBooking(booking.id);
    await mail.checkout(done);
    return done;
  },
});
