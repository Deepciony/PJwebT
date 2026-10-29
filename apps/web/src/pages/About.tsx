import { useQuery } from '@tanstack/react-query';
import { Fragment, useState } from 'react';
import { toast } from 'sonner';
import project from 'virtual:project-files';
import { Input, InfoChip, Loading, Modal, PageHeader, Panel, Section, StatBox } from '../components/ui';
import { dateTimeTh } from '../lib/format';

const github = (path: string) => `https://github.com/Deepciony/PJwebT/blob/feat/sporthub/${path}`;

// The real source of one repo file, shipped by the project-files plugin as /source/<path>.txt.
function SourceViewer({ path, onClose }: { path: string | null; onClose: () => void }) {
  const source = useQuery({
    queryKey: ['source', path],
    queryFn: async () => {
      const res = await fetch(`/source/${path!.split('/').map(encodeURIComponent).join('/')}.txt`);
      if (!res.ok) throw new Error(`เปิดไฟล์ไม่ได้ (${res.status})`);
      return res.text();
    },
    enabled: Boolean(path),
    staleTime: Number.POSITIVE_INFINITY,
  });
  const lines = source.data?.split('\n') ?? [];
  const copy = () =>
    navigator.clipboard.writeText(source.data ?? '').then(
      () => toast.success('คัดลอกโค้ดแล้ว'),
      () => toast.error('คัดลอกไม่ได้ ลองลากคลุมแล้วกด Ctrl+C'),
    );
  return (
    <Modal open={Boolean(path)} onClose={onClose} title={<span className="font-mono text-base normal-case">{path}</span>} wide>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-sm text-muted">
        <span>{source.data ? `${lines.length} บรรทัด` : ''}</span>
        <span className="flex gap-4">
          <button type="button" onClick={copy} disabled={!source.data} className="underline hover:text-ink">
            คัดลอกโค้ด
          </button>
          {path && (
            <a href={github(path)} target="_blank" rel="noreferrer" className="underline hover:text-ink">
              เปิดบน GitHub
            </a>
          )}
        </span>
      </div>
      {source.isPending ? (
        <Loading />
      ) : source.isError ? (
        <p className="text-danger">{source.error.message}</p>
      ) : (
        <pre className="max-h-[70vh] overflow-auto rounded-lg border border-line bg-black/45 py-2 font-mono text-xs leading-5">
          <code className="grid grid-cols-[auto_1fr]">
            {lines.map((line, i) => (
              <Fragment key={i}>
                <span className="num px-3 text-right text-muted/60 select-none">{i + 1}</span>
                <span className="pr-4 whitespace-pre">{line || ' '}</span>
              </Fragment>
            ))}
          </code>
        </pre>
      )}
    </Modal>
  );
}

// Every file in the repo and what it is for, read from the files themselves at build / dev time.
function ProjectFiles() {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState<string | null>(null);
  const files = project.files.filter((f) => !q || `${f.path} ${f.about}`.toLowerCase().includes(q.toLowerCase()));
  const groups = new Map<string, typeof files>();
  for (const f of files) {
    const parts = f.path.split('/');
    const folder = parts.length > 1 ? parts.slice(0, -1).join('/') + '/' : '(โฟลเดอร์หลัก)';
    groups.set(folder, [...(groups.get(folder) ?? []), f]);
  }
  const lines = project.files.reduce((n, f) => n + f.lines, 0);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <StatBox label="ไฟล์" value={project.files.length} unit="ไฟล์" />
        <StatBox label="โค้ดและข้อความ" value={lines.toLocaleString('th-TH')} unit="บรรทัด" />
        <StatBox label="โฟลเดอร์" value={new Set(project.files.map((f) => f.path.split('/').slice(0, -1).join('/'))).size} unit="โฟลเดอร์" />
        <div className="w-full sm:ml-auto sm:w-72">
          <Input type="search" placeholder="ค้นหาไฟล์หรือคำอธิบาย" value={q} onChange={(e) => setQ(e.target.value)} aria-label="ค้นหาไฟล์" />
        </div>
      </div>
      <p className="text-sm text-muted">
        อ่านจากไฟล์จริงล่าสุดเมื่อ {dateTimeTh(project.generatedAt)} · คำอธิบายมาจาก comment บรรทัดแรกของแต่ละไฟล์ · <b className="text-mark">กดชื่อไฟล์เพื่อดูโค้ดจริง</b>
      </p>
      <SourceViewer path={open} onClose={() => setOpen(null)} />
      <div className="space-y-2">
        {[...groups].map(([folder, list]) => (
          <details key={folder} open={Boolean(q)} className="group rounded-xl border-2 border-line bg-surface">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-2.5 font-mono text-sm font-semibold">
              <span>📁 {folder}</span>
              <span className="text-xs font-normal text-muted">
                {list.length} ไฟล์ <span className="inline-block transition group-open:rotate-90">›</span>
              </span>
            </summary>
            <table className="w-full text-sm">
              <tbody>
                {list.map((f) => (
                  <tr key={f.path} className="border-t border-line/50 align-top">
                    <td className="w-64 px-4 py-1.5 font-mono font-semibold break-all">
                      {f.view ? (
                        <button type="button" onClick={() => setOpen(f.path)} className="text-left text-mark underline decoration-mark/40 underline-offset-2 hover:decoration-mark">
                          {f.path.split('/').pop()}
                        </button>
                      ) : (
                        f.path.split('/').pop() || f.path
                      )}
                    </td>
                    <td className="px-2 py-1.5 text-muted">{f.about || '-'}</td>
                    <td className="num px-4 py-1.5 text-right whitespace-nowrap text-muted">{f.lines ? `${f.lines} บรรทัด` : ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </details>
        ))}
      </div>
    </div>
  );
}

// What Arena Hub is built with and how it works, for the presentation and anyone curious.
// Endpoint counts are read live from /openapi.json; the schema below mirrors apps/api/db/migrations.

type OpenApi = { paths: Record<string, Record<string, { tags?: string[] }>> };

const tagTh: Record<string, string> = {
  System: 'ระบบ',
  Auth: 'เข้าสู่ระบบ',
  Users: 'สมาชิก',
  Sports: 'กีฬา',
  Courts: 'สนาม',
  Equipment: 'อุปกรณ์',
  Cart: 'ตะกร้า',
  Bookings: 'การจอง',
  Payments: 'ชำระเงิน',
  Reviews: 'รีวิว',
  Realtime: 'เรียลไทม์',
  Emails: 'อีเมล',
  Admin: 'ผู้ดูแล',
};

const stack: [string, string, [string, string][]][] = [
  [
    '🖥️',
    'หน้าเว็บ (Frontend)',
    [
      ['React 19', 'สร้างหน้าจอเป็นคอมโพเนนต์'],
      ['Vite 8', 'dev server และ build ไฟล์สำหรับใช้งานจริง'],
      ['TypeScript 7', 'ภาษาเดียวกันทั้งเว็บและ API ตรวจชนิดข้อมูลก่อนรัน'],
      ['Tailwind CSS 4', 'จัดหน้าและธีมสีม่วงทั้งเว็บ'],
      ['TanStack Query 5', 'ดึงข้อมูลจาก API เก็บ cache และโหลดใหม่อัตโนมัติ'],
      ['React Router 8', 'เปลี่ยนหน้าโดยไม่โหลดทั้งเว็บใหม่'],
      ['openapi-fetch', 'เรียก API ด้วยชนิดข้อมูลที่สร้างจากเอกสาร OpenAPI'],
      ['html5-qrcode', 'สแกน QR เช็คอินด้วยกล้อง'],
      ['sonner', 'ข้อความแจ้งเตือนด้านล่างจอ'],
    ],
  ],
  [
    '⚙️',
    'เซิร์ฟเวอร์ (Backend)',
    [
      ['Node.js 24', 'รันโค้ดฝั่งเซิร์ฟเวอร์'],
      ['Express 5', 'REST API ทุก endpoint อยู่ใต้ /api/v1'],
      ['Zod 4', 'ตรวจข้อมูลที่ส่งเข้ามา และสร้างเอกสาร API จาก schema เดียวกัน'],
      ['pg (node-postgres)', 'ส่ง SQL ไป PostgreSQL แบบ parameterized ($1, $2) กัน SQL injection'],
      ['argon2', 'เข้ารหัสรหัสผ่านแบบ argon2id'],
      ['jose', 'สร้างและตรวจ JWT สำหรับการเข้าสู่ระบบ'],
      ['multer', 'รับไฟล์รูปและสลิป เฉพาะรูปภาพไม่เกิน 5 MB'],
      ['helmet, express-rate-limit', 'header ด้านความปลอดภัย และจำกัดการลอง login (30 ครั้ง / 15 นาที)'],
      ['nodemailer', 'ส่งอีเมลออกทาง SMTP เมื่อตั้งค่าไว้'],
      ['promptpay-qr, qrcode', 'สร้าง QR PromptPay ตามยอด และ QR ตั๋วเช็คอิน'],
    ],
  ],
  [
    '🗄️',
    'ฐานข้อมูล',
    [
      ['PostgreSQL 18', 'เก็บข้อมูลทั้งหมดของระบบ'],
      ['Docker Compose', 'รัน PostgreSQL ด้วยคำสั่งเดียว ได้เวอร์ชันเดียวกันทุกเครื่อง'],
      ['ไฟล์ migration .sql', 'สร้างตารางตามลำดับ 001–004 และจดไว้ในตาราง migrations'],
      ['btree_gist', 'extension ที่ทำให้ใช้ exclusion constraint กันจองซ้อนได้'],
    ],
  ],
  [
    '🧪',
    'เอกสารและการทดสอบ',
    [
      ['OpenAPI 3.1 + Scalar', 'เอกสาร API ออนไลน์ที่ /docs สร้างจากโค้ดโดยตรง กดทดลองเรียกได้'],
      ['Vitest + Supertest', 'ชุดทดสอบ API อัตโนมัติ รันกับ PostgreSQL จริง (ฐานข้อมูล sporthub_test)'],
      ['Playwright', 'ทดสอบผ่านเบราว์เซอร์จริง และถ่ายภาพหน้าจอสำหรับคู่มือ'],
    ],
  ],
  [
    '📦',
    'โครงสร้างโปรเจกต์และการติดตั้ง',
    [
      ['pnpm workspaces', 'repo เดียวแยกเป็น apps/api และ apps/web'],
      ['Dockerfile', 'image เดียว build หน้าเว็บแล้วให้ API เสิร์ฟบนโดเมนเดียวกัน และ migrate ฐานข้อมูลตอนเริ่ม'],
    ],
  ],
];

type Col = [name: string, type: string, note?: string];
type Table = { name: string; th: string; desc: string; cols: Col[] };

const tables: Table[] = [
  {
    name: 'users',
    th: 'สมาชิกและผู้ดูแลระบบ',
    desc: 'ทุกบัญชีในระบบ แยกสิทธิ์ด้วย role และระงับบัญชีด้วย status',
    cols: [
      ['id', 'int', 'PK'],
      ['email', 'text', 'UNIQUE'],
      ['password_hash', 'text', 'argon2id'],
      ['name', 'text'],
      ['phone', 'text', 'ว่างได้'],
      ['avatar_url', 'text', 'รูปโปรไฟล์'],
      ['role', 'user_role', 'member / admin'],
      ['status', 'user_status', 'active / suspended'],
      ['created_at', 'timestamptz'],
    ],
  },
  {
    name: 'sports',
    th: 'ประเภทกีฬา',
    desc: 'ฟุตบอล แบดมินตัน บาสเกตบอล ฯลฯ สนามและอุปกรณ์ทุกชิ้นสังกัดกีฬาหนึ่ง',
    cols: [
      ['id', 'int', 'PK'],
      ['name', 'text', 'UNIQUE'],
      ['icon', 'text', 'อีโมจิ'],
    ],
  },
  {
    name: 'courts',
    th: 'สนาม',
    desc: 'ราคา เวลาเปิด-ปิด (เต็มชั่วโมง) และราคาช่วง peak ถ้ามี',
    cols: [
      ['id', 'int', 'PK'],
      ['sport_id', 'int', 'FK → sports'],
      ['name, description', 'text'],
      ['price_per_hour', 'numeric(10,2)', 'CHECK ≥ 0'],
      ['open_hour, close_hour', 'smallint', 'CHECK 0 ≤ เปิด < ปิด ≤ 24'],
      ['peak_price_per_hour', 'numeric(10,2)', 'ว่างได้'],
      ['peak_from_hour', 'smallint', 'ต้องมาคู่กับราคา peak'],
      ['image_url', 'text'],
      ['is_active', 'boolean', 'ปิดชั่วคราว'],
      ['created_at', 'timestamptz'],
    ],
  },
  {
    name: 'equipment',
    th: 'อุปกรณ์ให้ยืม',
    desc: 'จำนวนในคลัง ค่าเช่าต่อชิ้น และมัดจำ',
    cols: [
      ['id', 'int', 'PK'],
      ['sport_id', 'int', 'FK → sports'],
      ['name, description', 'text'],
      ['total_qty', 'int', 'CHECK ≥ 0'],
      ['rent_price', 'numeric(10,2)', 'ต่อชิ้น'],
      ['deposit', 'numeric(10,2)', 'มัดจำต่อชิ้น'],
      ['image_url', 'text'],
      ['is_active', 'boolean'],
      ['created_at', 'timestamptz'],
    ],
  },
  {
    name: 'bookings',
    th: 'การจอง (และตะกร้า)',
    desc: 'ตะกร้าคือการจองที่ status = cart สมาชิกมีตะกร้าได้คนละ 1 ใบ ยอดเงินไม่เก็บซ้ำ แต่คำนวณจากรายการผ่าน VIEW',
    cols: [
      ['id', 'int', 'PK'],
      ['code', 'text', 'UNIQUE เช่น 202610260064'],
      ['user_id', 'int', 'FK → users'],
      ['status', 'booking_status', '7 สถานะ'],
      ['coupon_id', 'int', 'FK → coupons'],
      ['discount', 'numeric(10,2)', 'ล็อกตอนยืนยัน'],
      ['confirmed_at', 'timestamptz'],
      ['expires_at', 'timestamptz', 'หมดเวลาชำระ'],
      ['checkin_token', 'uuid', 'UNIQUE อยู่ใน QR'],
      ['reminder_sent_at', 'timestamptz'],
      ['created_at', 'timestamptz'],
    ],
  },
  {
    name: 'booking_slots',
    th: 'ช่วงเวลาสนามในการจอง',
    desc: 'ช่องละ 1 ชั่วโมง active = true เมื่อยืนยันแล้ว ฐานข้อมูลจึงกันช่วงเวลาซ้อนกันได้',
    cols: [
      ['id', 'int', 'PK'],
      ['booking_id', 'int', 'FK → bookings ลบตาม'],
      ['court_id', 'int', 'FK → courts'],
      ['start_at, end_at', 'timestamptz'],
      ['price', 'numeric(10,2)', 'ราคา ณ ตอนเพิ่ม'],
      ['active', 'boolean', 'EXCLUDE no_overlap'],
    ],
  },
  {
    name: 'booking_equipment',
    th: 'อุปกรณ์ในการจอง',
    desc: 'จำนวน ช่วงเวลา และข้อมูลการคืนของ',
    cols: [
      ['id', 'int', 'PK'],
      ['booking_id', 'int', 'FK → bookings ลบตาม'],
      ['equipment_id', 'int', 'FK → equipment'],
      ['qty', 'int', 'CHECK > 0'],
      ['start_at, end_at', 'timestamptz'],
      ['price', 'numeric(10,2)'],
      ['active', 'boolean'],
      ['returned_at', 'timestamptz', 'วันเวลาที่คืน'],
      ['condition_note', 'text', 'สภาพตอนคืน'],
      ['fine', 'numeric(10,2)', 'ค่าปรับ'],
    ],
  },
  {
    name: 'payments',
    th: 'สลิปชำระเงิน',
    desc: 'แต่ละครั้งที่สมาชิกแนบสลิป และผลตรวจของผู้ดูแล',
    cols: [
      ['id', 'int', 'PK'],
      ['booking_id', 'int', 'FK → bookings'],
      ['amount', 'numeric(10,2)'],
      ['slip_path', 'text', 'ไฟล์ส่วนตัว'],
      ['status', 'payment_status', 'pending / approved / rejected'],
      ['note', 'text', 'เหตุผลที่ไม่ผ่าน'],
      ['reviewed_by', 'int', 'FK → users'],
      ['reviewed_at, created_at', 'timestamptz'],
    ],
  },
  {
    name: 'reviews',
    th: 'รีวิวสนาม',
    desc: 'รีวิวได้หลังใช้บริการ สนามละ 1 ครั้งต่อการจอง',
    cols: [
      ['id', 'int', 'PK'],
      ['booking_id', 'int', 'FK → bookings'],
      ['user_id', 'int', 'FK → users'],
      ['court_id', 'int', 'FK → courts'],
      ['rating', 'smallint', 'CHECK 1–5'],
      ['comment', 'text'],
      ['created_at', 'timestamptz'],
      ['(booking_id, court_id)', '', 'UNIQUE'],
    ],
  },
  {
    name: 'coupons',
    th: 'คูปองส่วนลด',
    desc: 'ลดเป็นเปอร์เซ็นต์หรือเป็นบาทอย่างใดอย่างหนึ่ง พร้อมเงื่อนไข',
    cols: [
      ['id', 'int', 'PK'],
      ['code', 'text', 'UNIQUE ตัวพิมพ์ใหญ่'],
      ['percent_off', 'smallint', '1–100'],
      ['amount_off', 'numeric(10,2)', 'CHECK เลือกอย่างใดอย่างหนึ่ง'],
      ['min_total', 'numeric(10,2)', 'ยอดขั้นต่ำ'],
      ['max_uses, used_count', 'int'],
      ['expires_at', 'timestamptz'],
      ['is_active', 'boolean'],
      ['created_at', 'timestamptz'],
    ],
  },
  {
    name: 'emails',
    th: 'อีเมลที่ระบบส่ง',
    desc: 'ทุกฉบับเก็บไว้ แสดงในกล่องข้อความบนเว็บ และส่งออก SMTP ถ้าตั้งค่าไว้',
    cols: [
      ['id', 'int', 'PK'],
      ['user_id', 'int', 'FK → users'],
      ['booking_id', 'int', 'FK → bookings'],
      ['kind', 'text', 'confirmed / approved / …'],
      ['to_address, subject, html', 'text'],
      ['status', 'email_status', 'web / sent / failed'],
      ['error', 'text'],
      ['read_at, created_at', 'timestamptz'],
    ],
  },
  {
    name: 'settings',
    th: 'ค่าตั้งระบบ',
    desc: 'ค่าที่ผู้ดูแลแก้ในหน้า ระบบ ถ้าไม่มีค่าใดจะใช้ค่าเริ่มต้นในโค้ด',
    cols: [
      ['key', 'text', 'PK'],
      ['value', 'jsonb'],
      ['updated_by', 'int', 'FK → users'],
      ['updated_at', 'timestamptz'],
    ],
  },
  {
    name: 'migrations',
    th: 'ประวัติ migration',
    desc: 'ชื่อไฟล์ .sql ที่รันแล้ว ระบบจะรันเฉพาะไฟล์ใหม่',
    cols: [
      ['name', 'text', 'PK'],
      ['run_at', 'timestamptz'],
    ],
  },
];

// ER diagram layout: box centres on a 1000 × 650 canvas, then the foreign keys (child → parent)
const nodes: Record<string, [number, number, string]> = {
  settings: [130, 50, 'ค่าตั้งระบบ'],
  coupons: [500, 50, 'คูปอง'],
  emails: [870, 50, 'อีเมล'],
  users: [130, 190, 'สมาชิก'],
  bookings: [500, 190, 'การจอง / ตะกร้า'],
  payments: [870, 190, 'สลิปชำระเงิน'],
  reviews: [130, 330, 'รีวิว'],
  booking_slots: [330, 330, 'ช่วงเวลาที่จอง'],
  booking_equipment: [670, 330, 'อุปกรณ์ที่ยืม'],
  courts: [330, 470, 'สนาม'],
  equipment: [670, 470, 'อุปกรณ์'],
  sports: [500, 600, 'ประเภทกีฬา'],
};
const edges: [string, string][] = [
  ['settings', 'users'],
  ['emails', 'users'],
  ['emails', 'bookings'],
  ['bookings', 'users'],
  ['bookings', 'coupons'],
  ['payments', 'bookings'],
  ['reviews', 'users'],
  ['reviews', 'bookings'],
  ['reviews', 'courts'],
  ['booking_slots', 'bookings'],
  ['booking_slots', 'courts'],
  ['booking_equipment', 'bookings'],
  ['booking_equipment', 'equipment'],
  ['courts', 'sports'],
  ['equipment', 'sports'],
];
const BOX_W = 80; // half width
const BOX_H = 25; // half height

// where the line from `from` towards `to` leaves the box around `from`
function edgePoint([x, y]: [number, number, string], [tx, ty]: [number, number, string]) {
  const dx = tx - x;
  const dy = ty - y;
  const scale = Math.min(dx ? BOX_W / Math.abs(dx) : Infinity, dy ? BOX_H / Math.abs(dy) : Infinity);
  return [x + dx * scale, y + dy * scale];
}

function ErDiagram() {
  return (
    <div className="overflow-x-auto rounded-xl border-2 border-line bg-sunken p-3">
      <svg viewBox="0 0 1000 650" className="mx-auto w-full max-w-5xl min-w-[44rem]" role="img" aria-label="แผนภาพความสัมพันธ์ของตารางในฐานข้อมูล">
        <defs>
          <marker id="er-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto">
            <path d="M0 0L10 5L0 10z" fill="var(--mark)" />
          </marker>
        </defs>
        {edges.map(([child, parent]) => {
          const [x1, y1] = edgePoint(nodes[child], nodes[parent]);
          const [x2, y2] = edgePoint(nodes[parent], nodes[child]);
          return <line key={`${child}-${parent}`} x1={x1} y1={y1} x2={x2} y2={y2} stroke="var(--line-hi)" strokeWidth="1.6" markerEnd="url(#er-arrow)" />;
        })}
        {Object.entries(nodes).map(([name, [x, y, th]]) => (
          <a key={name} href={`#t-${name}`}>
            <rect
              x={x - BOX_W}
              y={y - BOX_H}
              width={BOX_W * 2}
              height={BOX_H * 2}
              rx="10"
              fill="var(--surface)"
              stroke={name === 'bookings' ? 'var(--mark)' : 'var(--line)'}
              strokeWidth={name === 'bookings' ? 3 : 2}
            />
            <text x={x} y={y - 3} textAnchor="middle" fill="#fff" fontSize="15" fontWeight="700">
              {name}
            </text>
            <text x={x} y={y + 15} textAnchor="middle" fill="var(--muted)" fontSize="12">
              {th}
            </text>
          </a>
        ))}
      </svg>
      <p className="mt-2 text-center text-sm text-muted">ลูกศรชี้จากตารางที่เก็บ foreign key ไปยังตารางที่อ้างถึง (หลายแถว → 1 แถว) กดชื่อตารางเพื่อดูคอลัมน์</p>
    </div>
  );
}

function NoteChip({ note }: { note: string }) {
  const tone = note.startsWith('PK') ? 'bg-mark/15 text-mark ring-mark/60' : note.startsWith('FK') ? 'bg-info/15 text-info ring-info/50' : 'bg-sunken text-muted ring-line';
  return <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ${tone}`}>{note}</span>;
}

const statusFlow: [string, string][] = [
  ['cart', 'ตะกร้า'],
  ['pending_payment', 'รอชำระเงิน'],
  ['paid', 'ชำระแล้ว'],
  ['checked_in', 'เช็คอินแล้ว'],
  ['completed', 'เสร็จสิ้น'],
];

const mechanisms: [string, string, string][] = [
  ['🛡️', 'กันจองซ้อน', 'ช่วงเวลาในตะกร้ายังไม่ล็อก (active = false) พอกดยืนยันจึงเป็น true แล้ว exclusion constraint no_overlap ของ PostgreSQL ปฏิเสธเวลาที่ทับกัน แม้สองคนกดยืนยันพร้อมกัน ระบบก็ให้สำเร็จได้คนเดียว (error 23P01 → 409 SLOT_TAKEN)'],
  ['📦', 'สต็อกอุปกรณ์', 'ตอนยืนยัน ระบบล็อกแถวอุปกรณ์ด้วย SELECT … FOR UPDATE ใน transaction แล้วนับจำนวนที่ถูกยืมในช่วงเวลาที่ทับซ้อน จึงยืมเกินจำนวนในคลังไม่ได้'],
  ['🧮', 'ยอดเงิน', 'VIEW booking_totals คำนวณยอดก่อนส่วนลด ส่วนลด และยอดสุทธิจากรายการทุกครั้ง ราคาแต่ละรายการล็อกตอนเพิ่มลงตะกร้า ส่วนลดคูปองล็อกลง bookings.discount ตอนยืนยัน'],
  ['⚡', 'ตารางว่างเรียลไทม์', 'เมื่อมีการล็อกหรือคืนช่วงเวลา API ส่ง Server-Sent Events ทุกแท็บของผู้ใช้รับผ่าน SharedWorker ตัวเดียวกัน แล้วโหลดตารางใหม่ทันที'],
  ['🔐', 'การเข้าสู่ระบบ', 'รหัสผ่านเก็บแบบ argon2id login แล้วได้ JWT อายุ 7 วันใน httpOnly cookie (หรือส่งเป็น Bearer token) ระบบโหลดผู้ใช้จากฐานข้อมูลทุกคำขอ บัญชีที่ถูกระงับจึงใช้ไม่ได้ทันที'],
  ['💳', 'การชำระเงิน', 'สร้าง QR PromptPay ตามยอดจริง สมาชิกแนบสลิป (เก็บเป็นไฟล์ส่วนตัว ดูได้เฉพาะเจ้าของและผู้ดูแล) ผู้ดูแลอนุมัติแล้วการจองเป็น paid และส่งอีเมลพร้อมตั๋ว QR'],
  ['⏱️', 'งานอัตโนมัติทุก 1 นาที', 'ยกเลิกการจองที่เลยเวลาชำระ ปิดการจองที่ใช้เสร็จแล้ว ส่งอีเมลเตือนก่อนเวลา 1 ชั่วโมง และล้างรายการในตะกร้าที่เลยเวลาไปแล้ว'],
  ['✉️', 'อีเมล', 'ทุกฉบับบันทึกในตาราง emails และแสดงในกล่องข้อความบนเว็บ ถ้าตั้งค่า SMTP_URL ไว้จะส่งออกไปอีเมลจริงด้วย'],
  ['🛠️', 'ค่าตั้งระบบ', 'ตาราง settings เก็บค่าแบบ key/jsonb ผู้ดูแลแก้ในหน้า ระบบ มีผลกับรายการถัดไปทันทีโดยไม่ต้องรีสตาร์ทเซิร์ฟเวอร์'],
];

const dbFeatures: [string, string][] = [
  ['ENUM 5 ชนิด', 'user_role, user_status, booking_status, payment_status, email_status ใส่ค่านอกรายการไม่ได้'],
  ['VIEW booking_totals', 'ยอดเงินของทุกการจองคำนวณที่เดียว'],
  ['EXCLUDE no_overlap', 'กันช่วงเวลาสนามทับกัน (ต้องใช้ extension btree_gist)'],
  ['UNIQUE INDEX one_cart_per_user', 'สมาชิกมีตะกร้าได้คนละ 1 ใบ'],
  ['CHECK', 'ราคาไม่ติดลบ เวลาเปิดก่อนปิด คะแนน 1–5 คูปองต้องเลือก % หรือบาท ราคา peak ต้องมาพร้อมเวลา'],
  ['FOREIGN KEY', 'รายการ สลิป และรีวิวอ้างถึงการจองที่มีอยู่จริง ลบการจองแล้วรายการลบตาม (ON DELETE CASCADE)'],
  ['timestamptz', 'เก็บเวลาพร้อมเขตเวลา และตั้ง session เป็น Asia/Bangkok ทุกการเชื่อมต่อ'],
  ['Transaction', 'การยืนยันการจองทำทั้งหมดในคราวเดียว ถ้าขั้นใดพลาดจะย้อนกลับทั้งหมด'],
];

const tree = `webth/
├─ docker-compose.yml        PostgreSQL 18 สำหรับเครื่องพัฒนา
├─ Dockerfile                image สำหรับใช้งานจริง (เว็บ + API)
├─ apps/api/                 เซิร์ฟเวอร์ Express
│  ├─ db/migrations/         001_init.sql … 004_mail_and_settings.sql
│  ├─ src/routes/            1 ไฟล์ต่อหมวด endpoint
│  ├─ src/lib/               เข้าสู่ระบบ อีเมล ค่าตั้ง realtime อัปโหลด
│  ├─ src/jobs.ts            งานอัตโนมัติทุก 1 นาที
│  ├─ src/openapi.ts         สร้างเอกสาร API จากทุก route
│  └─ test/                  ชุดทดสอบ Vitest + Supertest
├─ apps/web/                 หน้าเว็บ React
│  ├─ src/pages/             หน้าสมาชิก และ pages/admin/ หน้าผู้ดูแล
│  ├─ src/components/        ส่วนที่ใช้ซ้ำ เช่น ตารางว่าง แถบเมนู
│  └─ src/api-types.ts       ชนิดข้อมูลที่สร้างจาก OpenAPI
└─ docs/                     คู่มือ PDF และสเปกดีไซน์`;

export default function About() {
  const spec = useQuery({ queryKey: ['openapi'], queryFn: (): Promise<OpenApi> => fetch('/openapi.json').then((r) => r.json()), staleTime: Infinity }).data;
  const ops = spec ? Object.values(spec.paths).flatMap((methods) => Object.values(methods)) : [];
  const byTag = new Map<string, number>();
  for (const op of ops) byTag.set(op.tags?.[0] ?? '-', (byTag.get(op.tags?.[0] ?? '-') ?? 0) + 1);

  const jump: [string, string][] = [
    ['#arch', 'ภาพรวม'],
    ['#stack', 'เทคโนโลยี'],
    ['#db', 'ฐานข้อมูล'],
    ['#tables', 'ตารางทั้งหมด'],
    ['#how', 'ระบบทำงานยังไง'],
    ['#files', 'โครงสร้างไฟล์'],
    ['#allfiles', 'ไฟล์ทั้งหมด'],
    ['#api', 'API'],
  ];

  return (
    <div className="space-y-12">
      <div className="space-y-4">
        <PageHeader title="ข้อมูลระบบ" sub="Arena Hub สร้างด้วยอะไร ทำงานยังไง และเก็บข้อมูลแบบไหน สำหรับการนำเสนอและผู้ที่สนใจด้านเทคนิค">
          <StatBox label="REST API" value={ops.length || '-'} unit="endpoint" />
          <StatBox label="ฐานข้อมูล" value={tables.length} unit="ตาราง" />
          <StatBox label="ภาษา" value="TS" unit="ทั้งระบบ" />
        </PageHeader>
        <nav className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1" aria-label="หัวข้อในหน้านี้">
          {jump.map(([href, label]) => (
            <a key={href} href={href} className="shrink-0 rounded-full border-2 border-line bg-sunken px-3 py-1 text-sm font-semibold transition hover:border-line-hi">
              {label}
            </a>
          ))}
        </nav>
      </div>

      <Section id="arch" kicker="Architecture" title="ภาพรวมการทำงาน" sub="ระบบแบ่งเป็น 3 ชั้น หน้าเว็บคุยกับเซิร์ฟเวอร์ผ่าน REST API เท่านั้น และมีแค่เซิร์ฟเวอร์ที่ต่อฐานข้อมูลได้">
        <div className="flex flex-col items-stretch gap-3 lg:flex-row lg:items-center">
          {[
            ['เบราว์เซอร์', 'หน้าเว็บ React', ['หน้าสมาชิกและหน้าผู้ดูแลระบบ', 'ชนิดข้อมูลสร้างจากเอกสาร API', 'ติดตั้งเป็นแอปบนมือถือได้ (PWA)']],
            ['เซิร์ฟเวอร์', 'API Node.js + Express', [`${ops.length || 'ทุก'} endpoint ใต้ /api/v1`, 'ตรวจสิทธิ์ ตรวจข้อมูล ส่งอีเมล', 'งานอัตโนมัติทุก 1 นาที', 'เอกสาร API ที่ /docs']],
            ['ฐานข้อมูล', 'PostgreSQL 18 ใน Docker', [`${tables.length} ตาราง 1 VIEW 5 ENUM`, 'กฎสำคัญบังคับในฐานข้อมูล', 'รูปและสลิปเก็บเป็นไฟล์ในเซิร์ฟเวอร์']],
          ].map(([kicker, title, items], i) => (
            <div key={title as string} className="contents">
              {i > 0 && (
                <div className="grid shrink-0 place-items-center text-center text-mark" aria-hidden>
                  <span className="text-2xl lg:hidden">↓</span>
                  <span className="hidden text-2xl lg:block">→</span>
                  <span className="label text-mark!">{i === 1 ? 'REST + SSE' : 'SQL (pg)'}</span>
                </div>
              )}
              <Panel className="flex-1 p-5">
                <p className="label">{kicker}</p>
                <h3 className="text-lg">{title}</h3>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted">
                  {(items as string[]).map((t) => (
                    <li key={t}>{t}</li>
                  ))}
                </ul>
              </Panel>
            </div>
          ))}
        </div>
        <p className="text-muted">
          ตอนใช้งานจริง เซิร์ฟเวอร์ API เสิร์ฟหน้าเว็บที่ build แล้วบนโดเมนเดียวกัน จึงไม่มีปัญหา cookie ข้ามโดเมน ส่วนตอนพัฒนา Vite (พอร์ต 5173) ส่งต่อคำขอ /api ไปที่ API (พอร์ต 3000)
        </p>
      </Section>

      <Section id="stack" kicker="Tech stack" title="เทคโนโลยีที่ใช้" sub="ทั้งระบบเขียนด้วย TypeScript ภาษาเดียว ใช้เวอร์ชันล่าสุด ณ ตอนสร้างโปรเจกต์">
        <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
          {stack.map(([icon, title, items]) => (
            <Panel key={title} className="p-5">
              <h3 className="mb-3 flex items-center gap-3 text-lg">
                <span className="grid size-10 place-items-center rounded-full bg-violet text-xl ring-2 ring-mark" aria-hidden>
                  {icon}
                </span>
                {title}
              </h3>
              <dl className="divide-y divide-line/50">
                {items.map(([name, what]) => (
                  <div key={name} className="grid gap-x-4 py-2 sm:grid-cols-[11rem_minmax(0,1fr)]">
                    <dt className="font-semibold">{name}</dt>
                    <dd className="text-sm text-muted">{what}</dd>
                  </div>
                ))}
              </dl>
            </Panel>
          ))}
        </div>
      </Section>

      <Section id="db" kicker="Database" title="ฐานข้อมูล PostgreSQL" sub={`${tables.length} ตาราง ศูนย์กลางคือ bookings (การจอง) ตารางอื่นเชื่อมกันด้วย foreign key ตามแผนภาพ`}>
        <ErDiagram />
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {dbFeatures.map(([k, v]) => (
            <div key={k} className="rounded-xl bg-sunken p-4">
              <p className="font-semibold text-mark">{k}</p>
              <p className="text-sm text-muted">{v}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section id="tables" kicker="Tables" title="ตารางทั้งหมดและคอลัมน์" sub="PK = primary key, FK = foreign key (อ้างถึงตารางอื่น)">
        <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
          {tables.map((t) => (
            <Panel key={t.name} className="scroll-mt-32 overflow-hidden">
              <div id={`t-${t.name}`} className="scroll-mt-32 border-b border-line bg-sunken/50 px-5 py-3">
                <h3 className="font-mono text-lg normal-case">{t.name}</h3>
                <p className="text-sm">
                  <span className="font-semibold">{t.th}</span> <span className="text-muted">· {t.desc}</span>
                </p>
              </div>
              <table className="w-full text-sm">
                <tbody>
                  {t.cols.map(([name, type, note]) => (
                    <tr key={name} className="border-b border-line/40 last:border-0">
                      <td className="px-5 py-1.5 font-mono font-semibold">{name}</td>
                      <td className="px-2 py-1.5 font-mono text-muted">{type}</td>
                      <td className="px-5 py-1.5 text-right">{note && <NoteChip note={note} />}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Panel>
          ))}
        </div>
      </Section>

      <Section id="how" kicker="How it works" title="ระบบทำงานยังไง" sub="วงจรของการจองหนึ่งครั้ง และกลไกสำคัญเบื้องหลัง">
        <Panel className="space-y-3 p-5">
          <h3 className="text-lg">
            สถานะของการจอง <span className="font-mono text-sm font-normal text-muted normal-case">booking_status</span>
          </h3>
          <div className="flex flex-wrap items-center gap-2">
            {statusFlow.map(([code, th], i) => (
              <span key={code} className="flex items-center gap-2">
                {i > 0 && <span className="text-mark" aria-hidden>→</span>}
                <span className="rounded-lg border-2 border-line bg-sunken px-3 py-1.5 text-sm">
                  <span className="font-semibold">{th}</span> <span className="font-mono text-xs text-muted">{code}</span>
                </span>
              </span>
            ))}
          </div>
          <p className="text-sm text-muted">
            ออกนอกเส้นทางได้ 2 แบบ: <InfoChip label="expired">หมดเวลาชำระ</InfoChip> เมื่อไม่แนบสลิปตามเวลา และ <InfoChip label="cancelled">ยกเลิก</InfoChip>{' '}
            โดยสมาชิก (ก่อนเวลาที่กำหนด) หรือผู้ดูแล ทั้งสองแบบคืนช่วงเวลาให้คนอื่นจองต่อได้ทันที
          </p>
        </Panel>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {mechanisms.map(([icon, title, text]) => (
            <Panel key={title} className="flex gap-4 p-5">
              <span className="grid size-11 shrink-0 place-items-center rounded-full bg-violet text-xl ring-2 ring-mark" aria-hidden>
                {icon}
              </span>
              <div>
                <h3 className="text-base">{title}</h3>
                <p className="text-sm text-muted">{text}</p>
              </div>
            </Panel>
          ))}
        </div>
      </Section>

      <Section id="files" kicker="Project" title="โครงสร้างไฟล์" sub="โฟลเดอร์สำคัญในโปรเจกต์">
        <pre className="overflow-x-auto rounded-xl border-2 border-line bg-sunken p-5 font-mono text-sm leading-7">{tree}</pre>
      </Section>

      <Section id="allfiles" kicker="Files" title="ไฟล์ทั้งหมดในโปรเจกต์" sub="ทุกไฟล์ใน repo แยกตามโฟลเดอร์ บอกว่าแต่ละไฟล์ใช้ทำอะไร อัปเดตตามไฟล์จริงทุกครั้งที่รันหรือ build เว็บ">
        <ProjectFiles />
      </Section>

      <Section id="api" kicker="API" title="REST API" sub="นับจากเอกสาร OpenAPI ของเซิร์ฟเวอร์ตอนนี้ แต่ละ endpoint มีคำอธิบาย parameter ผลลัพธ์ และตัวอย่างการเรียกจริง">
        <div className="flex flex-wrap gap-2">
          {[...byTag].map(([tag, n]) => (
            <InfoChip key={tag} label={tagTh[tag] ?? tag}>
              {n}
            </InfoChip>
          ))}
        </div>
        <a href="/docs" target="_blank" rel="noreferrer" className="inline-flex h-11 items-center rounded-lg bg-linear-to-b from-mark-hi to-mark px-5 font-semibold text-mark-ink shadow-[inset_0_-3px_0_rgb(0_0_0/0.22)]">
          เปิดเอกสาร API ({ops.length || '-'} endpoint)
        </a>
      </Section>
    </div>
  );
}
