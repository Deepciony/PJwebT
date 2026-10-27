import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router';
import { toast } from 'sonner';
import { api, errorText, ok, useMe } from '../api';
import { DateStrip, SportChips } from '../components/Pickers';
import { Button, Empty, ErrorNote, Field, FilterRow, Input, Loading, PageHeader, Panel, Select, SportArt } from '../components/ui';
import { useCartActions } from '../lib/cart';
import { atHour, baht, bangkokDate, hourLabel } from '../lib/format';

export function EquipmentList() {
  const [params, setParams] = useSearchParams();
  const sport = params.get('sport') ? Number(params.get('sport')) : undefined;
  const items = useQuery({ queryKey: ['equipment', sport], queryFn: () => ok(api.GET('/api/v1/equipment', { params: { query: { sport } } })) });

  return (
    <div className="space-y-6">
      <PageHeader title="ยืมอุปกรณ์" sub="เลือกอุปกรณ์และช่วงเวลาที่ใช้ ค่าเช่าคิดต่อชิ้นต่อการจอง ส่วนมัดจำจ่ายที่เคาน์เตอร์และได้คืนเมื่อคืนของ" />
      <div className="rounded-xl border-2 border-line bg-sunken/60 p-3">
        <FilterRow label="กีฬา">
      <SportChips
        value={sport}
        onChange={(s) =>
          setParams((p) => {
            if (s === undefined) p.delete('sport');
            else p.set('sport', String(s));
            return p;
          })
        }
      />
        </FilterRow>
      </div>
      {items.isPending ? (
        <Loading />
      ) : items.error ? (
        <ErrorNote error={items.error} />
      ) : items.data.length === 0 ? (
        <Empty title="ยังไม่มีอุปกรณ์ของกีฬานี้" />
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
          {items.data.map((e) => (
            <li key={e.id}>
              <Link to={`/equipment/${e.id}`} className="block h-full overflow-hidden rounded-xl border-2 border-line bg-surface transition hover:-translate-y-0.5 hover:border-line-hi">
                <SportArt icon={e.sportIcon} sportId={e.sportId} imageUrl={e.imageUrl} gear className="h-36 w-full" />
                <div className="space-y-1 p-4">
                  <h2 className="text-lg">{e.name}</h2>
                  <p className="text-sm text-muted">
                    {e.sportIcon} {e.sportName} มีทั้งหมด <span className="num">{e.totalQty}</span> ชิ้น
                  </p>
                  <p className="num">
                    <span className="text-lg font-semibold">{baht(e.rentPrice)}</span>
                    <span className="text-sm text-muted">/ชิ้น{e.deposit > 0 && ` มัดจำ ${baht(e.deposit)}`}</span>
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function EquipmentDetail() {
  const id = Number(useParams().id);
  const me = useMe().data;
  const navigate = useNavigate();
  const { addEquipment } = useCartActions();
  const [date, setDate] = useState(bangkokDate());
  // options run 06:00–23:00; default to the next hour inside that range
  const [start, setStart] = useState(() => Math.min(Math.max(new Date().getHours() + 1, 6), 21));
  const [hours, setHours] = useState(2);
  const [qty, setQty] = useState(1);
  const startAt = atHour(date, start);
  const endAt = new Date(Date.parse(startAt) + hours * 3_600_000).toISOString();

  const item = useQuery({ queryKey: ['equipment-item', id], queryFn: () => ok(api.GET('/api/v1/equipment/{id}', { params: { path: { id } } })) });
  const stock = useQuery({
    queryKey: ['equipment-stock', id, startAt, endAt],
    queryFn: () => ok(api.GET('/api/v1/equipment/{id}/availability', { params: { path: { id }, query: { startAt, endAt } } })),
  });

  if (item.isPending) return <Loading />;
  if (item.error) return <ErrorNote error={item.error} />;
  const e = item.data;
  const available = stock.data?.available ?? 0;
  const past = Date.parse(startAt) <= Date.now();

  const add = () => {
    if (!me) return navigate(`/login?next=/equipment/${id}`);
    addEquipment.mutate(
      { equipmentId: id, qty, startAt, endAt },
      {
        onSuccess: () => toast.success(`เพิ่ม ${e.name} × ${qty} ลงตะกร้าแล้ว`, { action: { label: 'ไปที่ตะกร้า', onClick: () => navigate('/cart') } }),
        onError: (err) => toast.error(errorText(err)),
      },
    );
  };

  return (
    <div className="space-y-5">
      <Link to="/equipment" className="group inline-flex items-center gap-2 rounded-full border-2 border-line bg-sunken py-1 pr-4 pl-1 text-sm font-semibold transition hover:-translate-y-0.5 hover:border-line-hi">
        <span className="grid size-6 place-items-center rounded-full bg-violet text-white transition group-hover:-translate-x-0.5" aria-hidden>←</span>
        อุปกรณ์ทั้งหมด
      </Link>
      <PageHeader title={e.name} sub={`${e.sportIcon} ${e.sportName} · เลือกวัน เวลา และจำนวนที่แผงด้านขวา`} />
    <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,1fr)_24rem]">
      <div className="space-y-5">
        <SportArt icon={e.sportIcon} sportId={e.sportId} imageUrl={e.imageUrl} gear className="aspect-[21/9] w-full rounded-xl" />
        <dl className="grid grid-cols-3 gap-3">
          {[
            ['ค่าเช่า', `${baht(e.rentPrice)}/ชิ้น`],
            ['มัดจำ', e.deposit > 0 ? `${baht(e.deposit)}/ชิ้น` : 'ไม่มี'],
            ['ในคลัง', `${e.totalQty} ชิ้น`],
          ].map(([k, v]) => (
            <div key={k} className="rounded-xl bg-sunken p-3">
              <dt className="label">{k}</dt>
              <dd className="num font-semibold sm:text-lg">{v}</dd>
            </div>
          ))}
        </dl>
        {e.description && <p className="max-w-prose">{e.description}</p>}
      </div>

      <Panel className="h-fit space-y-4 p-5 lg:sticky lg:top-28">
        <h2 className="text-lg">ยืมอุปกรณ์</h2>
        <DateStrip value={date} onChange={setDate} />
        <div className="grid grid-cols-3 gap-3">
          <Field label="เริ่ม">
            <Select value={start} onChange={(ev) => setStart(Number(ev.target.value))}>
              {Array.from({ length: 18 }, (_, i) => i + 6).map((h) => (
                <option key={h} value={h}>
                  {hourLabel(h)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="กี่ชั่วโมง">
            <Select value={hours} onChange={(ev) => setHours(Number(ev.target.value))}>
              {[1, 2, 3, 4].map((h) => (
                <option key={h} value={h}>
                  {h}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="จำนวน">
            <Input type="number" min={1} max={Math.max(available, 1)} value={qty} onChange={(ev) => setQty(Math.max(1, Number(ev.target.value)))} />
          </Field>
        </div>
        <p className="rounded-lg bg-sunken px-3 py-2 text-sm" aria-live="polite">
          {past ? 'เวลานี้ผ่านไปแล้ว เลือกเวลาใหม่' : stock.isPending ? 'กำลังเช็คจำนวน' : `ช่วงเวลานี้ยืมได้ ${available} จาก ${e.totalQty} ชิ้น`}
        </p>
        <div className="flex items-baseline justify-between">
          <span className="text-muted">ค่าเช่า</span>
          <span className="num text-2xl font-semibold">{baht(e.rentPrice * qty)}</span>
        </div>
        {e.deposit > 0 && <p className="text-sm text-muted">มัดจำ {baht(e.deposit * qty)} จ่ายที่เคาน์เตอร์ตอนรับของ</p>}
        <Button variant="primary" size="lg" className="w-full" disabled={past || qty > available} pending={addEquipment.isPending} onClick={add}>
          เพิ่มลงตะกร้า
        </Button>
      </Panel>
    </div>
    </div>
  );
}
