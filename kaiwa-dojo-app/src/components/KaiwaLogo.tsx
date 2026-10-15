import { useState, useEffect } from 'react'

const LIGHT_LOGO = '/logo-kaiwadojo-light.png?v=2'
const DARK_LOGO = '/logo-kaiwadojo-dark.png?v=2'

interface KaiwaLogoProps {
  className?: string
  alt?: string
  mode?: 'auto' | 'light' | 'dark'
}

export default function KaiwaLogo({
  className = 'size-full object-contain',
  alt = 'kaiwadojo',
  mode = 'auto',
}: KaiwaLogoProps) {
  const [isDark, setIsDark] = useState(() => {
    if (typeof document === 'undefined') return false
    return document.documentElement.classList.contains('dark')
  })

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

  const currentSrc =
    mode === 'dark'
      ? DARK_LOGO
      : mode === 'light'
      ? LIGHT_LOGO
      : isDark
      ? DARK_LOGO
      : LIGHT_LOGO

  return (
    <img
      src={currentSrc}
      alt={alt}
      className={className}
    />
  )
}
