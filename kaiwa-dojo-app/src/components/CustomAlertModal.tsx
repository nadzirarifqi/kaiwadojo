export interface AlertModalConfig {
  isOpen: boolean
  title: string
  message: string
  type?: 'lock' | 'warning' | 'info' | 'success'
  buttonText?: string
  onClose: () => void
}

function renderFormattedText(text: string) {
  const paragraphs = text.split(/\n+/)
  return (
    <div className="space-y-2 text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed font-medium">
      {paragraphs.map((para, i) => {
        // Highlight quoted strings or bold text
        const parts = para.split(/(".*?"|\*\*.*?\*\*)/g)
        return (
          <p key={i}>
            {parts.map((part, j) => {
              if (part.startsWith('"') && part.endsWith('"')) {
                return (
                  <span key={j} className="font-black text-slate-900 dark:text-white bg-slate-100 dark:bg-slate-800/80 px-1.5 py-0.5 rounded-md border border-slate-200/80 dark:border-slate-700 text-primary dark:text-sky-400">
                    {part}
                  </span>
                )
              }
              if (part.startsWith('**') && part.endsWith('**')) {
                return (
                  <strong key={j} className="font-black text-slate-900 dark:text-white">
                    {part.slice(2, -2)}
                  </strong>
                )
              }
              return part
            })}
          </p>
        )
      })}
    </div>
  )
}

export default function CustomAlertModal({
  isOpen,
  title,
  message,
  type = 'warning',
  buttonText = 'Mengerti',
  onClose,
}: AlertModalConfig) {
  if (!isOpen) return null

  const typeStyles = {
    lock: {
      bgIcon: 'bg-amber-500/10 border-amber-500/30 text-amber-500',
      icon: '🔒',
      btn: 'bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white shadow-md shadow-amber-500/20',
    },
    warning: {
      bgIcon: 'bg-rose-500/10 border-rose-500/30 text-rose-500',
      icon: '⚠️',
      btn: 'bg-gradient-to-r from-rose-500 to-red-600 hover:from-rose-600 hover:to-red-700 text-white shadow-md shadow-rose-500/20',
    },
    info: {
      bgIcon: 'bg-sky-500/10 border-sky-500/30 text-sky-500',
      icon: '💡',
      btn: 'bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-600 hover:to-blue-700 text-white shadow-md shadow-sky-500/20',
    },
    success: {
      bgIcon: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-500',
      icon: '🎉',
      btn: 'bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white shadow-md shadow-emerald-500/20',
    },
  }

  const currentStyle = typeStyles[type] || typeStyles.warning

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[999] flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-sm w-full p-6 shadow-2xl flex flex-col items-center text-center gap-4 animate-scale-up relative overflow-hidden">
        {/* Decorative Top Accent Line */}
        <div className={`absolute top-0 left-0 right-0 h-1.5 ${currentStyle.btn.split(' ')[0]}`} />

        {/* Icon Circle */}
        <div className={`size-16 rounded-2xl border flex items-center justify-center text-3xl shadow-xs mt-1 ${currentStyle.bgIcon}`}>
          {currentStyle.icon}
        </div>

        {/* Title & Formatted Message */}
        <div className="w-full">
          <h3 className="text-base sm:text-lg font-black text-slate-800 dark:text-white leading-snug mb-2">
            {title}
          </h3>
          {renderFormattedText(message)}
        </div>

        {/* Action Button */}
        <button
          onClick={onClose}
          className={`w-full py-3 rounded-2xl text-xs sm:text-sm font-extrabold border-none cursor-pointer transition-all hover:scale-[1.02] active:scale-[0.98] ${currentStyle.btn}`}
        >
          {buttonText}
        </button>
      </div>
    </div>
  )
}
