import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, Navigate, Outlet, useLocation, useNavigate, useSearchParams } from 'react-router';
import { api, type User, ok, useMe } from '../api';
import { Button, ErrorNote, Field, Input, Loading, Panel } from '../components/ui';
import { formData } from '../lib/pick';

function useSignedIn() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const next = useSearchParams()[0].get('next');
  return (user: User) => {
    qc.setQueryData(['me'], user);
    qc.invalidateQueries({ queryKey: ['cart'] });
    // only same-site paths, never an absolute URL from the query string
    navigate(next?.startsWith('/') && !next.startsWith('//') ? next : user.role === 'admin' ? '/admin' : '/');
  };
}

function AuthShell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="grid flex-1 overflow-hidden rounded-xl border-2 border-line bg-surface md:grid-cols-[minmax(0,1fr)_30rem]">
      <div className="relative hidden bg-linear-to-br from-violet to-panel md:block" aria-hidden>
        <svg viewBox="0 0 200 300" className="absolute inset-0 size-full" preserveAspectRatio="xMidYMid meet">
          <g fill="none" stroke="white" strokeOpacity="0.6" strokeWidth="2">
            <rect x="20" y="20" width="160" height="260" />
            <path d="M20 150h160" stroke="#f5c542" strokeOpacity="1" strokeWidth="3" />
            <circle cx="100" cy="150" r="28" />
            <rect x="60" y="20" width="80" height="40" />
            <rect x="60" y="240" width="80" height="40" />
          </g>
        </svg>
      </div>
      <div className="space-y-6 self-center p-8 sm:p-10">
        <h1 className="text-2xl sm:text-3xl">{title}</h1>
        {children}
      </div>
    </div>
  );
}

export function Login() {
  const done = useSignedIn();
  const login = useMutation({
    mutationFn: (body: { email: string; password: string }) => ok(api.POST('/api/v1/auth/login', { body })),
    onSuccess: (r) => done(r.user),
  });
  const next = useSearchParams()[0].get('next');
  return (
    <AuthShell title="เข้าสู่ระบบ">
      <form
        className="space-y-4"
        onSubmit={(e) => {
          const f = formData(e);
          login.mutate({ email: String(f.get('email')), password: String(f.get('password')) });
        }}
      >
        <Field label="อีเมล">
          <Input name="email" type="email" required autoComplete="email" autoFocus />
        </Field>
        <Field label="รหัสผ่าน">
          <Input name="password" type="password" required autoComplete="current-password" />
        </Field>
        <ErrorNote error={login.error} />
        <Button type="submit" variant="primary" size="lg" className="w-full" pending={login.isPending}>
          เข้าสู่ระบบ
        </Button>
      </form>
      <p className="text-muted">
        ยังไม่มีบัญชี?{' '}
        <Link to={`/register${next ? `?next=${encodeURIComponent(next)}` : ''}`} className="font-medium text-ink underline">
          สมัครสมาชิก
        </Link>
      </p>
      <p className="rounded-lg bg-sunken px-3 py-2 text-sm text-muted">
        บัญชีทดลอง: member@sporthub.local / member1234
        {/* a production admin has its own ADMIN_PASSWORD, so the demo one is only shown by the dev server */}
        {import.meta.env.DEV && ' หรือ admin@sporthub.local / admin1234'}
      </p>
    </AuthShell>
  );
}

export function Register() {
  const done = useSignedIn();
  const register = useMutation({
    mutationFn: (body: { email: string; password: string; name: string; phone?: string }) => ok(api.POST('/api/v1/auth/register', { body })),
    onSuccess: (r) => done(r.user),
  });
  return (
    <AuthShell title="สมัครสมาชิก">
      <form
        className="space-y-4"
        onSubmit={(e) => {
          const f = formData(e);
          register.mutate({
            name: String(f.get('name')),
            email: String(f.get('email')),
            password: String(f.get('password')),
            phone: String(f.get('phone')) || undefined,
          });
        }}
      >
        <Field label="ชื่อ-นามสกุล">
          <Input name="name" required maxLength={100} autoComplete="name" autoFocus />
        </Field>
        <Field label="อีเมล">
          <Input name="email" type="email" required autoComplete="email" />
        </Field>
        <Field label="เบอร์โทร" hint="ไม่บังคับ">
          <Input name="phone" inputMode="tel" pattern="0[0-9]{8,9}" autoComplete="tel" />
        </Field>
        <Field label="รหัสผ่าน" hint="อย่างน้อย 8 ตัวอักษร">
          <Input name="password" type="password" required minLength={8} autoComplete="new-password" />
        </Field>
        <ErrorNote error={register.error} />
        <Button type="submit" variant="primary" size="lg" className="w-full" pending={register.isPending}>
          สมัครสมาชิก
        </Button>
      </form>
      <p className="text-muted">
        มีบัญชีแล้ว?{' '}
        <Link to="/login" className="font-medium text-ink underline">
          เข้าสู่ระบบ
        </Link>
      </p>
    </AuthShell>
  );
}

export function RequireAuth({ admin = false }: { admin?: boolean }) {
  const me = useMe();
  const location = useLocation();
  if (me.isPending) return <Loading />;
  if (!me.data) return <Navigate to={`/login?next=${encodeURIComponent(location.pathname + location.search)}`} replace />;
  if (admin && me.data.role !== 'admin') return <Navigate to="/" replace />;
  return <Outlet />;
}

export function NotFound() {
  return (
    <Panel className="mx-auto max-w-lg p-10 text-center">
      <h1 className="text-2xl sm:text-3xl">ไม่พบหน้านี้</h1>
      <p className="mt-2 text-muted">ลิงก์อาจผิดหรือหน้านี้ถูกย้ายไปแล้ว</p>
      <Link to="/" className="mt-6 inline-block font-medium underline">
        กลับไปหน้าตารางสนามว่าง
      </Link>
    </Panel>
  );
}
