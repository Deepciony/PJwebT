import { useQueries, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router';
import { toast } from 'sonner';
import { api, errorText, ok, type Slot, useMe, useSettings } from '../api';
import { DateStrip } from '../components/Pickers';
import { Badge, Button, Empty, ErrorNote, Field, Input, LinkButton, Loading, PageHeader, Panel, Select, SportArt, Stars } from '../components/ui';
import { useCart, useCartActions } from '../lib/cart';
import { baht, bangkokDate, dateTh, hourLabel, timeRange } from '../lib/format';
import { useSlotPicker } from '../lib/pick';

// Rent this sport's equipment with the court: the rental covers the hours already picked on this court
// that day (first start to last end), so players get the gear for exactly the time they play.
function CourtEquipment({ courtId, sportId, sportName, date }: { courtId: number; sportId: number; sportName: string; date: string }) {
  const me = useMe().data;
  const navigate = useNavigate();
  const cart = useCart(Boolean(me)).data;
  const { addEquipment } = useCartActions();
  const [qty, setQty] = useState<Record<number, number>>({});
  const items = useQuery({
    queryKey: ['equipment', sportId],
    queryFn: () => ok(api.GET('/api/v1/equipment', { params: { query: { sport: sportId } } })),
  }).data;
  const picked = (cart?.slots ?? []).filter((s) => s.courtId === courtId && bangkokDate(new Date(s.startAt)) === date);
  const range = picked.length
    ? {
        startAt: picked.reduce((a, s) => (s.startAt < a ? s.startAt : a), picked[0].startAt),
        endAt: picked.reduce((a, s) => (s.endAt > a ? s.endAt : a), picked[0].endAt),
      }
    : null;
  const stock = useQueries({
    queries: (items ?? []).map((e) => ({
      queryKey: ['equipment-stock', e.id, range?.startAt, range?.endAt],
      queryFn: () => ok(api.GET('/api/v1/equipment/{id}/availability', { params: { path: { id: e.id }, query: { startAt: range!.startAt, endAt: range!.endAt } } })),
      enabled: range !== null,
    })),
  });
  if (!items?.length) return null;

  const add = (equipmentId: number, name: string, n: number) => {
    if (!me) return navigate(`/login?next=/courts/${courtId}`);
    if (!range) return;
    addEquipment.mutate(
      { equipmentId, qty: n, ...range },
      { onSuccess: () => toast.success(`เพิ่ม ${name} × ${n} ลงตะกร้าแล้ว`), onError: (err) => toast.error(errorText(err)) },
    );
  };

  return (
    <Panel className="h-fit space-y-3 p-5">
      <h2 className="text-lg">ยืมอุปกรณ์{sportName}</h2>
      <p className="text-sm text-muted">
        {!me
          ? 'เข้าสู่ระบบแล้วเลือกเวลาสนามก่อน จึงยืมอุปกรณ์ไปพร้อมกันได้'
          : range
            ? `ยืมช่วง ${timeRange(range.startAt, range.endAt)} ตามเวลาสนามที่เลือกไว้ ค่าเช่าคิดต่อชิ้นต่อการจอง`
            : 'เลือกเวลาสนามด้านบนก่อน แล้วอุปกรณ์จะใช้ช่วงเวลาเดียวกัน'}
      </p>
      <ul className="space-y-2">
        {items.map((e, i) => {
          const available = stock[i]?.data?.available;
          const n = Math.max(1, qty[e.id] ?? 1);
          const inCart = (cart?.equipment ?? [])
            .filter((c) => c.equipmentId === e.id && c.startAt === range?.startAt && c.endAt === range?.endAt)
            .reduce((sum, c) => sum + c.qty, 0);
          return (
            <li key={e.id} className="space-y-2 rounded-xl bg-sunken p-3">
              <div className="flex items-start justify-between gap-2">
                <span className="font-semibold">
                  {e.sportIcon} {e.name}
                </span>
                <span className="num shrink-0 font-semibold">{baht(e.rentPrice)}/ชิ้น</span>
              </div>
              <p className="text-xs text-muted">
                {e.deposit > 0 ? `มัดจำ ${baht(e.deposit)}/ชิ้น` : 'ไม่มีมัดจำ'}
                {range && available !== undefined && ` · ว่าง ${available} จาก ${e.totalQty} ชิ้น`}
                {inCart > 0 && (
                  <>
                    {' '}
                    <Badge tone="mark">ในตะกร้า × {inCart}</Badge>
                  </>
                )}
              </p>
              <div className="flex gap-2">
                <Input
                  type="number"
                  min={1}
                  max={Math.max(available ?? e.totalQty, 1)}
                  value={n}
                  onChange={(ev) => setQty({ ...qty, [e.id]: Number(ev.target.value) })}
                  className="h-9 max-w-20 py-0"
                  aria-label={`จำนวน ${e.name}`}
                />
                <Button
                  size="sm"
                  variant="primary"
                  className="h-9 flex-1"
                  disabled={Boolean(me) && (!range || available === undefined || n > available)}
                  pending={addEquipment.isPending && addEquipment.variables?.equipmentId === e.id}
                  onClick={() => add(e.id, e.name, n)}
                >
                  {available === 0 ? 'หมดช่วงนี้' : 'เพิ่มลงตะกร้า'}
                </Button>
              </div>
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}

const hourClass: Record<Slot['status'], string> = {
  free: 'border-turf/40 bg-turf-soft text-turf hover:border-turf',
  in_cart: 'border-mark bg-mark text-mark-ink',
  mine: 'border-line-hi bg-violet text-white',
  booked: 'border-line bg-sunken text-muted line-through',
  past: 'border-transparent bg-sunken/60 text-muted/60',
};

export default function CourtDetail() {
  const id = Number(useParams().id);
  const [params, setParams] = useSearchParams();
  const date = params.get('date') ?? bangkokDate();
  const me = useMe().data;
  const pick = useSlotPicker();
  const [weeks, setWeeks] = useState(1);
  // weekly repeats only make sense when bookings open at least a week ahead
  const maxWeeks = Math.min(8, Math.floor((useSettings().data?.maxDaysAhead ?? 1) / 7) + 1);
  const court = useQuery({ queryKey: ['court', id], queryFn: () => ok(api.GET('/api/v1/courts/{id}', { params: { path: { id } } })) });
  const slots = useQuery({
    queryKey: ['availability', id, date],
    queryFn: () => ok(api.GET('/api/v1/courts/{id}/availability', { params: { path: { id }, query: { date } } })),
  });
  const reviews = useQuery({ queryKey: ['reviews', id], queryFn: () => ok(api.GET('/api/v1/courts/{id}/reviews', { params: { path: { id } } })) });

  if (court.isPending) return <Loading />;
  if (court.error) return <ErrorNote error={court.error} />;
  const c = court.data;

  return (
    <div className="space-y-5">
      <Link to="/courts" className="group inline-flex items-center gap-2 rounded-full border-2 border-line bg-sunken py-1 pr-4 pl-1 text-sm font-semibold transition hover:-translate-y-0.5 hover:border-line-hi">
        <span className="grid size-6 place-items-center rounded-full bg-violet text-white transition group-hover:-translate-x-0.5" aria-hidden>←</span>
        สนามทั้งหมด
      </Link>
      <PageHeader title={c.name} sub={`${c.sportIcon} ${c.sportName} · เลือกวันและเวลาที่แผงด้านขวา แล้วกดช่องสีเขียวเพื่อเพิ่มลงตะกร้า`}>
        {me?.role === 'admin' && <LinkButton to={`/admin/catalog?edit=court-${c.id}`}>แก้ไขสนาม</LinkButton>}
      </PageHeader>
    <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,1fr)_24rem]">
      <div className="space-y-5">
        <SportArt icon={c.sportIcon} sportId={c.sportId} imageUrl={c.imageUrl} className="aspect-[21/9] w-full rounded-xl" />
        <dl className="grid grid-cols-3 gap-3">
          {[
            [
              'ราคา',
              c.peakPricePerHour !== null && c.peakFromHour !== null
                ? `${c.pricePerHour.toLocaleString('th-TH')} / ${c.peakPricePerHour.toLocaleString('th-TH')} บาท หลัง ${hourLabel(c.peakFromHour)}`
                : `${baht(c.pricePerHour)}/ชม.`,
            ],
            ['เวลาเปิด', `${hourLabel(c.openHour)}–${hourLabel(c.closeHour)}`],
            ['รีวิว', c.rating === null ? 'ยังไม่มี' : `${c.rating} จาก ${c.reviewCount} รีวิว`],
          ].map(([k, v]) => (
            <div key={k} className="rounded-xl bg-sunken p-3">
              <dt className="label">{k}</dt>
              <dd className="num font-semibold sm:text-lg">{v}</dd>
            </div>
          ))}
        </dl>
        {c.description && <p className="max-w-prose">{c.description}</p>}

        <section className="space-y-3">
          <h2 className="text-lg">รีวิวจากผู้ใช้ {reviews.data?.length ? <span className="num text-sm font-normal text-muted">({reviews.data.length})</span> : null}</h2>
          {reviews.data?.length ? (
            <ul className="space-y-3">
              {reviews.data.map((r) => (
                <li key={r.id} className="rounded-xl border-2 border-line bg-surface p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-medium">{r.userName}</span>
                    <Stars value={r.rating} />
                  </div>
                  {r.comment && <p className="mt-1">{r.comment}</p>}
                  <p className="mt-1 text-xs text-muted">{dateTh(r.createdAt)}</p>
                </li>
              ))}
            </ul>
          ) : (
            <Empty title="ยังไม่มีรีวิว">ใช้บริการแล้วกลับมารีวิวได้ที่หน้าการจองของคุณ</Empty>
          )}
        </section>
      </div>

      <div className="h-fit space-y-4">
      <Panel className="space-y-4 p-5">
        <h2 className="text-lg">เลือกเวลา</h2>
        <DateStrip value={date} onChange={(d) => setParams({ date: d }, { replace: true })} />
        {maxWeeks > 1 && (
          <Field label="จองประจำ" hint="เพิ่มชั่วโมงเดียวกันทุกสัปดาห์ ถ้าสัปดาห์ใดไม่ว่างจะไม่เพิ่มเลย">
            <Select value={weeks} onChange={(e) => setWeeks(Number(e.target.value))}>
              <option value={1}>ครั้งเดียว</option>
              {Array.from({ length: maxWeeks - 1 }, (_, i) => i + 2).map((n) => (
                <option key={n} value={n}>
                  ทุกสัปดาห์ {n} สัปดาห์
                </option>
              ))}
            </Select>
          </Field>
        )}
        {slots.isPending ? (
          <Loading />
        ) : slots.error ? (
          <ErrorNote error={slots.error} />
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {slots.data.slots.map((s) => (
              <button
                key={`${s.hour}-${s.status}`}
                type="button"
                disabled={s.status !== 'free' && s.status !== 'in_cart'}
                onClick={() => pick({ courtId: c.id, courtName: c.name }, s, weeks)}
                className={`flip num rounded-lg border px-2 py-2 text-sm font-medium transition ${hourClass[s.status]}`}
                aria-label={`${timeRange(s.startAt, s.endAt)} ${s.status === 'free' ? 'ว่าง' : s.status === 'in_cart' ? 'อยู่ในตะกร้า' : 'ไม่ว่าง'}`}
              >
                {timeRange(s.startAt, s.endAt)}
                {c.peakPricePerHour !== null && <span className="block text-xs opacity-80">{baht(s.price)}</span>}
              </button>
            ))}
          </div>
        )}
        <p className="text-sm text-muted">ช่องสีเขียวว่าง กดเพื่อเพิ่มลงตะกร้า ช่องสีเหลืองอยู่ในตะกร้าแล้ว</p>
        {me && (
          <LinkButton to="/cart" variant="primary" className="w-full">
            ไปที่ตะกร้า
          </LinkButton>
        )}
      </Panel>
      <CourtEquipment courtId={c.id} sportId={c.sportId} sportName={c.sportName} date={date} />
      </div>
    </div>
    </div>
  );
}
