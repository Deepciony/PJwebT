import nodemailer from 'nodemailer';
import { one, query } from '../db';
import { env } from '../env';
import type { BookingRow } from './bookings';
import { getSettings, type SettingsValue } from './settings';

// Every email is first stored (member inbox + admin mail log in the web app), then delivered by SMTP
// in the background when SMTP_URL is set. A mail outage never fails the request that triggered it.

type Kind = 'confirmed' | 'approved' | 'rejected' | 'cancelled' | 'reminder' | 'fine' | 'checkout';

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const when = new Intl.DateTimeFormat('th-TH', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Bangkok' });
const time = new Intl.DateTimeFormat('th-TH', { timeStyle: 'short', timeZone: 'Asia/Bangkok' });
const baht = (n: number) => `${n.toLocaleString('th-TH')} บาท`;

function items(b: BookingRow) {
  const rows = [
    ...b.slots.map((s) => `${esc(s.courtName)} — ${when.format(new Date(s.startAt))} - ${time.format(new Date(s.endAt))}`),
    ...b.equipment.map((e) => `${esc(e.name)} × ${e.qty} — ${when.format(new Date(e.startAt))} - ${time.format(new Date(e.endAt))}`),
  ];
  return `<ul>${rows.map((r) => `<li>${r}</li>`).join('')}</ul>`;
}

function contact(s: SettingsValue) {
  const parts = [s.contactPhone && `โทร ${esc(s.contactPhone)}`, s.contactLine && `LINE ${esc(s.contactLine)}`, s.address && esc(s.address)].filter(Boolean);
  return parts.length ? `<br>${parts.join(' | ')}` : '';
}

function layout(b: BookingRow, heading: string, body: string, s: SettingsValue) {
  return `<div style="font-family:sans-serif;max-width:560px">
  <h2 style="color:#0f766e">${heading}</h2>
  <p>สวัสดีคุณ ${esc(b.userName)}</p>
  ${body}
  <p><b>เลขที่การจอง:</b> ${b.code}<br><b>ยอดรวม:</b> ${baht(b.total)}</p>
  ${items(b)}
  <p><a href="${env.appUrl}/bookings/${b.id}">ดูรายละเอียดการจอง</a></p>
  <p style="color:#64748b;font-size:12px">Arena Hub — ระบบจองสนามกีฬาและยืมอุปกรณ์${contact(s)}</p></div>`;
}

async function record(b: BookingRow, kind: Kind, subject: string, html: string) {
  const { id } = (await one(
    'INSERT INTO emails (user_id, booking_id, kind, to_address, subject, html) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id',
    [b.userId, b.id, kind, b.userEmail, subject, html],
  ))!;
  deliver(id).catch((err) => console.error(`mail ${id}:`, err.message));
  return id as number;
}

// Sends a stored email by SMTP. The web copy embeds images as data: URLs; mail clients block those,
// so the SMTP copy carries them as attachments referenced by cid:.
export async function deliver(id: number): Promise<'web' | 'sent' | 'failed'> {
  const smtp = env.smtpUrl;
  if (!smtp) return 'web';
  const row = (await one('SELECT to_address, subject, html FROM emails WHERE id = $1', [id]))!;
  const attachments: { filename: string; content: Buffer; cid: string }[] = [];
  const html = row.html.replace(/src="data:image\/png;base64,([^"]+)"/g, (_: string, data: string) => {
    const cid = `image${attachments.length}`;
    attachments.push({ filename: `${cid}.png`, content: Buffer.from(data, 'base64'), cid });
    return `src="cid:${cid}"`;
  });
  try {
    await nodemailer.createTransport(smtp).sendMail({ from: env.mailFrom, to: row.to_address, subject: row.subject, html, attachments });
    await query(`UPDATE emails SET status = 'sent', error = NULL WHERE id = $1`, [id]);
    return 'sent';
  } catch (err) {
    await query(`UPDATE emails SET status = 'failed', error = $2 WHERE id = $1`, [id, (err as Error).message]);
    return 'failed';
  }
}

export const mail = {
  confirmed: async (b: BookingRow) => {
    const s = await getSettings();
    const { payWithinMinutes } = s;
    return record(
      b,
      'confirmed',
      `[Arena Hub] ยืนยันการจอง #${b.code} — กรุณาชำระเงินภายใน ${payWithinMinutes} นาที`,
      layout(b, 'ได้รับการจองแล้ว', `<p>กรุณาสแกน QR PromptPay และแนบสลิปภายใน ${payWithinMinutes} นาที ไม่เช่นนั้นการจองจะถูกยกเลิกอัตโนมัติ</p>`, s),
    );
  },
  approved: async (b: BookingRow) =>
    record(
      b,
      'approved',
      `[Arena Hub] ชำระเงินสำเร็จ #${b.code}`,
      layout(b, 'ชำระเงินสำเร็จ', `<p>แสดง QR นี้ที่เคาน์เตอร์เพื่อเช็คอิน</p><img src="${b.checkinQr}" width="200" alt="QR เช็คอิน">`, await getSettings()),
    ),
  rejected: async (b: BookingRow, note: string | null) => {
    const s = await getSettings();
    const { payWithinMinutes } = s;
    return record(
      b,
      'rejected',
      `[Arena Hub] สลิปไม่ผ่านการตรวจสอบ #${b.code}`,
      layout(b, 'สลิปไม่ผ่านการตรวจสอบ', `<p>เหตุผล: ${esc(note ?? '-')}</p><p>กรุณาแนบสลิปใหม่ภายใน ${payWithinMinutes} นาที</p>`, s),
    );
  },
  cancelled: async (b: BookingRow, reason: string) =>
    record(b, 'cancelled', `[Arena Hub] การจอง #${b.code} ถูกยกเลิก`, layout(b, 'การจองถูกยกเลิก', `<p>${esc(reason)}</p>`, await getSettings())),
  fine: async (b: BookingRow, item: string, amount: number, note: string | null) =>
    record(
      b,
      'fine',
      `[Arena Hub] ค่าปรับ ${baht(amount)} การจอง #${b.code}`,
      layout(b, 'มีค่าปรับจากการคืนอุปกรณ์', `<p>อุปกรณ์: ${esc(item)}</p><p>สภาพตอนคืน: ${esc(note ?? '-')}</p><p><b>ค่าปรับ ${baht(amount)}</b> ชำระที่เคาน์เตอร์ (รวมค่าปรับทั้งการจอง ${baht(b.fineTotal)})</p>`, await getSettings()),
    ),
  checkout: async (b: BookingRow) =>
    record(
      b,
      'checkout',
      `[Arena Hub] เช็คเอาท์เรียบร้อย #${b.code}`,
      layout(b, 'เช็คเอาท์เรียบร้อย', `<p>คืนอุปกรณ์ครบแล้ว ขอบคุณที่ใช้บริการ${b.fineTotal > 0 ? `</p><p><b>ค่าปรับรวม ${baht(b.fineTotal)}</b> ชำระที่เคาน์เตอร์` : ''}</p><p>เข้าไปรีวิวสนามได้ที่หน้าการจอง</p>`, await getSettings()),
    ),
  reminder: async (b: BookingRow) =>
    record(b, 'reminder', `[Arena Hub] อีก 1 ชั่วโมงถึงเวลาจอง #${b.code}`, layout(b, 'ใกล้ถึงเวลาแล้ว', '<p>อย่าลืมแสดง QR เช็คอินที่เคาน์เตอร์</p>', await getSettings())),
};
