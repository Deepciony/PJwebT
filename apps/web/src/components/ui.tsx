import { type ChangeEvent, Children, type ComponentProps, isValidElement, type ReactNode, useEffect, useId, useRef, useState } from 'react';
import { Link } from 'react-router';
import { sportColor } from '../lib/format';

type Variant = 'primary' | 'turf' | 'ghost' | 'danger' | 'quiet' | 'quiet-danger';

const variants: Record<Variant, string> = {
  primary:
    'bg-linear-to-b from-mark-hi to-mark text-mark-ink font-semibold shadow-[inset_0_-3px_0_rgb(0_0_0/0.22)] hover:shadow-[inset_0_-3px_0_rgb(0_0_0/0.22),0_0_14px_rgb(245_197_66/0.45)]',
  turf: 'bg-turf text-turf-ink font-semibold shadow-[inset_0_-3px_0_rgb(0_0_0/0.2)] hover:brightness-110',
  ghost: 'border-2 border-line bg-sunken hover:border-line-hi',
  danger: 'bg-danger-strong text-white shadow-[inset_0_-3px_0_rgb(0_0_0/0.25)] hover:brightness-110',
  quiet: 'text-muted hover:text-ink hover:bg-sunken',
  'quiet-danger': 'text-danger hover:bg-danger-soft',
};

export function Button({
  variant = 'ghost',
  size = 'md',
  pending,
  className = '',
  children,
  ...props
}: ComponentProps<'button'> & { variant?: Variant; size?: 'sm' | 'md' | 'lg'; pending?: boolean }) {
  const sizes = { sm: 'h-8 px-3 text-sm', md: 'h-10 px-4', lg: 'h-12 px-6 text-lg' };
  return (
    <button
      type="button"
      disabled={pending || props.disabled}
      className={`inline-flex items-center justify-center gap-2 rounded-lg font-medium whitespace-nowrap transition active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50 ${sizes[size]} ${variants[variant]} ${className}`}
      {...props}
    >
      {pending && <Spinner />}
      {children}
    </button>
  );
}

export function LinkButton({ to, variant = 'ghost', className = '', children }: { to: string; variant?: Variant; className?: string; children: ReactNode }) {
  return (
    <Link to={to} className={`inline-flex h-10 items-center justify-center gap-2 rounded-lg px-4 font-medium whitespace-nowrap transition ${variants[variant]} ${className}`}>
      {children}
    </Link>
  );
}

export const Spinner = () => <span aria-hidden className="size-4 animate-spin rounded-full border-2 border-current border-r-transparent" />;

const inputClass =
  'w-full rounded-lg border-2 border-line bg-sunken px-3 py-2 text-ink placeholder:text-muted/70 focus:border-mark focus:outline-none focus:ring-2 focus:ring-mark/25 file:mr-3 file:rounded-md file:border-0 file:bg-surface file:px-3 file:py-1 file:text-sm file:text-ink';

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-medium">{label}</span>
      {children}
      {hint && <span className="block text-xs text-muted">{hint}</span>}
    </label>
  );
}

// :read-only also matches <select>, so the read-only look lives on Input alone
export const Input = (props: ComponentProps<'input'>) => (
  <input {...props} className={`${inputClass} read-only:border-line/50 read-only:text-muted ${props.className ?? ''}`} />
);
type SelectOption = { value: string; label: ReactNode; disabled?: boolean };

// Themed dropdown with the same props as <select> (value / defaultValue / onChange / name / <option> children),
// so every caller and form keeps working: a hidden native <select> still carries the name, value and required
// check for FormData, while the visible list is a popover in the top layer (never clipped by a dialog).
export function Select({ children, value, defaultValue, onChange, name, required, disabled, className = '', 'aria-label': ariaLabel }: ComponentProps<'select'>) {
  const options: SelectOption[] = Children.toArray(children).flatMap((child) =>
    isValidElement<ComponentProps<'option'>>(child)
      ? [{ value: String(child.props.value ?? child.props.children), label: child.props.children, disabled: child.props.disabled }]
      : [],
  );
  const [own, setOwn] = useState(String(defaultValue ?? options[0]?.value ?? ''));
  const current = value !== undefined ? String(value) : own;
  const selected = options.find((o) => o.value === current) ?? options[0];
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const button = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const native = useRef<HTMLSelectElement>(null);
  const listId = useId();

  // place the list under the button (or above it when there is no room below) before it opens
  const place = () => {
    const r = button.current!.getBoundingClientRect();
    const height = Math.min(options.length * 40 + 12, 288);
    const above = r.bottom + 6 + height > innerHeight && r.top - 6 - height > 0;
    Object.assign(list.current!.style, { left: `${r.left}px`, top: `${above ? r.top - 6 - height : r.bottom + 6}px`, minWidth: `${r.width}px` });
    setActive(Math.max(0, options.findIndex((o) => o.value === current)));
  };
  const pick = (v: string) => {
    list.current!.hidePopover();
    button.current!.focus();
    if (v === current) return;
    if (value === undefined) setOwn(v);
    const el = native.current!;
    el.value = v;
    onChange?.({ target: el, currentTarget: el } as ChangeEvent<HTMLSelectElement>);
  };
  const move = (step: number) => {
    let i = active;
    do i = (i + step + options.length) % options.length;
    while (options[i].disabled && i !== active);
    setActive(i);
  };

  // a page scroll or resize would leave the list floating in the wrong place, so close it
  useEffect(() => {
    if (!open) return;
    const close = (e: Event) => e.target !== list.current && list.current?.hidePopover();
    addEventListener('scroll', close, true);
    addEventListener('resize', close);
    return () => {
      removeEventListener('scroll', close, true);
      removeEventListener('resize', close);
    };
  }, [open]);

  return (
    <div className={`relative w-full ${className}`}>
      <button
        ref={button}
        type="button"
        disabled={disabled}
        popoverTarget={listId}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        aria-activedescendant={open ? `${listId}-${active}` : undefined}
        onClick={place}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault();
            if (!open) {
              place();
              list.current!.showPopover();
            } else move(e.key === 'ArrowDown' ? 1 : -1);
          } else if (open && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault();
            pick(options[active].value);
          } else if (open && e.key === 'Tab') list.current!.hidePopover();
        }}
        className="flex w-full items-center justify-between gap-2 rounded-lg border-2 border-line bg-sunken px-3 py-2 text-left text-ink transition hover:border-line-hi focus:border-mark focus:ring-2 focus:ring-mark/25 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
      >
        <span className="truncate">{selected?.label}</span>
        <svg viewBox="0 0 24 24" className={`size-4 shrink-0 text-muted transition ${open ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>
      <select ref={native} name={name} value={current} onChange={() => {}} required={required} disabled={disabled} tabIndex={-1} aria-hidden className="sr-only">
        {children}
      </select>
      <ul
        ref={list}
        id={listId}
        popover="auto"
        role="listbox"
        onToggle={(e) => setOpen((e.nativeEvent as ToggleEvent).newState === 'open')}
        style={{ position: 'fixed', inset: 'auto', margin: 0 }}
        className="max-h-72 overflow-auto rounded-xl border-2 border-line-hi bg-panel p-1 text-ink shadow-[0_0_0_3px_var(--frame),0_12px_30px_rgb(0_0_0/0.5)]"
      >
        {options.map((o, i) => (
          <li
            key={o.value}
            id={`${listId}-${i}`}
            role="option"
            aria-selected={o.value === current}
            aria-disabled={o.disabled}
            onMouseEnter={() => setActive(i)}
            onClick={() => !o.disabled && pick(o.value)}
            className={`flex cursor-pointer items-center justify-between gap-4 rounded-lg px-3 py-2 whitespace-nowrap ${i === active ? 'bg-surface-hi' : ''} ${
              o.value === current ? 'font-semibold text-mark' : ''
            } ${o.disabled ? 'cursor-not-allowed opacity-40' : ''}`}
          >
            {o.label}
            {o.value === current && <span aria-hidden>✓</span>}
          </li>
        ))}
      </ul>
    </div>
  );
}
export const Textarea = (props: ComponentProps<'textarea'>) => <textarea rows={3} {...props} className={`${inputClass} ${props.className ?? ''}`} />;

const tones = {
  mark: 'bg-mark/15 text-mark ring-mark/70',
  turf: 'bg-turf/15 text-turf ring-turf/60',
  info: 'bg-info/15 text-info ring-info/50',
  muted: 'bg-sunken text-muted ring-line',
  danger: 'bg-danger/15 text-danger ring-danger/60',
};

export function Badge({ tone, children }: { tone: keyof typeof tones; children: ReactNode }) {
  return <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ${tones[tone]}`}>{children}</span>;
}

export function Panel({ className = '', children }: { className?: string; children: ReactNode }) {
  return <section className={`rounded-xl border-2 border-line bg-linear-to-b from-surface-hi to-surface ${className}`}>{children}</section>;
}

// Every page opens the same way: what it is, what it is for, and its main action on the right.
export function PageHeader({ title, sub, children }: { title: ReactNode; sub?: ReactNode; children?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3 border-b border-line pb-4">
      <div className="min-w-0 max-w-3xl">
        <h1 className="text-2xl sm:text-3xl">{title}</h1>
        {sub && <p className="mt-1 text-muted">{sub}</p>}
      </div>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </div>
  );
}

// A titled block on long pages: gold kicker in English (game-style), Thai heading, one-line summary.
export function Section({ id, kicker, title, sub, children }: { id?: string; kicker: string; title: string; sub?: string; children: ReactNode }) {
  return (
    <section id={id} className="scroll-mt-32 space-y-5">
      <div>
        <p className="label text-mark!">{kicker}</p>
        <h2 className="text-2xl sm:text-3xl">{title}</h2>
        {sub && <p className="mt-1 max-w-3xl text-muted">{sub}</p>}
      </div>
      {children}
    </section>
  );
}

// Big number in a dark well, like the game's ONLINE PLAYERS box.
export function StatBox({ label, value, unit }: { label: string; value: ReactNode; unit?: string }) {
  return (
    <div className="rounded-xl bg-sunken px-4 py-2">
      <p className="label">{label}</p>
      <p className="num text-2xl leading-tight font-extrabold">
        {value} {unit && <span className="text-sm font-medium text-muted">{unit}</span>}
      </p>
    </div>
  );
}

// Dark chip with a muted label and a value: ID 1401, JOB ประชาชน.
export function InfoChip({ label, children }: { label: string; children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-lg bg-sunken px-2.5 py-1 text-sm">
      <span className="label">{label}</span>
      <span className="font-semibold">{children}</span>
    </span>
  );
}

// One labelled row of a filter panel: label on the left, choices on the right.
export function FilterRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid items-center gap-x-3 gap-y-1 sm:grid-cols-[4.5rem_minmax(0,1fr)]">
      <span className="text-sm font-semibold text-muted">{label}</span>
      {children}
    </div>
  );
}

// Numbered how-to strip, e.g. how booking works.
export function Steps({ items }: { items: string[] }) {
  return (
    <ol className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 text-sm sm:flex-wrap">
      {items.map((label, i) => (
        <li key={label} className="flex shrink-0 items-center gap-2 rounded-full border-2 border-line bg-sunken py-1 pr-3 pl-1 whitespace-nowrap">
          <span className="num grid size-6 place-items-center rounded-full bg-violet text-xs font-bold text-white">{i + 1}</span>
          {label}
        </li>
      ))}
    </ol>
  );
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="rounded-xl border-2 border-dashed border-line bg-sunken/50 px-6 py-12 text-center">
      <p className="font-display text-lg font-semibold uppercase">{title}</p>
      {children && <div className="mt-3 text-muted">{children}</div>}
    </div>
  );
}

export function ErrorNote({ error }: { error: unknown }) {
  if (!error) return null;
  return (
    <p role="alert" className="rounded-lg border border-danger/50 bg-danger-soft px-3 py-2 text-sm text-danger">
      {error instanceof Error ? error.message : String(error)}
    </p>
  );
}

export function Loading({ label = 'กำลังโหลด' }: { label?: string }) {
  return (
    <div className="flex items-center gap-3 py-10 text-muted" aria-live="polite">
      <Spinner /> {label}
    </div>
  );
}

// Native <dialog>: focus trap, Esc to close and inert background come for free.
export function Modal({ open, onClose, title, wide, children }: { open: boolean; onClose: () => void; title: ReactNode; wide?: boolean; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (open && !d?.open) d?.showModal();
    if (!open && d?.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      className={`m-auto ${wide ? "w-[min(60rem,calc(100vw-2rem))]" : "w-[min(32rem,calc(100vw-2rem))]"} rounded-[20px] border-2 border-line-hi bg-panel p-0 text-ink shadow-[0_0_0_4px_var(--frame),0_18px_50px_rgb(0_0_0/0.6)]`}
    >
      <div className="m-2 flex items-center justify-between gap-3 rounded-xl bg-sunken/70 px-4 py-2.5">
        <h2 className="text-lg">{title}</h2>
        <IconButton label="ปิด" onClick={onClose} tone="danger">
          ×
        </IconButton>
      </div>
      <div className="px-5 pt-2 pb-5">{open && children}</div>
    </dialog>
  );
}

// Each sport's real line markings, drawn on a 120×80 court (net/halfway at x = 60).
const courtLines: Record<string, ReactNode> = {
  '⚽': (
    <>
      <path d="M60 8v64M8 24h14v32H8M112 24H98v32h14M8 33h5v14H8M112 33h-5v14h5" />
      <circle cx="60" cy="40" r="10" />
    </>
  ),
  '🏸': <path d="M8 13h104M8 67h104M48 8v64M72 8v64M14 8v64M106 8v64M8 40h40M72 40h40M60 6v68" strokeWidth="1.6" />,
  '🏀': (
    <>
      <path d="M60 8v64M8 30h22v20H8M112 30H90v20h22M8 13h6a27 27 0 0 1 0 54H8M112 13h-6a27 27 0 0 0 0 54h6" />
      <circle cx="60" cy="40" r="8" />
    </>
  ),
  '🎾': <path d="M8 16h104M8 64h104M33 16v48M87 16v48M33 40h54M60 5v70" />,
  '🏓': <path d="M8 40h104M60 4v72" strokeWidth="1.6" />,
  '🏐': <path d="M43 8v64M77 8v64M60 4v72" />,
  '🥅': (
    <>
      <path d="M60 8v64M8 28h12v24H8M112 28h-12v24h12" />
      <circle cx="60" cy="40" r="8" />
    </>
  ),
  '🏊': <path d="M8 24h104M8 40h104M8 56h104" strokeDasharray="6 4" />,
  '🥊': <rect x="22" y="16" width="76" height="48" />,
  '🎱': (
    <>
      <circle cx="10" cy="10" r="3" />
      <circle cx="60" cy="9" r="3" />
      <circle cx="110" cy="10" r="3" />
      <circle cx="10" cy="70" r="3" />
      <circle cx="60" cy="71" r="3" />
      <circle cx="110" cy="70" r="3" />
      <path d="M30 8v64" />
    </>
  ),
  '🎳': <path d="M36 8v64M60 8v64M84 8v64M8 62h104" />,
  '⛳': (
    <>
      <circle cx="60" cy="40" r="10" />
      <circle cx="60" cy="40" r="22" />
    </>
  ),
  '🏹': (
    <>
      <circle cx="60" cy="40" r="8" />
      <circle cx="60" cy="40" r="18" />
      <circle cx="60" cy="40" r="28" />
    </>
  ),
  '🧗': <path d="M20 66l14-20 12 8 14-26 12 14 16-30 12 18" />,
  '🏑': (
    <>
      <path d="M60 8v64M8 24a16 16 0 0 1 0 32M112 24a16 16 0 0 0 0 32" />
      <circle cx="60" cy="40" r="2" />
    </>
  ),
  '⚾': <path d="M60 68L28 36L60 12L92 36z" />,
  '🏉': <path d="M20 8v64M100 8v64M60 8v64M38 8v64M82 8v64" strokeDasharray="4 4" />,
  '🤺': <path d="M8 34h104M8 46h104M60 34v12" />,
  '🏋️': <path d="M30 40h60M30 28v24M90 28v24M22 32v16M98 32v16" />,
};

// Placeholder art when a court or item has no photo: the sport's surface and its line markings
// (courts), or a plain swatch of that surface (equipment).
export function SportArt({
  icon,
  sportId = 0,
  imageUrl,
  gear = false,
  className = '',
}: { icon: string; sportId?: number; imageUrl?: string | null; gear?: boolean; className?: string }) {
  if (imageUrl) return <img src={imageUrl} alt="" className={`object-cover ${className}`} />;
  return (
    <div
      className={`relative overflow-hidden ${className}`}
      style={{ background: sportColor(icon, sportId), containerType: 'inline-size' }}
      aria-hidden
    >
      {gear ? (
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_55%,rgb(255_255_255/0.28),transparent_60%)]" />
      ) : (
        <svg viewBox="0 0 120 80" className="absolute inset-0 size-full" preserveAspectRatio="none">
          <g fill="none" stroke="white" strokeOpacity="0.6" strokeWidth="1.1">
            <rect x="8" y="8" width="104" height="64" />
            {courtLines[icon] ?? <path d="M60 8v64" />}
          </g>
        </svg>
      )}
      <span className="absolute inset-0 grid place-items-center drop-shadow-md" style={{ fontSize: gear ? 'clamp(2rem, 30cqw, 7rem)' : 'clamp(1.25rem, 16cqw, 4.5rem)' }}>
        {icon}
      </span>
    </div>
  );
}

// Square 32px icon button from the game header (settings, mail, close).
export function IconButton({ label, tone, className = '', children, ...props }: ComponentProps<'button'> & { label: string; tone?: 'danger' }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={`grid size-8 shrink-0 place-items-center rounded-lg border-2 text-lg leading-none transition hover:border-line-hi ${tone === 'danger' ? 'border-danger-strong/70 bg-danger-soft text-danger' : 'border-line bg-sunken text-ink'} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

// Amber progress bar on a dark well track, as in the farming HUD and battle pass.
export function Progress({ value, className = '' }: { value: number; className?: string }) {
  return (
    <div className={`h-2 overflow-hidden rounded-full bg-sunken ${className}`}>
      <div className="h-full rounded-full bg-linear-to-r from-prog to-prog-hi" style={{ width: `${Math.max(0, Math.min(1, value)) * 100}%` }} />
    </div>
  );
}

export function Stars({ value }: { value: number }) {
  return (
    <span className="text-mark" aria-label={`${value} จาก 5 ดาว`}>
      {'★'.repeat(Math.round(value))}
      <span className="text-muted/40">{'★'.repeat(5 - Math.round(value))}</span>
    </span>
  );
}
