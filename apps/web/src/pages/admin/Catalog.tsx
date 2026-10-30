import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useSearchParams } from 'react-router';
import { toast } from 'sonner';
import { api, type Body, type Court, type Equipment, errorText, ok, type Sport, upload } from '../../api';
import { useSports } from '../../components/Pickers';
import { Badge, Button, ErrorNote, Field, Input, Loading, Modal, PageHeader, Select, SportArt, Stars, Textarea } from '../../components/ui';
import { confirm } from '../../lib/confirm';
import { baht, dateTimeTh, hourLabel } from '../../lib/format';
import { formData } from '../../lib/pick';

type Def = { name: string; label: string; kind?: 'text' | 'number' | 'optional-number' | 'textarea' | 'sport' | 'checkbox'; min?: number; max?: number; step?: number; hint?: string };

const courtFields: Def[] = [
  { name: 'name', label: 'ชื่อสนาม' },
  { name: 'sportId', label: 'กีฬา', kind: 'sport' },
  { name: 'pricePerHour', label: 'ราคาต่อชั่วโมง (บาท)', kind: 'number', min: 0, step: 10 },
  { name: 'openHour', label: 'เปิด (ชั่วโมง)', kind: 'number', min: 0, max: 23 },
  { name: 'closeHour', label: 'ปิด (ชั่วโมง)', kind: 'number', min: 1, max: 24, hint: '24 = เที่ยงคืน' },
  { name: 'peakPricePerHour', label: 'ราคาช่วง peak (บาท/ชม.)', kind: 'optional-number', min: 0, step: 10, hint: 'เว้นว่าง = ราคาเดียวทั้งวัน' },
  { name: 'peakFromHour', label: 'peak เริ่มเวลา (ชั่วโมง)', kind: 'optional-number', min: 0, max: 23, hint: 'เช่น 17 = ตั้งแต่ 17:00 จนปิด' },
  { name: 'description', label: 'รายละเอียด', kind: 'textarea' },
  { name: 'isActive', label: 'เปิดให้จอง', kind: 'checkbox' },
];

const equipmentFields: Def[] = [
  { name: 'name', label: 'ชื่ออุปกรณ์' },
  { name: 'sportId', label: 'กีฬา', kind: 'sport' },
  { name: 'totalQty', label: 'จำนวนในคลัง', kind: 'number', min: 0 },
  { name: 'rentPrice', label: 'ค่าเช่าต่อชิ้น (บาท)', kind: 'number', min: 0, step: 5 },
  { name: 'deposit', label: 'มัดจำต่อชิ้น (บาท)', kind: 'number', min: 0, step: 50 },
  { name: 'description', label: 'รายละเอียด', kind: 'textarea' },
  { name: 'isActive', label: 'เปิดให้ยืม', kind: 'checkbox' },
];

// One form for courts and equipment; the field list decides what it edits.
function EntityForm({
  defs,
  initial,
  sports,
  pending,
  error,
  onSubmit,
}: {
  defs: Def[];
  initial: Record<string, unknown>;
  sports: Sport[];
  pending: boolean;
  error: unknown;
  onSubmit: (values: Record<string, unknown>) => void;
}) {
  return (
    <form
      className="grid gap-4 sm:grid-cols-2"
      onSubmit={(e) => {
        const f = formData(e);
        const values: Record<string, unknown> = {};
        for (const d of defs) {
          if (d.kind === 'checkbox') values[d.name] = f.get(d.name) === 'on';
          else if (d.kind === 'number' || d.kind === 'sport') values[d.name] = Number(f.get(d.name));
          else if (d.kind === 'optional-number') values[d.name] = f.get(d.name) === '' ? null : Number(f.get(d.name));
          else values[d.name] = String(f.get(d.name) ?? '');
        }
        onSubmit(values);
      }}
    >
      {defs.map((d) => {
        const value = initial[d.name];
        if (d.kind === 'checkbox') {
          return (
            <label key={d.name} className="flex items-center gap-2 sm:col-span-2">
              <input type="checkbox" name={d.name} defaultChecked={value !== false} className="size-4 accent-[var(--turf)]" />
              {d.label}
            </label>
          );
        }
        return (
          <div key={d.name} className={d.kind === 'textarea' || d.name === 'name' ? 'sm:col-span-2' : ''}>
            <Field label={d.label} hint={d.hint}>
              {d.kind === 'textarea' ? (
                <Textarea name={d.name} defaultValue={String(value ?? '')} maxLength={2000} />
              ) : d.kind === 'sport' ? (
                <Select name={d.name} defaultValue={String(value ?? sports[0]?.id ?? '')} required>
                  {sports.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.icon} {s.name}
                    </option>
                  ))}
                </Select>
              ) : (
                <Input
                  name={d.name}
                  type={d.kind === 'number' || d.kind === 'optional-number' ? 'number' : 'text'}
                  min={d.min}
                  max={d.max}
                  step={d.step}
                  defaultValue={value === undefined || value === null ? '' : String(value)}
                  required={d.kind !== 'optional-number'}
                />
              )}
            </Field>
          </div>
        );
      })}
      <div className="sm:col-span-2">
        <ErrorNote error={error} />
      </div>
      <div className="flex justify-end sm:col-span-2">
        <Button type="submit" variant="primary" pending={pending}>
          บันทึก
        </Button>
      </div>
    </form>
  );
}

function ImagePicker({ path, onDone }: { path: string; onDone: () => void }) {
  const send = useMutation({
    mutationFn: (file: File) => upload(path, file),
    onSuccess: () => {
      toast.success('เปลี่ยนรูปแล้ว');
      onDone();
    },
    onError: (e) => toast.error(errorText(e)),
  });
  return (
    <label className="cursor-pointer rounded-md px-2 py-1 text-sm text-info hover:bg-sunken">
      {send.isPending ? 'กำลังอัปโหลด' : 'เปลี่ยนรูป'}
      <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="sr-only" onChange={(e) => e.target.files?.[0] && send.mutate(e.target.files[0])} />
    </label>
  );
}

type Kind = 'courts' | 'equipment';

function CatalogTable({ kind }: { kind: Kind }) {
  const [params, setParams] = useSearchParams();
  const qc = useQueryClient();
  const sports = useSports().data ?? [];
  const list = useQuery({
    queryKey: [kind, 'admin'],
    queryFn: (): Promise<(Court | Equipment)[]> =>
      kind === 'courts'
        ? ok(api.GET('/api/v1/courts', { params: { query: { includeInactive: 'true' } } }))
        : ok(api.GET('/api/v1/equipment', { params: { query: { includeInactive: 'true' } } })),
  });
  // ?edit=court-5 / ?edit=equipment-3 opens that record; ?edit=court-new / equipment-new opens an empty form
  const prefix = kind === 'courts' ? 'court' : 'equipment';
  const edit = params.get('edit')?.startsWith(`${prefix}-`) ? params.get('edit')!.slice(prefix.length + 1) : null;
  const editing = edit === 'new' ? {} : list.data?.find((r) => String(r.id) === edit);
  const close = () =>
    setParams((p) => {
      p.delete('edit');
      return p;
    });
  const refresh = () => {
    qc.invalidateQueries({ queryKey: [kind] });
    qc.invalidateQueries({ queryKey: ['board'] });
    qc.invalidateQueries({ queryKey: ['sports'] });
  };
  const save = useMutation({
    mutationFn: async (values: Record<string, unknown>) => {
      const id = edit && edit !== 'new' ? Number(edit) : null;
      if (kind === 'courts') {
        return id
          ? ok(api.PATCH('/api/v1/courts/{id}', { params: { path: { id } }, body: values as Body<'/api/v1/courts/{id}', 'patch'> }))
          : ok(api.POST('/api/v1/courts', { body: values as Body<'/api/v1/courts', 'post'> }));
      }
      return id
        ? ok(api.PATCH('/api/v1/equipment/{id}', { params: { path: { id } }, body: values as Body<'/api/v1/equipment/{id}', 'patch'> }))
        : ok(api.POST('/api/v1/equipment', { body: values as Body<'/api/v1/equipment', 'post'> }));
    },
    onSuccess: () => {
      toast.success('บันทึกแล้ว');
      close();
      refresh();
    },
  });
  // only records without history can go; the API explains when to deactivate instead
  const remove = useMutation({
    mutationFn: (id: number) =>
      kind === 'courts'
        ? ok(api.DELETE('/api/v1/courts/{id}', { params: { path: { id } } }))
        : ok(api.DELETE('/api/v1/equipment/{id}', { params: { path: { id } } })),
    onSuccess: () => {
      toast('ลบแล้ว');
      refresh();
    },
    onError: (e) => toast.error(errorText(e)),
  });

  if (list.isPending) return <Loading />;
  if (list.error) return <ErrorNote error={list.error} />;

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button variant="primary" onClick={() => setParams((p) => (p.set('edit', `${prefix}-new`), p))}>
          {kind === 'courts' ? 'เพิ่มสนาม' : 'เพิ่มอุปกรณ์'}
        </Button>
      </div>
      <ul className="divide-y divide-line rounded-xl border-2 border-line bg-surface">
        {list.data.map((r) => (
          <li key={r.id} className="grid grid-cols-[4.5rem_1fr] items-center gap-4 p-3 sm:grid-cols-[4.5rem_1fr_auto]">
            <SportArt icon={r.sportIcon} sportId={r.sportId} imageUrl={r.imageUrl} gear={kind === 'equipment'} className="h-14 w-full rounded-lg" />
            <div className="min-w-0">
              <p className="font-medium">
                {r.name} {!r.isActive && <Badge tone="danger">ปิดอยู่</Badge>}
              </p>
              <p className="num text-sm text-muted">
                {r.sportIcon} {r.sportName}{' '}
                {'pricePerHour' in r
                  ? `${baht(r.pricePerHour)}/ชม. เปิด ${hourLabel(r.openHour)}–${hourLabel(r.closeHour)}`
                  : `${baht(r.rentPrice)}/ชิ้น มีทั้งหมด ${r.totalQty} ชิ้น`}
              </p>
            </div>
            <div className="col-span-2 flex justify-end gap-1 sm:col-span-1">
              <ImagePicker path={`/api/v1/${kind}/${r.id}/image`} onDone={refresh} />
              <Button size="sm" variant="quiet" onClick={() => setParams((p) => (p.set('edit', `${prefix}-${r.id}`), p))}>
                แก้ไข
              </Button>
              <Button size="sm" variant="quiet-danger" onClick={() => confirm(`ลบ ${r.name}?`).then((ok) => ok && remove.mutate(r.id))}>
                ลบ
              </Button>
            </div>
          </li>
        ))}
      </ul>
      <Modal
        open={editing !== undefined && edit !== null}
        onClose={close}
        title={edit === 'new' ? (kind === 'courts' ? 'เพิ่มสนาม' : 'เพิ่มอุปกรณ์') : `แก้ไข ${(editing as { name?: string })?.name ?? ''}`}
      >
        <EntityForm
          defs={kind === 'courts' ? courtFields : equipmentFields}
          initial={(editing ?? {}) as Record<string, unknown>}
          sports={sports}
          pending={save.isPending}
          error={save.error}
          onSubmit={(v) => save.mutate(v)}
        />
      </Modal>
    </div>
  );
}

function SportsTable() {
  const qc = useQueryClient();
  const sports = useSports();
  const refresh = () => qc.invalidateQueries({ queryKey: ['sports'] });
  const add = useMutation({
    mutationFn: (body: { name: string; icon: string }) => ok(api.POST('/api/v1/sports', { body })),
    onSuccess: () => {
      toast.success('เพิ่มกีฬาแล้ว');
      refresh();
    },
  });
  const rename = useMutation({
    mutationFn: ({ id, ...body }: { id: number; name: string; icon: string }) => ok(api.PATCH('/api/v1/sports/{id}', { params: { path: { id } }, body })),
    onSuccess: () => {
      toast.success('บันทึกแล้ว');
      refresh();
    },
    onError: (e) => toast.error(errorText(e)),
  });
  const remove = useMutation({
    mutationFn: (id: number) => ok(api.DELETE('/api/v1/sports/{id}', { params: { path: { id } } })),
    onSuccess: () => {
      toast('ลบกีฬาแล้ว');
      refresh();
    },
    onError: (e) => toast.error(errorText(e)),
  });
  if (sports.isPending) return <Loading />;
  return (
    <div className="space-y-4">
      <ul className="divide-y divide-line rounded-xl border-2 border-line bg-surface">
        {sports.data?.map((s) => (
          <li key={s.id}>
            <form
              className="flex flex-wrap items-center gap-2 p-3"
              onSubmit={(e) => {
                const f = formData(e);
                rename.mutate({ id: s.id, name: String(f.get('name')), icon: String(f.get('icon')) });
              }}
            >
              <Input name="icon" defaultValue={s.icon} className="w-16 text-center text-xl" aria-label="ไอคอน" />
              <Input name="name" defaultValue={s.name} className="max-w-56" aria-label="ชื่อกีฬา" />
              <span className="num text-sm text-muted">
                {s.courtCount} สนาม {s.equipmentCount} อุปกรณ์
              </span>
              <span className="ml-auto flex gap-1">
                <Button type="submit" size="sm" variant="quiet">
                  บันทึก
                </Button>
                <Button
                  size="sm"
                  variant="quiet-danger"
                  disabled={s.courtCount + s.equipmentCount > 0}
                  title={s.courtCount + s.equipmentCount > 0 ? 'ลบได้เมื่อไม่มีสนามหรืออุปกรณ์ของกีฬานี้' : undefined}
                  onClick={() => confirm(`ลบ ${s.name}?`).then((ok) => ok && remove.mutate(s.id))}
                >
                  ลบ
                </Button>
              </span>
            </form>
          </li>
        ))}
      </ul>
      <form
        className="flex flex-wrap items-end gap-2 rounded-xl border-2 border-dashed border-line p-4"
        onSubmit={(e) => {
          const f = formData(e);
          add.mutate({ name: String(f.get('name')), icon: String(f.get('icon') || '🏅') }, { onSuccess: () => (e.target as HTMLFormElement).reset() });
        }}
      >
        <Field label="ไอคอน">
          <Input name="icon" placeholder="🏅" className="w-20 text-center text-xl" />
        </Field>
        <Field label="ชื่อกีฬาใหม่">
          <Input name="name" required />
        </Field>
        <Button type="submit" variant="primary" pending={add.isPending}>
          เพิ่มกีฬา
        </Button>
        <div className="w-full">
          <ErrorNote error={add.error} />
        </div>
      </form>
    </div>
  );
}

function ReviewsTable() {
  const qc = useQueryClient();
  const [rating, setRating] = useState<number>();
  const reviews = useQuery({
    queryKey: ['reviews', 'admin', rating],
    queryFn: () => ok(api.GET('/api/v1/reviews', { params: { query: { rating } } })),
  });
  const remove = useMutation({
    mutationFn: (id: number) => ok(api.DELETE('/api/v1/reviews/{id}', { params: { path: { id } } })),
    onSuccess: () => {
      toast('ลบรีวิวแล้ว');
      qc.invalidateQueries({ queryKey: ['reviews'] });
      qc.invalidateQueries({ queryKey: ['courts'] });
    },
    onError: (e) => toast.error(errorText(e)),
  });
  return (
    <div className="space-y-4">
      <Select value={rating ?? ''} onChange={(e) => setRating(e.target.value ? Number(e.target.value) : undefined)} className="max-w-48" aria-label="กรองตามคะแนน">
        <option value="">ทุกคะแนน</option>
        {[1, 2, 3, 4, 5].map((n) => (
          <option key={n} value={n}>
            {n} ดาว
          </option>
        ))}
      </Select>
      {reviews.isPending ? (
        <Loading />
      ) : reviews.error ? (
        <ErrorNote error={reviews.error} />
      ) : reviews.data.length === 0 ? (
        <p className="text-muted">ยังไม่มีรีวิว</p>
      ) : (
        <ul className="divide-y divide-line rounded-xl border-2 border-line bg-surface">
          {reviews.data.map((r) => (
            <li key={r.id} className="flex items-start gap-4 p-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm text-muted">
                  {r.courtName} · {r.userName} · {dateTimeTh(r.createdAt)} · การจอง #{r.bookingCode}
                </p>
                <p>
                  <Stars value={r.rating} /> {r.comment || <span className="text-muted">(ไม่มีความเห็น)</span>}
                </p>
              </div>
              <Button size="sm" variant="quiet-danger" onClick={() => confirm('ลบรีวิวนี้?').then((ok) => ok && remove.mutate(r.id))}>
                ลบ
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function Catalog() {
  const [params, setParams] = useSearchParams();
  const editing = params.get('edit');
  const tab = params.get('tab') ?? (editing?.startsWith('equipment') ? 'equipment' : 'courts');
  const tabs: [string, string][] = [
    ['courts', 'สนาม'],
    ['equipment', 'อุปกรณ์'],
    ['sports', 'ประเภทกีฬา'],
    ['reviews', 'รีวิว'],
  ];
  return (
    <div className="space-y-5">
      <PageHeader title="จัดการข้อมูล" sub="เพิ่ม แก้ไข และลบสนาม อุปกรณ์ ประเภทกีฬา และรีวิว เลือกหมวดจากแท็บด้านล่าง (คูปองอยู่ที่เมนู คูปอง)" />
      <div className="flex gap-1 overflow-x-auto rounded-xl bg-sunken p-1 sm:w-fit" role="tablist">
        {tabs.map(([key, label]) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={tab === key}
            onClick={() => setParams({ tab: key })}
            className={`flex-1 whitespace-nowrap rounded-lg px-4 py-1.5 text-sm ${tab === key ? 'bg-mark font-semibold text-mark-ink' : 'text-muted'}`}
          >
            {label}
          </button>
        ))}
      </div>
      {tab === 'sports' ? (
        <SportsTable />
      ) : tab === 'reviews' ? (
        <ReviewsTable />
      ) : (
        <CatalogTable key={tab} kind={tab as Kind} />
      )}
    </div>
  );
}
