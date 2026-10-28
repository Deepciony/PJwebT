import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { bangkokDate, HOUR } from '../src/lib/time';
import { admin, api, bearer, member, png } from './helpers';

const day = (n: number) => bangkokDate(new Date(Date.now() + n * 24 * HOUR));
const at = (date: string, hour: number) => `${date}T${String(hour).padStart(2, '0')}:00:00+07:00`;

let adminToken: string;
let courtId: number;
let hourSeq = 0;

beforeAll(async () => {
  adminToken = (await admin()).token;
  const sport = await api().post('/api/v1/sports').set(bearer(adminToken)).send({ name: `วอลเลย์-${Date.now()}`, icon: '🏐' });
  courtId = (
    await api()
      .post('/api/v1/courts')
      .set(bearer(adminToken))
      .send({ sportId: sport.body.id, name: 'สนามวอลเลย์ทดสอบ', pricePerHour: 600, openHour: 0, closeHour: 24 })
  ).body.id;
});

async function confirmBooking(token: string, daysAhead = 4) {
  await api().post('/api/v1/cart/slots').set(bearer(token)).send({ courtId, startAt: at(day(daysAhead), hourSeq++ % 24) }).expect(200);
  return (await api().post('/api/v1/cart/confirm').set(bearer(token)).expect(200)).body;
}

describe('mail inside the web app', () => {
  it('every email the system sends lands in the member’s inbox, unread until opened', async () => {
    const m = await member();
    const booking = await confirmBooking(m.token);
    const inbox = await api().get('/api/v1/users/me/emails').set(bearer(m.token));
    expect(inbox.status).toBe(200);
    expect(inbox.body.unread).toBe(1);
    const mail = inbox.body.items[0];
    expect(mail).toMatchObject({ kind: 'confirmed', toAddress: m.email, readAt: null, bookingId: booking.id });
    expect(mail.subject).toContain(booking.code);
    const opened = await api().get(`/api/v1/emails/${mail.id}`).set(bearer(m.token));
    expect(opened.body.html).toContain(booking.code);
    expect(opened.body.readAt).toEqual(expect.any(String));
    expect((await api().get('/api/v1/users/me/emails').set(bearer(m.token))).body.unread).toBe(0);
  });

  it('members cannot open other people’s emails or the full mail log', async () => {
    const owner = await member();
    const stranger = await member();
    await confirmBooking(owner.token);
    const id = (await api().get('/api/v1/users/me/emails').set(bearer(owner.token))).body.items[0].id;
    expect((await api().get(`/api/v1/emails/${id}`).set(bearer(stranger.token))).status).toBe(404);
    expect((await api().get('/api/v1/emails').set(bearer(stranger.token))).status).toBe(403);
  });

  it('admins see every email, can search it, and the approval email carries the check-in QR inline', async () => {
    const m = await member();
    const booking = await confirmBooking(m.token);
    const payment = (
      await api().post(`/api/v1/bookings/${booking.id}/payments`).set(bearer(m.token)).attach('image', png, { filename: 's.png', contentType: 'image/png' })
    ).body;
    await api().patch(`/api/v1/payments/${payment.id}`).set(bearer(adminToken)).send({ status: 'approved' }).expect(200);
    const list = await api().get('/api/v1/emails').query({ q: m.email }).set(bearer(adminToken));
    expect(list.status).toBe(200);
    expect(list.body.map((e: { kind: string }) => e.kind).sort()).toEqual(['approved', 'confirmed']);
    expect(list.body[0]).toMatchObject({ userName: m.user.name, bookingCode: booking.code });
    const approved = list.body.find((e: { kind: string }) => e.kind === 'approved');
    const full = await api().get(`/api/v1/emails/${approved.id}`).set(bearer(adminToken));
    expect(full.body.html).toContain('data:image/png;base64,');
    expect(full.body.readAt).toBeNull(); // an admin reading it does not mark the member's copy as read
  });

  it('without SMTP the mail stays in the web app and cannot be re-sent', async () => {
    const m = await member();
    await confirmBooking(m.token);
    const mail = (await api().get('/api/v1/users/me/emails').set(bearer(m.token))).body.items[0];
    expect(mail.status).toBe('web');
    const res = await api().post(`/api/v1/emails/${mail.id}/resend`).set(bearer(adminToken));
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('SMTP_DISABLED');
  });

  it('records a failed SMTP delivery and lets an admin retry it', async () => {
    const saved = process.env.SMTP_URL;
    process.env.SMTP_URL = 'smtp://127.0.0.1:1'; // nothing listens here
    try {
      const m = await member();
      await confirmBooking(m.token);
      const id = (await api().get('/api/v1/users/me/emails').set(bearer(m.token))).body.items[0].id;
      let mail = { status: 'web', error: null as string | null };
      for (let i = 0; i < 50 && mail.status !== 'failed'; i++) {
        await new Promise((r) => setTimeout(r, 100));
        mail = (await api().get(`/api/v1/emails/${id}`).set(bearer(adminToken))).body;
      }
      expect(mail.status).toBe('failed');
      expect(mail.error).toEqual(expect.any(String));
      const retry = await api().post(`/api/v1/emails/${id}/resend`).set(bearer(adminToken));
      expect(retry.status).toBe(200);
      expect(retry.body.status).toBe('failed');
    } finally {
      if (saved === undefined) delete process.env.SMTP_URL;
      else process.env.SMTP_URL = saved;
    }
  });
});

describe('system settings managed from the web', () => {
  const restore = () =>
    api()
      .patch('/api/v1/settings')
      .set(bearer(adminToken))
      .send({ promptpayId: null, payWithinMinutes: null, cancelBeforeHours: null, maxDaysAhead: null, checkinEarlyMinutes: null });
  afterAll(restore);

  it('anyone reads the effective settings; only admins change them', async () => {
    const res = await api().get('/api/v1/settings');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ payWithinMinutes: 15, cancelBeforeHours: 24, maxDaysAhead: 60, promptpayId: expect.any(String) });
    const { token } = await member();
    expect((await api().patch('/api/v1/settings').set(bearer(token)).send({ payWithinMinutes: 5 })).status).toBe(403);
  });

  it('changing the payment window, booking horizon and PromptPay number takes effect immediately', async () => {
    const saved = await api()
      .patch('/api/v1/settings')
      .set(bearer(adminToken))
      .send({ payWithinMinutes: 30, maxDaysAhead: 10, promptpayId: '0899999999' });
    expect(saved.status).toBe(200);
    expect(saved.body).toMatchObject({ payWithinMinutes: 30, maxDaysAhead: 10, promptpayId: '0899999999' });
    const { token } = await member();
    const tooFar = await api().post('/api/v1/cart/slots').set(bearer(token)).send({ courtId, startAt: at(day(20), 10) });
    expect(tooFar.body.error.code).toBe('TOO_FAR_AHEAD');
    const booking = await confirmBooking(token, 3);
    expect((Date.parse(booking.expiresAt) - Date.now()) / 60_000).toBeGreaterThan(29);
    const qr = await api().get(`/api/v1/bookings/${booking.id}/promptpay`).set(bearer(token));
    expect(qr.body.promptpayId).toBe('0899999999');
    await restore().expect(200);
  });

  it('books at most one calendar day ahead by default: today and all of tomorrow, nothing later', async () => {
    const saved = process.env.MAX_DAYS_AHEAD;
    delete process.env.MAX_DAYS_AHEAD; // the suite runs with a wide window; this checks the real default
    try {
      expect((await api().get('/api/v1/settings')).body.maxDaysAhead).toBe(1);
      const { token } = await member();
      const add = (startAt: string) => api().post('/api/v1/cart/slots').set(bearer(token)).send({ courtId, startAt });
      expect((await add(at(day(1), 23))).status).toBe(200); // late tomorrow is fine
      const dayAfter = await add(at(day(2), 0)); // first hour of the day after tomorrow is not
      expect(dayAfter.status).toBe(400);
      expect(dayAfter.body.error.code).toBe('TOO_FAR_AHEAD');
      expect(dayAfter.body.error.message).toContain('พรุ่งนี้');
    } finally {
      process.env.MAX_DAYS_AHEAD = saved;
    }
  });

  it('can be limited to today only', async () => {
    await api().patch('/api/v1/settings').set(bearer(adminToken)).send({ maxDaysAhead: 0 }).expect(200);
    try {
      const { token } = await member();
      const res = await api().post('/api/v1/cart/slots').set(bearer(token)).send({ courtId, startAt: at(day(1), 10) });
      expect(res.body.error.code).toBe('TOO_FAR_AHEAD');
      expect(res.body.error.message).toContain('วันนี้');
    } finally {
      await api().patch('/api/v1/settings').set(bearer(adminToken)).send({ maxDaysAhead: null }).expect(200);
    }
  });

  it('rejects out-of-range values', async () => {
    const res = await api().patch('/api/v1/settings').set(bearer(adminToken)).send({ payWithinMinutes: 0 });
    expect(res.status).toBe(400);
  });
});

describe('system status', () => {
  it('shows database, migrations, mail delivery mode and counts to admins', async () => {
    const res = await api().get('/api/v1/admin/system').set(bearer(adminToken));
    expect(res.status).toBe(200);
    expect(res.body.db).toBe(true);
    expect(res.body.migrations).toContain('004_mail_and_settings.sql');
    expect(res.body.smtpEnabled).toBe(false);
    expect(res.body.counts).toMatchObject({ users: expect.any(Number), bookings: expect.any(Number), emails: expect.any(Number) });
  });

  it('lets admins run the background jobs on demand', async () => {
    const res = await api().post('/api/v1/admin/jobs/run').set(bearer(adminToken));
    expect(res.status).toBe(200);
    expect(Date.parse(res.body.lastJobRunAt)).toBeGreaterThan(Date.now() - 10_000);
    const { token } = await member();
    expect((await api().post('/api/v1/admin/jobs/run').set(bearer(token))).status).toBe(403);
  });

  it('lets admins download the user manual as a PDF; members cannot', async () => {
    const res = await api().get('/api/v1/admin/manual').set(bearer(adminToken)).buffer(true);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe('application/pdf');
    expect(res.headers['content-disposition']).toContain('Arena-Hub-manual.pdf');
    expect(res.body.subarray(0, 5).toString()).toBe('%PDF-');
    const { token } = await member();
    expect((await api().get('/api/v1/admin/manual').set(bearer(token))).status).toBe(403);
  });
});
