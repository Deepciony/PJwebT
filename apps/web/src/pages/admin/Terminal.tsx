import { useQuery } from '@tanstack/react-query';
import { type FormEvent, type KeyboardEvent, useEffect, useRef, useState } from 'react';
import { api, ok } from '../../api';
import { PageHeader } from '../../components/ui';

type Result = { ok: boolean; output: string; table?: { columns: string[]; rows: string[][] } };
type Entry = Result & { id: number; command: string; pending?: boolean };

const send = (command: string) => ok(api.POST('/api/v1/admin/terminal', { body: { command } })) as Promise<Result>;
const quick = ['help', 'info', 'versions', 'db', 'tables', 'stats', 'endpoints', 'health', 'env', 'sql SELECT version()'];
const quote = (name: string) => `"${name.replaceAll('"', '""')}"`;

function Grid({ table }: { table: NonNullable<Result['table']> }) {
  if (!table.columns.length) return null;
  return (
    <div className="mt-2 max-h-[28rem] overflow-auto rounded-lg border border-line">
      <table className="w-full border-collapse text-left text-xs">
        <thead className="sticky top-0 bg-sunken">
          <tr>
            {table.columns.map((c) => (
              <th key={c} className="border-b border-line px-2.5 py-1.5 font-semibold whitespace-nowrap text-mark">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {table.rows.map((row, i) => (
            <tr key={i} className="odd:bg-white/[0.03] hover:bg-white/[0.06]">
              {row.map((v, j) => (
                <td key={j} title={v} className={`max-w-md truncate border-b border-line/40 px-2.5 py-1 whitespace-nowrap ${v === 'NULL' ? 'text-muted italic' : ''}`}>
                  {v}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {!table.rows.length && <p className="px-2.5 py-2 text-muted">(0 rows)</p>}
    </div>
  );
}

// one table in the tree: the name opens its data, the arrow shows its columns
function TableNode({ name, rows, onOpen }: { name: string; rows: string; onOpen: (name: string) => void }) {
  const [open, setOpen] = useState(false);
  const columns = useQuery({ queryKey: ['terminal', 'columns', name], queryFn: () => send(`columns ${name}`), enabled: open });
  return (
    <li>
      <div className="flex items-center">
        <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} aria-label={`คอลัมน์ของ ${name}`} className="grid size-6 shrink-0 place-items-center text-muted hover:text-ink">
          <span className={`transition ${open ? 'rotate-90' : ''}`}>›</span>
        </button>
        <button type="button" onClick={() => onOpen(name)} className="flex min-w-0 flex-1 items-center justify-between gap-2 rounded px-1.5 py-0.5 text-left hover:bg-white/5" title={`SELECT * FROM ${name}`}>
          <span className="truncate font-mono text-sm">{name}</span>
          <span className="num text-xs text-muted">{rows}</span>
        </button>
      </div>
      {open && (
        <ul className="mb-1 ml-3 border-l border-line pl-3 font-mono text-xs text-muted">
          {columns.isPending && <li>…</li>}
          {columns.data?.table?.rows.map(([column, type]) => (
            <li key={column} className="flex justify-between gap-2 py-0.5">
              <span className="text-ink/85">{column}</span>
              <span className="truncate">{type}</span>
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

function Tree({ onOpen }: { onOpen: (name: string) => void }) {
  const db = useQuery({ queryKey: ['terminal', 'db'], queryFn: () => send('db') });
  const tables = useQuery({ queryKey: ['terminal', 'tables'], queryFn: () => send('tables') });
  const fact = (key: string) => db.data?.table?.rows.find((r) => r[0] === key)?.[1];
  const rows = tables.data?.table?.rows ?? [];
  const group = (type: string, title: string) => {
    const list = rows.filter((r) => r[1] === type);
    return (
      list.length > 0 && (
        <div>
          <p className="label mt-3 mb-1 px-1">
            {title} ({list.length})
          </p>
          <ul>
            {list.map(([name, , count]) => (
              <TableNode key={name} name={name} rows={count} onOpen={onOpen} />
            ))}
          </ul>
        </div>
      )
    );
  };
  return (
    <aside className="rounded-xl border-2 border-line bg-surface p-3 lg:max-h-[78vh] lg:overflow-auto" aria-label="โครงสร้างฐานข้อมูล">
      <div className="flex items-center gap-2 px-1">
        <span aria-hidden>🐘</span>
        <div className="min-w-0 leading-tight">
          <p className="font-semibold">{fact('database') ?? 'ฐานข้อมูล'}</p>
          <p className="truncate text-xs text-muted">{fact('version')?.split(' on ')[0] ?? 'PostgreSQL'}</p>
        </div>
      </div>
      {tables.isPending && <p className="mt-3 px-1 text-sm text-muted">กำลังโหลด…</p>}
      {group('table', 'Tables')}
      {group('view', 'Views')}
      <p className="mt-3 px-1 text-xs text-muted">กดชื่อตารางเพื่อดูข้อมูล 100 แถวแรก · กดลูกศรเพื่อดูคอลัมน์</p>
    </aside>
  );
}

// An admin terminal: fixed read-only commands and read-only SQL, answered by POST /admin/terminal.
export default function Terminal() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [input, setInput] = useState('');
  const history = useRef<string[]>([]);
  const cursor = useRef(0);
  const out = useRef<HTMLDivElement>(null);
  const field = useRef<HTMLInputElement>(null);
  const started = useRef(false);

  const run = (command: string) => {
    const c = command.trim();
    if (!c) return;
    history.current = [...history.current.filter((h) => h !== c), c];
    cursor.current = history.current.length;
    setInput('');
    if (c === 'clear') return setEntries([]);
    const id = Date.now() + Math.random();
    const settle = (r: Result) => setEntries((list) => list.map((e) => (e.id === id ? { ...e, ...r, pending: false } : e)));
    setEntries((list) => [...list, { id, command: c, ok: true, output: '', pending: true }]);
    send(c)
      .then(settle)
      .catch((err: Error) => settle({ ok: false, output: err.message }));
  };

  useEffect(() => {
    if (started.current) return; // StrictMode mounts twice in development
    started.current = true;
    run('info');
  }, []);
  useEffect(() => {
    out.current?.scrollTo({ top: out.current.scrollHeight, behavior: 'smooth' }); // newer browsers return a promise here; an effect must not
  }, [entries]);

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    run(input);
  };
  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
    e.preventDefault();
    cursor.current = Math.max(0, Math.min(history.current.length, cursor.current + (e.key === 'ArrowUp' ? -1 : 1)));
    setInput(history.current[cursor.current] ?? '');
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Terminal"
        sub="เช็คทุกอย่างของระบบ: ใช้อะไร เวอร์ชันไหน ฐานข้อมูล ตาราง endpoint ค่าตั้ง และรัน SQL แบบอ่านอย่างเดียว พิมพ์ help เพื่อดูคำสั่งทั้งหมด"
      />
      <div className="grid gap-4 lg:grid-cols-[17rem_minmax(0,1fr)]">
        <Tree onOpen={(name) => run(`sql SELECT * FROM ${quote(name)} LIMIT 100`)} />
        <section className="flex min-w-0 flex-col overflow-hidden rounded-xl border-2 border-line bg-black/45 font-mono text-sm" onClick={() => field.current?.focus()}>
          <div className="flex flex-wrap gap-1.5 border-b border-line bg-sunken/60 px-3 py-2">
            {quick.map((q) => (
              <button
                key={q}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  run(q);
                }}
                className="rounded-md border border-line px-2 py-0.5 text-xs text-ink/85 hover:border-line-hi hover:text-ink"
              >
                {q}
              </button>
            ))}
          </div>
          <div ref={out} className="h-[62vh] space-y-4 overflow-auto px-4 py-3" aria-live="polite">
            {entries.length === 0 && <p className="text-muted">พิมพ์ help เพื่อดูคำสั่งทั้งหมด</p>}
            {entries.map((e) => (
              <div key={e.id}>
                <p className="break-all">
                  <span className="text-turf">admin@arena-hub</span>
                  <span className="text-muted">:~$ </span>
                  {e.command}
                </p>
                {e.pending ? (
                  <p className="text-muted">…</p>
                ) : (
                  <>
                    {e.output && <pre className={`mt-1 whitespace-pre-wrap break-words ${e.ok ? 'text-ink/85' : 'text-danger'}`}>{e.output}</pre>}
                    {e.table && <Grid table={e.table} />}
                  </>
                )}
              </div>
            ))}
          </div>
          <form onSubmit={onSubmit} className="flex items-center gap-2 border-t border-line px-4 py-2.5">
            <label htmlFor="terminal-input" className="shrink-0">
              <span className="text-turf">admin@arena-hub</span>
              <span className="text-muted">:~$</span>
            </label>
            <input
              id="terminal-input"
              ref={field}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKeyDown}
              autoComplete="off"
              spellCheck={false}
              autoFocus
              placeholder="help"
              className="min-w-0 flex-1 bg-transparent text-ink outline-none placeholder:text-muted/60"
            />
          </form>
        </section>
      </div>
    </div>
  );
}
