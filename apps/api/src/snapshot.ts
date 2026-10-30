// Copy a private database snapshot to another machine.
//   SNAPSHOT_SOURCE_DATABASE_URL may point at production; otherwise DATABASE_URL is exported.
//   pnpm db:export            writes db/private-snapshot/: schema, data, migration ledger and available uploads
//   pnpm db:import            loads that snapshot here, restores the files and runs any newer migrations
//   pnpm db:import --replace  same, even if this database already has bookings (they are replaced)
// PostgreSQL client tools run in Docker, so nothing else needs installing.
import { spawn } from 'node:child_process';
import { cpSync, createReadStream, createWriteStream, existsSync, mkdirSync, rmSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { finished } from 'node:stream/promises';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { pool, query } from './db';
import { env } from './env';
import { migrate } from './migrate';

const repoRoot = fileURLToPath(new URL('../../../', import.meta.url));
const snapshotDir = fileURLToPath(new URL('../db/private-snapshot/', import.meta.url));
const sqlFile = join(snapshotDir, 'sporthub.sql');
const filesDir = join(snapshotDir, 'uploads');
const { username, password, pathname } = new URL(env.databaseUrl);
const dbUser = decodeURIComponent(username);
const dbName = pathname.slice(1);
const dbArgs = ['-U', dbUser, '-d', dbName];

// Runs psql against the local Compose database, streaming a file into stdin or out of stdout.
function inDb(args: string[], io: { stdin?: string; stdout?: string }) {
  return new Promise<void>((resolve, reject) => {
    const child = spawn('docker', ['compose', 'exec', '-T', '-e', 'PGPASSWORD', 'db', ...args, ...dbArgs], {
      cwd: repoRoot,
      env: { ...process.env, PGPASSWORD: decodeURIComponent(password) },
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
async function referencedFiles(db: pg.Pool) {
  const rows = await db.query<{ path: string }>(
    `SELECT 'private/slips/' || slip_path AS path FROM payments
     UNION
     SELECT 'public/' || substr(url, length('/uploads/') + 1) FROM (
       SELECT avatar_url AS url FROM users UNION SELECT image_url FROM courts UNION SELECT image_url FROM equipment
     ) u
     WHERE url LIKE '/uploads/%'`,
  );
  return rows.rows.map((r) => r.path);
}

function dumpRemoteDatabase(connectionString: string) {
  const url = new URL(connectionString);
  const sourcePassword = decodeURIComponent(url.password);
  url.password = '';
  if (['localhost', '127.0.0.1', '::1'].includes(url.hostname)) url.hostname = 'host.docker.internal';

  return new Promise<void>((resolve, reject) => {
    const output = createWriteStream(sqlFile);
    const outputFinished = finished(output);
    const child = spawn(
      'docker',
      ['run', '--rm', '--add-host', 'host.docker.internal:host-gateway', '-e', 'PGPASSWORD', 'postgres:18', 'pg_dump', '--dbname', url.toString(), '--clean', '--if-exists', '--no-owner', '--no-privileges'],
      {
        cwd: repoRoot,
        env: { ...process.env, PGPASSWORD: sourcePassword },
        stdio: ['ignore', 'pipe', 'inherit'],
      },
    );
    child.stdout!.pipe(output);
    child.on('error', (err) => reject(new Error(`could not run docker (${err.message}); is Docker Desktop running?`)));
    child.on('close', (code) => {
      if (code !== 0) {
        output.destroy();
        rmSync(sqlFile, { force: true });
        reject(new Error(`pg_dump failed (exit ${code}); check the snapshot source database connection`));
        return;
      }
      outputFinished.then(() => resolve(), reject);
    });
  });
}

async function exportSnapshot() {
  const sourceUrl = process.env.SNAPSHOT_SOURCE_DATABASE_URL || env.databaseUrl;
  const sourceDb = new pg.Pool({ connectionString: sourceUrl, options: '-c timezone=Asia/Bangkok' });
  mkdirSync(snapshotDir, { recursive: true });
  try {
    await dumpRemoteDatabase(sourceUrl);
    const uploadDir = process.env.SNAPSHOT_SOURCE_UPLOAD_DIR || (sourceUrl === env.databaseUrl ? env.uploadDir : undefined);
    const referenced = await referencedFiles(sourceDb);
    rmSync(filesDir, { recursive: true, force: true });
    let copied = 0;
    let missing = uploadDir ? 0 : referenced.length;
    if (uploadDir) {
      const sourceRoot = resolve(uploadDir);
      for (const path of referenced) {
        const from = resolve(sourceRoot, path);
        if ((from !== sourceRoot && !from.startsWith(`${sourceRoot}${sep}`)) || !existsSync(from)) {
          missing++;
          continue;
        }
        mkdirSync(dirname(join(filesDir, path)), { recursive: true });
        cpSync(from, join(filesDir, path));
        copied++;
      }
    }
    console.log(
      `exported ${relative(repoRoot, sqlFile)} (${Math.round(statSync(sqlFile).size / 1024)} KB) and ${copied} uploaded files` +
        (missing ? ` (${missing} referenced files were not available; set SNAPSHOT_SOURCE_UPLOAD_DIR to their source folder)` : ''),
    );
  } finally {
    await sourceDb.end();
  }
}

async function importSnapshot(replace: boolean) {
  const targetHost = new URL(env.databaseUrl).hostname.replace(/^\[|\]$/g, '');
  if (!['localhost', '127.0.0.1', '::1'].includes(targetHost)) {
    throw new Error('refusing to import into a remote database; set DATABASE_URL to the local Docker database first');
  }
  if (!existsSync(sqlFile)) throw new Error(`no snapshot at ${relative(repoRoot, sqlFile)}; run "pnpm db:export" on the source machine first`);
  // The host-side pool connects before the snapshot is restored. Align the container
  // role password first so that this preflight and the later migrations can connect.
  const sqlUser = dbUser.replaceAll('"', '""');
  const sqlPassword = decodeURIComponent(password).replaceAll("'", "''");
  await inDb(['psql', '-v', 'ON_ERROR_STOP=1', '-c', `ALTER ROLE "${sqlUser}" WITH PASSWORD '${sqlPassword}'`], {});
  // never wipe real bookings by accident
  if (!replace && (await query("SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'bookings'")).length) {
    const [{ n }] = await query<{ n: number }>('SELECT count(*)::int AS n FROM bookings');
    if (n > 0) throw new Error(`this database already has ${n} bookings; run "pnpm db:import --replace" to overwrite it with the snapshot`);
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
  else throw new Error('usage: tsx src/snapshot.ts export | import [--replace]');
} catch (err) {
  console.error((err as Error).message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
