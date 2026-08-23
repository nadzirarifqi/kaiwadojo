interface LoadingScreenProps {
  message?: string
  fullScreen?: boolean
}

export default function LoadingScreen({
  message = 'Memuat data...',
  fullScreen = true,
}: LoadingScreenProps) {
  const content = (
    <div className="flex flex-col items-center justify-center gap-4 p-6 animate-fade-in text-center">
      {/* Outer pulsing ring with inner logo */}
      <div className="relative size-16 flex items-center justify-center">
        <div className="absolute inset-0 rounded-full border-4 border-primary/20 dark:border-red-900/40" />
        <div className="absolute inset-0 rounded-full border-4 border-primary dark:border-red-500 border-t-transparent animate-spin" />
        <div className="size-10 bg-white dark:bg-slate-800 rounded-xl p-1 shadow-md flex items-center justify-center overflow-hidden animate-pulse">
          <img src="/kaiwa-logo.png" alt="KaiwaDojo" className="size-full object-contain" />
        </div>
      </div>

      <div className="flex flex-col items-center gap-1">
        <span className="text-sm font-extrabold text-slate-800 dark:text-slate-100 tracking-tight">
          Kaiwa<span className="text-primary dark:text-red-400">Dojo</span>
        </span>
        <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 animate-pulse">
          {message}
        </p>
      </div>

      {/* Shimmer loading dots */}
      <div className="flex items-center gap-1.5 mt-1">
        <div className="size-1.5 rounded-full bg-primary animate-bounce [animation-delay:-0.3s]" />
        <div className="size-1.5 rounded-full bg-primary animate-bounce [animation-delay:-0.15s]" />
        <div className="size-1.5 rounded-full bg-primary animate-bounce" />
      </div>
    </div>
  )

  if (fullScreen) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 transition-colors">
        {content}
      </div>
    )
  }

  return (
    <div className="min-h-[40vh] w-full flex items-center justify-center bg-transparent">
      {content}
    </div>
  )
}
