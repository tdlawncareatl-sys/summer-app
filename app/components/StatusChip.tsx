import { EventStatus, STATUS } from '@/lib/status'

export default function StatusChip({
  status,
  size = 'sm',
}: {
  status: EventStatus
  size?: 'xs' | 'sm' | 'md'
}) {
  const s = STATUS[status]
  const sizeClass =
    size === 'xs' ? 'text-[10px] px-2 py-0.5' :
    size === 'md' ? 'text-xs px-3 py-1.5' :
    'text-xs px-2.5 py-1'
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-[12px] font-semibold ${s.tint} ${s.text} ${sizeClass}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
      {s.label}
    </span>
  )
}
