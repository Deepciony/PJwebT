// Copy the whole database to another machine.
//   bun run db:export            writes db/snapshot/: a pg_dump of this database (schema, data, migration ledger)
//                             plus every uploaded file the data points at (slips, avatars, photos)
//   bun run db:import            loads that snapshot here, restores the files and runs any newer migrations
//   bun run db:import --replace  same, even if this database already has bookings (they are replaced)
// pg_dump and psql run inside the docker compose "db" container, so nothing else needs installing.
import { spawn } from 'node:child_process';
import { cpSync, createReadStream, createWriteStream, existsSync, mkdirSync, rmSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { pool, query } from './db';
import { env } from './env';
import { migrate } from './migrate';

const repoRoot = fileURLToPath(new URL('../../../', import.meta.url));
const snapshotDir = fileURLToPath(new URL('../db/snapshot/', import.meta.url));
const sqlFile = join(snapshotDir, 'sporthub.sql');
const filesDir = join(snapshotDir, 'uploads');
const { username, pathname } = new URL(env.databaseUrl);
const dbArgs = ['-U', decodeURIComponent(username), '-d', pathname.slice(1)];

// Runs pg_dump/psql in the db container, streaming a file into stdin or out of stdout.
function inDb(args: string[], io: { stdin?: string; stdout?: string }) {
  return new Promise<void>((resolve, reject) => {
    const child = spawn('docker', ['compose', 'exec', '-T', 'db', ...args, ...dbArgs], {
      cwd: repoRoot,
      stdio: [io.stdin ? 'pipe' : 'ignore', io.stdout ? 'pipe' : 'inherit', 'inherit'],
    });
    const written = io.stdout ? new Promise<void>((done) => child.stdout!.pipe(createWriteStream(io.stdout!)).on('finish', () => done())) : Promise.resolve();
    if (io.stdin) createReadStream(io.stdin).pipe(child.stdin!);
    child.on('error', (err) => reject(new Error(`could not run docker (${err.message}); is Docker Desktop running?`)));
    child.on('close', (code) =>
      code === 0 ? written.then(() => resolve()) : reject(new Error(`${args[0]} failed (exit ${code}); is "docker compose up -d" running?`)),
    );
  });
}

// Uploaded files the data refers to, relative to the uploads folder (test runs leave many unreferenced ones).
async function referencedFiles() {
  const rows = await query<{ path: string }>(
    `SELECT 'private/slips/' || slip_path AS path FROM payments
     UNION
     SELECT 'public/' || substr(url, length('/uploads/') + 1) FROM (
       SELECT avatar_url AS url FROM users UNION SELECT image_url FROM courts UNION SELECT image_url FROM equipment
     ) u
     WHERE url LIKE '/uploads/%'`,
  );
  return rows.map((r) => r.path);
}

async function exportSnapshot() {
  mkdirSync(snapshotDir, { recursive: true });
  await inDb(['pg_dump', '--clean', '--if-exists', '--no-owner', '--no-privileges'], { stdout: sqlFile });
  rmSync(filesDir, { recursive: true, force: true });
  let copied = 0;
  let missing = 0;
  for (const path of await referencedFiles()) {
    const from = join(env.uploadDir, path);
    if (!existsSync(from)) {
      missing++;
      continue;
    }
    mkdirSync(dirname(join(filesDir, path)), { recursive: true });
    cpSync(from, join(filesDir, path));
    copied++;
  }
  console.log(
    `exported ${relative(repoRoot, sqlFile)} (${Math.round(statSync(sqlFile).size / 1024)} KB) and ${copied} uploaded files` +
      (missing ? ` (${missing} files the data points at were already missing)` : ''),
  );
}

async function importSnapshot(replace: boolean) {
  if (!existsSync(sqlFile)) throw new Error(`no snapshot at ${relative(repoRoot, sqlFile)}; run "bun run db:export" on the source machine first`);
  // never wipe real bookings by accident
  if (!replace && (await query("SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'bookings'")).length) {
    const [{ n }] = await query<{ n: number }>('SELECT count(*)::int AS n FROM bookings');
    if (n > 0) throw new Error(`this database already has ${n} bookings; run "bun run db:import --replace" to overwrite it with the snapshot`);
  }
  // one transaction: either the whole snapshot loads or nothing changes; notices like "does not exist, skipping" stay quiet
  await inDb(['psql', '-q', '-v', 'ON_ERROR_STOP=1', '--single-transaction', '-c', 'SET client_min_messages = warning', '-f', '-'], { stdin: sqlFile });
  if (existsSync(filesDir)) cpSync(filesDir, env.uploadDir, { recursive: true });
  // a snapshot made before newer migrations still works: bring the schema up to date
  await migrate();
  const [{ n }] = await query<{ n: number }>('SELECT count(*)::int AS n FROM bookings');
  console.log(`imported ${relative(repoRoot, sqlFile)}: ${n} bookings, uploaded files restored to ${relative(repoRoot, env.uploadDir)}`);
}

const [command, ...flags] = process.argv.slice(2);
try {
  if (command === 'export') await exportSnapshot();
  else if (command === 'import') await importSnapshot(flags.includes('--replace'));
  else throw new Error('usage: bun src/snapshot.ts export | import [--replace]');
} catch (err) {
  console.error((err as Error).message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
