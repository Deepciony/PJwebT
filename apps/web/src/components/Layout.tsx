import { useMutation, useQueryClient } from '@tanstack/react-query';
import { type ReactNode, useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router';
import { Toaster } from 'sonner';
import { api, ok, useMe, useSettings } from '../api';
import { useCart } from '../lib/cart';
import { ConfirmHost } from '../lib/confirm';
import { useInbox } from '../pages/Inbox';
import { UserAvatar } from './UserAvatar';
import { LinkButton } from './ui';

// Server-Sent Events: whenever any booking holds or frees a slot, refetch what shows availability.
// All tabs share one stream through a SharedWorker (see public/live-worker.js) so open tabs
// never use up the browser's 6 connections per host; without SharedWorker, one stream per tab.
function useLiveAvailability() {
  const qc = useQueryClient();
  useEffect(() => {
    const refresh = () => {
      for (const key of ['board', 'availability', 'equipment-stock', 'cart']) qc.invalidateQueries({ queryKey: [key] });
    };
    if (typeof SharedWorker === 'undefined') {
      const events = new EventSource('/api/v1/events/availability');
      events.addEventListener('availability', refresh);
      return () => events.close();
    }
    const { port } = new SharedWorker('/live-worker.js', { name: 'sporthub-live' });
    port.onmessage = refresh;
    port.start();
    const leave = () => port.postMessage('close');
    addEventListener('pagehide', leave);
    return () => {
      leave();
      removeEventListener('pagehide', leave);
      port.close();
    };
  }, [qc]);
}

const clockFmt = new Intl.DateTimeFormat('th-TH', { weekday: 'short', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false, timeZone: 'Asia/Bangkok' });

// Ticks on its own so the rest of the page never re-renders every second.
function Clock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return (
    <span className="num hidden h-9 items-center gap-1.5 rounded-lg bg-sunken px-3 text-sm sm:flex">
      <Icon className="text-muted">
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </Icon>
      {clockFmt.format(now)}
    </span>
  );
}

function greeting() {
  const h = Number(new Intl.DateTimeFormat('en-GB', { hour: 'numeric', hourCycle: 'h23', timeZone: 'Asia/Bangkok' }).format(new Date()));
  return h < 5 || h >= 18 ? '☾ สวัสดีตอนเย็น : ' : h < 12 ? '☀ สวัสดีตอนเช้า : ' : '☀ สวัสดีตอนบ่าย : ';
}

function Icon({ className = '', children }: { className?: string; children: ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`size-4 shrink-0 ${className}`} aria-hidden>
      {children}
    </svg>
  );
}

// The round badge in the middle of the menu: a court inside a ring, with a slowly turning gold arc.
export function Emblem({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden>
      <circle cx="32" cy="32" r="30.5" fill="none" stroke="var(--line-hi)" strokeWidth="1.2" strokeDasharray="0.8 3" />
      <circle cx="32" cy="32" r="25" fill="var(--sunken)" stroke="var(--line-hi)" strokeWidth="2.5" />
      <path d="M32 7a25 25 0 0 1 25 25" fill="none" stroke="var(--mark)" strokeWidth="3" strokeLinecap="round" className="origin-[32px_32px] motion-safe:animate-[spin_14s_linear_infinite]" />
      <g fill="none" stroke="#fff" strokeWidth="2">
        <rect x="19" y="23" width="26" height="18" rx="1.5" />
        <circle cx="32" cy="32" r="4" />
      </g>
      <path d="M32 21v22" stroke="var(--mark)" strokeWidth="2.5" />
    </svg>
  );
}

// Menu items are game buttons: dark with a lavender rim and a pressed bottom edge; the open page glows gold.
const navClass = ({ isActive }: { isActive: boolean }) =>
  `inline-flex h-10 shrink-0 items-center gap-2 rounded-xl border-2 px-4 text-sm font-semibold whitespace-nowrap shadow-[inset_0_-3px_0_rgb(0_0_0/0.25)] transition hover:-translate-y-0.5 active:translate-y-0 ${
    isActive
      ? 'border-mark bg-linear-to-b from-mark-hi to-mark text-mark-ink shadow-[inset_0_-3px_0_rgb(0_0_0/0.22),0_0_16px_rgb(245_197_66/0.4)]'
      : 'border-line bg-sunken text-ink/85 hover:border-line-hi hover:text-ink'
  }`;

const navIcons: Record<string, ReactNode> = {
  '/': <path d="M3 11.5 12 4l9 7.5M5.5 9.5V20h5v-6h3v6h5V9.5" />,
  '/book': (
    <>
      <rect x="3" y="4.5" width="18" height="16" rx="2" />
      <path d="M3 9.5h18M8 2.5v4M16 2.5v4M8 14h2M14 14h2" />
    </>
  ),
  '/courts': (
    <>
      <rect x="3" y="5" width="18" height="14" rx="1.5" />
      <path d="M12 5v14" />
      <circle cx="12" cy="12" r="2.5" />
    </>
  ),
  '/equipment': (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M5.6 5.6c3.5 3.5 3.5 9.3 0 12.8M18.4 5.6c-3.5 3.5-3.5 9.3 0 12.8" />
    </>
  ),
  '/bookings': (
    <>
      <path d="M4 7h16v3a2 2 0 0 0 0 4v3H4v-3a2 2 0 0 0 0-4z" />
      <path d="M14 7v10" strokeDasharray="2 2" />
    </>
  ),
  '/admin': <path d="M12 3l8 3v6c0 4.5-3.4 8-8 9-4.6-1-8-4.5-8-9V6z" />,
};

const iconLink = 'relative grid size-9 shrink-0 place-items-center rounded-lg border-2 border-line bg-sunken text-ink transition hover:border-line-hi';
const countBadge = 'num absolute -top-2 -right-2 grid min-w-5 place-items-center rounded-full px-1 text-xs font-bold';

export function Layout() {
  useLiveAvailability();
  const me = useMe().data;
  const cart = useCart(Boolean(me)).data;
  const count = (cart?.slots.length ?? 0) + (cart?.equipment.length ?? 0);
  const unread = useInbox(Boolean(me)).data?.unread ?? 0;
  const settings = useSettings().data;
  const qc = useQueryClient();
  const navigate = useNavigate();
  const logout = useMutation({
    mutationFn: () => ok(api.POST('/api/v1/auth/logout')),
    onSuccess: () => {
      qc.clear();
      navigate('/');
    },
  });
  const links: [string, string][] = [
    ['/', 'หน้าแรก'],
    ['/book', 'ตารางว่าง'],
    ['/courts', 'สนาม'],
    ['/equipment', 'ยืมอุปกรณ์'],
    ...(me ? ([['/bookings', 'การจองของฉัน']] as [string, string][]) : []),
    ...(me?.role === 'admin' ? ([['/admin', 'ผู้ดูแลระบบ']] as [string, string][]) : []),
  ];
  const navLinks = (list: [string, string][]) =>
    list.map(([to, label]) => (
      <NavLink key={to} to={to} end={to === '/'} className={navClass}>
        <Icon>{navIcons[to]}</Icon>
        {label}
      </NavLink>
    ));

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-30 px-3 pt-3 sm:px-4">
        <div className="frame rounded-2xl px-3 py-2 sm:px-4">
          <div className="flex items-center gap-3">
            {/* left: emblem, name and the menu buttons; right: clock and account */}
            <Link to="/" className="shrink-0" aria-label="หน้าแรก">
              <img src="/logo.svg" alt="" className="size-11 drop-shadow-[0_0_10px_rgb(124_92_230/0.6)] lg:size-12" />
            </Link>
            <div className="min-w-0 shrink-0 leading-tight">
              <Link to="/" className="font-display text-xl font-extrabold tracking-wide uppercase">
                Arena Hub
              </Link>
              <p className="truncate text-xs text-muted">
                {greeting()}
                {me && <span className="font-semibold text-ink uppercase">, {me.name}</span>}
              </p>
            </div>
            <nav className="ml-4 hidden items-center gap-2 xl:flex" aria-label="เมนูหลัก">
              {navLinks(links)}
            </nav>
            <div className="ml-auto flex items-center gap-2">
              <Clock />
              {me && (
                <Link to="/inbox" className={iconLink} aria-label={`กล่องข้อความ ยังไม่อ่าน ${unread} ฉบับ`} title="กล่องข้อความ">
                  <Icon>
                    <rect x="3" y="5" width="18" height="14" rx="2" />
                    <path d="m3 7 9 6 9-6" />
                  </Icon>
                  {unread > 0 && <span className={`${countBadge} bg-danger-strong text-white`}>{unread}</span>}
                </Link>
              )}
              {me && (
                <Link to="/cart" className={iconLink} aria-label={`ตะกร้า ${count} รายการ`} title="ตะกร้า">
                  <Icon>
                    <path d="M3 4h2l2.4 10.2a2 2 0 0 0 2 1.6h7.7a2 2 0 0 0 1.9-1.4L21 8H6.2" />
                    <circle cx="10" cy="20" r="1.3" />
                    <circle cx="17" cy="20" r="1.3" />
                  </Icon>
                  {count > 0 && <span className={`${countBadge} bg-mark text-mark-ink`}>{count}</span>}
                </Link>
              )}
              {me ? (
                <details className="relative">
                  <summary className="flex cursor-pointer list-none items-center rounded-full" aria-label="เมนูบัญชี">
                    <UserAvatar name={me.name} url={me.avatarUrl} className="size-9 ring-2 ring-mark" fallbackClassName="text-sm" />
                  </summary>
                  <div className="absolute right-0 mt-3 w-52 rounded-xl border-2 border-line-hi bg-panel p-1.5 shadow-[0_0_0_3px_var(--frame),0_12px_30px_rgb(0_0_0/0.5)]">
                    <p className="truncate px-3 pt-1 pb-2 text-sm font-semibold uppercase">{me.name}</p>
                    <Link to="/profile" className="block rounded-lg px-3 py-2 text-sm hover:bg-sunken">
                      ข้อมูลส่วนตัว
                    </Link>
                    <Link to="/bookings" className="block rounded-lg px-3 py-2 text-sm hover:bg-sunken">
                      การจองของฉัน
                    </Link>
                    <Link to="/inbox" className="block rounded-lg px-3 py-2 text-sm hover:bg-sunken">
                      กล่องข้อความ
                    </Link>
                    <button type="button" onClick={() => logout.mutate()} className="block w-full rounded-lg px-3 py-2 text-left text-sm text-danger hover:bg-danger-soft">
                      ออกจากระบบ
                    </button>
                  </div>
                </details>
              ) : (
                <LinkButton to="/login" variant="primary" className="h-9 px-4 text-sm">
                  เข้าสู่ระบบ
                </LinkButton>
              )}
            </div>
          </div>
          <nav className="-mx-1 mt-2 flex gap-2 overflow-x-auto px-1 pt-1 pb-1.5 xl:hidden" aria-label="เมนูหลัก">
            {navLinks(links)}
          </nav>
        </div>
      </header>
      <main className="flex w-full flex-1 flex-col px-3 py-5 sm:px-4">
        {settings?.announcement && (
          <p role="status" className="mb-4 flex items-center gap-3 rounded-xl border-2 border-line bg-panel/90 px-3 py-2 text-sm">
            <span className="grid size-8 shrink-0 place-items-center rounded-full bg-violet text-white ring-2 ring-mark">
              <Icon>
                <path d="M3 11v2a1 1 0 0 0 1 1h3l6 4V6L7 10H4a1 1 0 0 0-1 1z" />
                <path d="M17 9a4 4 0 0 1 0 6" />
              </Icon>
            </span>
            <span className="whitespace-pre-line">
              <b className="text-mark">ประกาศ: </b>
              {settings.announcement}
            </span>
          </p>
        )}
        <div className="frame flex flex-1 flex-col p-5 sm:p-8 xl:p-10">
          <Outlet />
        </div>
      </main>
      <footer className="flex w-full flex-wrap items-center gap-x-6 gap-y-2 px-4 pb-6 text-sm text-muted sm:px-5">
        <span>Arena Hub ระบบจองสนามกีฬาและยืมอุปกรณ์</span>
        {settings?.contactPhone && (
          <a href={`tel:${settings.contactPhone}`} className="num hover:text-ink">
            โทร {settings.contactPhone}
          </a>
        )}
        {settings?.contactLine && <span>LINE {settings.contactLine}</span>}
        {settings?.address && <span>{settings.address}</span>}
        <Link to="/about" className="hover:text-ink">
          ข้อมูลระบบ
        </Link>
        <a href="/docs" className="hover:text-ink">
          เอกสาร API
        </a>
      </footer>
      <Toaster position="bottom-center" theme="dark" richColors closeButton />
      <ConfirmHost />
    </div>
  );
}
