// Vite plugin: `virtual:project-files` lists every file in the repo with what it is for, for the /about page.
// The text comes from each file's own header comment, else from a rule for its folder, so the list follows
// the code: files added, removed or edited while `pnpm dev` runs show up on the next page load.
import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import type { Plugin } from 'vite';

const repo = new URL('../../', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const id = 'virtual:project-files';

// fallbacks for files without a header comment (first match wins)
const rules: [RegExp, string][] = [
  [/^apps\/web\/src\/pages\/admin\//, 'หน้าในส่วนผู้ดูแลระบบ'],
  [/^apps\/web\/src\/pages\//, 'หน้าเว็บฝั่งสมาชิก'],
  [/^apps\/web\/src\/components\//, 'ส่วนประกอบหน้าเว็บที่ใช้ซ้ำ'],
  [/^apps\/web\/public\/photos\//, 'รูปจริงของสนามและอุปกรณ์ เลขตามลำดับรายการใน seed.ts'],
  [/^apps\/web\/public\//,'ไฟล์ที่เว็บเสิร์ฟตรง เช่น ไอคอนแอป'],
  [/^apps\/api\/src\/routes\//, 'endpoint ของ REST API หมวดนี้'],
  [/^apps\/api\/test\//, 'ชุดทดสอบ API (Vitest + Supertest)'],
  [/^apps\/api\/db\/migrations\//, 'migration สร้างหรือแก้ตารางในฐานข้อมูล'],
  [/^apps\/api\/db\/snapshot\/uploads\//, 'ไฟล์ที่อัปโหลด เก็บไว้กับ snapshot ฐานข้อมูล'],
  [/^apps\/api\/db\/snapshot\//, 'ข้อมูลฐานข้อมูลทั้งก้อนสำหรับ pnpm db:import'],
  [/^docs\/manual\/img\//, 'ภาพหน้าจอในคู่มือ'],
  [/^docs\//, 'เอกสารและคู่มือ'],
  [/package\.json$/, 'รายชื่อแพ็กเกจและคำสั่ง pnpm'],
  [/tsconfig.*\.json$/, 'ตั้งค่า TypeScript'],
  [/openapi.*\.json$/, 'เอกสาร API (OpenAPI) ที่สร้างอัตโนมัติ'],
  [/api-types\.ts$/, 'ชนิดข้อมูล API ที่สร้างจาก OpenAPI (ห้ามแก้มือ)'],
  [/\.(png|jpe?g|svg|webp|ico)$/, 'รูปภาพ'],
];
const known: Record<string, string> = {
  'README.md': 'วิธีติดตั้ง รัน ทดสอบ และสาธิตโปรเจกต์',
  'docker-compose.yml': 'รัน PostgreSQL 18 สำหรับเครื่องพัฒนา',
  Dockerfile: 'สร้าง image สำหรับใช้งานจริง (เว็บ + API)',
  '.env.example': 'ตัวอย่างค่าตั้ง (คัดลอกเป็น .env)',
  '.gitignore': 'ไฟล์ที่ไม่เก็บใน git',
  '.dockerignore': 'ไฟล์ที่ไม่ส่งเข้า Docker image',
  '.gitattributes': 'ตั้งค่าการขึ้นบรรทัดของไฟล์ใน git',
  'pnpm-workspace.yaml': 'กำหนด monorepo (apps/*) ของ pnpm',
  'pnpm-lock.yaml': 'ล็อกเวอร์ชันแพ็กเกจทุกตัว',
  'รายละเอียด Project.pdf': 'โจทย์โครงงานจากรายวิชา',
};

// first comment of a file, cleaned to one sentence-ish line
function headerComment(text: string) {
  const lines = text.split(/\r?\n/).slice(0, 15);
  const out: string[] = [];
  for (const raw of lines) {
    const line = raw.trim();
    if (!out.length && (line === '' || line.startsWith('import ') || line.startsWith('<!doctype') || line.startsWith('@import'))) continue;
    const m = line.match(/^(?:\/\/|--|#|\/\*+|\*)\s?(.*?)(?:\*\/)?$/);
    if (!m || line.startsWith('#!')) break;
    if (m[1]) out.push(m[1]);
    if (out.join(' ').length > 220) break;
  }
  return out.join(' ').trim();
}

// git's view of the repo (tracked + new files, minus .gitignore); a Docker build has no git, so walk the folder there
function repoFiles() {
  try {
    return execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'], { cwd: repo, encoding: 'utf8' }).split('\0').filter(Boolean);
  } catch {
    return readdirSync(repo, { recursive: true, withFileTypes: true })
      .filter((d) => d.isFile())
      .map((d) => relative(repo, join(d.parentPath, d.name)).replaceAll('\\', '/'))
      .filter((f) => !/(^|\/)(node_modules|dist|\.git)\/|^apps\/api\/uploads\/|^\.env$/.test(f));
  }
}

// files whose source the /about page may open: text only, and never the database snapshot (members' data)
const viewable = new Set<string>();
const MAX_VIEW = 400_000;

function scan() {
  const all = repoFiles();
  const isSlip = (f: string) => /^apps\/api\/db\/snapshot\/uploads\/private\//.test(f);
  const files = all.filter((f) => !isSlip(f)); // slips are listed as one line below
  const slips = all.filter(isSlip).length;
  viewable.clear();
  const list = files.map((path) => {
    let text = '';
    const binary = /\.(png|jpe?g|webp|ico|pdf|gif)$/i.test(path);
    if (!binary) {
      try {
        text = readFileSync(join(repo, path), 'utf8');
      } catch {
        // deleted after listing
      }
    }
    const view = !binary && text.length <= MAX_VIEW && !path.startsWith('apps/api/db/snapshot/');
    if (view) viewable.add(path);
    const name = path.split('/').pop()!;
    const about = known[path] ?? (binary ? '' : headerComment(text)) ?? '';
    return { path, lines: binary ? 0 : text.split('\n').length, view, about: about || (rules.find(([re]) => re.test(path))?.[1] ?? (name.startsWith('.') ? 'ไฟล์ตั้งค่า' : '')) };
  });
  if (slips) list.push({ path: 'apps/api/db/snapshot/uploads/private/slips/', lines: 0, view: false, about: `สลิปชำระเงินใน snapshot (${slips} ไฟล์)` });
  return list;
}

export function projectFiles(): Plugin {
  return {
    name: 'project-files',
    resolveId: (source) => (source === id ? `\0${id}` : undefined),
    load: (source) => (source === `\0${id}` ? `export default ${JSON.stringify({ generatedAt: new Date().toISOString(), files: scan() })};` : undefined),
    // the build ships each viewable file as /source/<path>.txt, fetched only when someone opens it
    generateBundle() {
      if (!viewable.size) scan();
      for (const path of viewable) this.emitFile({ type: 'asset', fileName: `source/${path}.txt`, source: readFileSync(join(repo, path), 'utf8') });
    },
    configureServer(server) {
      // the dev server answers the same /source/<path>.txt URLs straight from the repo (listed files only)
      server.middlewares.use('/source/', (req, res, next) => {
        const path = decodeURIComponent((req.url ?? '').slice(1).split('?')[0]).replace(/\.txt$/, '');
        if (!viewable.has(path)) return next();
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        res.end(readFileSync(join(repo, path)));
      });
      // any change in the repo re-generates the list on the next page load
      const refresh = () => {
        const mod = server.moduleGraph.getModuleById(`\0${id}`);
        if (mod) server.moduleGraph.invalidateModule(mod);
      };
      server.watcher.add(repo);
      server.watcher.on('add', refresh);
      server.watcher.on('unlink', refresh);
      server.watcher.on('change', refresh);
    },
  };
}
