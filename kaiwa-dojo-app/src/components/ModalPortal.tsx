import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'

/**
 * Merender modal langsung di <body>, sehingga posisinya selalu relatif ke layar (viewport)
 * apa pun gaya elemen induknya (transform, filter, overflow, dsb.).
 */
export default function ModalPortal({ children }: { children: ReactNode }) {
  if (typeof document === 'undefined') return <>{children}</>
  return createPortal(children, document.body)
}
