import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router';
import { api, ok, useMe, useSettings } from '../api';
import { Emblem } from '../components/Layout';
import { useSports } from '../components/Pickers';
import { LinkButton, Section, SportArt, StatBox } from '../components/ui';
import { baht, bangkokDate } from '../lib/format';

// The front page is a poster: what SportHub is, how booking works, what you can play and the house rules.
// Booking itself lives on /book.

const duration = (minutes: number) => (minutes >= 60 && minutes % 60 === 0 ? `${minutes / 60} ชั่วโมง` : `${minutes} นาที`);

const features: [string, string, string][] = [
  ['📅', 'ตารางว่างแบบเรียลไทม์', 'เห็นทุกสนามทุกชั่วโมงในหน้าเดียว ช่องเปลี่ยนสถานะทันทีเมื่อมีคนจอง ไม่ต้องโทรถาม'],
  ['🏸', 'ยืมอุปกรณ์ไปพร้อมกัน', 'ไม้แบด ลูกบอล เสื้อเอี๊ยม ฯลฯ ใส่ตะกร้าเดียวกับสนาม ระบบเช็คจำนวนของที่เหลือให้'],
  ['💳', 'จ่ายด้วย PromptPay', 'สแกน QR ตามยอดจริงจากแอปธนาคารไหนก็ได้ แนบสลิป แล้วรอเจ้าหน้าที่ตรวจ'],
  ['🎟️', 'ตั๋ว QR เช็คอิน', 'ชำระแล้วได้ตั๋วในกล่องข้อความ แสดง QR ที่เคาน์เตอร์เพื่อเข้าสนามและรับอุปกรณ์'],
  ['🏷️', 'คูปองและราคาช่วงเวลา', 'ใช้คูปองส่วนลดในตะกร้า บางสนามมีราคาช่วงเย็น (peak) แสดงชัดก่อนจอง'],
  ['⭐', 'รีวิวจากผู้เล่นจริง', 'ใช้บริการเสร็จแล้วให้ดาวและความเห็นได้ ดูคะแนนแต่ละสนามก่อนตัดสินใจ'],
];

export default function Home() {
  const me = useMe().data;
  const settings = useSettings().data;
  const sports = useSports().data ?? [];
  const courts = useQuery({ queryKey: ['courts', undefined, ''], queryFn: () => ok(api.GET('/api/v1/courts')) }).data ?? [];
  const today = bangkokDate();
  // same cache entry as the booking board, so going on to /book is instant
  const board = useQuery({
    queryKey: ['board', today, undefined],
    queryFn: () => ok(api.GET('/api/v1/availability', { params: { query: { date: today } } })),
  }).data;
  const freeToday = board?.courts.reduce((n, c) => n + c.slots.filter((s) => s.status === 'free').length, 0);
  const names = sports.map((s) => s.name);
  const sportList = names.length > 5 ? `${names.slice(0, 3).join(' ')} ไปจนถึง${names.slice(-3).join(' ')}` : names.join(' ');
  const fromPrice = (sportId: number) => Math.min(...courts.filter((c) => c.sportId === sportId).map((c) => c.pricePerHour));

  const ahead = settings?.maxDaysAhead ?? 1;
  const payWithin = settings?.payWithinMinutes ?? 15;
  const steps: [string, string][] = [
    ['เลือกวันและสนาม', 'เปิดหน้า "ตารางว่าง" แล้วกดช่องสีเขียวของสนามและชั่วโมงที่ต้องการ'],
    ['เพิ่มอุปกรณ์', 'ถ้าต้องการ ไปที่ "ยืมอุปกรณ์" เลือกเวลาและจำนวนชิ้น (ข้ามได้)'],
    ['ยืนยันที่ตะกร้า', 'ตรวจรายการ ใส่คูปอง (ถ้ามี) แล้วกด "ยืนยันการจอง"'],
    ['ชำระเงิน', `สแกน QR PromptPay แล้วแนบสลิปภายใน ${duration(payWithin)}`],
    ['รับตั๋วแล้วเช็คอิน', 'เจ้าหน้าที่อนุมัติแล้วคุณจะได้ตั๋ว QR แสดงที่เคาน์เตอร์ก่อนเล่น'],
  ];
  const rules: [string, string][] = [
    ['จองล่วงหน้า', ahead === 0 ? 'เฉพาะวันนี้' : ahead === 1 ? 'วันนี้และพรุ่งนี้' : `ได้ถึง ${ahead} วัน`],
    ['ช่องเวลา', 'ช่องละ 1 ชั่วโมง'],
    ['ชำระเงินภายใน', duration(payWithin)],
    ['ยกเลิกได้ก่อนเริ่ม', duration((settings?.cancelBeforeHours ?? 24) * 60)],
    ['เช็คอินก่อนเวลาได้', duration(settings?.checkinEarlyMinutes ?? 30)],
  ];

  return (
    <div className="space-y-14">
      {/* hero poster */}
      {/* text in the left half from the edge; the wheel centred in the right half, shrinking if the half is narrow */}
      {/* arena photo behind, darkened on the left so the text stays readable */}
      <section className="grid items-center gap-8 rounded-2xl border-2 border-line bg-[linear-gradient(90deg,rgb(18_13_28/0.94)_0%,rgb(29_21_48/0.78)_45%,rgb(29_21_48/0.35)_100%),url(/hero-arena.jpg)] bg-cover bg-center p-6 sm:p-10 lg:grid-cols-2 lg:gap-12">
        <div className="space-y-7">
          <p className="inline-flex items-center gap-2 rounded-full border-2 border-line bg-sunken px-4 py-1.5 text-sm sm:text-base">
            <span className="size-2 rounded-full bg-turf" aria-hidden /> ระบบจองสนามกีฬาและยืมอุปกรณ์ออนไลน์
          </p>
          <h1 className="text-[clamp(2.75rem,4.6vw,6rem)] leading-[1.15]">
            จองสนาม <span className="inline-block">ยืมอุปกรณ์</span>
            <br />
            <span className="text-mark">จบในที่เดียว</span>
          </h1>
          <p className="max-w-4xl text-lg text-muted sm:text-xl 2xl:text-2xl">
            SportHub รวมสนามกีฬา {sports.length || 'หลาย'} ประเภท{sportList && ` ตั้งแต่${sportList}`} ไว้ในตารางเดียว ดูว่าชั่วโมงไหนว่าง กดจอง จ่ายด้วย
            PromptPay แล้วใช้ตั๋ว QR เช็คอินที่หน้าสนาม ไม่ต้องโทร ไม่ต้องรอคิว
          </p>
          <div className="flex flex-wrap gap-3">
            <LinkButton to="/book" variant="primary" className="h-12 px-6 text-lg">
              ดูตารางว่างและจองเลย
            </LinkButton>
            <LinkButton to="/courts" className="h-12 px-6">
              ดูสนามทั้งหมด
            </LinkButton>
            {!me && (
              <LinkButton to="/register" variant="quiet" className="h-12">
                สมัครสมาชิกฟรี
              </LinkButton>
            )}
          </div>
          <div className="flex flex-wrap gap-3">
            <StatBox label="สนาม" value={courts.length || '-'} unit="สนาม" />
            <StatBox label="ประเภทกีฬา" value={sports.length || '-'} unit="กีฬา" />
            <StatBox label="ว่างวันนี้" value={freeToday ?? '-'} unit="ชั่วโมง" />
          </div>
        </div>

        <div
          className="relative mx-auto grid aspect-square w-full max-w-[32rem] place-items-center rounded-full bg-[radial-gradient(circle_at_50%_50%,rgb(124_92_230/0.5),transparent_68%)] lg:max-w-[30rem] xl:max-w-[36rem] 2xl:max-w-[42rem]"
          aria-hidden
        >
          <div className="absolute inset-[12%] rounded-full border-2 border-dashed border-line/60" />
          <Emblem className="size-44 drop-shadow-[0_0_30px_rgb(124_92_230/0.9)] sm:size-56 xl:size-64 2xl:size-80" />
          {sports.map((s, i) => {
            const angle = (i / sports.length) * 2 * Math.PI - Math.PI / 2;
            const position = { left: `${50 + 42 * Math.cos(angle)}%`, top: `${50 + 42 * Math.sin(angle)}%` };
            // up to 8 sports fit as named chips; beyond that the ring shows icons only
            return sports.length > 8 ? (
              <span
                key={s.id}
                title={s.name}
                className="absolute grid size-11 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-2 border-line bg-sunken text-xl shadow-lg xl:size-14 xl:text-2xl 2xl:size-16 2xl:text-3xl"
                style={position}
              >
                {s.icon}
              </span>
            ) : (
              <span
                key={s.id}
                className="absolute flex -translate-x-1/2 -translate-y-1/2 items-center gap-1.5 rounded-full border-2 border-line bg-sunken px-3 py-1.5 text-sm font-semibold whitespace-nowrap shadow-lg"
                style={position}
              >
                <span className="text-lg">{s.icon}</span>
                {s.name}
              </span>
            );
          })}
        </div>
      </section>

      <Section kicker="What is SportHub" title="ทำอะไรได้บ้าง" sub="ทุกอย่างที่ต้องใช้ตั้งแต่หาสนามว่างจนเข้าเล่นจริง อยู่ในเว็บเดียว ใช้ได้ทั้งคอมและมือถือ">
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {features.map(([icon, title, text]) => (
            <li key={title} className="flex gap-4 rounded-xl border-2 border-line bg-surface p-5">
              <span className="grid size-12 shrink-0 place-items-center rounded-full bg-violet text-2xl ring-2 ring-mark" aria-hidden>
                {icon}
              </span>
              <div>
                <h3 className="text-lg">{title}</h3>
                <p className="text-muted">{text}</p>
              </div>
            </li>
          ))}
        </ul>
      </Section>

      <Section kicker="How it works" title="จองยังไง" sub="5 ขั้นตอน ใช้เวลาไม่กี่นาที">
        <ol className="relative grid gap-4 md:grid-cols-5">
          <span className="absolute top-6 right-[10%] left-[10%] hidden h-0.5 bg-linear-to-r from-mark via-line-hi to-line md:block" aria-hidden />
          {steps.map(([title, text], i) => (
            <li key={title} className="relative flex gap-4 md:flex-col md:items-center md:text-center">
              <span className="num z-10 grid size-12 shrink-0 place-items-center rounded-full border-2 border-mark bg-sunken text-xl font-extrabold text-mark shadow-[0_0_14px_rgb(245_197_66/0.35)]">
                {i + 1}
              </span>
              <div className="rounded-xl border-2 border-line bg-surface p-4 md:w-full">
                <h3 className="text-base">{title}</h3>
                <p className="text-sm text-muted">{text}</p>
              </div>
            </li>
          ))}
        </ol>
      </Section>

      <Section kicker="Sports" title="กีฬาที่เปิดให้จอง" sub="กดกีฬาเพื่อดูสนามทั้งหมดของกีฬานั้น ราคาเป็นราคาต่อชั่วโมง">
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
          {sports.map((s) => (
            <li key={s.id}>
              <Link
                to={`/courts?sport=${s.id}`}
                className="flex h-full flex-col overflow-hidden rounded-xl border-2 border-line bg-surface transition hover:-translate-y-0.5 hover:border-line-hi"
              >
                <SportArt icon={s.icon} sportId={s.id} imageUrl={courts.find((c) => c.sportId === s.id && c.imageUrl)?.imageUrl} className="aspect-[2/1] w-full" />
                <div className="flex flex-1 items-end justify-between gap-3 p-4">
                  <div>
                    <h3 className="text-lg">{s.name}</h3>
                    <p className="text-sm text-muted">
                      {s.courtCount} สนาม · อุปกรณ์ {s.equipmentCount} รายการ
                    </p>
                  </div>
                  {s.courtCount > 0 && courts.length > 0 && (
                    <div className="text-right">
                      <p className="label">เริ่มต้น</p>
                      <p className="num font-bold">{baht(fromPrice(s.id))}</p>
                    </div>
                  )}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </Section>

      <Section kicker="Rules" title="กติกาการจอง" sub="ผู้ดูแลสนามปรับค่าเหล่านี้ได้ ตัวเลขด้านล่างคือค่าที่ใช้อยู่ตอนนี้">
        <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {rules.map(([k, v]) => (
            <div key={k} className="rounded-xl bg-sunken p-4">
              <dt className="label">{k}</dt>
              <dd className="num text-xl font-bold">{v}</dd>
            </div>
          ))}
        </dl>
      </Section>

      <section className="flex flex-wrap items-center justify-between gap-6 rounded-2xl border-2 border-mark/60 bg-[radial-gradient(circle_at_0%_0%,rgb(245_197_66/0.18),transparent_55%)] bg-surface p-6 sm:p-8">
        <div>
          <h2 className="text-2xl sm:text-3xl">พร้อมลงสนามแล้วใช่ไหม</h2>
          <p className="text-muted">
            ตอนนี้ว่างอยู่ {freeToday ?? '-'} ชั่วโมงในวันนี้
            {settings?.contactPhone && ` · สอบถาม โทร ${settings.contactPhone}`}
            {settings?.contactLine && ` · LINE ${settings.contactLine}`}
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <LinkButton to="/about" className="h-12 px-6">
            ระบบนี้สร้างยังไง
          </LinkButton>
          <LinkButton to="/book" variant="primary" className="h-12 px-6 text-lg">
            ไปที่ตารางว่าง
          </LinkButton>
        </div>
      </section>
    </div>
  );
}
