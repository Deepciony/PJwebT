import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api, errorText, ok, type User, upload, useMe } from '../api';
import { Button, ErrorNote, Field, InfoChip, Input, Loading, PageHeader, Panel } from '../components/ui';
import { UserAvatar } from '../components/UserAvatar';
import { dateTh } from '../lib/format';
import { formData } from '../lib/pick';

export default function Profile() {
  const me = useMe().data;
  const qc = useQueryClient();
  const saved = (user: User) => qc.setQueryData(['me'], user);
  const save = useMutation({
    mutationFn: (body: { name: string; phone: string | null }) => ok(api.PATCH('/api/v1/users/me', { body })),
    onSuccess: (u) => {
      saved(u);
      toast.success('บันทึกข้อมูลแล้ว');
    },
  });
  const password = useMutation({
    mutationFn: (body: { currentPassword: string; newPassword: string }) => ok(api.PATCH('/api/v1/users/me', { body })),
    onSuccess: () => toast.success('เปลี่ยนรหัสผ่านแล้ว'),
  });
  const avatar = useMutation({
    mutationFn: (file: File) => upload<User>('/api/v1/users/me/avatar', file),
    onSuccess: (u) => {
      saved(u);
      toast.success('เปลี่ยนรูปโปรไฟล์แล้ว');
    },
    onError: (e) => toast.error(errorText(e)),
  });
  if (!me) return <Loading />;

  return (
    <div className="space-y-5">
      <PageHeader title="ข้อมูลส่วนตัว" sub="แก้ชื่อ เบอร์โทร รูปโปรไฟล์ และรหัสผ่านของคุณ" />
      <Panel className="flex flex-wrap items-center gap-5 p-5">
        <UserAvatar name={me.name} url={me.avatarUrl} alt="รูปโปรไฟล์" className="size-24 ring-4 ring-mark" fallbackClassName="text-4xl" />
        <div className="min-w-0 flex-1 space-y-2">
          <p className="font-display text-2xl font-extrabold uppercase">{me.name}</p>
          <div className="flex flex-wrap gap-2">
            <InfoChip label="อีเมล">{me.email}</InfoChip>
            <InfoChip label="โทร">{me.phone ?? '-'}</InfoChip>
            <InfoChip label="สมาชิกตั้งแต่">{dateTh(me.createdAt)}</InfoChip>
          </div>
        </div>
        <div className="w-full sm:w-72">
          <Field label="เปลี่ยนรูป" hint="JPG, PNG หรือ WEBP ไม่เกิน 5 MB">
            <Input type="file" accept="image/jpeg,image/png,image/webp,image/gif" disabled={avatar.isPending} onChange={(e) => e.target.files?.[0] && avatar.mutate(e.target.files[0])} />
          </Field>
        </div>
      </Panel>

      <div className="grid gap-6 lg:grid-cols-2">
      <Panel className="p-5">
        <h2 className="mb-4 text-lg">แก้ไขข้อมูล</h2>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            const f = formData(e);
            save.mutate({ name: String(f.get('name')), phone: String(f.get('phone')) || null });
          }}
        >
          <Field label="อีเมล" hint="เปลี่ยนอีเมลได้โดยติดต่อผู้ดูแลระบบ">
            <Input value={me.email} readOnly />
          </Field>
          <Field label="ชื่อ-นามสกุล">
            <Input name="name" defaultValue={me.name} required maxLength={100} />
          </Field>
          <Field label="เบอร์โทร" hint="ตัวเลข 9-10 หลัก ขึ้นต้นด้วย 0">
            <Input name="phone" defaultValue={me.phone ?? ''} inputMode="tel" pattern="0[0-9]{8,9}" />
          </Field>
          <ErrorNote error={save.error} />
          <div className="flex justify-end">
            <Button type="submit" variant="primary" pending={save.isPending}>
              บันทึกข้อมูล
            </Button>
          </div>
        </form>
      </Panel>

      <Panel className="p-5">
        <h2 className="mb-4 text-lg">เปลี่ยนรหัสผ่าน</h2>
        <form
          className="grid gap-4"
          onSubmit={(e) => {
            const f = formData(e);
            password.mutate(
              { currentPassword: String(f.get('current')), newPassword: String(f.get('next')) },
              { onSuccess: () => (e.target as HTMLFormElement).reset() },
            );
          }}
        >
          <Field label="รหัสผ่านปัจจุบัน">
            <Input name="current" type="password" required autoComplete="current-password" />
          </Field>
          <Field label="รหัสผ่านใหม่" hint="อย่างน้อย 8 ตัวอักษร">
            <Input name="next" type="password" required minLength={8} autoComplete="new-password" />
          </Field>
          <ErrorNote error={password.error} />
          <Button type="submit" pending={password.isPending} className="justify-self-end">
            เปลี่ยนรหัสผ่าน
          </Button>
        </form>
      </Panel>
      </div>
    </div>
  );
}
