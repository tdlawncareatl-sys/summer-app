import { NextRequest } from 'next/server'
import { getServerSupabase } from '@/lib/serverSupabase'
import { buildIcsEvent, icsFilename, type IcsEventInput } from '@/lib/ics'

export const runtime = 'nodejs'

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const supabase = getServerSupabase()
  const { data, error } = await supabase
    .from('events')
    .select('id, title, description, status, confirmed_date, confirmed_end_date, location_name, location_address, location_notes, event_notes, start_time, end_time, length_days')
    .eq('id', id)
    .maybeSingle()

  if (error) {
    return new Response(`Could not load event: ${error.message}`, { status: 500 })
  }
  if (!data) {
    return new Response('Event not found', { status: 404 })
  }
  if (data.status !== 'confirmed' || !data.confirmed_date) {
    return new Response('Event is not confirmed yet', { status: 409 })
  }

  const ics = buildIcsEvent(data as IcsEventInput)

  return new Response(ics, {
    status: 200,
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': `attachment; filename="${icsFilename(data)}"`,
      'Cache-Control': 'no-store',
    },
  })
}
