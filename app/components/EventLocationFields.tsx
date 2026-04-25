'use client'

type EventLocationFieldsProps = {
  locationName: string
  locationAddress: string
  onLocationNameChange: (value: string) => void
  onLocationAddressChange: (value: string) => void
  idPrefix?: string
}

export default function EventLocationFields({
  locationName,
  locationAddress,
  onLocationNameChange,
  onLocationAddressChange,
  idPrefix = 'event-location',
}: EventLocationFieldsProps) {
  return (
    <div className="grid gap-3">
      <input
        id={`${idPrefix}-name`}
        type="text"
        value={locationName}
        onChange={(event) => onLocationNameChange(event.target.value)}
        placeholder="Location name"
        className="w-full rounded-xl bg-sand px-3 py-2.5 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-olive"
      />
      <input
        id={`${idPrefix}-address`}
        type="text"
        value={locationAddress}
        onChange={(event) => onLocationAddressChange(event.target.value)}
        placeholder="Street address"
        autoComplete="shipping street-address"
        className="w-full rounded-xl bg-sand px-3 py-2.5 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-olive"
      />

      <p className="px-1 text-xs text-ink-mute">
        Add the address the group should use for maps and navigation.
      </p>
    </div>
  )
}
