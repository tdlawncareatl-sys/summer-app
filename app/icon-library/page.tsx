'use client'

// The living icon library. Every name in the registry, rendered in context.
// Open this page whenever you're about to add or swap an icon — it's the one
// source of truth for what already exists.

import Icon from '@/app/components/Icon'
import IconTile from '@/app/components/IconTile'
import { icons, type IconName } from '@/lib/icons'
import { type CategoryTint } from '@/lib/categories'

// Visual grouping for the page. Pure organization — registry stays flat.
const SECTIONS: { title: string; names: IconName[] }[] = [
  {
    title: 'Navigation',
    names: ['home', 'calendar', 'lightbulb', 'user', 'users'],
  },
  {
    title: 'Actions',
    names: ['plus', 'check', 'x', 'pencil', 'copy', 'share', 'more'],
  },
  {
    title: 'Direction',
    names: ['arrowRight', 'chevronRight', 'chevronLeft', 'chevronDown'],
  },
  {
    title: 'Info & status',
    names: ['sun', 'bell', 'star', 'clock', 'mapPin', 'info', 'note'],
  },
  {
    title: 'Activities',
    names: [
      'palm', 'clapper', 'mountain', 'tent', 'boat', 'paddle',
      'game', 'flag', 'pizza', 'boot', 'droplet', 'picnic', 'bowl',
    ],
  },
]

const TINTS: CategoryTint[] = ['olive', 'terracotta', 'teal', 'sage', 'amber', 'lavender', 'blush']

export default function IconLibraryPage() {
  // Sanity check: every name in SECTIONS exists in the registry, and every
  // registry name is shown. Fail loud if drift creeps in.
  const shown = new Set(SECTIONS.flatMap((s) => s.names))
  const allNames = Object.keys(icons) as IconName[]
  const missing = allNames.filter((n) => !shown.has(n))

  return (
    <main className="max-w-md mx-auto px-5 py-6">
      <header className="mb-6">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-olive">Reference</p>
        <h1 className="mt-2 font-serif text-[34px] leading-[1.05] font-black tracking-tight text-ink">
          Icon library
        </h1>
        <p className="mt-3 text-sm leading-6 text-ink-soft">
          Every icon name in the registry, rendered as-shipped. Use{' '}
          <code className="rounded bg-sand-alt px-1.5 py-0.5 text-[12px]">{'<Icon name="..." />'}</code>{' '}
          or{' '}
          <code className="rounded bg-sand-alt px-1.5 py-0.5 text-[12px]">{'<IconTile name="..." tint="..." />'}</code>.
        </p>
      </header>

      {missing.length > 0 && (
        <div className="mb-6 rounded-[16px] bg-blush-soft p-4 text-sm text-blush">
          <p className="font-bold">Not in any section: {missing.join(', ')}</p>
          <p className="mt-1 text-xs">Add them to a section in <code>app/icon-library/page.tsx</code>.</p>
        </div>
      )}

      {SECTIONS.map((section) => (
        <section key={section.title} className="mb-7">
          <h2 className="mb-3 text-xs font-bold uppercase tracking-[0.18em] text-ink-mute">{section.title}</h2>
          <div className="rounded-[18px] bg-cream border border-stone/50 p-3">
            <div className="grid grid-cols-3 gap-2">
              {section.names.map((name) => (
                <div key={name} className="flex flex-col items-center gap-1.5 py-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-[12px] bg-sand-alt text-ink">
                    <Icon name={name} size={26} />
                  </div>
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-ink-mute text-center">
                    {name}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>
      ))}

      <section className="mb-7">
        <h2 className="mb-3 text-xs font-bold uppercase tracking-[0.18em] text-ink-mute">Tints (on IconTile)</h2>
        <p className="mb-3 text-xs leading-5 text-ink-soft">
          The same icon across every semantic tint, so tinted backgrounds are easy to pick.
        </p>
        <div className="rounded-[18px] bg-cream border border-stone/50 p-3">
          <div className="grid grid-cols-4 gap-2">
            {TINTS.map((tint) => (
              <div key={tint} className="flex flex-col items-center gap-1.5 py-2">
                <IconTile name="palm" tint={tint} size={48} />
                <span className="text-[10px] font-semibold uppercase tracking-wider text-ink-mute">
                  {tint}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mb-10">
        <h2 className="mb-3 text-xs font-bold uppercase tracking-[0.18em] text-ink-mute">Sizes</h2>
        <div className="rounded-[18px] bg-cream border border-stone/50 p-3">
          <div className="flex items-end justify-around gap-2 py-2">
            {[14, 18, 22, 28, 36].map((size) => (
              <div key={size} className="flex flex-col items-center gap-1.5">
                <Icon name="calendar" size={size} />
                <span className="text-[10px] font-semibold uppercase tracking-wider text-ink-mute">
                  {size}px
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  )
}
