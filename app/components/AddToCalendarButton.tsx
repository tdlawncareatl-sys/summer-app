import Icon from './Icon'

type Variant = 'onOlive' | 'inline'

const VARIANT_CLASSES: Record<Variant, string> = {
  // For use on top of the olive confirmed banner — translucent white pill.
  onOlive: 'inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-white hover:bg-white/25 active:scale-[0.98] transition-all',
  // For use on a neutral surface — sand-tinted pill.
  inline: 'inline-flex items-center gap-1.5 rounded-full bg-olive-tint px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-olive hover:bg-olive hover:text-white active:scale-[0.98] transition-all',
}

export default function AddToCalendarButton({
  eventId,
  variant = 'inline',
  label = 'Add to calendar',
}: {
  eventId: string
  variant?: Variant
  label?: string
}) {
  return (
    <a
      href={`/api/events/${eventId}/ics`}
      className={VARIANT_CLASSES[variant]}
      aria-label={label}
    >
      <Icon name="calendar" size={14} />
      {label}
    </a>
  )
}
