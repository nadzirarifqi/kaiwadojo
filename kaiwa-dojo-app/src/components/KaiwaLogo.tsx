const LIGHT_LOGO = '/logo-kaiwadojo-light.png?v=2'
const DARK_LOGO = '/logo-kaiwadojo-dark.png?v=2'

interface KaiwaLogoProps {
  className?: string
  alt?: string
  mode?: 'auto' | 'light' | 'dark'
}

export default function KaiwaLogo({
  className = 'size-full object-contain',
  alt = 'KaiwaDojo',
  mode = 'auto',
}: KaiwaLogoProps) {
  if (mode === 'light') {
    return (
      <img
        src={LIGHT_LOGO}
        alt={alt}
        className={className}
      />
    )
  }

  if (mode === 'dark') {
    return (
      <img
        src={DARK_LOGO}
        alt={alt}
        className={className}
      />
    )
  }

  return (
    <>
      <img
        src={LIGHT_LOGO}
        alt={alt}
        className={`${className} dark:hidden`}
      />
      <img
        src={DARK_LOGO}
        alt={alt}
        className={`${className} hidden dark:block`}
      />
    </>
  )
}
