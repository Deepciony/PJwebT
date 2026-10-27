import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router';
import { toast } from 'sonner';
import { api, errorText, ok, useMe } from '../../api';
import { Badge, Button, Empty, ErrorNote, Field, InfoChip, Input, Loading, Modal, PageHeader, Panel, Select, StatBox } from '../../components/ui';
import { baht, dateTh } from '../../lib/format';
import { formData } from '../../lib/pick';
import { BookingTable } from '../Bookings';

export default function Users() {
  const [params, setParams] = useSearchParams();
  const q = params.get('q') ?? '';
  const role = (params.get('role') as 'member' | 'admin' | null) ?? undefined;
  const [creating, setCreating] = useState(false);
  const me = useMe().data;
  const qc = useQueryClient();
  const users = useQuery({
    queryKey: ['users', q, role],
    queryFn: () => ok(api.GET('/api/v1/users', { params: { query: { q: q || undefined, role } } })),
  });
  const done = (message: string) => () => {
    toast.success(message);
    qc.invalidateQueries({ queryKey: ['users'] });
  };
  const setStatus = useMutation({
    mutationFn: ({ id, status }: { id: number; status: 'active' | 'suspended' }) =>
      ok(api.PATCH('/api/v1/users/{id}/status', { params: { path: { id } }, body: { status } })),
    onSuccess: done('เปลี่ยนสถานะแล้ว'),
    onError: (e) => toast.error(errorText(e)),
  });
  const setRole = useMutation({
    mutationFn: ({ id, role }: { id: number; role: 'member' | 'admin' }) => ok(api.PATCH('/api/v1/users/{id}/role', { params: { path: { id } }, body: { role } })),
    onSuccess: done('เปลี่ยนสิทธิ์แล้ว'),
    onError: (e) => toast.error(errorText(e)),
  });
  const create = useMutation({
    mutationFn: (body: { email: string; password: string; name: string; phone?: string; role: 'member' | 'admin' }) => ok(api.POST('/api/v1/users', { body })),
    onSuccess: () => {
      setCreating(false);
      done('เพิ่มผู้ใช้แล้ว')();
    },
  });
  const set = (key: string, value?: string) =>
    setParams((p) => {
      if (value) p.set(key, value);
      else p.delete(key);
      return p;
    });

  return (
    <div className="space-y-5">
      <PageHeader title="สมาชิก" sub="ค้นหา ระงับหรือเปิดใช้งาน ตั้งสิทธิ์แอดมิน และกดชื่อเพื่อดูประวัติการจองของแต่ละคน">
        <Button variant="primary" onClick={() => setCreating(true)}>
          เพิ่มผู้ใช้
        </Button>
      </PageHeader>
      <div className="flex flex-wrap gap-3">
        <Input type="search" placeholder="ค้นหาชื่อหรืออีเมล" defaultValue={q} onChange={(e) => set('q', e.target.value)} className="max-w-xs" aria-label="ค้นหาชื่อหรืออีเมล" />
        <Select value={role ?? ''} onChange={(e) => set('role', e.target.value)} className="max-w-48" aria-label="กรองตามสิทธิ์">
          <option value="">ทุกสิทธิ์</option>
          <option value="member">สมาชิก</option>
          <option value="admin">ผู้ดูแลระบบ</option>
        </Select>
      </div>
      {users.isPending ? (
        <Loading />
      ) : users.error ? (
        <ErrorNote error={users.error} />
      ) : users.data.length === 0 ? (
        <Empty title="ไม่พบผู้ใช้" />
      ) : (
        <div className="overflow-x-auto rounded-xl border-2 border-line bg-surface">
          <table className="w-full min-w-[44rem] text-left">
            <thead className="text-sm text-muted">
              <tr className="border-b border-line">
                <th className="px-4 py-3 font-medium">ชื่อ</th>
                <th className="px-4 py-3 font-medium">เบอร์โทร</th>
                <th className="px-4 py-3 font-medium">สิทธิ์</th>
                <th className="px-4 py-3 font-medium">สถานะ</th>
                <th className="px-4 py-3 font-medium">สมัครเมื่อ</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {users.data.map((u) => {
                const self = u.id === me?.id;
                return (
                  <tr key={u.id} className="border-b border-line last:border-0">
                    <td className="px-4 py-3">
                      <Link to={`/admin/users/${u.id}`} className="font-medium hover:underline">
                        {u.name}
                      </Link>
                      <span className="block text-sm text-muted">{u.email}</span>
                    </td>
                    <td className="num px-4 py-3 text-sm">{u.phone ?? '-'}</td>
                    <td className="px-4 py-3">
                      <Badge tone={u.role === 'admin' ? 'info' : 'muted'}>{u.role === 'admin' ? 'ผู้ดูแลระบบ' : 'สมาชิก'}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      <Badge tone={u.status === 'active' ? 'turf' : 'danger'}>{u.status === 'active' ? 'ใช้งานได้' : 'ถูกระงับ'}</Badge>
                    </td>
                    <td className="px-4 py-3 text-sm text-muted">{dateTh(u.createdAt)}</td>
                    <td className="px-4 py-3">
                      {!self && (
                        <div className="flex justify-end gap-1">
                          <Button size="sm" variant="quiet" onClick={() => setStatus.mutate({ id: u.id, status: u.status === 'active' ? 'suspended' : 'active' })}>
                            {u.status === 'active' ? 'ระงับ' : 'เปิดใช้งาน'}
                          </Button>
                          <Button size="sm" variant="quiet" onClick={() => setRole.mutate({ id: u.id, role: u.role === 'admin' ? 'member' : 'admin' })}>
                            {u.role === 'admin' ? 'ปลดจากแอดมิน' : 'ตั้งเป็นแอดมิน'}
                          </Button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <Modal open={creating} onClose={() => setCreating(false)} title="เพิ่มผู้ใช้">
        <form
          className="space-y-4"
          onSubmit={(e) => {
            const f = formData(e);
            create.mutate({
              name: String(f.get('name')),
              email: String(f.get('email')),
              password: String(f.get('password')),
              phone: String(f.get('phone')) || undefined,
              role: f.get('role') === 'admin' ? 'admin' : 'member',
            });
          }}
        >
          <Field label="ชื่อ-นามสกุล">
            <Input name="name" required />
          </Field>
          <Field label="อีเมล">
            <Input name="email" type="email" required />
          </Field>
          <Field label="เบอร์โทร">
            <Input name="phone" pattern="0[0-9]{8,9}" />
          </Field>
          <Field label="รหัสผ่านเริ่มต้น" hint="อย่างน้อย 8 ตัวอักษร">
            <Input name="password" type="password" required minLength={8} />
          </Field>
          <Field label="สิทธิ์">
            <Select name="role" defaultValue="admin">
              <option value="admin">ผู้ดูแลระบบ</option>
              <option value="member">สมาชิก</option>
            </Select>
          </Field>
          <ErrorNote error={create.error} />
          <div className="flex justify-end">
            <Button type="submit" variant="primary" pending={create.isPending}>
              เพิ่มผู้ใช้
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

export function UserDetail() {
  const id = Number(useParams().id);
  const qc = useQueryClient();
  const [open, setOpen] = useState<'edit' | 'password' | null>(null);
  const user = useQuery({ queryKey: ['user', id], queryFn: () => ok(api.GET('/api/v1/users/{id}', { params: { path: { id } } })) });
  const bookings = useQuery({ queryKey: ['bookings', 'user', id], queryFn: () => ok(api.GET('/api/v1/bookings', { params: { query: { userId: id } } })) });
  const edit = useMutation({
    mutationFn: (body: { name: string; email: string; phone: string | null }) => ok(api.PATCH('/api/v1/users/{id}', { params: { path: { id } }, body })),
    onSuccess: () => {
      toast.success('บันทึกข้อมูลแล้ว');
      setOpen(null);
      qc.invalidateQueries({ queryKey: ['user', id] });
      qc.invalidateQueries({ queryKey: ['users'] });
    },
  });
  const password = useMutation({
    mutationFn: (password: string) => ok(api.POST('/api/v1/users/{id}/password', { params: { path: { id } }, body: { password } })),
    onSuccess: () => {
      toast.success('ตั้งรหัสผ่านใหม่แล้ว แจ้งรหัสให้สมาชิกทราบ');
      setOpen(null);
    },
  });
  if (user.isPending) return <Loading />;
  if (user.error) return <ErrorNote error={user.error} />;
  const u = user.data;
  return (
    <div className="space-y-5">
      <Link to="/admin/users" className="group inline-flex items-center gap-2 rounded-full border-2 border-line bg-sunken py-1 pr-4 pl-1 text-sm font-semibold transition hover:-translate-y-0.5 hover:border-line-hi">
        <span className="grid size-6 place-items-center rounded-full bg-violet text-white transition group-hover:-translate-x-0.5" aria-hidden>←</span>
        สมาชิกทั้งหมด
      </Link>
      <Panel className="flex flex-wrap items-center gap-5 p-5">
        {u.avatarUrl ? (
          <img src={u.avatarUrl} alt="" className="size-20 rounded-full object-cover ring-4 ring-mark" />
        ) : (
          <span className="grid size-20 place-items-center rounded-full bg-violet font-display text-3xl font-bold text-white ring-4 ring-mark">{u.name.slice(0, 1)}</span>
        )}
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl">{u.name}</h1>
          <div className="mt-2 flex flex-wrap gap-2">
            <InfoChip label="อีเมล">{u.email}</InfoChip>
            <InfoChip label="โทร">{u.phone ?? '-'}</InfoChip>
          </div>
          <div className="mt-2 flex gap-1">
            <Button size="sm" variant="quiet" onClick={() => setOpen('edit')}>
              แก้ไขข้อมูล
            </Button>
            <Button size="sm" variant="quiet" onClick={() => setOpen('password')}>
              ตั้งรหัสผ่านใหม่
            </Button>
          </div>
        </div>
        <div className="flex gap-3">
          <StatBox label="การจอง" value={u.bookingCount} unit="ครั้ง" />
          <StatBox label="ยอดใช้จ่าย" value={u.totalSpent.toLocaleString('th-TH')} unit="บาท" />
        </div>
      </Panel>
      <h2 className="text-lg">ประวัติการจอง</h2>
      {bookings.data?.length ? <BookingTable rows={bookings.data} /> : <Empty title="ยังไม่มีการจอง" />}
      <Modal open={open === 'edit'} onClose={() => setOpen(null)} title={`แก้ไขข้อมูล ${u.name}`}>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            const f = formData(e);
            edit.mutate({ name: String(f.get('name')), email: String(f.get('email')), phone: String(f.get('phone')) || null });
          }}
        >
          <Field label="ชื่อ-นามสกุล">
            <Input name="name" required defaultValue={u.name} />
          </Field>
          <Field label="อีเมล">
            <Input name="email" type="email" required defaultValue={u.email} />
          </Field>
          <Field label="เบอร์โทร" hint="เว้นว่าง = ลบเบอร์">
            <Input name="phone" pattern="0[0-9]{8,9}" defaultValue={u.phone ?? ''} />
          </Field>
          <ErrorNote error={edit.error} />
          <div className="flex justify-end">
            <Button type="submit" variant="primary" pending={edit.isPending}>
              บันทึก
            </Button>
          </div>
        </form>
      </Modal>
      <Modal open={open === 'password'} onClose={() => setOpen(null)} title={`ตั้งรหัสผ่านใหม่ให้ ${u.name}`}>
        <form className="space-y-4" onSubmit={(e) => password.mutate(String(formData(e).get('password')))}>
          <Field label="รหัสผ่านใหม่" hint="อย่างน้อย 8 ตัวอักษร">
            <Input name="password" type="text" required minLength={8} autoComplete="off" />
          </Field>
          <ErrorNote error={password.error} />
          <div className="flex justify-end">
            <Button type="submit" variant="primary" pending={password.isPending}>
              ตั้งรหัสผ่าน
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
