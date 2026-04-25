'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState } from 'react'
import { HomeIcon, CalendarIcon, LightbulbIcon, UserIcon, PlusIcon } from './icons'

const ITEMS: { href: string; label: string; Icon: React.ComponentType<React.SVGProps<SVGSVGElement> & { size?: number }> }[] = [
  { href: '/',         label: 'Home',     Icon: HomeIcon },
  { href: '/calendar', label: 'Calendar', Icon: CalendarIcon },
  { href: '/ideas',    label: 'Ideas',    Icon: LightbulbIcon },
  { href: '/me',       label: 'Me',       Icon: UserIcon },
]

export default function BottomNav() {
  const pathname = usePathname()
  const router = useRouter()
  const [sheetOpen, setSheetOpen] = useState(false)

  function isActive(href: string) {
    if (href === '/') return pathname === '/'
    return pathname === href || pathname.startsWith(href + '/')
  }

  return (
    <>
      <nav className="fixed bottom-0 inset-x-0 z-40 pointer-events-none">
        <div className="max-w-md mx-auto px-4 pb-4 pointer-events-auto">
          <div className="relative rounded-[24px] border border-stone/70 bg-cream shadow-[var(--shadow-raised)]">
            <div className="grid h-16 grid-cols-5 items-end px-2.5">
              {ITEMS.slice(0, 2).map((item) => (
                <NavItem key={item.href} {...item} active={isActive(item.href)} />
              ))}

              {/* Center FAB */}
              <div className="flex justify-center -mt-5">
                <button
                  onClick={() => setSheetOpen(true)}
                  className="flex h-14 w-14 items-center justify-center rounded-full bg-olive text-white shadow-[var(--shadow-raised)] transition-transform active:scale-95"
                  aria-label="Create"
                >
                  <PlusIcon size={22} />
                </button>
              </div>

              {ITEMS.slice(2).map((item) => (
                <NavItem key={item.href} {...item} active={isActive(item.href)} />
              ))}
            </div>
          </div>
        </div>
      </nav>

      {/* Create sheet */}
      {sheetOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center" onClick={() => setSheetOpen(false)}>
          <div className="absolute inset-0 bg-ink/30 backdrop-blur-sm" />
          <div
            className="relative w-full max-w-md rounded-t-[24px] border border-stone/70 bg-cream p-6 shadow-[var(--shadow-raised)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-10 h-1 bg-stone rounded-full mx-auto mb-5" />
            <p className="text-xs font-semibold text-ink-mute uppercase tracking-widest mb-3">What do you want to add?</p>
            <div className="flex flex-col gap-2.5">
              {[
                { label: 'New event', sub: 'Propose a plan & gather votes', href: '/events', tint: 'bg-terracotta-tint text-terracotta' },
                { label: 'New idea',  sub: 'Throw something out for the group', href: '/ideas', tint: 'bg-amber-tint text-amber' },
                { label: 'Time block', sub: 'Mark dates you can\u2019t make it', href: '/availability', tint: 'bg-olive-tint text-olive' },
              ].map((a) => (
                <button
                  key={a.label}
                  onClick={() => { setSheetOpen(false); router.push(a.href) }}
                  className="flex items-center gap-3 rounded-[16px] bg-sand px-4 py-3 text-left transition active:scale-[0.99]"
                >
                  <span className={`flex h-10 w-10 items-center justify-center rounded-[14px] ${a.tint}`}><PlusIcon size={16} /></span>
                  <span>
                    <span className="block font-semibold text-ink">{a.label}</span>
                    <span className="block text-xs text-ink-soft">{a.sub}</span>
                  </span>
                </button>
              ))}
            </div>
            <button
              onClick={() => setSheetOpen(false)}
              className="w-full mt-4 text-sm text-ink-mute hover:text-ink py-2 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </>
  )
}

function NavItem({
  href, label, Icon, active,
}: {
  href: string; label: string; active: boolean;
  Icon: React.ComponentType<React.SVGProps<SVGSVGElement> & { size?: number }>;
}) {
  return (
    <Link
      href={href}
      className={`flex flex-col items-center justify-center gap-0.5 py-2 text-[10px] font-semibold transition-colors ${
        active ? 'text-olive' : 'text-ink-mute hover:text-ink'
      }`}
    >
      <Icon size={22} />
      <span>{label}</span>
    </Link>
  )
}
