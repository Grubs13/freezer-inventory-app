'use client';

import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from 'react';
import { FRESHNESS_LABEL, type Freshness } from '@/lib/domain';

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ');

const PATHS = {
  plus: 'M12 5v14M5 12h14',
  minus: 'M5 12h14',
  search: 'M18 11a7 7 0 1 1-14 0 7 7 0 0 1 14 0zM20 20l-4-4',
  mic: 'M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3zM19 11a7 7 0 0 1-14 0M12 18v3',
  snowflake: 'M12 2v20M3.3 7l17.4 10M3.3 17L20.7 7M9 3.5l3 2.5 3-2.5M9 20.5l3-2.5 3 2.5',
  freezer: 'M3 9h18v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zM3 9l2-5h14l2 5M10 13h4',
  list: 'M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01',
  chart: 'M5 20V11M12 20V5M19 20v-6',
  cart: 'M3 4h2l2.4 11h11L21 8H6.2M10 20h.01M17 20h.01',
  user: 'M16 8a4 4 0 1 1-8 0 4 4 0 0 1 8 0zM4 21a8 8 0 0 1 16 0',
  check: 'M5 12l5 5 9-10',
  x: 'M6 6l12 12M18 6L6 18',
  clock: 'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0zM12 7v5l3 2',
  trash: 'M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3',
  filter: 'M4 5h16l-6 8v6l-4-2v-4z',
  chevronRight: 'M9 6l6 6-6 6',
  chevronDown: 'M6 9l6 6 6-6',
  chevronLeft: 'M15 6l-6 6 6 6',
  more: 'M5 12h.01M12 12h.01M19 12h.01',
  layers: 'M12 3l9 5-9 5-9-5zM3 13l9 5 9-5',
  note: 'M5 4h14v16H5zM9 9h6M9 13h6M9 17h3',
  settings: 'M4 7h10M18 7h2M4 17h4M12 17h8M16 5v4M10 15v4',
} as const;
export type IconName = keyof typeof PATHS;

export function Icon({ name, size = 20, strokeWidth = 1.75, label, className }: { name: IconName; size?: number; strokeWidth?: number; label?: string; className?: string }) {
  return (
    <svg className={cx('fb-icon', className)} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" aria-hidden={label ? undefined : true} role={label ? 'img' : undefined} aria-label={label}>
      <path d={PATHS[name]} />
    </svg>
  );
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  icon?: IconName;
  iconRight?: IconName;
  block?: boolean;
};

export function Button({ variant = 'secondary', size = 'md', icon, iconRight, block, className, children, type = 'button', ...rest }: ButtonProps) {
  const iconSize = size === 'sm' ? 16 : 18;
  return (
    <button type={type} {...rest} className={cx('fb-btn', `fb-btn--${variant}`, `fb-btn--${size}`, block && 'fb-btn--block', className)}>
      {icon && <Icon name={icon} size={iconSize} />}
      {children != null && <span>{children}</span>}
      {iconRight && <Icon name={iconRight} size={iconSize} />}
    </button>
  );
}

type IconButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & { icon: IconName; label: string; variant?: 'ghost' | 'secondary'; size?: 'sm' | 'md' };

export function IconButton({ icon, label, variant = 'ghost', size = 'md', className, type = 'button', ...rest }: IconButtonProps) {
  return (
    <button type={type} aria-label={label} title={label} {...rest} className={cx('fb-iconbtn', `fb-iconbtn--${variant}`, `fb-iconbtn--${size}`, className)}>
      <Icon name={icon} size={size === 'sm' ? 16 : 20} />
    </button>
  );
}

export function Badge({ tone = 'neutral', dot, children }: { tone?: 'neutral' | 'frost' | Freshness; dot?: boolean; children?: ReactNode }) {
  return (
    <span className={cx('fb-badge', `fb-badge--${tone}`)}>
      {dot && <span className="fb-badge__dot" aria-hidden />}
      {children ?? (tone in FRESHNESS_LABEL ? FRESHNESS_LABEL[tone as Freshness] : '')}
    </span>
  );
}

type StepperProps = {
  value: number;
  onChange: (n: number) => void;
  min?: number;
  unit?: string;
  size?: 'sm' | 'md';
  trashAtOne?: boolean;
  label?: string;
  disabled?: boolean;
};

export function QuantityStepper({ value, onChange, min = 0, unit, size = 'md', trashAtOne, label = 'Quantity', disabled }: StepperProps) {
  const lastOne = value <= 1;
  return (
    <div className={cx('fb-stepper', size === 'sm' && 'fb-stepper--sm')} role="group" aria-label={label}>
      <button type="button" className="fb-stepper__btn" aria-label={lastOne && trashAtOne ? 'Remove the last one' : 'Remove one'}
        disabled={disabled || value <= min} onClick={() => onChange(Math.max(min, value - 1))}>
        <Icon name={lastOne && trashAtOne ? 'trash' : 'minus'} size={16} />
      </button>
      <span className="fb-stepper__val" aria-live="polite">
        {Number.isInteger(value) ? value : value.toFixed(2).replace(/0+$/, '').replace(/\.$/, '')}
        {unit && <span className="fb-stepper__unit"> {unit}</span>}
      </span>
      <button type="button" className="fb-stepper__btn" aria-label="Add one" disabled={disabled} onClick={() => onChange(value + 1)}>
        <Icon name="plus" size={16} />
      </button>
    </div>
  );
}

export function SearchField({ onVoice, size = 'lg', className, ...rest }: Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> & { onVoice?: () => void; size?: 'md' | 'lg' }) {
  return (
    <label className={cx('fb-search', size === 'md' && 'fb-search--md', className)}>
      <Icon name="search" size={18} className="fb-search__icon" />
      <input type="search" placeholder="Search the freezer" aria-label="Search items" {...rest} className="fb-search__input" />
      {onVoice && (
        <button type="button" className="fb-search__mic" aria-label="Search by voice" onClick={onVoice}>
          <Icon name="mic" size={18} />
        </button>
      )}
    </label>
  );
}

export type Chip = { id: string; label: string; count?: number };

export function CategoryChips({ items, active, onChange, label = 'Categories' }: { items: Chip[]; active: string; onChange: (id: string) => void; label?: string }) {
  return (
    <div className="fb-chips" role="tablist" aria-label={label}>
      {items.map((it) => (
        <button key={it.id} type="button" role="tab" aria-selected={it.id === active} className={cx('fb-chip', it.id === active && 'is-active')} onClick={() => onChange(it.id)}>
          {it.label}
          {it.count != null && <span className="fb-chip__count">{it.count}</span>}
        </button>
      ))}
    </div>
  );
}

type StatCardProps = { label: string; value: ReactNode; hint?: string; tone?: 'frost' | Freshness; compact?: boolean; pressed?: boolean; onClick?: () => void };

export function StatCard({ label, value, hint, tone, compact, pressed, onClick }: StatCardProps) {
  const body = (
    <>
      <div className="fb-stat__label">
        {tone && <span className={`fb-stat__dot fb-dot--${tone}`} aria-hidden />}
        {label}
      </div>
      <div className="fb-stat__value">{value}</div>
      {hint && <div className="fb-stat__hint">{hint}</div>}
    </>
  );
  const className = cx('fb-stat', compact && 'fb-stat--compact');
  return onClick ? (
    <button type="button" className={className} aria-pressed={pressed} onClick={onClick}>{body}</button>
  ) : (
    <div className={className}>{body}</div>
  );
}

export function Wave({ className }: { className?: string }) {
  return (
    <span className={cx('fb-wave', className)} aria-hidden>
      {[0, 1, 2, 3, 4].map((i) => <span key={i} style={{ animationDelay: `${i * 0.12}s` }} />)}
    </span>
  );
}

export type VoiceState = 'idle' | 'listening' | 'processing';

export function VoiceButton({ state = 'idle', size = 'md', label, onClick }: { state?: VoiceState; size?: 'md' | 'lg'; label?: string; onClick?: () => void }) {
  const name = label ?? (state === 'listening' ? 'Stop listening' : state === 'processing' ? 'Working…' : 'Add or remove by voice');
  return (
    <button type="button" className={cx('fb-voice', `fb-voice--${state}`, size === 'lg' && 'fb-voice--lg')} aria-label={name}
      aria-pressed={state === 'listening'} onClick={onClick} disabled={state === 'processing'}>
      <span className="fb-voice__ring" aria-hidden />
      <span className="fb-voice__ring fb-voice__ring--2" aria-hidden />
      <span className="fb-voice__core">
        {state === 'listening' ? <Wave /> : state === 'processing' ? <span className="fb-spinner" aria-hidden /> : <Icon name="mic" size={26} strokeWidth={2} />}
      </span>
    </button>
  );
}

/** The Frostbox mark from design/frostbox/logos/frostbox-mark.svg. */
export function Mark({ size = 28 }: { size?: number }) {
  return (
    <svg className="fb-mark" width={size} height={size} viewBox="0 0 64 64" aria-hidden>
      <rect width="64" height="64" rx="16" fill="#0b6bcb" />
      <rect x="12" y="24" width="40" height="28" rx="6" fill="none" stroke="#ffffff" strokeWidth="3.5" />
      <path d="M12 30h40" stroke="#ffffff" strokeWidth="3.5" />
      <path d="M32 8v14M25.5 11.5 32 15l6.5-3.5" fill="none" stroke="#bfe0ff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export { cx };
