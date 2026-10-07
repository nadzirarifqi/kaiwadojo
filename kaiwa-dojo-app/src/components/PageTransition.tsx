import { useEffect, useState, useRef, type ReactNode } from 'react'
import { useLocation } from 'react-router-dom'

interface PageTransitionProps {
  children: ReactNode
}

export default function PageTransition({ children }: PageTransitionProps) {
  const location = useLocation()
  const prevPathRef = useRef(location.pathname)
  const [isNavigating, setIsNavigating] = useState(false)

  useEffect(() => {
    if (location.pathname !== prevPathRef.current) {
      prevPathRef.current = location.pathname
      // Instant scroll to top on route change
      window.scrollTo({ top: 0, behavior: 'instant' })

      // Subtle top progress bar micro-feedback (non-blocking)
      setIsNavigating(true)
      const timer = setTimeout(() => {
        setIsNavigating(false)
      }, 200)

      return () => clearTimeout(timer)
    }
  }, [location.pathname])

  return (
    <div className="relative w-full min-h-full">
      {/* Sleek Top Progress Loading Indicator (instant & non-blocking) */}
      <div
        className={`fixed top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-primary via-red-500 to-amber-500 z-[9999] transition-all duration-300 pointer-events-none ${
          isNavigating
            ? 'w-full opacity-100'
            : 'w-0 opacity-0'
        }`}
      />

      {/* Immediate render of page children without artificial delays or remounting wrappers */}
      <div className="w-full min-h-full">
        {children}
      </div>
    </div>
  )
}
