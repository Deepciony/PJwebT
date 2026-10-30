import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router';
import { toast } from 'sonner';
import { api, type Body, errorText, ok } from '../../api';
import type { components } from '../../api-types';
import { Badge, Button, Empty, ErrorNote, Field, Input, Loading, Modal, PageHeader, Progress, Select, StatBox } from '../../components/ui';
import { confirm } from '../../lib/confirm';
import { baht, bangkokDate, bookingStatus, dateTh, dateTimeTh } from '../../lib/format';
import { formData } from '../../lib/pick';

type Coupon = components['schemas']['Coupon'];
type CouponValues = Omit<Body<'/api/v1/coupons', 'post'>, 'code'> & { code?: string };

// readable random code: no 0/O or 1/I/L to mix up when read aloud
const randomCode = () => Array.from(crypto.getRandomValues(new Uint8Array(8)), (n) => 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'[n % 31]).join('');
const discountText = (c: Coupon) => (c.percentOff !== null ? `ลด ${c.percentOff}%` : `ลด ${baht(c.amountOff ?? 0)}`);
const expired = (c: Coupon) => c.expiresAt !== null && Date.parse(c.expiresAt) <= Date.now();
const usedUp = (c: Coupon) => c.maxUses !== null && c.usedCount >= c.maxUses;

// One form for creating and editing; the code is fixed once created.
function CouponForm({ coupon, pending, error, onSubmit }: { coupon?: Coupon; pending: boolean; error: unknown; onSubmit: (v: CouponValues) => void }) {
  const [code, setCode] = useState(coupon?.code ?? '');
  const number = (v: FormDataEntryValue | null) => (v ? Number(v) : null);
  return (
    <form
      className="grid gap-4 sm:grid-cols-2"
      onSubmit={(e) => {
        const f = formData(e);
        const value = Number(f.get('value'));
        const expires = String(f.get('expires'));
        onSubmit({
          ...(coupon ? { isActive: f.get('isActive') === 'on' } : { code }),
          name: String(f.get('name')),
          percentOff: f.get('type') === 'percent' ? value : null,
          amountOff: f.get('type') === 'amount' ? value : null,
          minTotal: Number(f.get('minTotal') || 0),
          maxUses: number(f.get('maxUses')),
          perUserLimit: number(f.get('perUserLimit')),
          expiresAt: expires ? `${expires}T23:59:59+07:00` : null,
        });
      }}
    >
      <div className="sm:col-span-2">
        <Field label="ชื่อโปร" hint="ผู้ดูแลเห็นคนเดียว เช่น โปรเปิดเทอม, ลูกค้าประจำ">
          <Input name="name" maxLength={100} defaultValue={coupon?.name} placeholder="เช่น โปรเปิดเทอม" />
        </Field>
      </div>
      <div className="sm:col-span-2">
        <Field label="รหัสคูปอง" hint={coupon ? 'แก้รหัสไม่ได้' : 'A-Z 0-9 3-30 ตัว สมาชิกพิมพ์รหัสนี้ที่ตะกร้า'}>
          <div className="flex gap-2">
            <Input
              name="code"
              required
              pattern="[A-Za-z0-9_\-]{3,30}"
              className="min-w-0 uppercase"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              readOnly={Boolean(coupon)}
            />
            {!coupon && (
              <Button onClick={() => setCode(randomCode())} title="สร้างรหัสแบบสุ่ม 8 ตัว">
                สุ่มรหัส
              </Button>
            )}
          </div>
        </Field>
      </div>
      <Field label="ประเภทส่วนลด">
        <Select name="type" defaultValue={coupon?.amountOff ? 'amount' : 'percent'}>
          <option value="percent">ลดเป็นเปอร์เซ็นต์</option>
          <option value="amount">ลดเป็นบาท</option>
        </Select>
      </Field>
      <Field label="มูลค่า" hint="1-100 สำหรับเปอร์เซ็นต์">
        <Input name="value" type="number" min={1} required defaultValue={coupon ? (coupon.percentOff ?? coupon.amountOff ?? '') : ''} />
      </Field>
      <Field label="จำกัดกี่คน (สิทธิ์ทั้งหมด)" hint="ถ้าใช้ได้คนละ 1 ครั้ง ตัวเลขนี้คือจำนวนคน · ว่าง = ไม่จำกัด">
        <Input name="maxUses" type="number" min={1} defaultValue={coupon?.maxUses ?? ''} />
      </Field>
      <Field label="ใช้ได้คนละกี่ครั้ง" hint="ว่าง = ไม่จำกัด">
        <Input name="perUserLimit" type="number" min={1} defaultValue={coupon ? (coupon.perUserLimit ?? '') : 1} />
      </Field>
      <Field label="ยอดขั้นต่ำ (บาท)">
        <Input name="minTotal" type="number" min={0} defaultValue={coupon?.minTotal ?? 0} />
      </Field>
      <Field label="หมดอายุ" hint="ว่าง = ไม่มีวันหมดอายุ">
        <Input name="expires" type="date" defaultValue={coupon?.expiresAt ? bangkokDate(new Date(coupon.expiresAt)) : ''} />
      </Field>
      {coupon && (
        <label className="flex items-center gap-2 sm:col-span-2">
          <input type="checkbox" name="isActive" defaultChecked={coupon.isActive} className="size-4 accent-[var(--turf)]" />
          เปิดใช้คูปอง
        </label>
      )}
      <div className="sm:col-span-2">
        <ErrorNote error={error} />
      </div>
      <div className="flex justify-end sm:col-span-2">
        <Button type="submit" variant="primary" pending={pending}>
          {coupon ? 'บันทึก' : 'สร้างคูปอง'}
        </Button>
      </div>
    </form>
  );
}

// Every booking that used the coupon: who, which booking, when, and how much it saved.
function CouponUsage({ id }: { id: number }) {
  const usage = useQuery({ queryKey: ['coupons', id, 'usage'], queryFn: () => ok(api.GET('/api/v1/coupons/{id}/usage', { params: { path: { id } } })) });
  if (usage.isPending) return <Loading />;
  if (usage.error) return <ErrorNote error={usage.error} />;
  const { coupon: c, uses } = usage.data;
  const net = uses.reduce((n, u) => n + u.total, 0);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        <StatBox label="ใช้แล้ว" value={c.usedCount} unit={c.maxUses ? `/ ${c.maxUses} ครั้ง` : 'ครั้ง'} />
        <StatBox label="สมาชิกที่ใช้" value={c.userCount} unit="คน" />
        <StatBox label="ส่วนลดรวม" value={c.discountGiven.toLocaleString('th-TH')} unit="บาท" />
        <StatBox label="ยอดสุทธิรวม" value={net.toLocaleString('th-TH')} unit="บาท" />
      </div>
      {uses.length === 0 ? (
        <Empty title="ยังไม่มีใครใช้คูปองนี้" />
      ) : (
        <div className="overflow-x-auto rounded-xl border-2 border-line">
          <table className="w-full min-w-[44rem] text-left text-sm">
            <thead className="bg-sunken/60 text-muted">
              <tr>
                <th className="px-3 py-2 font-medium">ยืนยันเมื่อ</th>
                <th className="px-3 py-2 font-medium">การจอง</th>
                <th className="px-3 py-2 font-medium">สมาชิก</th>
                <th className="px-3 py-2 font-medium">สถานะ</th>
                <th className="px-3 py-2 text-right font-medium">ก่อนลด</th>
                <th className="px-3 py-2 text-right font-medium">ส่วนลด</th>
                <th className="px-3 py-2 text-right font-medium">สุทธิ</th>
              </tr>
            </thead>
            <tbody>
              {uses.map((u) => (
                <tr key={u.bookingId} className="border-t border-line">
                  <td className="num px-3 py-2 whitespace-nowrap">{u.confirmedAt ? dateTimeTh(u.confirmedAt) : '-'}</td>
                  <td className="px-3 py-2">
                    <Link to={`/bookings/${u.bookingId}`} className="num text-info hover:underline">
                      #{u.code}
                    </Link>
                  </td>
                  <td className="px-3 py-2">
                    <Link to={`/admin/users/${u.userId}`} className="font-medium hover:underline">
                      {u.userName}
                    </Link>
                    <span className="block text-xs text-muted">{u.userEmail}</span>
                  </td>
                  <td className="px-3 py-2">
                    <Badge tone={bookingStatus[u.status].tone}>{bookingStatus[u.status].label}</Badge>
                  </td>
                  <td className="num px-3 py-2 text-right">{baht(u.subtotal)}</td>
                  <td className="num px-3 py-2 text-right text-turf">−{baht(u.discount)}</td>
                  <td className="num px-3 py-2 text-right font-semibold">{baht(u.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-xs text-muted">นับเฉพาะการจองที่กดยืนยันแล้ว การจองที่ยกเลิกหรือหมดเวลาชำระยังนับเป็นการใช้สิทธิ์</p>
    </div>
  );
}

export default function Coupons() {
  const qc = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Coupon | null>(null);
  const [viewing, setViewing] = useState<Coupon | null>(null);
  const coupons = useQuery({ queryKey: ['coupons'], queryFn: () => ok(api.GET('/api/v1/coupons')) });
  const refresh = () => qc.invalidateQueries({ queryKey: ['coupons'] });
  const create = useMutation({
    mutationFn: (body: CouponValues) => ok(api.POST('/api/v1/coupons', { body: body as Body<'/api/v1/coupons', 'post'> })),
    onSuccess: (c) => {
      toast.success(`สร้างคูปอง ${c.code} แล้ว`);
      setCreating(false);
      refresh();
    },
  });
  const update = useMutation({
    mutationFn: ({ id, body }: { id: number; body: CouponValues }) => ok(api.PATCH('/api/v1/coupons/{id}', { params: { path: { id } }, body })),
    onSuccess: (c) => {
      toast.success(`บันทึกคูปอง ${c.code} แล้ว`);
      setEditing(null);
      refresh();
    },
  });
  // used coupons cannot be deleted (409 IN_USE); the toast says to switch them off instead
  const remove = useMutation({
    mutationFn: (id: number) => ok(api.DELETE('/api/v1/coupons/{id}', { params: { path: { id } } })),
    onSuccess: () => {
      toast('ลบคูปองแล้ว');
      refresh();
    },
    onError: (e) => toast.error(errorText(e)),
  });

  const list = coupons.data ?? [];
  return (
    <div className="space-y-5">
      <PageHeader title="คูปองส่วนลด" sub="สร้างโค้ดส่วนลด จำกัดจำนวนคนที่ใช้ได้ และดูว่าใครใช้ไปแล้วบ้าง">
        <Button variant="primary" onClick={() => setCreating(true)}>
          สร้างคูปอง
        </Button>
      </PageHeader>
      <div className="flex flex-wrap gap-3">
        <StatBox label="เปิดใช้อยู่" value={list.filter((c) => c.isActive && !expired(c) && !usedUp(c)).length} unit="คูปอง" />
        <StatBox label="ใช้ไปแล้ว" value={list.reduce((n, c) => n + c.usedCount, 0)} unit="ครั้ง" />
        <StatBox label="ส่วนลดที่ให้ไป" value={list.reduce((n, c) => n + c.discountGiven, 0).toLocaleString('th-TH')} unit="บาท" />
      </div>

      {coupons.isPending ? (
        <Loading />
      ) : coupons.error ? (
        <ErrorNote error={coupons.error} />
      ) : list.length === 0 ? (
        <Empty title="ยังไม่มีคูปอง">กด สร้างคูปอง เพื่อเริ่ม</Empty>
      ) : (
        <ul className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
          {list.map((c) => (
            <li key={c.id} className="flex flex-col gap-3 rounded-xl border-2 border-line bg-surface p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="num text-xl font-extrabold tracking-wider text-mark">{c.code}</p>
                  <p className="truncate text-sm text-muted">{c.name || 'ไม่มีชื่อโปร'}</p>
                </div>
                {!c.isActive ? (
                  <Badge tone="danger">ปิดอยู่</Badge>
                ) : expired(c) ? (
                  <Badge tone="muted">หมดอายุ</Badge>
                ) : usedUp(c) ? (
                  <Badge tone="muted">ใช้ครบแล้ว</Badge>
                ) : (
                  <Badge tone="turf">เปิดใช้</Badge>
                )}
              </div>
              <p className="text-2xl font-bold">{discountText(c)}</p>
              <p className="text-sm text-muted">
                {[
                  c.minTotal > 0 ? `ขั้นต่ำ ${baht(c.minTotal)}` : 'ไม่มียอดขั้นต่ำ',
                  c.perUserLimit ? `คนละ ${c.perUserLimit} ครั้ง` : 'ใช้ซ้ำได้',
                  c.expiresAt ? `หมดอายุ ${dateTh(c.expiresAt)}` : 'ไม่มีวันหมดอายุ',
                ].join(' · ')}
              </p>
              <div className="space-y-1.5 rounded-lg bg-sunken p-3">
                <div className="flex items-baseline justify-between gap-2 text-sm">
                  <span>
                    ใช้แล้ว <b className="num">{c.usedCount}</b>
                    {c.maxUses !== null ? ` / ${c.maxUses}` : ''} ครั้ง · <b className="num">{c.userCount}</b> คน
                  </span>
                  <span className="num text-muted">ลดไป {baht(c.discountGiven)}</span>
                </div>
                {c.maxUses !== null && <Progress value={c.usedCount / c.maxUses} />}
              </div>
              <div className="mt-auto flex flex-wrap gap-2">
                <Button size="sm" variant="primary" onClick={() => setViewing(c)}>
                  ดูการใช้
                </Button>
                <Button size="sm" onClick={() => setEditing(c)}>
                  แก้ไข
                </Button>
                <Button size="sm" variant="quiet-danger" className="ml-auto" onClick={() => confirm(`ลบคูปอง ${c.code}?`).then((ok) => ok && remove.mutate(c.id))}>
                  ลบ
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Modal open={creating} onClose={() => setCreating(false)} title="สร้างคูปอง">
        <CouponForm pending={create.isPending} error={create.error} onSubmit={(v) => create.mutate(v)} />
      </Modal>
      <Modal open={editing !== null} onClose={() => setEditing(null)} title={`แก้ไขคูปอง ${editing?.code ?? ''}`}>
        {editing && <CouponForm key={editing.id} coupon={editing} pending={update.isPending} error={update.error} onSubmit={(body) => update.mutate({ id: editing.id, body })} />}
      </Modal>
      <Modal wide open={viewing !== null} onClose={() => setViewing(null)} title={`การใช้คูปอง ${viewing?.code ?? ''}${viewing?.name ? ` · ${viewing.name}` : ''}`}>
        {viewing && <CouponUsage id={viewing.id} />}
      </Modal>
    </div>
  );
}
