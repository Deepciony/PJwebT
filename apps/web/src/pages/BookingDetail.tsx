import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';
import { toast } from 'sonner';
import { api, type Booking, errorText, ok, type Payment, upload, useMe, useSettings } from '../api';
import { Badge, Button, ErrorNote, Field, Input, Loading, PageHeader, Panel, Textarea } from '../components/ui';
import { baht, bookingStatus, dateTimeTh, dayLabel, paymentStatus, timeRange } from '../lib/format';
import { formData } from '../lib/pick';

const HOUR = 3_600_000;

export default function BookingDetail() {
  const id = Number(useParams().id);
  const me = useMe().data;
  const cancelHours = useSettings().data?.cancelBeforeHours ?? 24;
  const qc = useQueryClient();
  const booking = useQuery({ queryKey: ['booking', id], queryFn: () => ok(api.GET('/api/v1/bookings/{id}', { params: { path: { id } } })) });
  const refresh = (b?: Booking) => {
    if (b) qc.setQueryData(['booking', id], b);
    else qc.invalidateQueries({ queryKey: ['booking', id] });
    qc.invalidateQueries({ queryKey: ['bookings'] });
    qc.invalidateQueries({ queryKey: ['inbox'] });
  };
  const cancel = useMutation({
    mutationFn: () => ok(api.POST('/api/v1/bookings/{id}/cancel', { params: { path: { id } } })),
    onSuccess: (b) => {
      refresh(b);
      toast('ยกเลิกการจองแล้ว');
    },
    onError: (e) => toast.error(errorText(e)),
  });

  if (booking.isPending) return <Loading />;
  if (booking.error) return <ErrorNote error={booking.error} />;
  const b = booking.data;
  const admin = me?.role === 'admin';
  const firstStart = Math.min(...[...b.slots, ...b.equipment].map((i) => Date.parse(i.startAt)));
  const canCancel = b.status === 'pending_payment' || (b.status === 'paid' && (admin || firstStart - Date.now() >= cancelHours * HOUR));

  return (
    <div className="space-y-5">
      <Link to={admin && b.userId !== me?.id ? '/admin/bookings' : '/bookings'} className="group inline-flex items-center gap-2 rounded-full border-2 border-line bg-sunken py-1 pr-4 pl-1 text-sm font-semibold transition hover:-translate-y-0.5 hover:border-line-hi">
        <span className="grid size-6 place-items-center rounded-full bg-violet text-white transition group-hover:-translate-x-0.5" aria-hidden>←</span>
        รายการจองทั้งหมด
      </Link>
      <PageHeader
        title={
          <span className="num inline-flex flex-wrap items-center gap-3">
            การจอง #{b.code} <Badge tone={bookingStatus[b.status].tone}>{bookingStatus[b.status].label}</Badge>
          </span>
        }
        sub={
          <>
            {b.confirmedAt ? `ยืนยันเมื่อ ${dateTimeTh(b.confirmedAt)}` : `สร้างเมื่อ ${dateTimeTh(b.createdAt)}`}
            {admin && ` โดย ${b.userName} (${b.userEmail})`}
          </>
        }
      />

      <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="space-y-6">
          <Panel className="divide-y divide-line">
            {b.slots.map((s) => (
              <div key={`s${s.id}`} className="flex flex-wrap items-center justify-between gap-2 p-4">
                <div>
                  <p className="font-medium">
                    {s.sportIcon} {s.courtName}
                  </p>
                  <p className="num text-sm text-muted">
                    {dayLabel(s.startAt)} {timeRange(s.startAt, s.endAt)}
                  </p>
                </div>
                <span className="num">{baht(s.price)}</span>
              </div>
            ))}
            {b.equipment.map((e) => (
              <div key={`e${e.id}`} className="space-y-3 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-medium">
                      {e.sportIcon} {e.name} × <span className="num">{e.qty}</span>
                    </p>
                    <p className="num text-sm text-muted">
                      {dayLabel(e.startAt)} {timeRange(e.startAt, e.endAt)}
                      {e.deposit > 0 && ` มัดจำ ${baht(e.deposit)}`}
                    </p>
                    {e.returnedAt && (
                      <p className="text-sm text-turf">
                        คืนแล้ว {dateTimeTh(e.returnedAt)}
                        {e.conditionNote && ` สภาพ: ${e.conditionNote}`}
                        {e.fine > 0 && ` ค่าปรับ ${baht(e.fine)}`}
                      </p>
                    )}
                  </div>
                  <span className="num">{baht(e.price)}</span>
                </div>
                {admin && !e.returnedAt && ['paid', 'checked_in', 'completed'].includes(b.status) && <ReturnForm bookingId={b.id} itemId={e.id} onDone={refresh} />}
              </div>
            ))}
            {b.discount > 0 && (
              <div className="num flex items-baseline justify-between p-4 text-muted">
                <span>
                  ส่วนลดคูปอง {b.couponCode} (จาก {baht(b.subtotal)})
                </span>
                <span>−{baht(b.discount)}</span>
              </div>
            )}
            <div className="flex items-baseline justify-between p-4">
              <span className="text-muted">ยอดรวม</span>
              <span className="num text-2xl font-semibold">{baht(b.total)}</span>
            </div>
          </Panel>

          {b.payments.length > 0 && (
            <section className="space-y-2">
              <h2 className="text-xl font-semibold">ประวัติการชำระเงิน</h2>
              <ul className="divide-y divide-line rounded-xl border-2 border-line bg-surface">
                {b.payments.map((p) => (
                  <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 p-4">
                    <span>
                      <span className="num">{baht(p.amount)}</span> <span className="text-sm text-muted">ส่งเมื่อ {dateTimeTh(p.createdAt)}</span>
                      {p.note && <span className="block text-sm text-danger">{p.note}</span>}
                    </span>
                    <span className="flex items-center gap-3">
                      <a href={`/api/v1/payments/${p.id}/slip`} target="_blank" rel="noreferrer" className="text-sm text-info hover:underline">
                        ดูสลิป
                      </a>
                      <Badge tone={paymentStatus[p.status].tone}>{paymentStatus[p.status].label}</Badge>
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>

        <div className="space-y-4">
          <StatusPanel booking={b} onChange={refresh} />
          {canCancel && (
            <Button
              variant="quiet-danger"
              className="w-full"
              pending={cancel.isPending}
              onClick={() => window.confirm('ยืนยันการยกเลิกการจองนี้?') && cancel.mutate()}
            >
              ยกเลิกการจอง
            </Button>
          )}
          {b.status === 'paid' && !canCancel && <p className="text-center text-sm text-muted">ยกเลิกได้ก่อนเวลาเริ่มอย่างน้อย {cancelHours} ชั่วโมง</p>}
        </div>
      </div>
    </div>
  );
}

function StatusPanel({ booking: b, onChange }: { booking: Booking; onChange: (b?: Booking) => void }) {
  const me = useMe().data;
  const mine = me?.id === b.userId;
  switch (b.status) {
    case 'pending_payment':
      return <PayPanel booking={b} onChange={onChange} />;
    case 'paid':
      return (
        <Panel className="space-y-3 p-5 text-center">
          <h2 className="text-xl font-semibold">ตั๋วเช็คอิน</h2>
          {b.checkinQr && <img src={b.checkinQr} alt={`QR เช็คอินการจอง ${b.code}`} className="mx-auto w-56 rounded-xl border-8 border-white" />}
          <p className="num text-lg font-semibold">#{b.code}</p>
          <p className="text-sm text-muted">แสดง QR นี้ที่เคาน์เตอร์เพื่อเช็คอินและรับอุปกรณ์</p>
        </Panel>
      );
    case 'checked_in':
      return (
        <Panel className="p-5">
          <h2 className="text-xl font-semibold">เช็คอินแล้ว</h2>
          <p className="mt-1 text-muted">ขอให้สนุกกับการเล่น อย่าลืมคืนอุปกรณ์ที่เคาน์เตอร์ก่อนกลับ</p>
        </Panel>
      );
    case 'completed':
      return mine ? <ReviewPanel booking={b} onChange={onChange} /> : <Panel className="p-5">ใช้บริการเสร็จสิ้นแล้ว</Panel>;
    case 'expired':
      return <Panel className="p-5">หมดเวลาชำระเงิน การจองนี้ถูกยกเลิกอัตโนมัติ</Panel>;
    default:
      return <Panel className="p-5">การจองนี้ถูกยกเลิกแล้ว</Panel>;
  }
}

function useCountdown(until: string | null | undefined) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!until) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [until]);
  return until ? Math.max(0, Date.parse(until) - now) : null;
}

function PayPanel({ booking: b, onChange }: { booking: Booking; onChange: (b?: Booking) => void }) {
  const waiting = b.payments.some((p) => p.status === 'pending');
  const left = useCountdown(b.expiresAt);
  const qr = useQuery({
    queryKey: ['promptpay', b.id],
    queryFn: () => ok(api.GET('/api/v1/bookings/{id}/promptpay', { params: { path: { id: b.id } } })),
    enabled: !waiting,
  });
  const send = useMutation({
    mutationFn: (file: File) => upload<Payment>(`/api/v1/bookings/${b.id}/payments`, file),
    onSuccess: () => {
      toast.success('ส่งสลิปแล้ว รอเจ้าหน้าที่ตรวจสอบ');
      onChange();
    },
    onError: (e) => toast.error(errorText(e)),
  });
  useEffect(() => {
    if (left === 0) onChange();
  }, [left, onChange]);

  if (waiting) {
    return (
      <Panel className="space-y-2 p-5">
        <h2 className="text-xl font-semibold">รอตรวจสอบสลิป</h2>
        <p className="text-muted">เจ้าหน้าที่จะตรวจสลิปและแจ้งผลทางอีเมล เมื่ออนุมัติแล้วหน้านี้จะแสดง QR สำหรับเช็คอิน</p>
      </Panel>
    );
  }
  return (
    <Panel className="space-y-4 p-5">
      <div className="flex items-baseline justify-between">
        <h2 className="text-xl font-semibold">ชำระเงิน</h2>
        {left !== null && (
          <span className={`num text-lg font-semibold ${left < 3 * 60_000 ? 'text-danger' : ''}`} aria-live="polite">
            {String(Math.floor(left / 60_000)).padStart(2, '0')}:{String(Math.floor((left % 60_000) / 1000)).padStart(2, '0')}
          </span>
        )}
      </div>
      <p className="text-sm text-muted">สแกน QR ด้วยแอปธนาคาร ยอด {baht(b.total)} แล้วแนบสลิปก่อนหมดเวลา</p>
      {qr.data ? (
        <img src={qr.data.qr} alt={`QR PromptPay ยอด ${baht(b.total)}`} className="mx-auto w-60 rounded-xl border-8 border-white" />
      ) : qr.error ? (
        <ErrorNote error={qr.error} />
      ) : (
        <Loading label="กำลังสร้าง QR" />
      )}
      {qr.data && <p className="num text-center text-sm text-muted">PromptPay {qr.data.promptpayId}</p>}
      <Field label="แนบสลิป" hint="รูป JPG, PNG หรือ WEBP ไม่เกิน 5 MB">
        <Input
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          disabled={send.isPending}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) send.mutate(file);
          }}
        />
      </Field>
    </Panel>
  );
}

function ReviewPanel({ booking: b, onChange }: { booking: Booking; onChange: (b?: Booking) => void }) {
  const courts = [...new Map(b.slots.map((s) => [s.courtId, s])).values()].filter((s) => !b.reviewedCourtIds.includes(s.courtId));
  const review = useMutation({
    mutationFn: (body: { courtId: number; rating: number; comment: string }) =>
      ok(api.POST('/api/v1/bookings/{id}/review', { params: { path: { id: b.id } }, body })),
    onSuccess: () => {
      toast.success('ขอบคุณสำหรับรีวิว');
      onChange();
    },
    onError: (e) => toast.error(errorText(e)),
  });
  if (courts.length === 0) return <Panel className="p-5">ใช้บริการเสร็จสิ้นแล้ว ขอบคุณที่รีวิว</Panel>;
  return (
    <Panel className="space-y-5 p-5">
      <h2 className="text-xl font-semibold">รีวิวสนาม</h2>
      {courts.map((s) => (
        <ReviewForm key={s.courtId} courtName={s.courtName} pending={review.isPending} onSend={(rating, comment) => review.mutate({ courtId: s.courtId, rating, comment })} />
      ))}
    </Panel>
  );
}

function ReviewForm({ courtName, pending, onSend }: { courtName: string; pending: boolean; onSend: (rating: number, comment: string) => void }) {
  const [rating, setRating] = useState(0);
  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        const f = formData(e);
        if (rating) onSend(rating, String(f.get('comment') ?? ''));
      }}
    >
      <p className="font-medium">{courtName}</p>
      <div className="flex gap-1" role="radiogroup" aria-label="คะแนน">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={rating === n}
            aria-label={`${n} ดาว`}
            onClick={() => setRating(n)}
            className={`text-3xl leading-none transition ${n <= rating ? 'text-mark' : 'text-line hover:text-mark/60'}`}
          >
            ★
          </button>
        ))}
      </div>
      <Textarea name="comment" placeholder="เล่าประสบการณ์ เช่น พื้นสนาม แสงไฟ ความสะอาด" maxLength={1000} />
      <Button type="submit" variant="turf" pending={pending} disabled={!rating}>
        ส่งรีวิว
      </Button>
    </form>
  );
}

function ReturnForm({ bookingId, itemId, onDone }: { bookingId: number; itemId: number; onDone: (b?: Booking) => void }) {
  const ret = useMutation({
    mutationFn: (body: { conditionNote?: string; fine: number }) =>
      ok(api.POST('/api/v1/bookings/{id}/equipment/{itemId}/return', { params: { path: { id: bookingId, itemId } }, body })),
    onSuccess: (b) => {
      toast.success('บันทึกการคืนอุปกรณ์แล้ว');
      onDone(b);
    },
    onError: (e) => toast.error(errorText(e)),
  });
  return (
    <form
      className="grid gap-2 rounded-xl bg-sunken p-3 sm:grid-cols-[1fr_7rem_auto] sm:items-end"
      onSubmit={(e) => {
        const f = formData(e);
        ret.mutate({ conditionNote: String(f.get('note') || '') || undefined, fine: Number(f.get('fine') || 0) });
      }}
    >
      <Field label="สภาพตอนคืน">
        <Input name="note" placeholder="เช่น ปกติ" />
      </Field>
      <Field label="ค่าปรับ (บาท)">
        <Input name="fine" type="number" min={0} defaultValue={0} />
      </Field>
      <Button type="submit" variant="turf" pending={ret.isPending}>
        รับคืน
      </Button>
    </form>
  );
}
