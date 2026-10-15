import React, { createContext, useContext, useState, useCallback, useEffect } from 'react'

export type ToastType = 'success' | 'error' | 'info' | 'warning'

export interface ToastItem {
  id: string
  type: ToastType
  message: string
  title?: string
  duration?: number
}

interface ToastContextValue {
  toasts: ToastItem[]
  showToast: (typeOrOptions: ToastType | Omit<ToastItem, 'id'>, message?: string, title?: string) => void
  removeToast: (id: string) => void
  toast: {
    success: (message: string, title?: string, duration?: number) => void
    error: (message: string, title?: string, duration?: number) => void
    info: (message: string, title?: string, duration?: number) => void
    warning: (message: string, title?: string, duration?: number) => void
  }
}

const ToastContext = createContext<ToastContextValue | null>(null)

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  const showToast = useCallback(
    (typeOrOptions: ToastType | Omit<ToastItem, 'id'>, message?: string, title?: string) => {
      let newItem: ToastItem

      if (typeof typeOrOptions === 'object') {
        newItem = {
          ...typeOrOptions,
          id: `toast-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          duration: typeOrOptions.duration ?? 3500,
        }
      } else {
        newItem = {
          id: `toast-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          type: typeOrOptions,
          message: message || '',
          title,
          duration: 3500,
        }
      }

      // Keep max 3 active toasts at a time to prevent screen clutter
      setToasts(prev => [newItem, ...prev.slice(0, 2)])

      const timeout = newItem.duration || 3500
      setTimeout(() => {
        removeToast(newItem.id)
      }, timeout)
    },
    [removeToast]
  )

  const toastHelpers = {
    success: (msg: string, title?: string, dur?: number) =>
      showToast({ type: 'success', message: msg, title, duration: dur }),
    error: (msg: string, title?: string, dur?: number) =>
      showToast({ type: 'error', message: msg, title, duration: dur }),
    info: (msg: string, title?: string, dur?: number) =>
      showToast({ type: 'info', message: msg, title, duration: dur }),
    warning: (msg: string, title?: string, dur?: number) =>
      showToast({ type: 'warning', message: msg, title, duration: dur }),
  }

  // Listen to global custom events so non-React/deep handlers can dispatch easily
  useEffect(() => {
    function handleCustomEvent(e: Event) {
      const customEvent = e as CustomEvent<{ type?: ToastType; message: string; title?: string }>
      if (customEvent.detail && customEvent.detail.message) {
        showToast(
          customEvent.detail.type || 'info',
          customEvent.detail.message,
          customEvent.detail.title
        )
      }
    }

    window.addEventListener('kaiwa-toast', handleCustomEvent)
    return () => window.removeEventListener('kaiwa-toast', handleCustomEvent)
  }, [showToast])

  return (
    <ToastContext.Provider value={{ toasts, showToast, removeToast, toast: toastHelpers }}>
      {children}

      {/* Floating Toast Container (Positioned safely below header navbar at z-[9999]) */}
      <div
        aria-live="polite"
        className="fixed top-15 sm:top-17 right-3 sm:right-5 left-3 sm:left-auto z-[9999] pointer-events-none flex flex-col gap-2.5 max-w-sm w-full"
      >
        {toasts.map(item => (
          <div
            key={item.id}
            role="status"
            className={`pointer-events-auto flex items-start gap-3 p-3.5 rounded-2xl shadow-xl backdrop-blur-md border animate-slide-down transition-all duration-200 ${
              item.type === 'success'
                ? 'bg-emerald-500/95 text-white border-emerald-400/40 shadow-emerald-500/20'
                : item.type === 'error'
                ? 'bg-rose-500/95 text-white border-rose-400/40 shadow-rose-500/20'
                : item.type === 'warning'
                ? 'bg-amber-500/95 text-white border-amber-400/40 shadow-amber-500/20'
                : 'bg-slate-900/95 dark:bg-slate-800/95 text-white border-slate-700/60 shadow-slate-900/30'
            }`}
          >
            {/* Icon */}
            <div className="size-6 shrink-0 rounded-full bg-white/20 flex items-center justify-center mt-0.5">
              {item.type === 'success' && (
                <svg className="size-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              )}
              {item.type === 'error' && (
                <svg className="size-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              )}
              {item.type === 'warning' && (
                <svg className="size-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              )}
              {item.type === 'info' && (
                <svg className="size-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              )}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0 pr-1">
              {item.title && (
                <h4 className="text-xs font-black uppercase tracking-wider opacity-90 leading-tight mb-0.5">
                  {item.title}
                </h4>
              )}
              <p className="text-xs sm:text-sm font-semibold leading-snug break-words">
                {item.message}
              </p>
            </div>

            {/* Dismiss Button */}
            <button
              type="button"
              onClick={() => removeToast(item.id)}
              className="size-5 shrink-0 rounded-full hover:bg-white/20 active:scale-90 flex items-center justify-center text-white/80 hover:text-white transition-colors border-none bg-transparent cursor-pointer -mr-1 -mt-0.5"
              title="Tutup pemberitahuan"
              aria-label="Tutup"
            >
              <svg className="size-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) {
    // Fallback if rendered outside provider: dispatch custom DOM event
    return {
      toasts: [],
      removeToast: () => {},
      showToast: (typeOrOptions: ToastType | Omit<ToastItem, 'id'>, message?: string, title?: string) => {
        const type = typeof typeOrOptions === 'object' ? typeOrOptions.type : typeOrOptions
        const text = typeof typeOrOptions === 'object' ? typeOrOptions.message : (message || '')
        const ttl = typeof typeOrOptions === 'object' ? typeOrOptions.title : title
        if (typeof window !== 'undefined') {
          window.dispatchEvent(
            new CustomEvent('kaiwa-toast', { detail: { type, message: text, title: ttl } })
          )
        }
      },
      toast: {
        success: (msg: string, title?: string) => {
          if (typeof window !== 'undefined') {
            window.dispatchEvent(
              new CustomEvent('kaiwa-toast', { detail: { type: 'success', message: msg, title } })
            )
          }
        },
        error: (msg: string, title?: string) => {
          if (typeof window !== 'undefined') {
            window.dispatchEvent(
              new CustomEvent('kaiwa-toast', { detail: { type: 'error', message: msg, title } })
            )
          }
        },
        info: (msg: string, title?: string) => {
          if (typeof window !== 'undefined') {
            window.dispatchEvent(
              new CustomEvent('kaiwa-toast', { detail: { type: 'info', message: msg, title } })
            )
          }
        },
        warning: (msg: string, title?: string) => {
          if (typeof window !== 'undefined') {
            window.dispatchEvent(
              new CustomEvent('kaiwa-toast', { detail: { type: 'warning', message: msg, title } })
            )
          }
        },
      },
    }
  }
  return ctx
}
