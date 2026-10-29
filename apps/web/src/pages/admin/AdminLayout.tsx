import { useQuery } from '@tanstack/react-query';
import { Suspense } from 'react';
import { NavLink, Outlet } from 'react-router';
import { api, ok } from '../../api';
import { Loading } from '../../components/ui';

// same game buttons as the main menu, one size smaller
const tab = ({ isActive }: { isActive: boolean }) =>
  `inline-flex h-9 shrink-0 items-center gap-2 rounded-lg border-2 px-3.5 text-sm font-semibold whitespace-nowrap shadow-[inset_0_-3px_0_rgb(0_0_0/0.25)] transition hover:-translate-y-0.5 ${
    isActive ? 'border-mark bg-linear-to-b from-mark-hi to-mark text-mark-ink' : 'border-line bg-sunken text-ink/85 hover:border-line-hi hover:text-ink'
  }`;

export default function AdminLayout() {
  const pending = useQuery({
    queryKey: ['payments', 'pending'],
    queryFn: () => ok(api.GET('/api/v1/payments', { params: { query: { status: 'pending' } } })),
    refetchInterval: 30_000,
  });
  const waiting = pending.data?.length ?? 0;
  return (
    <div className="space-y-6">
      <nav className="-mx-1 flex gap-2 overflow-x-auto border-b border-line px-1 pt-1 pb-4" aria-label="เมนูผู้ดูแลระบบ">
        <NavLink to="/admin" end className={tab}>
          ภาพรวม
        </NavLink>
        <NavLink to="/admin/payments" className={tab}>
          ตรวจสลิป
          {waiting > 0 && <span className="num grid min-w-5 place-items-center rounded-full bg-danger-strong px-1.5 text-xs font-bold text-white">{waiting}</span>}
        </NavLink>
        <NavLink to="/admin/checkin" className={tab}>
          เช็คอิน
        </NavLink>
        <NavLink to="/admin/bookings" className={tab}>
          การจองทั้งหมด
        </NavLink>
        <NavLink to="/admin/catalog" className={tab}>
          จัดการข้อมูล
        </NavLink>
        <NavLink to="/admin/coupons" className={tab}>
          คูปอง
        </NavLink>
        <NavLink to="/admin/users" className={tab}>
          สมาชิก
        </NavLink>
        <NavLink to="/admin/emails" className={tab}>
          อีเมล
        </NavLink>
        <NavLink to="/admin/system" className={tab}>
          ระบบ
        </NavLink>
        <NavLink to="/admin/api" className={tab}>
          API
        </NavLink>
        <NavLink to="/admin/terminal" className={tab}>
          Terminal
        </NavLink>
        <NavLink to="/admin/about" className={tab}>
          ข้อมูลระบบ
        </NavLink>
        {/* a plain link: the login cookie goes along, and the API answers with the file as an attachment */}
        <a href="/api/v1/admin/manual" download className={`${tab({ isActive: false })} ml-auto`}>
          <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M12 4v11m-5-5 5 5 5-5M5 20h14" />
          </svg>
          คู่มือ PDF
        </a>
      </nav>
      <Suspense fallback={<Loading />}>
        <Outlet />
      </Suspense>
    </div>
  );
}
