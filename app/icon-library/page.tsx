import Card from '../components/Card'
import IconTile from '../components/IconTile'
import { AppIcon, ICON_LIBRARY_SECTIONS, getIconDefinition, type AppIconName } from '../components/icons'
import type { CategoryTint } from '@/lib/categories'

const SECTION_TINTS: Record<string, CategoryTint> = {
  Navigation: 'olive',
  Planning: 'terracotta',
  'Views & Filters': 'sage',
  Actions: 'olive',
  Status: 'amber',
  Activities: 'teal',
}

export default function IconLibraryPage() {
  return (
    <main className="mx-auto max-w-6xl px-6 py-8">
      <section className="grid gap-6 lg:grid-cols-[1.7fr_1fr]">
        <Card className="p-6">
          <div className="flex flex-col gap-4 border-b border-sand-alt pb-5 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-4">
              <AppIcon name="summerPlansMark" size={46} palette="brand" />
              <div>
                <h1 className="font-serif text-5xl font-black tracking-tight text-ink">Summer Plans</h1>
                <p className="mt-2 text-lg leading-7 text-olive">Plan more sun. Stress less.</p>
              </div>
            </div>
            <div className="max-w-sm text-sm leading-6 text-ink-soft">
              Icon system reference for navigation, planning, status, and activity scenes.
              The registry below is the source of truth for how icons are named and rendered in the app.
            </div>
          </div>

          <div className="mt-6 space-y-7">
            {ICON_LIBRARY_SECTIONS.map((section) => (
              <section key={section.label}>
                <h2 className="text-sm font-bold uppercase tracking-[0.16em] text-olive">{section.label}</h2>
                <div className={`mt-4 grid gap-3 ${section.label === 'Activities' ? 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-5' : 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-6'}`}>
                  {section.icons.map((icon) => (
                    <IconLibraryTile
                      key={icon}
                      icon={icon}
                      tint={SECTION_TINTS[section.label] ?? 'olive'}
                    />
                  ))}
                </div>
              </section>
            ))}
          </div>
        </Card>

        <div className="space-y-6">
          <Card className="p-6">
            <p className="text-sm font-bold uppercase tracking-[0.16em] text-olive">Custom Lake Icon</p>
            <div className="mt-5 flex items-center justify-center">
              <IconTile icon="lakePlankRaft" size={148} rounded="lg" />
            </div>
            <ul className="mt-5 space-y-2 text-sm leading-6 text-ink-soft">
              <li>24×24 SVG canvas</li>
              <li>1.85px rounded outline system with open negative space</li>
              <li>Canonical `lake_plank_raft` scene for dock, lake, and floating hangout events</li>
              <li>Blue is reserved for barrel floats and water accents only</li>
            </ul>
          </Card>

          <Card className="p-6">
            <p className="text-sm font-bold uppercase tracking-[0.16em] text-olive">How It Works</p>
            <div className="mt-4 space-y-3 text-sm leading-6 text-ink-soft">
              <p><strong className="text-ink">Registry first:</strong> every icon lives in one typed registry with a semantic name, family, and default palette.</p>
              <p><strong className="text-ink">One visual grammar:</strong> system icons and activity icons both use the same thin-line stroke language, with orange for emphasis and blue reserved for water.</p>
              <p><strong className="text-ink">Semantic matching:</strong> event and idea titles map to icon names through `lib/categories.ts`, so the product stays free-text but visually consistent.</p>
              <p><strong className="text-ink">UI owns the tile:</strong> the cream tile sits in the interface, while the SVGs stay clean and reusable on their own.</p>
            </div>
          </Card>
        </div>
      </section>
    </main>
  )
}

function IconLibraryTile({
  icon,
  tint,
}: {
  icon: AppIconName
  tint: CategoryTint
}) {
  const definition = getIconDefinition(icon)
  return (
    <Card className="flex h-full flex-col items-center gap-3 p-4 text-center">
      <IconTile icon={icon} tint={tint} size={definition.kind === 'scene' ? 64 : 56} rounded={definition.kind === 'scene' ? 'full' : 'lg'} />
      <div>
        <p className="text-sm font-semibold leading-tight text-ink">{definition.label}</p>
        <p className="mt-1 text-[11px] uppercase tracking-[0.14em] text-ink-mute">{definition.family}</p>
      </div>
    </Card>
  )
}
