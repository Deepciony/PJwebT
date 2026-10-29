import QRCode from 'qrcode';
import { type Db, one, pool } from '../db';
import type { User } from '../types';
import { notifyAvailability } from './events';
import { fail, found } from './http';

const bookingSql = `
  SELECT b.id, b.code, b.status, b.user_id AS "userId", u.name AS "userName", u.email AS "userEmail",
    b.created_at AS "createdAt", b.confirmed_at AS "confirmedAt", b.expires_at AS "expiresAt",
    t.subtotal, t.discount, t.total, (SELECT code FROM coupons WHERE id = b.coupon_id) AS "couponCode",
    CASE WHEN b.status IN ('paid', 'checked_in') THEN b.checkin_token::text END AS "checkinToken",
    COALESCE((
      SELECT json_agg(json_build_object(
        'id', s.id, 'courtId', c.id, 'courtName', c.name, 'sportName', sp.name, 'sportIcon', sp.icon,
        'startAt', s.start_at, 'endAt', s.end_at, 'price', s.price,
        'taken', EXISTS (SELECT 1 FROM booking_slots o WHERE o.court_id = s.court_id AND o.active AND o.id <> s.id
                           AND tstzrange(o.start_at, o.end_at) && tstzrange(s.start_at, s.end_at))
      ) ORDER BY s.start_at, c.name)
      FROM booking_slots s JOIN courts c ON c.id = s.court_id JOIN sports sp ON sp.id = c.sport_id
      WHERE s.booking_id = b.id), '[]') AS slots,
    COALESCE((
      SELECT json_agg(json_build_object(
        'id', be.id, 'equipmentId', e.id, 'name', e.name, 'sportIcon', sp.icon, 'qty', be.qty,
        'startAt', be.start_at, 'endAt', be.end_at, 'price', be.price, 'deposit', e.deposit * be.qty,
        'returnedAt', be.returned_at, 'conditionNote', be.condition_note, 'fine', be.fine
      ) ORDER BY be.start_at, e.name)
      FROM booking_equipment be JOIN equipment e ON e.id = be.equipment_id JOIN sports sp ON sp.id = e.sport_id
      WHERE be.booking_id = b.id), '[]') AS equipment,
    COALESCE((SELECT sum(e.deposit * be.qty) FROM booking_equipment be JOIN equipment e ON e.id = be.equipment_id
      WHERE be.booking_id = b.id), 0) AS "depositTotal",
    COALESCE((SELECT sum(fine) FROM booking_equipment WHERE booking_id = b.id), 0) AS "fineTotal",
    COALESCE((
      SELECT json_agg(json_build_object(
        'id', p.id, 'amount', p.amount, 'status', p.status, 'note', p.note, 'createdAt', p.created_at, 'reviewedAt', p.reviewed_at
      ) ORDER BY p.created_at DESC)
      FROM payments p WHERE p.booking_id = b.id), '[]') AS payments,
    COALESCE((SELECT json_agg(r.court_id) FROM reviews r WHERE r.booking_id = b.id), '[]') AS "reviewedCourtIds"
  FROM bookings b JOIN users u ON u.id = b.user_id JOIN booking_totals t ON t.booking_id = b.id
  WHERE b.id = $1`;

export type BookingRow = {
  id: number;
  code: string;
  status: string;
  userId: number;
  userName: string;
  userEmail: string;
  expiresAt: Date | null;
  total: number;
  fineTotal: number;
  checkinToken: string | null;
  checkinQr?: string | null;
  slots: { id: number; courtId: number; courtName: string; startAt: string; endAt: string }[];
  equipment: { id: number; equipmentId: number; name: string; qty: number; startAt: string; endAt: string; returnedAt: string | null; fine: number; conditionNote: string | null }[];
};

export async function getBooking(id: number, db: Db = pool) {
  const booking = found(await one<BookingRow>(bookingSql, [id], db), 'การจอง');
  booking.checkinQr = booking.checkinToken ? await QRCode.toDataURL(booking.checkinToken, { margin: 1, width: 256 }) : null;
  return booking;
}

// members only ever see their own bookings; a stranger's booking simply "does not exist"
export async function getVisibleBooking(id: number, user: User) {
  const booking = await getBooking(id);
  if (user.role !== 'admin' && booking.userId !== user.id) fail(404, 'NOT_FOUND', 'ไม่พบการจอง');
  return booking;
}

export const firstStart = (b: BookingRow) =>
  Math.min(...[...b.slots, ...b.equipment].map((i) => Date.parse(i.startAt)));
export const lastEnd = (b: BookingRow) =>
  Math.max(...[...b.slots, ...b.equipment].map((i) => Date.parse(i.endAt)));

// The member's open cart, created on first use. Code = local date + zero-padded id, e.g. 202610070003.
export async function cartIdFor(userId: number, db: Db = pool): Promise<number> {
  const existing = await one(`SELECT id FROM bookings WHERE user_id = $1 AND status = 'cart'`, [userId], db);
  if (existing) return existing.id;
  await db.query(
    `INSERT INTO bookings (id, user_id, code)
     SELECT n.id, $1, to_char(now(), 'YYYYMMDD') || lpad(n.id::text, greatest(4, length(n.id::text)), '0')
     FROM (SELECT nextval(pg_get_serial_sequence('bookings', 'id')) AS id) n
     ON CONFLICT (user_id) WHERE status = 'cart' DO NOTHING`,
    [userId],
  );
  return (await one(`SELECT id FROM bookings WHERE user_id = $1 AND status = 'cart'`, [userId], db)).id;
}

// Ends a booking's hold on its court slots and equipment.
export async function release(bookingId: number, status: 'cancelled' | 'expired', db: Db) {
  await db.query('UPDATE bookings SET status = $2, expires_at = NULL WHERE id = $1', [bookingId, status]);
  await db.query('UPDATE booking_slots SET active = false WHERE booking_id = $1', [bookingId]);
  await db.query('UPDATE booking_equipment SET active = false WHERE booking_id = $1', [bookingId]);
}

export function notifyBooking(b: BookingRow) {
  notifyAvailability(
    b.slots.map((s) => s.courtId),
    b.equipment.map((e) => e.equipmentId),
  );
}
