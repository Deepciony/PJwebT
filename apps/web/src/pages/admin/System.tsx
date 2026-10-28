import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api, errorText, ok, type Settings } from '../../api';
import { Badge, Button, ErrorNote, Field, Input, Loading, PageHeader, Panel, Textarea } from '../../components/ui';
import { dateTimeTh } from '../../lib/format';
import { formData } from '../../lib/pick';

const fields: { name: keyof Settings; label: string; hint: string; min?: number; max?: number }[] = [
  { name: 'payWithinMinutes', label: 'เวลาชำระเงิน (นาที)', hint: 'ต้องแนบสลิปภายในกี่นาทีหลังยืนยัน ไม่งั้นการจองหมดเวลา', min: 5, max: 1440 },
  { name: 'cancelBeforeHours', label: 'ยกเลิกได้ก่อนเริ่ม (ชั่วโมง)', hint: 'สมาชิกยกเลิกการจองที่ชำระแล้วได้ถ้าเหลือเวลามากกว่านี้', min: 0, max: 720 },
  { name: 'checkinEarlyMinutes', label: 'เช็คอินล่วงหน้าได้ (นาที)', hint: 'เปิดให้เช็คอินก่อนเวลาเริ่มกี่นาที', min: 0, max: 43_200 },
  { name: 'maxDaysAhead', label: 'จองล่วงหน้าได้ (วัน)', hint: '0 = จองได้เฉพาะวันนี้, 1 = วันนี้และพรุ่งนี้ (จองประจำรายสัปดาห์ต้องตั้ง 7 ขึ้นไป)', min: 0, max: 365 },
];

const venueFields: { name: 'announcement' | 'contactPhone' | 'contactLine' | 'address'; label: string; hint?: string; max: number; long?: boolean }[] = [
  { name: 'announcement', label: 'ประกาศหน้าเว็บ', hint: 'แสดงเป็นแถบบนสุดทุกหน้า เว้นว่าง = ไม่แสดง', max: 500, long: true },
  { name: 'contactPhone', label: 'เบอร์ติดต่อ', max: 30 },
  { name: 'contactLine', label: 'LINE ID', max: 50 },
  { name: 'address', label: 'ที่อยู่', hint: 'แสดงท้ายเว็บและท้ายอีเมล', max: 300, long: true },
];

function duration(seconds: number) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return h ? `${h} ชม. ${m} นาที` : `${m} นาที`;
}

export default function System() {
  const qc = useQueryClient();
  const settings = useQuery({ queryKey: ['settings'], queryFn: () => ok(api.GET('/api/v1/settings')) });
  const system = useQuery({ queryKey: ['system'], queryFn: () => ok(api.GET('/api/v1/admin/system')), refetchInterval: 30_000 });
  const save = useMutation({
    mutationFn: (body: Partial<Settings>) => ok(api.PATCH('/api/v1/settings', { body })),
    onSuccess: (s) => {
      qc.setQueryData(['settings'], s);
      toast.success('บันทึกค่าตั้งระบบแล้ว มีผลกับรายการถัดไปทันที');
    },
  });
  const runJobs = useMutation({
    mutationFn: () => ok(api.POST('/api/v1/admin/jobs/run')),
    onSuccess: () => {
      toast.success('รันงานอัตโนมัติแล้ว');
      qc.invalidateQueries({ queryKey: ['system'] });
      qc.invalidateQueries({ queryKey: ['bookings'] });
      qc.invalidateQueries({ queryKey: ['emails'] });
    },
    onError: (e) => toast.error(errorText(e)),
  });

  return (
    <div className="space-y-6">
      <PageHeader title="ระบบหลังบ้าน" sub="ค่าตั้งการจองและการชำระเงิน ประกาศและข้อมูลติดต่อ และสถานะของเซิร์ฟเวอร์" />
      <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <Panel className="p-5">
          <h2 className="mb-4 text-lg">ค่าตั้งการจองและการชำระเงิน</h2>
          <p className="-mt-2 mb-4 text-sm text-muted">ราคาสนามและอุปกรณ์แก้ได้ที่เมนูจัดการข้อมูล</p>
          {settings.isPending ? (
            <Loading />
          ) : settings.error ? (
            <ErrorNote error={settings.error} />
          ) : (
            <form
              key={JSON.stringify(settings.data)}
              className="grid gap-4 sm:grid-cols-2"
              onSubmit={(e) => {
                const f = formData(e);
                save.mutate({
                  promptpayId: String(f.get('promptpayId')),
                  ...Object.fromEntries(fields.map((d) => [d.name, Number(f.get(d.name))])),
                  ...Object.fromEntries(venueFields.map((d) => [d.name, String(f.get(d.name))])),
                });
              }}
            >
              <div className="sm:col-span-2">
                <Field label="PromptPay ที่รับเงิน" hint="เบอร์มือถือ 10 หลัก หรือเลขประจำตัว 13 หลัก ใช้สร้าง QR ทุกการจอง">
                  <Input name="promptpayId" defaultValue={settings.data.promptpayId} required pattern="0[0-9]{9}|[0-9]{13}" inputMode="numeric" />
                </Field>
              </div>
              {fields.map((d) => (
                <Field key={d.name} label={d.label} hint={d.hint}>
                  <Input name={d.name} type="number" min={d.min} max={d.max} defaultValue={settings.data[d.name]} required />
                </Field>
              ))}
              <h2 className="mt-2 text-xl font-semibold sm:col-span-2">ข้อมูลสนามและประกาศ</h2>
              {venueFields.map((d) => (
                <div key={d.name} className={d.long ? 'sm:col-span-2' : ''}>
                  <Field label={d.label} hint={d.hint}>
                    {d.long ? (
                      <Textarea name={d.name} defaultValue={settings.data[d.name]} maxLength={d.max} rows={2} />
                    ) : (
                      <Input name={d.name} defaultValue={settings.data[d.name]} maxLength={d.max} />
                    )}
                  </Field>
                </div>
              ))}
              <div className="sm:col-span-2">
                <ErrorNote error={save.error} />
              </div>
              <div className="flex justify-end sm:col-span-2">
                <Button type="submit" variant="primary" pending={save.isPending}>
                  บันทึกค่าตั้งระบบ
                </Button>
              </div>
            </form>
          )}
        </Panel>

        <div className="space-y-6">
          <Panel className="space-y-3 p-5">
            <h2 className="text-xl font-semibold">สถานะระบบ</h2>
            {system.isPending ? (
              <Loading />
            ) : system.error ? (
              <ErrorNote error={system.error} />
            ) : (
              <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
                <dt className="text-muted">ฐานข้อมูล</dt>
                <dd>
                  <Badge tone={system.data.db ? 'turf' : 'danger'}>{system.data.db ? 'ปกติ' : 'เชื่อมต่อไม่ได้'}</Badge> PostgreSQL {system.data.postgresVersion}
                </dd>
                <dt className="text-muted">ส่งอีเมลออก</dt>
                <dd>
                  <Badge tone={system.data.smtpEnabled ? 'turf' : 'muted'}>{system.data.smtpEnabled ? 'เปิด (SMTP)' : 'ในเว็บเท่านั้น'}</Badge>
                  {system.data.counts.emailsFailed > 0 && <span className="ml-2 text-danger">ส่งไม่สำเร็จ {system.data.counts.emailsFailed} ฉบับ</span>}
                </dd>
                <dt className="text-muted">งานอัตโนมัติ</dt>
                <dd>{system.data.lastJobRunAt ? `ล่าสุด ${dateTimeTh(system.data.lastJobRunAt)}` : 'ยังไม่ได้รันตั้งแต่เปิดเซิร์ฟเวอร์'}</dd>
                <dt className="text-muted">ทำงานมาแล้ว</dt>
                <dd>
                  {duration(system.data.uptimeSeconds)} (Node {system.data.nodeVersion})
                </dd>
                <dt className="text-muted">ข้อมูล</dt>
                <dd className="num">
                  ผู้ใช้ {system.data.counts.users} การจอง {system.data.counts.bookings} อีเมล {system.data.counts.emails}
                </dd>
                <dt className="text-muted">Migration</dt>
                <dd className="text-xs">{system.data.migrations.join(', ')}</dd>
              </dl>
            )}
          </Panel>
          <Panel className="space-y-3 p-5">
            <h2 className="text-xl font-semibold">งานอัตโนมัติ</h2>
            <p className="text-sm text-muted">
              ระบบรันเองทุก 1 นาที: ยกเลิกการจองที่หมดเวลาชำระ ปิดการจองที่จบแล้ว ส่งอีเมลเตือนก่อนเวลา 1 ชั่วโมง และล้างตะกร้าที่เลยเวลา
            </p>
            <Button variant="turf" className="w-full" pending={runJobs.isPending} onClick={() => runJobs.mutate()}>
              รันตอนนี้เลย
            </Button>
          </Panel>
        </div>
      </div>
    </div>
  );
}
