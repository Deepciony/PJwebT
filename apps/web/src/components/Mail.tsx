import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { api, type EmailSummary, ok } from '../api';
import { dateTimeTh } from '../lib/format';
import { Badge, Empty, ErrorNote, Loading, Panel } from './ui';

export const mailKind: Record<EmailSummary['kind'], string> = {
  confirmed: 'ยืนยันการจอง',
  approved: 'ชำระเงินสำเร็จ',
  rejected: 'สลิปไม่ผ่าน',
  cancelled: 'ยกเลิกการจอง',
  reminder: 'เตือนก่อนเวลา',
  fine: 'ค่าปรับ',
  checkout: 'เช็คเอาท์',
};

export const mailStatus: Record<EmailSummary['status'], { label: string; tone: 'muted' | 'turf' | 'danger' }> = {
  web: { label: 'ในเว็บ', tone: 'muted' },
  sent: { label: 'ส่งออกแล้ว', tone: 'turf' },
  failed: { label: 'ส่งออกไม่สำเร็จ', tone: 'danger' },
};

export function MailList({
  items,
  selected,
  onSelect,
  showRecipient,
}: {
  items: EmailSummary[];
  selected: number | null;
  onSelect: (id: number) => void;
  showRecipient?: boolean;
}) {
  if (items.length === 0) return <Empty title="ยังไม่มีอีเมล">อีเมลแจ้งการจอง การชำระเงิน และการเตือนจะมาอยู่ที่นี่</Empty>;
  return (
    <ul className="divide-y divide-line overflow-hidden rounded-xl border-2 border-line bg-surface">
      {items.map((m) => {
        const unread = !showRecipient && !m.readAt;
        return (
          <li key={m.id}>
            <button
              type="button"
              onClick={() => onSelect(m.id)}
              aria-current={selected === m.id}
              className={`block w-full px-4 py-3 text-left transition hover:bg-sunken ${selected === m.id ? 'bg-sunken' : ''}`}
            >
              <span className="flex items-center justify-between gap-2 text-xs text-muted">
                <span>{showRecipient ? (m.userName ?? m.toAddress) : mailKind[m.kind]}</span>
                <span>{dateTimeTh(m.createdAt)}</span>
              </span>
              <span className={`mt-0.5 flex items-center gap-2 ${unread ? 'font-semibold' : ''}`}>
                {unread && <span className="size-2 shrink-0 rounded-full bg-mark" aria-label="ยังไม่อ่าน" />}
                <span className="line-clamp-2">{m.subject}</span>
              </span>
              {showRecipient && (
                <span className="mt-1 flex flex-wrap gap-1.5">
                  <Badge tone="muted">{mailKind[m.kind]}</Badge>
                  <Badge tone={mailStatus[m.status].tone}>{mailStatus[m.status].label}</Badge>
                </span>
              )}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

// Restyles the stored email in the site theme when shown on the web. Emails keep their light, inline-styled
// HTML for real mail clients (SMTP); only this view changes, so old and new emails look the same here.
const mailTheme = `<style>
html{scrollbar-width:none}::-webkit-scrollbar{display:none}
body{margin:0;padding:20px 24px;background:#18121f;color:#fff;line-height:1.65}
body,body *{font-family:Kanit,Prompt,sans-serif!important}
body>div{max-width:none!important}
h2{margin:0 0 12px;color:#f5c542!important;font-size:22px;text-transform:uppercase}
a{display:inline-block;padding:8px 18px;border-radius:8px;background:linear-gradient(#ffd975,#f5c542);color:#2b1d05;font-weight:600;text-decoration:none;box-shadow:inset 0 -3px 0 rgb(0 0 0/.22)}a:hover{filter:brightness(1.05)}
ul{margin:12px 0;padding:12px 12px 12px 32px;border:2px solid #7a68cc;border-radius:12px;background:#463774}
li{margin:4px 0}
p[style*="color"]{margin-top:20px;padding-top:12px;border-top:1px solid #7a68cc;color:#bdb3dc!important}
img{padding:8px;border-radius:12px;background:#fff}
</style><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Kanit:wght@400;600;700&display=swap">`;

// A stored email links to its booking with the absolute APP_URL of the day it was sent, which may be another
// host or port than this page (dev ports move). Here those links open the booking in this app, same tab.
const inApp = (html: string) => html.replace(/href="[^"]*?(\/bookings\/\d+)"/g, 'href="$1" target="_top"');

// Opens one email. The HTML renders in a sandboxed frame (no scripts); other links open in a new tab.
export function MailReader({ id, actions }: { id: number | null; actions?: (mail: { id: number; status: string }) => ReactNode }) {
  const qc = useQueryClient();
  const mail = useQuery({
    queryKey: ['email', id],
    queryFn: async () => {
      const m = await ok(api.GET('/api/v1/emails/{id}', { params: { path: { id: id! } } }));
      qc.invalidateQueries({ queryKey: ['inbox'] }); // opening may have marked it read
      return m;
    },
    enabled: id !== null,
  });
  if (id === null) return <Panel className="grid min-h-80 place-items-center p-6 text-muted">เลือกอีเมลทางซ้ายเพื่ออ่าน</Panel>;
  if (mail.isPending) return <Loading />;
  if (mail.error) return <ErrorNote error={mail.error} />;
  const m = mail.data;
  return (
    <Panel className="overflow-hidden">
      <div className="space-y-1 border-b border-line p-5">
        <h2 className="text-lg font-semibold">{m.subject}</h2>
        <p className="text-sm text-muted">
          ถึง {m.userName ? `${m.userName} <${m.toAddress}>` : m.toAddress} เมื่อ {dateTimeTh(m.createdAt)}
        </p>
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <Badge tone="muted">{mailKind[m.kind]}</Badge>
          <Badge tone={mailStatus[m.status].tone}>{mailStatus[m.status].label}</Badge>
          {m.bookingId && (
            <Link to={`/bookings/${m.bookingId}`} className="text-sm text-info hover:underline">
              เปิดการจอง #{m.bookingCode}
            </Link>
          )}
          {actions?.(m)}
        </div>
        {m.error && <p className="text-sm text-danger">{m.error}</p>}
      </div>
      <iframe
        title={m.subject}
        sandbox="allow-popups allow-popups-to-escape-sandbox allow-top-navigation-by-user-activation"
        srcDoc={`<base target="_blank">${mailTheme}${inApp(m.html)}`}
        className="h-[32rem] w-full bg-sunken"
      />
    </Panel>
  );
}
