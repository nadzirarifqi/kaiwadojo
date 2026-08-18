import { useState, useEffect } from 'react'

interface AdaptiveIconProps {
  src: string
  alt: string
  className?: string
  darkScale?: string
  hasDarkVariant?: boolean
}

export default function AdaptiveIcon({
  src,
  alt,
  className = 'size-5 object-contain shrink-0',
  darkScale = 'scale-125',
  hasDarkVariant = true,
}: AdaptiveIconProps) {
  const [isDark, setIsDark] = useState(() =>
    typeof document !== 'undefined'
      ? document.documentElement.classList.contains('dark')
      : false
  )

  useEffect(() => {
    if (typeof document === 'undefined') return

    const updateTheme = () => {
      setIsDark(document.documentElement.classList.contains('dark'))
    }

    updateTheme()

    const observer = new MutationObserver(updateTheme)
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    })

    return () => observer.disconnect()
  }, [])

  const darkSrc = hasDarkVariant && src.endsWith('.png') && !src.endsWith('-dark.png')
    ? src.replace(/\.png$/, '-dark.png')
    : src

  const activeSrc = isDark ? darkSrc : src

  return (
    <img
      src={activeSrc}
      alt={alt}
      className={`${className} transition-transform duration-200 ${isDark && hasDarkVariant ? darkScale : ''}`}
      onError={(e) => {
        // Fallback to original src if -dark.png is not found
        const target = e.currentTarget
        if (target.src.includes('-dark.png')) {
          target.src = src
        }
      }}
    />
  )
}
