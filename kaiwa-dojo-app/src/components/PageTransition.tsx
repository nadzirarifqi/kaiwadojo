import { useEffect, useState, type ReactNode } from 'react'
import { useLocation } from 'react-router-dom'

interface PageTransitionProps {
  children: ReactNode
}

export default function PageTransition({ children }: PageTransitionProps) {
  const location = useLocation()
  const [isLoading, setIsLoading] = useState(false)
  const [displayLocation, setDisplayLocation] = useState(location)

  useEffect(() => {
    if (location.pathname !== displayLocation.pathname) {
      setIsLoading(true)
      // Instant scroll to top on route change
      window.scrollTo({ top: 0, behavior: 'instant' })

      const timer = setTimeout(() => {
        setDisplayLocation(location)
        setIsLoading(false)
      }, 150)

      return () => clearTimeout(timer)
    }
  }, [location, displayLocation])

  return (
    <div className="relative w-full min-h-full">
      {/* Sleek Top Progress Loading Indicator */}
      <div
        className={`fixed top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary via-red-500 to-amber-500 z-[9999] transition-all duration-300 pointer-events-none ${
          isLoading
            ? 'w-full opacity-100 animate-pulse'
            : 'w-0 opacity-0'
        }`}
      />

      {/* Animated Page Container */}
      <div
        key={displayLocation.pathname}
        className="w-full min-h-full animate-fade-in"
      >
        {children}
      </div>
    </div>
  )
}
