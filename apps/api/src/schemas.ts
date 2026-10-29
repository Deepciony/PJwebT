import { z } from 'zod';

// Shared request pieces and response models (each `id` becomes a named schema in the API docs)

export const dateTime = z.iso.datetime({ offset: true });
export const idParam = z.object({ id: z.coerce.number().int().positive().describe('รหัสของรายการ') });
export const email = z.email('อีเมลไม่ถูกต้อง').toLowerCase();
export const password = z.string().min(8, 'รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร').max(100);
export const personName = z.string().trim().min(1, 'กรุณากรอกชื่อ').max(100);
export const phone = z.string().regex(/^0\d{8,9}$/, 'เบอร์โทรต้องเป็นตัวเลข 9-10 หลักขึ้นต้นด้วย 0');

export const Ok = z.object({ ok: z.literal(true) }).meta({ id: 'Ok' });

export const User = z
  .object({
    id: z.number().int(),
    email: z.email(),
    name: z.string(),
    phone: z.string().nullable(),
    avatarUrl: z.string().nullable(),
    role: z.enum(['member', 'admin']),
    status: z.enum(['active', 'suspended']),
    createdAt: dateTime,
  })
  .meta({ id: 'User', description: 'ข้อมูลสมาชิก' });

export const UserDetail = User.extend({
  bookingCount: z.number().int().describe('จำนวนการจองที่ยืนยันแล้ว'),
  totalSpent: z.number().describe('ยอดชำระแล้วทั้งหมด (บาท)'),
}).meta({ id: 'UserDetail' });

export const Sport = z
  .object({
    id: z.number().int(),
    name: z.string(),
    icon: z.string().describe('emoji'),
    courtCount: z.number().int(),
    equipmentCount: z.number().int(),
  })
  .meta({ id: 'Sport', description: 'ประเภทกีฬา' });

export const Court = z
  .object({
    id: z.number().int(),
    sportId: z.number().int(),
    sportName: z.string(),
    sportIcon: z.string(),
    name: z.string(),
    description: z.string(),
    pricePerHour: z.number().describe('ราคาต่อชั่วโมง (บาท)'),
    openHour: z.number().int().describe('เปิด (ชั่วโมง 0-23)'),
    closeHour: z.number().int().describe('ปิด (ชั่วโมง 1-24)'),
    peakPricePerHour: z.number().nullable().describe('ราคาช่วง peak ต่อชั่วโมง (null = ราคาเดียวทั้งวัน)'),
    peakFromHour: z.number().int().nullable().describe('ช่วง peak เริ่มที่ชั่วโมงนี้จนปิด'),
    imageUrl: z.string().nullable(),
    isActive: z.boolean(),
    rating: z.number().nullable().describe('คะแนนรีวิวเฉลี่ย 1-5'),
    reviewCount: z.number().int(),
  })
  .meta({ id: 'Court', description: 'สนามกีฬา' });

export const Slot = z
  .object({
    hour: z.number().int(),
    startAt: dateTime,
    endAt: dateTime,
    price: z.number().describe('ราคาของชั่วโมงนี้ (บาท)'),
    status: z.enum(['free', 'booked', 'mine', 'in_cart', 'past']).describe('free=ว่าง booked=มีคนจองแล้ว mine=การจองของฉัน in_cart=อยู่ในตะกร้าของฉัน past=เลยเวลาแล้ว'),
  })
  .meta({ id: 'Slot' });

export const Equipment = z
  .object({
    id: z.number().int(),
    sportId: z.number().int(),
    sportName: z.string(),
    sportIcon: z.string(),
    name: z.string(),
    description: z.string(),
    totalQty: z.number().int().describe('จำนวนทั้งหมดในคลัง'),
    rentPrice: z.number().describe('ค่าเช่าต่อชิ้นต่อการจอง (บาท)'),
    deposit: z.number().describe('ค่ามัดจำต่อชิ้น จ่ายหน้างานและได้คืนเมื่อคืนของ'),
    imageUrl: z.string().nullable(),
    isActive: z.boolean(),
  })
  .meta({ id: 'Equipment', description: 'อุปกรณ์กีฬาให้ยืม' });

export const bookingStatus = z
  .enum(['cart', 'pending_payment', 'paid', 'checked_in', 'completed', 'cancelled', 'expired'])
  .describe('cart=ตะกร้า pending_payment=รอชำระเงิน paid=ชำระแล้ว checked_in=เช็คอินแล้ว completed=เสร็จสิ้น cancelled=ยกเลิก expired=หมดเวลาชำระ');

export const BookingSlot = z
  .object({
    id: z.number().int(),
    courtId: z.number().int(),
    courtName: z.string(),
    sportName: z.string(),
    sportIcon: z.string(),
    startAt: dateTime,
    endAt: dateTime,
    price: z.number(),
    taken: z.boolean().describe('มีคนอื่นจองช่วงเวลานี้ไปแล้ว (ใช้กับรายการในตะกร้า)'),
  })
  .meta({ id: 'BookingSlot', description: 'ช่วงเวลาสนามในการจอง' });

export const BookingEquipment = z
  .object({
    id: z.number().int(),
    equipmentId: z.number().int(),
    name: z.string(),
    sportIcon: z.string(),
    qty: z.number().int(),
    startAt: dateTime,
    endAt: dateTime,
    price: z.number().describe('ค่าเช่ารวมของรายการนี้'),
    deposit: z.number().describe('มัดจำรวมของรายการนี้ (จ่ายหน้างาน)'),
    returnedAt: dateTime.nullable(),
    conditionNote: z.string().nullable(),
    fine: z.number().describe('ค่าปรับ (ชำรุด/คืนช้า)'),
  })
  .meta({ id: 'BookingEquipment', description: 'อุปกรณ์ที่ยืมในการจอง' });

export const PaymentSummary = z
  .object({
    id: z.number().int(),
    amount: z.number(),
    status: z.enum(['pending', 'approved', 'rejected']),
    note: z.string().nullable(),
    createdAt: dateTime,
    reviewedAt: dateTime.nullable(),
  })
  .meta({ id: 'PaymentSummary' });

export const Booking = z
  .object({
    id: z.number().int(),
    code: z.string().describe('เลขที่การจอง YYYYMMDD + ลำดับ'),
    status: bookingStatus,
    userId: z.number().int(),
    userName: z.string(),
    userEmail: z.string(),
    createdAt: dateTime,
    confirmedAt: dateTime.nullable(),
    expiresAt: dateTime.nullable().describe('ต้องแนบสลิปก่อนเวลานี้ ไม่งั้นการจองหมดอายุ'),
    subtotal: z.number().describe('ยอดก่อนส่วนลด'),
    discount: z.number().describe('ส่วนลดจากคูปอง'),
    couponCode: z.string().nullable(),
    total: z.number().describe('ยอดที่ต้องชำระหลังส่วนลด (บาท)'),
    depositTotal: z.number().describe('มัดจำอุปกรณ์รวม จ่ายหน้างาน'),
    fineTotal: z.number().describe('ค่าปรับรวมจากการคืนอุปกรณ์ (ชำระที่เคาน์เตอร์ ไม่รวมใน total)'),
    slots: z.array(BookingSlot),
    equipment: z.array(BookingEquipment),
    payments: z.array(PaymentSummary),
    checkinToken: z.string().nullable().describe('รหัสใน QR เช็คอิน (มีเมื่อชำระเงินแล้ว)'),
    checkinQr: z.string().nullable().describe('รูป QR เช็คอิน (data URL)'),
    reviewedCourtIds: z.array(z.number().int()).describe('สนามที่รีวิวแล้วในการจองนี้'),
  })
  .meta({ id: 'Booking', description: 'การจอง (รวมถึงตะกร้า)' });

export const BookingSummary = z
  .object({
    id: z.number().int(),
    code: z.string(),
    status: bookingStatus,
    userId: z.number().int(),
    userName: z.string(),
    createdAt: dateTime,
    confirmedAt: dateTime.nullable(),
    total: z.number(),
    firstStartAt: dateTime.nullable().describe('เวลาเริ่มของรายการแรก'),
    itemCount: z.number().int(),
  })
  .meta({ id: 'BookingSummary' });

export const Coupon = z
  .object({
    id: z.number().int(),
    code: z.string(),
    name: z.string().describe('ชื่อแคมเปญที่ผู้ดูแลตั้ง (ว่างได้)'),
    percentOff: z.number().int().nullable().describe('ลดเป็นเปอร์เซ็นต์ (ใช้อย่างใดอย่างหนึ่งกับ amountOff)'),
    amountOff: z.number().nullable().describe('ลดเป็นจำนวนเงิน (บาท)'),
    minTotal: z.number().describe('ยอดขั้นต่ำที่ใช้คูปองได้'),
    maxUses: z.number().int().nullable().describe('ใช้ได้ทั้งหมดกี่ครั้ง (null = ไม่จำกัด)'),
    perUserLimit: z.number().int().nullable().describe('สมาชิก 1 คนใช้ได้กี่ครั้ง (null = ไม่จำกัด)'),
    usedCount: z.number().int().describe('จำนวนการจองที่ยืนยันพร้อมคูปองนี้แล้ว'),
    userCount: z.number().int().describe('จำนวนสมาชิกที่เคยใช้'),
    discountGiven: z.number().describe('ส่วนลดรวมที่ให้ไปแล้ว (บาท)'),
    expiresAt: dateTime.nullable(),
    isActive: z.boolean(),
    createdAt: dateTime,
  })
  .meta({ id: 'Coupon', description: 'คูปองส่วนลด' });

export const AuthResult = z
  .object({ user: User, token: z.string().describe('JWT สำหรับ header Authorization: Bearer <token>') })
  .meta({ id: 'AuthResult' });
