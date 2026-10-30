import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import { errorText, useSettings } from '../api';
import { Badge, Button, Empty, ErrorNote, Input, LinkButton, Loading, PageHeader, Panel, Steps } from '../components/ui';
import { useCart, useCartActions } from '../lib/cart';
import { confirm as askConfirm } from '../lib/confirm';
import { baht, bangkokDate, dateTh, dayLabel, timeRange } from '../lib/format';
import { formData } from '../lib/pick';

export default function Cart() {
  const cart = useCart(true);
  const actions = useCartActions();
  const navigate = useNavigate();
  const payWithin = useSettings().data?.payWithinMinutes ?? 15;

  if (cart.isPending) return <Loading />;
  if (cart.error) return <ErrorNote error={cart.error} />;
  const c = cart.data;
  const count = c.slots.length + c.equipment.length;
  const anyTaken = c.slots.some((s) => s.taken);

  const confirm = () =>
    actions.confirm.mutate(undefined, {
      onSuccess: (booking) => {
        toast.success(booking.status === 'paid' ? 'ยืนยันการจองแล้ว ไม่มียอดที่ต้องชำระ' : `ยืนยันการจองแล้ว กรุณาชำระเงินภายใน ${payWithin} นาที`);
        navigate(`/bookings/${booking.id}`);
      },
      onError: (e) => toast.error(errorText(e)),
    });
  const clear = async () => {
    if (await askConfirm('ลบทุกรายการในตะกร้า?')) actions.clear.mutate(undefined, { onSuccess: () => toast('ลบตะกร้าแล้ว') });
  };
  // edit = go back to where it was added; the slot/equipment picker there shows this item so it can be changed
  const editSlot = (courtId: number, startAt: string) => navigate(`/courts/${courtId}?date=${bangkokDate(new Date(startAt))}`);
  const editEquipment = (equipmentId: number, cartItemId: number, startAt: string) => {
    actions.removeEquipment.mutate(cartItemId);
    navigate(`/equipment/${equipmentId}?date=${bangkokDate(new Date(startAt))}`);
  };

  return (
    <div className="space-y-5">
      <PageHeader title="ตะกร้า" sub={`การจองเลขที่ ${c.code} · ตรวจรายการ ใส่คูปอง (ถ้ามี) แล้วกดยืนยัน`} />
      <Steps items={['ตรวจรายการ', 'ยืนยันการจอง', `ชำระด้วย PromptPay ภายใน ${payWithin} นาที`, 'แนบสลิปแล้วรอตรวจ']} />
      {count === 0 ? (
        <Empty title="ตะกร้ายังว่าง">
          <div className="flex flex-wrap justify-center gap-3">
            <LinkButton to="/book" variant="primary">
              ดูตารางสนามว่าง
            </LinkButton>
            <LinkButton to="/equipment">ยืมอุปกรณ์</LinkButton>
          </div>
        </Empty>
      ) : (
        <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <Panel className="h-fit overflow-hidden">
            <div className="flex items-center justify-between gap-3 border-b border-line bg-sunken/50 px-5 py-3">
              <h2 className="text-lg">รายการ <span className="num text-sm font-normal text-muted">({count})</span></h2>
              <span className="text-sm text-muted">สร้างเมื่อ {dateTh(c.createdAt)}</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="text-sm text-muted">
                  <tr className="border-b border-line">
                    <th className="px-5 py-3 font-medium">#</th>
                    <th className="px-2 py-3 font-medium">รายการ</th>
                    <th className="px-2 py-3 font-medium">วันเวลา</th>
                    <th className="px-2 py-3 text-right font-medium">ราคา</th>
                    <th className="px-5 py-3">
                      <span className="sr-only">ลบ</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {c.slots.map((s, i) => (
                    <tr key={`s${s.id}`} className="border-b border-line last:border-0">
                      <td className="num px-5 py-3 text-muted">{i + 1}</td>
                      <td className="px-2 py-3">
                        {s.sportIcon} {s.courtName} {s.taken && <Badge tone="danger">มีคนจองไปแล้ว</Badge>}
                      </td>
                      <td className="num px-2 py-3">
                        {dayLabel(s.startAt)} {timeRange(s.startAt, s.endAt)}
                      </td>
                      <td className="num px-2 py-3 text-right">{baht(s.price)}</td>
                      <td className="px-5 py-3 text-right whitespace-nowrap">
                        <Button size="sm" variant="quiet" onClick={() => editSlot(s.courtId, s.startAt)}>
                          แก้ไข
                        </Button>
                        <Button size="sm" variant="quiet" pending={actions.removeSlot.isPending && actions.removeSlot.variables === s.id} onClick={() => actions.removeSlot.mutate(s.id)}>
                          ลบ
                        </Button>
                      </td>
                    </tr>
                  ))}
                  {c.equipment.map((e, i) => (
                    <tr key={`e${e.id}`} className="border-b border-line last:border-0">
                      <td className="num px-5 py-3 text-muted">{c.slots.length + i + 1}</td>
                      <td className="px-2 py-3">
                        {e.sportIcon} {e.name} × <span className="num">{e.qty}</span>
                      </td>
                      <td className="num px-2 py-3">
                        {dayLabel(e.startAt)} {timeRange(e.startAt, e.endAt)}
                      </td>
                      <td className="num px-2 py-3 text-right">{baht(e.price)}</td>
                      <td className="px-5 py-3 text-right whitespace-nowrap">
                        <Button size="sm" variant="quiet" onClick={() => editEquipment(e.equipmentId, e.id, e.startAt)}>
                          แก้ไข
                        </Button>
                        <Button
                          size="sm"
                          variant="quiet"
                          pending={actions.removeEquipment.isPending && actions.removeEquipment.variables === e.id}
                          onClick={() => actions.removeEquipment.mutate(e.id)}
                        >
                          ลบ
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>

          <Panel className="h-fit space-y-4 p-5 lg:sticky lg:top-28">
            <h2 className="text-lg">สรุปยอด</h2>
            <dl className="num grid grid-cols-2 gap-y-1">
              <dt className="text-muted">ยอดก่อนส่วนลด</dt>
              <dd className="text-right">{baht(c.subtotal)}</dd>
              <dt className="text-muted">ส่วนลด</dt>
              <dd className="text-right">{c.discount > 0 ? `−${baht(c.discount)}` : '-'}</dd>
            </dl>
            <div className="flex items-baseline justify-between rounded-xl bg-sunken px-4 py-3">
              <span className="label">ยอดชำระ</span>
              <span className="num text-3xl font-extrabold">{baht(c.total)}</span>
            </div>
            {c.couponCode ? (
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-turf-soft px-4 py-3">
                <span>
                  คูปอง <span className="num font-semibold">{c.couponCode}</span>{' '}
                  {c.discount > 0 ? (
                    <span className="num">ลด {baht(c.discount)}</span>
                  ) : (
                    <span className="text-sm text-muted">ยอดยังไม่ถึงขั้นต่ำของคูปอง</span>
                  )}
                </span>
                <Button size="sm" variant="quiet" pending={actions.removeCoupon.isPending} onClick={() => actions.removeCoupon.mutate()}>
                  เอาคูปองออก
                </Button>
              </div>
            ) : (
              <form
                className="flex gap-2"
                onSubmit={(e) => {
                  const code = String(formData(e).get('code')).trim();
                  if (code) actions.applyCoupon.mutate(code, { onSuccess: () => toast.success('ใช้คูปองแล้ว'), onError: (err) => toast.error(errorText(err)) });
                }}
              >
                <Input name="code" placeholder="รหัสคูปอง" aria-label="รหัสคูปอง" className="min-w-0 uppercase" />
                <Button type="submit" pending={actions.applyCoupon.isPending}>
                  ใช้คูปอง
                </Button>
              </form>
            )}
            {c.depositTotal > 0 && <p className="text-sm text-muted">มัดจำอุปกรณ์ {baht(c.depositTotal)} จ่ายที่เคาน์เตอร์ตอนรับของ และได้คืนเมื่อคืนอุปกรณ์</p>}
            {anyTaken && <ErrorNote error="มีช่วงเวลาที่คนอื่นจองไปแล้ว กรุณาลบออกก่อนยืนยัน" />}
            <Button variant="primary" size="lg" className="w-full" onClick={confirm} pending={actions.confirm.isPending} disabled={anyTaken}>
              ยืนยันการจอง
            </Button>
            <p className="text-sm text-muted">หลังยืนยันจะแก้ไขรายการไม่ได้ และต้องชำระเงินภายใน {payWithin} นาที</p>
            <Button variant="quiet-danger" size="sm" className="w-full" onClick={clear} pending={actions.clear.isPending}>
              ลบทั้งตะกร้า
            </Button>
          </Panel>
        </div>
      )}
    </div>
  );
}
