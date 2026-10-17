import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import ModalPortal from '../components/ModalPortal'

/**
 * Dialog konfirmasi yang konsisten di seluruh aplikasi (pengganti window.confirm).
 *
 *   const confirm = useConfirm()
 *   if (!(await confirm({ title: 'Hapus kosakata?', confirmLabel: 'Hapus', tone: 'danger' }))) return
 */

export interface ConfirmOptions {
  title: string
  message?: ReactNode
  confirmLabel?: string
  cancelLabel?: string
  tone?: 'danger' | 'primary'
  icon?: 'trash' | 'logout' | 'warning'
}

type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>

const ConfirmContext = createContext<ConfirmFn | null>(null)

const ICON_PATH: Record<NonNullable<ConfirmOptions['icon']>, string> = {
  trash: 'M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16',
  logout: 'M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1',
  warning: 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z',
}

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [options, setOptions] = useState<ConfirmOptions | null>(null)
  const resolverRef = useRef<((value: boolean) => void) | null>(null)
  const cancelBtnRef = useRef<HTMLButtonElement>(null)

  const confirm = useCallback<ConfirmFn>(opts => {
    // Jika ada dialog yang masih terbuka, anggap dibatalkan
    resolverRef.current?.(false)
    setOptions(opts)
    return new Promise<boolean>(resolve => { resolverRef.current = resolve })
  }, [])

  const settle = useCallback((value: boolean) => {
    resolverRef.current?.(value)
    resolverRef.current = null
    setOptions(null)
  }, [])

  useEffect(() => {
    if (!options) return
    // Fokus awal di tombol "Batal" agar Enter tidak langsung menjalankan aksi berbahaya
    cancelBtnRef.current?.focus()
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') settle(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [options, settle])

  const tone = options?.tone ?? 'danger'
  const icon = options?.icon ?? (tone === 'danger' ? 'warning' : 'warning')

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {options && (
        <ModalPortal>
          <div
            className="modal-overlay fixed inset-0 z-[100000] flex items-end sm:items-center justify-center sm:p-4 bg-slate-950/60 backdrop-blur-sm animate-fade-in"
            onClick={() => settle(false)}
          >
            <div
              role="alertdialog"
              aria-modal="true"
              aria-labelledby="confirm-dialog-title"
              aria-describedby={options.message ? 'confirm-dialog-message' : undefined}
              onClick={e => e.stopPropagation()}
              className="w-full sm:max-w-sm bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl px-5 pt-3 sm:pt-6 pb-[calc(1.25rem+env(safe-area-inset-bottom))] sm:pb-5 animate-fade-in-up"
            >
              <div className="sm:hidden mx-auto mb-4 h-1 w-10 rounded-full bg-slate-200 dark:bg-slate-700" />
              <div className="flex flex-col items-center text-center">
                <span className={`size-12 rounded-2xl flex items-center justify-center ${
                  tone === 'danger'
                    ? 'bg-red-50 text-red-600 dark:bg-red-950/50 dark:text-red-400'
                    : 'bg-primary/10 text-primary dark:text-primary-lighter'
                }`}>
                  <svg className="size-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d={ICON_PATH[icon]} />
                  </svg>
                </span>
                <h2 id="confirm-dialog-title" className="mt-3 text-lg font-bold text-slate-900 dark:text-white leading-snug">
                  {options.title}
                </h2>
                {options.message && (
                  <div id="confirm-dialog-message" className="mt-1.5 text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                    {options.message}
                  </div>
                )}
              </div>

              <div className="mt-5 flex flex-col-reverse sm:flex-row gap-2">
                <button
                  ref={cancelBtnRef}
                  type="button"
                  onClick={() => settle(false)}
                  className="flex-1 h-11 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-sm font-semibold border-none cursor-pointer transition-colors"
                >
                  {options.cancelLabel ?? 'Batal'}
                </button>
                <button
                  type="button"
                  onClick={() => settle(true)}
                  className={`flex-1 h-11 rounded-xl text-white text-sm font-bold border-none cursor-pointer transition-colors ${
                    tone === 'danger' ? 'bg-red-600 hover:bg-red-700' : 'bg-primary hover:bg-primary-dark'
                  }`}
                >
                  {options.confirmLabel ?? 'Ya, lanjutkan'}
                </button>
              </div>
            </div>
          </div>
        </ModalPortal>
      )}
    </ConfirmContext.Provider>
  )
}

export function useConfirm(): ConfirmFn {
  const ctx = useContext(ConfirmContext)
  // Cadangan bila provider tidak terpasang (mis. di halaman uji)
  return ctx ?? (async (o: ConfirmOptions) => window.confirm(o.title))
}

/** Logout dengan konfirmasi terlebih dahulu (mencegah keluar karena tidak sengaja menekan tombol). */
export function useConfirmedSignOut(signOut: () => Promise<void> | void) {
  const confirm = useConfirm()
  return async () => {
    const ok = await confirm({
      title: 'Keluar dari kaiwadojo?',
      message: 'Kamu perlu masuk lagi untuk melanjutkan belajar. Progres belajarmu tetap tersimpan.',
      confirmLabel: 'Ya, keluar',
      cancelLabel: 'Batal',
      tone: 'danger',
      icon: 'logout',
    })
    if (ok) await signOut()
  }
}
