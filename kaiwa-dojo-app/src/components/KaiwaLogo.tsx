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
        src="/logo-kaiwadojo-light.png"
        alt={alt}
        className={className}
      />
    )
  }

  if (mode === 'dark') {
    return (
      <img
        src="/logo-kaiwadojo-dark.png"
        alt={alt}
        className={className}
      />
    )
  }

  return (
    <>
      <img
        src="/logo-kaiwadojo-light.png"
        alt={alt}
        className={`${className} dark:hidden`}
      />
      <img
        src="/logo-kaiwadojo-dark.png"
        alt={alt}
        className={`${className} hidden dark:block`}
      />
    </>
  )
}
