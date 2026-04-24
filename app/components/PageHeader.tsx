// Page-top header. Variants:
//  - "greeting"  → sun + "Good evening, Megan" (home)
//  - "title"     → bold page title (calendar, ideas, me)
// Always includes the bell + avatar on the right.

'use client'

import Link from 'next/link'
import { useMemo } from 'react'
import { useName } from '@/lib/useName'
import Avatar from './Avatar'
import NotificationsBell from './NotificationsBell'
import { SunIcon } from './icons'

function greetingFor(d: Date) {
  const h = d.getHours()
  if (h < 5) return 'Late night'
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  if (h < 22) return 'Good evening'
  return 'Late night'
}

export default function PageHeader({
  variant = 'title',
  title,
  subtitle,
  action,
}: {
  variant?: 'greeting' | 'title'
  title?: string
  subtitle?: string
  action?: React.ReactNode
}) {
  const [name] = useName()
  const greet = useMemo(() => greetingFor(new Date()), [])

  return (
    <header className="pt-5 pb-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          {variant === 'greeting' ? (
            <>
              <div className="flex items-center gap-2 text-ink-soft">
                <span className="text-amber"><SunIcon size={18} /></span>
                <span className="text-sm font-medium">
                  {greet}{name ? ',' : ''}
                  {name && <span className="text-olive font-semibold"> {name}</span>}
                </span>
              </div>
              <h1 className="font-serif text-[40px] leading-[1.05] font-black text-ink mt-1 tracking-tight">
                Summer Plans
              </h1>
            </>
          ) : (
            <>
              <h1 className="font-serif text-[40px] leading-[1.05] font-black text-ink tracking-tight">
                {title}
              </h1>
              {subtitle && (
                <p className="text-sm text-ink-soft mt-1.5">{subtitle}</p>
              )}
            </>
          )}
        </div>
        <div className="flex items-center gap-3 pt-1">
          <NotificationsBell />
          <Link href="/me" aria-label="Profile">
            {name ? (
              <Avatar name={name} size={40} />
            ) : (
              <span className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-stone text-ink-soft text-xs font-semibold">
                ?
              </span>
            )}
          </Link>
        </div>
      </div>
      {action && <div className="mt-4">{action}</div>}
    </header>
  )
}
