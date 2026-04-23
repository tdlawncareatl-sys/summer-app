// Initials-based circular avatar. No image dependency.
// Deterministic tint so the same name always renders the same color.

import { CategoryTint, TINT_CLASSES } from '@/lib/categories'

const TINT_ORDER: CategoryTint[] = ['olive', 'terracotta', 'teal', 'lavender', 'amber', 'sage', 'blush']

function tintFor(name: string): CategoryTint {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) | 0
  return TINT_ORDER[Math.abs(hash) % TINT_ORDER.length]
}

function initials(name: string) {
  return name.split(/\s|&/).filter(Boolean).map((w) => w[0]).join('').slice(0, 2).toUpperCase()
}

export default function Avatar({
  name,
  size = 36,
  ring = false,
}: {
  name: string
  size?: number
  ring?: boolean
}) {
  const t = tintFor(name)
  const cls = TINT_CLASSES[t]
  return (
    <span
      className={`inline-flex items-center justify-center rounded-full font-semibold shrink-0 ${cls.bg} ${cls.text} ${ring ? 'ring-2 ring-cream' : ''}`}
      style={{ width: size, height: size, fontSize: size * 0.36 }}
      aria-label={name}
    >
      {initials(name)}
    </span>
  )
}

// A horizontal cluster of avatars with an overflow count.
export function AvatarStack({
  names,
  max = 4,
  size = 28,
}: {
  names: string[]
  max?: number
  size?: number
}) {
  const shown = names.slice(0, max)
  const extra = names.length - shown.length
  return (
    <div className="flex items-center">
      {shown.map((n, i) => (
        <div key={n + i} style={{ marginLeft: i === 0 ? 0 : -size * 0.28 }}>
          <Avatar name={n} size={size} ring />
        </div>
      ))}
      {extra > 0 && (
        <div
          className="inline-flex items-center justify-center rounded-full bg-stone text-ink-soft font-semibold ring-2 ring-cream"
          style={{ width: size, height: size, fontSize: size * 0.36, marginLeft: -size * 0.28 }}
        >
          +{extra}
        </div>
      )}
    </div>
  )
}
