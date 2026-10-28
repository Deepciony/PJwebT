import { z } from 'zod';
import { exampleKey, loadExamples } from './lib/examples';
import { routes } from './lib/route';

export const ErrorSchema = z.object({
  error: z.object({
    code: z.string().meta({ example: 'SLOT_TAKEN' }),
    message: z.string().meta({ example: 'ช่วงเวลานี้มีผู้จองแล้ว' }),
    issues: z.array(z.unknown()).optional().describe('รายละเอียดเมื่อ code = VALIDATION_ERROR'),
  }),
});

const intro = `REST API ของระบบจองสนามกีฬาและยืมอุปกรณ์ **Arena Hub**

- ทุก endpoint อยู่ใต้ \`/api/v1\` รับและคืนค่าเป็น JSON (ยกเว้นอัปโหลดรูปที่ใช้ \`multipart/form-data\`)
- **การยืนยันตัวตน:** เรียก \`POST /api/v1/auth/login\` แล้วนำ \`token\` ไปใส่ header \`Authorization: Bearer <token>\` (หน้าเว็บใช้ httpOnly cookie ชื่อ \`token\` ที่ตั้งให้อัตโนมัติ)
- **เวลา:** รูปแบบ ISO 8601 พร้อม timezone เช่น \`2026-10-08T18:00:00+07:00\` ช่องจองสนามละ 1 ชั่วโมง ตามเวลาประเทศไทย
- **Error:** ทุก error ใช้รูปแบบเดียวกัน \`{ "error": { "code": "...", "message": "..." } }\`
- ตัวอย่าง request/response ในเอกสารนี้บันทึกจากการรันชุดทดสอบจริง`;

const tags = [
  ['System', 'สถานะระบบ'],
  ['Auth', 'สมัครสมาชิก เข้าสู่ระบบ ออกจากระบบ'],
  ['Users', 'ข้อมูลสมาชิก: แก้ไขข้อมูลตัวเอง และ admin จัดการสมาชิก'],
  ['Sports', 'ประเภทกีฬา'],
  ['Courts', 'สนามกีฬาและตารางช่วงเวลาว่าง'],
  ['Equipment', 'อุปกรณ์กีฬาให้ยืม'],
  ['Cart', 'ตะกร้าการจอง เพิ่ม/ลบรายการได้จนกว่าจะยืนยัน'],
  ['Bookings', 'การจองที่ยืนยันแล้ว: ประวัติ ยกเลิก เช็คอิน คืนอุปกรณ์'],
  ['Payments', 'ชำระเงินผ่าน PromptPay QR และตรวจสลิป'],
  ['Reviews', 'รีวิวสนาม'],
  ['Realtime', 'Server-Sent Events แจ้งเมื่อตารางว่างเปลี่ยน'],
  ['Emails', 'อีเมลที่ระบบส่ง: กล่องข้อความของสมาชิก และบันทึกอีเมลทั้งหมดสำหรับ admin'],
  ['Admin', 'สถิติ ค่าตั้งระบบ คูปอง และสถานะระบบหลังบ้าน'],
].map(([name, description]) => ({ name, description }));

// drop zod's safe-integer bounds and the long regex it emits next to date formats: noise for readers
function tidy(this: Record<string, unknown>, key: string, value: unknown) {
  if (key === 'minimum' && value === Number.MIN_SAFE_INTEGER) return undefined;
  if (key === 'maximum' && value === Number.MAX_SAFE_INTEGER) return undefined;
  if (key === 'pattern' && this.format) return undefined;
  return value;
}

export function buildOpenApi() {
  const examples = loadExamples();
  const components: Record<string, unknown> = {};
  const schema = (s: z.ZodType, io: 'input' | 'output') => {
    const { $schema: _, $defs, ...rest } = z.toJSONSchema(s, { io, unrepresentable: 'any' }) as Record<string, unknown>;
    Object.assign(components, $defs);
    return rest;
  };
  components.Error = schema(ErrorSchema, 'output');
  const errorRef = { 'application/json': { schema: { $ref: '#/$defs/Error' } } };

  const parameters = (obj: z.ZodType | undefined, where: 'path' | 'query') =>
    obj instanceof z.ZodObject
      ? Object.entries(obj.shape as Record<string, z.ZodType>).map(([name, field]) => ({
          name,
          in: where,
          required: where === 'path' || !field.safeParse(undefined).success,
          description: field.description,
          schema: schema(field, 'input'),
        }))
      : [];

  const paths: Record<string, Record<string, unknown>> = {};
  for (const r of routes) {
    const ex = examples[exampleKey(r.method, r.path)];
    const errors: Record<number, string> = { ...r.errors };
    if (r.params || r.query || r.body) errors[400] ??= 'ข้อมูลที่ส่งมาไม่ถูกต้อง (VALIDATION_ERROR)';
    if (r.access) errors[401] ??= 'ยังไม่ได้เข้าสู่ระบบ (UNAUTHORIZED)';
    if (r.access) errors[403] ??= r.access === 'admin' ? 'ไม่ใช่ผู้ดูแลระบบ (FORBIDDEN) หรือบัญชีถูกระงับ' : 'บัญชีถูกระงับ (ACCOUNT_SUSPENDED)';
    const success =
      r.produces === 'image' || r.produces === 'pdf'
        ? { [r.produces === 'pdf' ? 'application/pdf' : 'image/*']: { schema: { type: 'string', format: 'binary' } } }
        : r.produces === 'sse'
          ? { 'text/event-stream': { schema: { type: 'string' }, example: 'event: availability\ndata: {"courtIds":[1],"equipmentIds":[2]}\n\n' } }
          : { 'application/json': { schema: schema(r.response, 'output'), ...(ex && { example: ex.response }) } };
    const requestBody = r.upload
      ? {
          required: true,
          content: {
            'multipart/form-data': {
              schema: {
                type: 'object',
                required: [r.upload.field],
                properties: { [r.upload.field]: { type: 'string', format: 'binary', description: r.upload.description } },
              },
            },
          },
        }
      : r.body && {
          required: true,
          content: { 'application/json': { schema: schema(r.body, 'input'), ...(ex?.body !== undefined && { example: ex.body }) } },
        };
    const access = r.access === 'admin' ? 'เฉพาะผู้ดูแลระบบ (admin)' : r.access ? 'สมาชิกที่เข้าสู่ระบบแล้ว' : 'ทุกคน ไม่ต้องเข้าสู่ระบบ';
    const path = `/api/v1${r.path.replace(/:(\w+)/g, '{$1}')}`;
    paths[path] ??= {};
    paths[path][r.method] = {
      tags: [r.tag],
      summary: r.summary,
      description: [r.description, `**สิทธิ์:** ${access}`, ex && `**ตัวอย่างการเรียกใช้:** \`${r.method.toUpperCase()} ${ex.url}\``]
        .filter(Boolean)
        .join('\n\n'),
      parameters: [...parameters(r.params, 'path'), ...parameters(r.query, 'query')],
      ...(requestBody && { requestBody }),
      responses: {
        [r.status ?? 200]: { description: 'สำเร็จ', content: success },
        ...Object.fromEntries(Object.entries(errors).map(([code, description]) => [code, { description, content: errorRef }])),
      },
      ...(r.access && { security: [{ bearerAuth: [] }, { cookieAuth: [] }] }),
    };
  }

  const doc = {
    openapi: '3.1.0',
    info: { title: 'Arena Hub API', version: '1.0.0', description: intro },
    tags,
    paths,
    components: {
      schemas: components,
      securitySchemes: {
        bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT', description: 'token จาก POST /api/v1/auth/login' },
        cookieAuth: { type: 'apiKey', in: 'cookie', name: 'token', description: 'httpOnly cookie ที่ตั้งให้ตอน login' },
      },
    },
  };
  return JSON.parse(JSON.stringify(doc).replaceAll('#/$defs/', '#/components/schemas/'), tidy);
}
