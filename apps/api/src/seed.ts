// Demo data: sports, courts, equipment, accounts and two weeks of booking history for the dashboard.
// bun run db:seed on an empty database fills everything; on a database that already has data it only adds
// sports, courts and equipment from the lists below that are missing (matched by name), so bookings stay.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { type Db, one, pool, query, tx } from './db';
import { hashPassword } from './lib/auth';
import { folderPath } from './lib/upload';
import { atBangkok, bangkokDate, HOUR } from './lib/time';

const sports = [
  { name: 'ฟุตบอล', icon: '⚽' },
  { name: 'แบดมินตัน', icon: '🏸' },
  { name: 'บาสเกตบอล', icon: '🏀' },
  { name: 'เทนนิส', icon: '🎾' },
  { name: 'ปิงปอง', icon: '🏓' },
  { name: 'วอลเลย์บอล', icon: '🏐' },
  { name: 'ฟุตซอล', icon: '🥅' },
  { name: 'ว่ายน้ำ', icon: '🏊' },
  { name: 'มวยไทย', icon: '🥊' },
  { name: 'สนุกเกอร์', icon: '🎱' },
  { name: 'โบว์ลิ่ง', icon: '🎳' },
  { name: 'กอล์ฟ', icon: '⛳' },
  { name: 'ยิงธนู', icon: '🏹' },
  { name: 'ปีนผา', icon: '🧗' },
  { name: 'ฮอกกี้', icon: '🏑' },
  { name: 'เบสบอล', icon: '⚾' },
  { name: 'รักบี้', icon: '🏉' },
  { name: 'ฟันดาบ', icon: '🤺' },
  { name: 'ฟิตเนส', icon: '🏋️' },
];

const courts: [string, string, string, number, number, number][] = [
  ['ฟุตบอล', 'สนามหญ้าเทียม A (7 คน)', 'หญ้าเทียมเกรด FIFA มีไฟส่องสว่างกลางคืน ห้องอาบน้ำในตัว', 1200, 9, 24],
  ['ฟุตบอล', 'สนามหญ้าเทียม B (5 คน)', 'สนามฟุตซอลกลางแจ้ง หลังคาโดม เล่นได้แม้ฝนตก', 800, 9, 24],
  ['แบดมินตัน', 'คอร์ทแบด 1', 'พื้นยาง PU มาตรฐาน BWF ไฟไม่แยงตา', 150, 8, 22],
  ['แบดมินตัน', 'คอร์ทแบด 2', 'พื้นยาง PU มาตรฐาน BWF ไฟไม่แยงตา', 150, 8, 22],
  ['แบดมินตัน', 'คอร์ทแบด 3', 'คอร์ทริมหน้าต่าง อากาศถ่ายเท', 150, 8, 22],
  ['แบดมินตัน', 'คอร์ทแบด 4 (VIP แอร์)', 'ห้องแอร์ เหมาะกับการแข่งขัน', 250, 8, 22],
  ['บาสเกตบอล', 'สนามบาสในร่ม', 'พื้นไม้ปาร์เก้ ห่วงปรับระดับได้', 500, 8, 22],
  ['บาสเกตบอล', 'สนามบาสกลางแจ้ง', 'สนามครึ่งคอร์ท เหมาะกับ 3x3', 250, 6, 21],
  ['เทนนิส', 'คอร์ทเทนนิส 1 (Hard court)', 'พื้นฮาร์ดคอร์ทมาตรฐาน', 400, 6, 22],
  ['เทนนิส', 'คอร์ทเทนนิส 2 (Hard court)', 'พื้นฮาร์ดคอร์ทมาตรฐาน', 400, 6, 22],
  ['ปิงปอง', 'โต๊ะปิงปอง 1', 'โต๊ะมาตรฐาน ITTF', 80, 8, 22],
  ['ปิงปอง', 'โต๊ะปิงปอง 2', 'โต๊ะมาตรฐาน ITTF', 80, 8, 22],
  ['วอลเลย์บอล', 'สนามวอลเลย์บอลในร่ม', 'พื้นยางสังเคราะห์ ตาข่ายปรับความสูงได้', 600, 8, 22],
  ['ฟุตซอล', 'สนามฟุตซอลในร่ม 1', 'พื้นยางสังเคราะห์มาตรฐานฟุตซอล ประตูขนาดจริง', 700, 9, 24],
  ['ฟุตซอล', 'สนามฟุตซอลในร่ม 2', 'พื้นยางสังเคราะห์มาตรฐานฟุตซอล ประตูขนาดจริง', 700, 9, 24],
  ['ว่ายน้ำ', 'สระว่ายน้ำ เลน 1-2', 'สระ 25 เมตร ระบบน้ำเกลือ จองครั้งละ 2 เลน', 200, 6, 21],
  ['ว่ายน้ำ', 'สระว่ายน้ำ เลน 3-4', 'สระ 25 เมตร ระบบน้ำเกลือ จองครั้งละ 2 เลน', 200, 6, 21],
  ['มวยไทย', 'เวทีมวยไทย', 'เวทีขนาดมาตรฐาน พร้อมกระสอบทราย 6 ลูก', 500, 9, 22],
  ['สนุกเกอร์', 'โต๊ะสนุกเกอร์ 1', 'โต๊ะ 12 ฟุต ผ้าสักหลาดใหม่', 150, 10, 24],
  ['สนุกเกอร์', 'โต๊ะสนุกเกอร์ 2', 'โต๊ะ 12 ฟุต ผ้าสักหลาดใหม่', 150, 10, 24],
  ['โบว์ลิ่ง', 'เลนโบว์ลิ่ง 1-2', 'เลนมาตรฐาน ระบบนับคะแนนอัตโนมัติ', 400, 10, 24],
  ['โบว์ลิ่ง', 'เลนโบว์ลิ่ง 3-4', 'เลนมาตรฐาน ระบบนับคะแนนอัตโนมัติ', 400, 10, 24],
  ['กอล์ฟ', 'ไดรฟ์กอล์ฟ ช่อง 1', 'ช่องตีระยะ 250 หลา รวมลูก 1 ตะกร้า', 250, 7, 22],
  ['กอล์ฟ', 'ไดรฟ์กอล์ฟ ช่อง 2', 'ช่องตีระยะ 250 หลา รวมลูก 1 ตะกร้า', 250, 7, 22],
  ['ยิงธนู', 'ลานยิงธนู', 'ระยะ 18 และ 30 เมตร เป้ามาตรฐาน', 300, 9, 20],
  ['ปีนผา', 'ผนังปีนผา', 'ผนังสูง 12 เมตร 8 เส้นทาง มีเจ้าหน้าที่คุมเชือก', 350, 10, 21],
  ['ฮอกกี้', 'สนามฮอกกี้หญ้าเทียม', 'หญ้าเทียมสำหรับฮอกกี้ ฉีดน้ำก่อนเล่น', 900, 7, 21],
  ['เบสบอล', 'กรงตีเบสบอล', 'กรงตีพร้อมเครื่องขว้างลูกปรับความเร็วได้', 300, 9, 21],
  ['รักบี้', 'สนามรักบี้', 'สนามหญ้าจริงขนาดมาตรฐาน มีไฟกลางคืน', 1500, 7, 22],
  ['ฟันดาบ', 'ลานฟันดาบ (2 ลาน)', 'พื้นลานมาตรฐานพร้อมเครื่องนับแต้ม', 300, 10, 21],
  ['ฟิตเนส', 'ห้องฟิตเนสส่วนตัว', 'ห้องเวทและคาร์ดิโอสำหรับกลุ่มไม่เกิน 4 คน', 200, 6, 22],
];

const equipment: [string, string, string, number, number, number][] = [
  ['ฟุตบอล', 'ลูกฟุตบอล เบอร์ 5', 'ลูกหนังเย็บมือ ใช้แข่งขันได้', 10, 30, 300],
  ['ฟุตบอล', 'เสื้อเอี๊ยม (ชุด 7 ตัว)', 'แบ่งทีมสีส้ม/เขียว', 6, 50, 200],
  ['แบดมินตัน', 'ไม้แบดมินตัน', 'ไม้คาร์บอน น้ำหนัก 4U', 20, 30, 300],
  ['แบดมินตัน', 'ลูกขนไก่ (หลอด 12 ลูก)', 'ลูกขนเป็ดเกรดซ้อม', 15, 120, 0],
  ['บาสเกตบอล', 'ลูกบาสเกตบอล เบอร์ 7', 'ลูกยางหนังเทียม เกาะมือ', 8, 30, 300],
  ['เทนนิส', 'ไม้เทนนิส', 'ไม้กราไฟต์ ขนาดหน้าไม้ 100', 10, 80, 1000],
  ['เทนนิส', 'ลูกเทนนิส (กระป๋อง 3 ลูก)', 'ลูกมาตรฐาน ITF', 12, 60, 0],
  ['ปิงปอง', 'ไม้ปิงปอง (คู่)', 'ไม้พร้อมยางสองหน้า', 12, 20, 200],
  ['ปิงปอง', 'ลูกปิงปอง (แพ็ค 6)', 'ลูก 3 ดาว 40+', 20, 20, 0],
  ['วอลเลย์บอล', 'ลูกวอลเลย์บอล', 'ลูกหนังเทียม น้ำหนักมาตรฐาน', 8, 30, 300],
  ['ฟุตซอล', 'ลูกฟุตซอล เบอร์ 4', 'ลูกเด้งต่ำสำหรับพื้นในร่ม', 10, 30, 300],
  ['ว่ายน้ำ', 'แว่นตาว่ายน้ำ', 'ปรับสายได้ ทำความสะอาดทุกครั้ง', 20, 20, 100],
  ['ว่ายน้ำ', 'โฟมเตะขา', 'สำหรับฝึกว่าย', 15, 10, 0],
  ['มวยไทย', 'นวมชกมวย (คู่)', 'นวม 12 ออนซ์', 12, 40, 300],
  ['มวยไทย', 'เป้าล่อ (คู่)', 'เป้ามือสำหรับเทรนเนอร์', 6, 30, 200],
  ['สนุกเกอร์', 'ไม้คิว', 'ไม้คิวหัว 9.5 มม.', 10, 30, 500],
  ['โบว์ลิ่ง', 'รองเท้าโบว์ลิ่ง (คู่)', 'มีทุกไซซ์ 36-46', 30, 30, 0],
  ['กอล์ฟ', 'ชุดไม้กอล์ฟ', 'ไดรเวอร์ เหล็ก 7 และพัตเตอร์', 8, 150, 2000],
  ['กอล์ฟ', 'ลูกกอล์ฟ (ตะกร้า 50 ลูก)', 'ลูกซ้อมระยะเพิ่ม', 30, 60, 0],
  ['ยิงธนู', 'ชุดธนู Recurve', 'คันธนูพร้อมลูกธนู 6 ดอก', 8, 100, 1000],
  ['ปีนผา', 'ชุดปีนผา', 'ฮาร์เนส รองเท้าปีน และถุงชอล์ก', 12, 80, 500],
  ['ฮอกกี้', 'ไม้ฮอกกี้', 'ไม้คอมโพสิต 36.5 นิ้ว', 22, 30, 300],
  ['เบสบอล', 'ไม้เบสบอลและหมวกกันน็อก', 'ไม้อะลูมิเนียม 32 นิ้ว', 8, 40, 500],
  ['รักบี้', 'ลูกรักบี้ เบอร์ 5', 'ลูกมาตรฐานสำหรับแข่ง', 8, 30, 300],
  ['ฟันดาบ', 'ชุดฟันดาบ', 'หน้ากาก เสื้อเกราะ และดาบฟอยล์', 6, 150, 1500],
  ['ฟิตเนส', 'ผ้าเย็นและล็อกเกอร์', 'ผ้าเย็นพร้อมกุญแจล็อกเกอร์', 40, 20, 0],
];

// photos live in apps/web/public/photos, numbered in the order of the lists above (migration 006 fills older databases)
const photo = (kind: 'courts' | 'equipment', i: number) => `/photos/${kind}/${String(i + 1).padStart(2, '0')}.jpg`;

const members = [
  ['member@sporthub.local', 'สมชาย ใจดี', '0812345678'],
  ['somying@sporthub.local', 'สมหญิง รักกีฬา', '0898765432'],
  ['anan@sporthub.local', 'อนันต์ วิ่งเร็ว', '0861112222'],
  ['pim@sporthub.local', 'พิมพ์ชนก ตีแบด', '0873334444'],
  ['krit@sporthub.local', 'กฤษดา ชู้ตไกล', '0845556666'],
];

const comments = ['สนามดีมาก ไฟสว่าง', 'พนักงานบริการดี', 'ห้องน้ำสะอาด จะมาอีกแน่นอน', 'ที่จอดรถเยอะ สะดวก', 'พื้นสนามดี แต่แอร์เย็นไปนิด', 'คุ้มราคา'];

// deterministic pseudo-random (mulberry32) so every fresh seed looks the same
let state = 42;
const rand = (n: number) => {
  state = (state + 0x6d2b79f5) | 0;
  let t = Math.imul(state ^ (state >>> 15), 1 | state);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return Math.floor((((t ^ (t >>> 14)) >>> 0) / 4294967296) * n);
};

async function insertBooking(db: Db, userId: number, status: string, confirmedAt: Date) {
  return (
    await one(
      `INSERT INTO bookings (id, user_id, code, status, confirmed_at, created_at, checkin_token)
       SELECT n.id, $1, to_char($3::timestamptz, 'YYYYMMDD') || lpad(n.id::text, greatest(4, length(n.id::text)), '0'), $2, $3, $3, gen_random_uuid()
       FROM (SELECT nextval(pg_get_serial_sequence('bookings', 'id')) AS id) n RETURNING id`,
      [userId, status, confirmedAt],
      db,
    )
  ).id as number;
}

// Inserts the sports, courts and equipment above that are not in the database yet (by name); returns how many.
async function addMissingCatalog(db: Db) {
  let added = 0;
  for (const s of sports) {
    added += (await db.query('INSERT INTO sports (name, icon) VALUES ($1, $2) ON CONFLICT (name) DO NOTHING', [s.name, s.icon])).rowCount ?? 0;
  }
  for (const [i, [sport, name, description, price, open, close]] of courts.entries()) {
    added +=
      (
        await db.query(
          `INSERT INTO courts (sport_id, name, description, price_per_hour, open_hour, close_hour, image_url)
           SELECT id, $2, $3, $4, $5, $6, $7 FROM sports WHERE name = $1 AND NOT EXISTS (SELECT 1 FROM courts WHERE name = $2)`,
          [sport, name, description, price, open, close, photo('courts', i)],
        )
      ).rowCount ?? 0;
  }
  for (const [i, [sport, name, description, qty, rent, deposit]] of equipment.entries()) {
    added +=
      (
        await db.query(
          `INSERT INTO equipment (sport_id, name, description, total_qty, rent_price, deposit, image_url)
           SELECT id, $2, $3, $4, $5, $6, $7 FROM sports WHERE name = $1 AND NOT EXISTS (SELECT 1 FROM equipment WHERE name = $2)`,
          [sport, name, description, qty, rent, deposit, photo('equipment', i)],
        )
      ).rowCount ?? 0;
  }
  return added;
}

async function seed() {
  if (await one('SELECT 1 FROM sports LIMIT 1')) {
    const added = await tx(addMissingCatalog);
    console.log(added ? `database already has data — added ${added} missing sports, courts and equipment` : 'database already has data — nothing to add');
    return;
  }
  mkdirSync(folderPath('slips'), { recursive: true });
  // a tiny placeholder image so seeded slips open in the admin screen
  writeFileSync(
    join(folderPath('slips'), 'seed-slip.png'),
    Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64'),
  );
  const adminHash = await hashPassword('admin1234');
  const memberHash = await hashPassword('member1234');

  await tx(async (db) => {
    const adminId = (
      await one(`INSERT INTO users (email, password_hash, name, phone, role) VALUES ($1, $2, $3, $4, 'admin') RETURNING id`, [
        'admin@sporthub.local',
        adminHash,
        'ผู้ดูแลระบบ',
        '0800000000',
      ], db)
    ).id;
    const memberIds: number[] = [];
    for (const [email, name, phone] of members) {
      memberIds.push((await one('INSERT INTO users (email, password_hash, name, phone) VALUES ($1, $2, $3, $4) RETURNING id', [email, memberHash, name, phone], db)).id);
    }
    await addMissingCatalog(db);
    const courtRows: { id: number; price: number; open: number; close: number }[] = await query(
      'SELECT id, price_per_hour AS price, open_hour AS open, close_hour AS close FROM courts ORDER BY id',
      [],
      db,
    );
    // evening peak rates for the outdoor-lit courts, and two demo coupons
    await db.query(
      `UPDATE courts SET peak_price_per_hour = price_per_hour * 1.25, peak_from_hour = 17
       WHERE sport_id IN (SELECT id FROM sports WHERE name IN ('ฟุตบอล', 'เทนนิส'))`,
    );
    await db.query(
      `INSERT INTO coupons (code, name, percent_off, amount_off, min_total, max_uses) VALUES
         ('WELCOME10', 'ต้อนรับสมาชิกใหม่', 10, NULL, 300, NULL), ('BAHT50', 'ลดทันที 50 บาท', NULL, 50, 0, 100)`,
    );
    const equipmentRows: { id: number; rent: number }[] = await query('SELECT id, rent_price AS rent FROM equipment ORDER BY id', [], db);

    // two weeks of history (completed, paid, reviewed) plus a few upcoming and pending bookings
    const used = new Set<string>();
    const plan: { daysAgo: number; status: string; slip?: 'approved' | 'pending' }[] = [];
    for (let d = 14; d >= 1; d--) for (let i = 0; i < 2 + rand(3); i++) plan.push({ daysAgo: d, status: 'completed', slip: 'approved' });
    for (let i = 0; i < 4; i++) plan.push({ daysAgo: -1 - rand(3), status: 'paid', slip: 'approved' });
    plan.push({ daysAgo: -2, status: 'pending_payment', slip: 'pending' }, { daysAgo: -3, status: 'pending_payment' });

    for (const p of plan) {
      const court = courtRows[rand(courtRows.length)];
      const date = bangkokDate(new Date(Date.now() - p.daysAgo * 24 * HOUR));
      let hour = court.open + rand(court.close - court.open);
      while (used.has(`${court.id}:${date}:${hour}`)) hour = court.open + ((hour - court.open + 1) % (court.close - court.open));
      used.add(`${court.id}:${date}:${hour}`);
      const start = atBangkok(date, hour);
      const confirmedAt = new Date(Math.min(start.getTime() - (2 + rand(48)) * HOUR, Date.now() - 30 * 60_000));
      const userId = memberIds[rand(memberIds.length)];
      const bookingId = await insertBooking(db, userId, p.status, confirmedAt);
      await db.query('INSERT INTO booking_slots (booking_id, court_id, start_at, end_at, price, active) VALUES ($1, $2, $3, $4, $5, true)', [
        bookingId,
        court.id,
        start,
        new Date(start.getTime() + HOUR),
        court.price,
      ]);
      if (rand(2)) {
        const item = equipmentRows[rand(equipmentRows.length)];
        const qty = 1 + rand(2);
        await db.query(
          'INSERT INTO booking_equipment (booking_id, equipment_id, qty, start_at, end_at, price, active, returned_at) VALUES ($1, $2, $3, $4, $5, $6, true, $7)',
          [bookingId, item.id, qty, start, new Date(start.getTime() + HOUR), item.rent * qty, p.status === 'completed' ? new Date(start.getTime() + HOUR) : null],
        );
      }
      if (p.status === 'pending_payment' && !p.slip) await db.query(`UPDATE bookings SET expires_at = now() + interval '15 minutes' WHERE id = $1`, [bookingId]);
      if (p.slip) {
        const { total } = await one('SELECT total FROM booking_totals WHERE booking_id = $1', [bookingId], db);
        const reviewed = p.slip === 'approved' ? new Date(confirmedAt.getTime() + 10 * 60_000) : null;
        await db.query(
          'INSERT INTO payments (booking_id, amount, slip_path, status, reviewed_by, reviewed_at, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7)',
          [bookingId, total, 'seed-slip.png', p.slip, reviewed && adminId, reviewed, new Date(confirmedAt.getTime() + 5 * 60_000)],
        );
      }
      if (p.status === 'completed' && rand(3) > 0) {
        await db.query('INSERT INTO reviews (booking_id, user_id, court_id, rating, comment, created_at) VALUES ($1, $2, $3, $4, $5, $6)', [
          bookingId,
          userId,
          court.id,
          3 + rand(3),
          comments[rand(comments.length)],
          new Date(start.getTime() + 2 * HOUR),
        ]);
      }
    }
  });
  console.log('seeded: admin@sporthub.local / admin1234, member@sporthub.local / member1234');
}

await seed().finally(() => pool.end());
