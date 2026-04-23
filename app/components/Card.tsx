// Cream-surfaced card. Standard container on every page.
import { ReactNode } from 'react'

export default function Card({
  children,
  className = '',
  padded = true,
  as: As = 'div',
  onClick,
}: {
  children: ReactNode
  className?: string
  padded?: boolean
  as?: 'div' | 'section' | 'article' | 'button'
  onClick?: () => void
}) {
  return (
    <As
      onClick={onClick}
      className={[
        'bg-cream rounded-[var(--radius-lg)] shadow-[var(--shadow-soft)]',
        padded ? 'p-4' : '',
        onClick ? 'text-left active:scale-[0.99] transition-transform' : '',
        className,
      ].join(' ')}
    >
      {children}
    </As>
  )
}
