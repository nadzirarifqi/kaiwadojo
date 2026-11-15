import type { ReactNode } from 'react'
import { useId } from 'react'
import { useNavigate } from 'react-router-dom'

/**
 * Kerangka bersama untuk semua halaman admin/pengajar.
 *
 * Struktur semantik setiap halaman:
 *   <main>                 → AdminPage
 *     <header><h1>         → PageHeader (satu h1 per halaman)
 *     <section aria-label> → StatGrid (ringkasan angka, opsional)
 *     <section><h2>        → Panel (blok konten utama)
 *       <h3>               → judul item di dalam panel
 */

export const CARD = 'bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm'

export const BTN_PRIMARY =
  'h-10 sm:h-11 px-4 shrink-0 rounded-xl bg-primary hover:bg-primary-dark disabled:opacity-60 text-white text-sm font-bold border-none cursor-pointer inline-flex items-center justify-center gap-2 transition-colors'
export const BTN_SECONDARY =
  'h-10 sm:h-11 px-4 shrink-0 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-sm font-bold cursor-pointer inline-flex items-center justify-center gap-2 transition-colors'

type Width = 'md' | 'lg' | 'xl' | 'full'
const WIDTH: Record<Width, string> = {
  md: 'max-w-4xl',
  lg: 'max-w-6xl',
  xl: 'max-w-7xl',
  full: 'max-w-none',
}

export function AdminPage({ children, width = 'xl', className = '' }: { children: ReactNode; width?: Width; className?: string }) {
  return (
    <main className={`flex-1 px-4 py-4 sm:p-6 lg:p-8 ${WIDTH[width]} mx-auto w-full min-w-0 animate-page-slide flex flex-col gap-4 sm:gap-6 text-slate-800 dark:text-slate-100 ${className}`}>
      {children}
    </main>
  )
}

export function PageHeader({
  title,
  description,
  eyebrow,
  meta,
  actions,
}: {
  title: ReactNode
  description?: ReactNode
  /** Label kecil di atas judul, mis. "Admin · Pengguna" */
  eyebrow?: ReactNode
  /** Badge/info tambahan di bawah deskripsi */
  meta?: ReactNode
  actions?: ReactNode
}) {
  return (
    <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
      <div className="min-w-0">
        {eyebrow && (
          <p className="text-xs font-bold uppercase tracking-wider text-primary dark:text-primary-lighter mb-1">{eyebrow}</p>
        )}
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white">{title}</h1>
        {description && <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5 max-w-2xl">{description}</p>}
        {meta && <div className="flex flex-wrap items-center gap-2 mt-2">{meta}</div>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2 shrink-0">{actions}</div>}
    </header>
  )
}

type Tone = 'default' | 'primary' | 'success' | 'warning' | 'danger' | 'info'
const TONE_TEXT: Record<Tone, string> = {
  default: 'text-slate-900 dark:text-white',
  primary: 'text-primary dark:text-primary-lighter',
  success: 'text-emerald-600 dark:text-emerald-400',
  warning: 'text-amber-600 dark:text-amber-400',
  danger: 'text-red-600 dark:text-red-400',
  info: 'text-sky-600 dark:text-sky-400',
}
const TONE_DOT: Record<Tone, string> = {
  default: 'bg-slate-400',
  primary: 'bg-primary',
  success: 'bg-emerald-500',
  warning: 'bg-amber-500',
  danger: 'bg-red-500',
  info: 'bg-sky-500',
}

export interface StatItem {
  label: string
  value: ReactNode
  hint?: ReactNode
  tone?: Tone
  onClick?: () => void
}

export function StatGrid({ items, label = 'Ringkasan', columns = 4 }: { items: StatItem[]; label?: string; columns?: 2 | 3 | 4 | 5 }) {
  const cols = { 2: 'lg:grid-cols-2', 3: 'lg:grid-cols-3', 4: 'lg:grid-cols-4', 5: 'lg:grid-cols-5' }[columns]
  return (
    <section aria-label={label}>
      <dl className={`grid grid-cols-2 ${cols} gap-3 sm:gap-4 m-0`}>
        {items.map(s => {
          const tone = s.tone ?? 'default'
          const body = (
            <>
              <dt className="text-sm text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                {tone !== 'default' && <span className={`size-1.5 rounded-full ${TONE_DOT[tone]}`} aria-hidden="true" />}
                {s.label}
              </dt>
              <dd className={`m-0 text-2xl font-black tabular-nums mt-1 leading-none ${TONE_TEXT[tone]}`}>{s.value}</dd>
              {s.hint && <dd className="m-0 text-xs text-slate-400 mt-1.5 truncate">{s.hint}</dd>}
            </>
          )
          return s.onClick ? (
            <button
              key={s.label}
              type="button"
              onClick={s.onClick}
              className={`${CARD} p-4 text-left cursor-pointer hover:border-primary/40 transition-colors`}
            >
              {body}
            </button>
          ) : (
            <div key={s.label} className={`${CARD} p-4`}>{body}</div>
          )
        })}
      </dl>
    </section>
  )
}

export function Panel({
  title,
  description,
  actions,
  children,
  className = '',
  bodyClassName = 'p-4 sm:p-5',
  as: Tag = 'section',
}: {
  title?: ReactNode
  description?: ReactNode
  actions?: ReactNode
  children: ReactNode
  className?: string
  bodyClassName?: string
  as?: 'section' | 'article' | 'div'
}) {
  const id = useId()
  return (
    <Tag aria-labelledby={title ? id : undefined} className={`${CARD} min-w-0 ${className}`}>
      {(title || actions) && (
        <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 sm:px-5 pt-4 sm:pt-5">
          <div className="min-w-0">
            {title && <h2 id={id} className="text-base font-bold text-slate-900 dark:text-white">{title}</h2>}
            {description && <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">{description}</p>}
          </div>
          {actions && <div className="flex flex-wrap items-center gap-2 shrink-0">{actions}</div>}
        </header>
      )}
      <div className={bodyClassName}>{children}</div>
    </Tag>
  )
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: ReactNode
  title: ReactNode
  description?: ReactNode
  action?: ReactNode
}) {
  return (
    <div className="py-10 px-4 text-center flex flex-col items-center">
      {icon && (
        <span className="size-12 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center" aria-hidden="true">
          {icon}
        </span>
      )}
      <p className="mt-3 text-base font-semibold text-slate-900 dark:text-white">{title}</p>
      {description && <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-sm">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

export function AccessDenied({ message = 'Halaman ini hanya dapat dibuka oleh Admin.' }: { message?: string }) {
  const navigate = useNavigate()
  return (
    <main className="flex-1 p-6 flex flex-col items-center justify-center min-h-[70vh] text-center">
      <span className="size-12 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center mb-3" aria-hidden="true">
        <svg className="size-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
        </svg>
      </span>
      <h1 className="text-xl font-bold text-slate-900 dark:text-white">Akses terbatas</h1>
      <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md mt-1 mb-4">{message}</p>
      <button type="button" onClick={() => navigate('/dashboard')} className={BTN_PRIMARY}>
        Kembali ke Dashboard
      </button>
    </main>
  )
}

/** Badge kecil untuk meta di header atau tabel */
export function Badge({ children, tone = 'default' }: { children: ReactNode; tone?: Tone }) {
  const cls: Record<Tone, string> = {
    default: 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300',
    primary: 'bg-primary/10 text-primary dark:text-primary-lighter',
    success: 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300',
    warning: 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300',
    danger: 'bg-red-50 dark:bg-red-950/60 text-red-700 dark:text-red-300',
    info: 'bg-sky-50 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300',
  }
  return <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold ${cls[tone]}`}>{children}</span>
}
