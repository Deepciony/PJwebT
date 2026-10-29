import type { AddressInfo } from 'node:net';
import { beforeAll, describe, expect, it } from 'vitest';
import { app } from '../src/app';
import { one, query } from '../src/db';
import { runJobs } from '../src/jobs';
import { bangkokDate, HOUR } from '../src/lib/time';
import { admin, api, bearer, member, png } from './helpers';

const day = (n: number) => bangkokDate(new Date(Date.now() + n * 24 * HOUR));
const at = (date: string, hour: number) => `${date}T${String(hour).padStart(2, '0')}:00:00+07:00`;
const nextHour = () => new Date(Math.ceil((Date.now() + 60_000) / HOUR) * HOUR).toISOString();

let adminToken: string;
let courtId: number;
let equipmentId: number;
let hourSeq = 0;

beforeAll(async () => {
  adminToken = (await admin()).token;
  const sport = await api().post('/api/v1/sports').set(bearer(adminToken)).send({ name: `ฟุตซอล-${Date.now()}`, icon: '⚽' });
  courtId = (
    await api()
      .post('/api/v1/courts')
      .set(bearer(adminToken))
      .send({ sportId: sport.body.id, name: 'สนามฟุตซอล 1', pricePerHour: 800, openHour: 0, closeHour: 24 })
  ).body.id;
  equipmentId = (
    await api()
      .post('/api/v1/equipment')
      .set(bearer(adminToken))
      .send({ sportId: sport.body.id, name: 'ลูกฟุตบอล', totalQty: 5, rentPrice: 20, deposit: 300 })
  ).body.id;
});

async function book(token: string, startAt = at(day(4), hourSeq++ % 24), withBall = false) {
  await api().post('/api/v1/cart/slots').set(bearer(token)).send({ courtId, startAt }).expect(200);
  if (withBall) {
    const endAt = new Date(Date.parse(startAt) + HOUR).toISOString();
    await api().post('/api/v1/cart/equipment').set(bearer(token)).send({ equipmentId, qty: 1, startAt, endAt }).expect(200);
  }
  return (await api().post('/api/v1/cart/confirm').set(bearer(token)).expect(200)).body;
}

async function pay(token: string, bookingId: number) {
  const payment = (
    await api().post(`/api/v1/bookings/${bookingId}/payments`).set(bearer(token)).attach('image', png, { filename: 's.png', contentType: 'image/png' })
  ).body;
  await api().patch(`/api/v1/payments/${payment.id}`).set(bearer(adminToken)).send({ status: 'approved' }).expect(200);
  return (await api().get(`/api/v1/bookings/${bookingId}`).set(bearer(token))).body;
}


describe('realtime availability', () => {
  it('streams an availability event when a booking is confirmed', async () => {
    const server = app.listen(0);
    const { port } = server.address() as AddressInfo;
    const res = await fetch(`http://localhost:${port}/api/v1/events/availability`);
    expect(res.headers.get('content-type')).toContain('text/event-stream');
    const reader = res.body!.getReader();
    const { token } = await member();
    await book(token);
    let text = '';
    while (!text.includes('event: availability')) text += new TextDecoder().decode((await reader.read()).value);
    expect(text).toContain(`"courtIds":[${courtId}]`);
    await reader.cancel();
    server.close();
  });
});

describe('check-in', () => {
  it('admin checks in a paid booking by its QR token', async () => {
    const m = await member();
    const booking = await pay(m.token, (await book(m.token)).id);
    const res = await api().post('/api/v1/checkin').set(bearer(adminToken)).send({ token: booking.checkinToken });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: booking.id, status: 'checked_in' });
    const again = await api().post('/api/v1/checkin').set(bearer(adminToken)).send({ token: booking.checkinToken });
    expect(again.body.error.code).toBe('INVALID_STATUS');
  });

  it('also accepts the booking code typed by hand', async () => {
    const m = await member();
    const booking = await pay(m.token, (await book(m.token)).id);
    expect((await api().post('/api/v1/checkin').set(bearer(adminToken)).send({ token: booking.code })).body.status).toBe('checked_in');
  });

  it('refuses unpaid bookings, unknown codes and members', async () => {
    const m = await member();
    const booking = await book(m.token);
    expect((await api().post('/api/v1/checkin').set(bearer(adminToken)).send({ token: booking.code })).body.error.code).toBe('INVALID_STATUS');
    expect((await api().post('/api/v1/checkin').set(bearer(adminToken)).send({ token: 'no-such-code' })).status).toBe(404);
    expect((await api().post('/api/v1/checkin').set(bearer(m.token)).send({ token: booking.code })).status).toBe(403);
  });

  it('refuses check-in earlier than the allowed window', async () => {
    const m = await member();
    const booking = await pay(m.token, (await book(m.token, at(day(5), 10))).id);
    const saved = process.env.CHECKIN_EARLY_MINUTES;
    process.env.CHECKIN_EARLY_MINUTES = '30';
    try {
      const res = await api().post('/api/v1/checkin').set(bearer(adminToken)).send({ token: booking.checkinToken });
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('TOO_EARLY');
    } finally {
      process.env.CHECKIN_EARLY_MINUTES = saved;
    }
  });
});

describe('equipment return', () => {
  it('admin records the return with condition and fine; it cannot be returned twice', async () => {
    const m = await member();
    const booking = await pay(m.token, (await book(m.token, undefined, true)).id);
    await api().post('/api/v1/checkin').set(bearer(adminToken)).send({ token: booking.checkinToken }).expect(200);
    const item = booking.equipment[0].id;
    const res = await api()
      .post(`/api/v1/bookings/${booking.id}/equipment/${item}/return`)
      .set(bearer(adminToken))
      .send({ conditionNote: 'ลูกบอลรั่ว', fine: 150 });
    expect(res.status).toBe(200);
    expect(res.body.equipment[0]).toMatchObject({ conditionNote: 'ลูกบอลรั่ว', fine: 150, returnedAt: expect.any(String) });
    expect(res.body.fineTotal).toBe(150);
    const twice = await api().post(`/api/v1/bookings/${booking.id}/equipment/${item}/return`).set(bearer(adminToken)).send({});
    expect(twice.body.error.code).toBe('ALREADY_RETURNED');
    // the member is told about the fine
    const inbox = (await api().get('/api/v1/users/me/emails').set(bearer(m.token))).body;
    expect(inbox.items.some((e: { kind: string; subject: string }) => e.kind === 'fine' && e.subject.includes('150'))).toBe(true);
  });

  it('checkout needs a check-in and every item returned; then the booking is completed and the member is emailed', async () => {
    const m = await member();
    const booking = await pay(m.token, (await book(m.token, undefined, true)).id);
    const early = await api().post(`/api/v1/bookings/${booking.id}/checkout`).set(bearer(adminToken));
    expect(early.body.error.code).toBe('INVALID_STATUS');
    await api().post('/api/v1/checkin').set(bearer(adminToken)).send({ token: booking.checkinToken }).expect(200);
    const blocked = await api().post(`/api/v1/bookings/${booking.id}/checkout`).set(bearer(adminToken));
    expect(blocked.status).toBe(409);
    expect(blocked.body.error.code).toBe('UNRETURNED_EQUIPMENT');
    await api().post(`/api/v1/bookings/${booking.id}/equipment/${booking.equipment[0].id}/return`).set(bearer(adminToken)).send({ fine: 50 }).expect(200);
    expect((await api().post(`/api/v1/bookings/${booking.id}/checkout`).set(bearer(m.token))).status).toBe(403);
    const done = await api().post(`/api/v1/bookings/${booking.id}/checkout`).set(bearer(adminToken));
    expect(done.status).toBe(200);
    expect(done.body.status).toBe('completed');
    const inbox = (await api().get('/api/v1/users/me/emails').set(bearer(m.token))).body;
    expect(inbox.items.some((e: { kind: string }) => e.kind === 'checkout')).toBe(true);
  });
});

describe('reviews', () => {
  it('a member reviews a court of a completed booking once; the court rating updates', async () => {
    const m = await member('นักฟุตซอล ตัวจริง');
    const booking = await pay(m.token, (await book(m.token)).id);
    const early = await api().post(`/api/v1/bookings/${booking.id}/review`).set(bearer(m.token)).send({ courtId, rating: 5, comment: 'ดี' });
    expect(early.body.error.code).toBe('INVALID_STATUS');
    await query(`UPDATE bookings SET status = 'completed' WHERE id = $1`, [booking.id]);
    const res = await api()
      .post(`/api/v1/bookings/${booking.id}/review`)
      .set(bearer(m.token))
      .send({ courtId, rating: 4, comment: 'พื้นสนามดี ไฟสว่าง' });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ rating: 4, comment: 'พื้นสนามดี ไฟสว่าง', userName: 'นักฟุตซอล ตัวจริง' });
    const dup = await api().post(`/api/v1/bookings/${booking.id}/review`).set(bearer(m.token)).send({ courtId, rating: 1 });
    expect(dup.body.error.code).toBe('ALREADY_REVIEWED');
    const list = await api().get(`/api/v1/courts/${courtId}/reviews`);
    expect(list.body.map((r: { id: number }) => r.id)).toContain(res.body.id);
    const court = await api().get(`/api/v1/courts/${courtId}`);
    expect(court.body.reviewCount).toBeGreaterThanOrEqual(1);
    expect(court.body.rating).toEqual(expect.any(Number));
  });

  it('cannot review a court that is not in the booking', async () => {
    const m = await member();
    const booking = await pay(m.token, (await book(m.token)).id);
    await query(`UPDATE bookings SET status = 'completed' WHERE id = $1`, [booking.id]);
    const res = await api().post(`/api/v1/bookings/${booking.id}/review`).set(bearer(m.token)).send({ courtId: 999999, rating: 3 });
    expect(res.body.error.code).toBe('COURT_NOT_IN_BOOKING');
  });
});

describe('background jobs', () => {
  it('expires unpaid bookings after the payment window and frees the slot', async () => {
    const m = await member();
    const booking = await book(m.token);
    await query(`UPDATE bookings SET expires_at = now() - interval '1 minute' WHERE id = $1`, [booking.id]);
    await runJobs();
    expect((await one('SELECT status FROM bookings WHERE id = $1', [booking.id])).status).toBe('expired');
    expect((await one('SELECT bool_or(active) AS held FROM booking_slots WHERE booking_id = $1', [booking.id])).held).toBe(false);
  });

  it('completes bookings whose last slot has ended', async () => {
    const m = await member();
    const booking = await pay(m.token, (await book(m.token)).id);
    await query(`UPDATE booking_slots SET start_at = now() - interval '3 hours', end_at = now() - interval '2 hours' WHERE booking_id = $1`, [booking.id]);
    await runJobs();
    expect((await one('SELECT status FROM bookings WHERE id = $1', [booking.id])).status).toBe('completed');
  });

  it('emails a reminder once, about an hour before a paid booking starts', async () => {
    const m = await member();
    const booking = await pay(m.token, (await book(m.token, nextHour())).id);
    // pin the start 30 minutes out regardless of when the suite runs
    await query(`UPDATE booking_slots SET start_at = now() + interval '30 minutes', end_at = now() + interval '90 minutes' WHERE booking_id = $1`, [
      booking.id,
    ]);
    await runJobs();
    await runJobs();
    expect((await one('SELECT reminder_sent_at FROM bookings WHERE id = $1', [booking.id])).reminder_sent_at).not.toBeNull();
    const inbox = (await api().get('/api/v1/users/me/emails').set(bearer(m.token))).body.items;
    const reminders = inbox.filter((x: { subject: string }) => x.subject.includes('อีก 1 ชั่วโมง'));
    expect(reminders).toHaveLength(1);
  });

  it('drops cart items whose time has passed', async () => {
    const m = await member();
    const cart = (await api().post('/api/v1/cart/slots').set(bearer(m.token)).send({ courtId, startAt: at(day(6), 9) })).body;
    await query(`UPDATE booking_slots SET start_at = now() - interval '2 hours', end_at = now() - interval '1 hour' WHERE booking_id = $1`, [cart.id]);
    await runJobs();
    expect((await api().get('/api/v1/cart').set(bearer(m.token))).body.slots).toEqual([]);
  });
});

describe('admin dashboard', () => {
  it('reports revenue, bookings, peak hours and top courts for the period; members are refused', async () => {
    const m = await member();
    const booking = await pay(m.token, (await book(m.token, at(day(2), 19), true)).id);
    const today = bangkokDate(new Date());
    const res = await api().get('/api/v1/admin/stats').query({ from: today, to: today }).set(bearer(adminToken));
    expect(res.status).toBe(200);
    expect(res.body.revenue).toBeGreaterThanOrEqual(booking.total);
    expect(res.body.revenueByDay.find((d: { date: string }) => d.date === today).revenue).toBeGreaterThanOrEqual(booking.total);
    expect(res.body.topCourts.map((c: { courtId: number }) => c.courtId)).toContain(courtId);
    expect(res.body.peakHours.find((h: { hour: number }) => h.hour === 19).bookings).toBeGreaterThanOrEqual(1);
    expect(res.body.topEquipment.map((e: { equipmentId: number }) => e.equipmentId)).toContain(equipmentId);
    expect(res.body).toHaveProperty('pendingPayments');
    expect((await api().get('/api/v1/admin/stats').set(bearer(m.token))).status).toBe(403);
  });
});
