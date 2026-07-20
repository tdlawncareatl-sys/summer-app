// Admin-only listing of everyone's personal connector links.
//
// Open /api/mcp-keys?secret=<MCP_SECRET> in a browser, copy each friend's
// link, and text it to them. Plain text on purpose — easy to copy from a phone.

import { getServerSupabase } from '@/lib/serverSupabase'
import { deriveFriendKey, connectorUrl, secretMatches } from '@/lib/mcp/keys'

export const runtime = 'nodejs'

export async function GET(request: Request) {
  const secret = process.env.MCP_SECRET
  if (!secret) {
    return new Response('MCP_SECRET is not set in the environment yet.', { status: 503 })
  }

  const url = new URL(request.url)
  const presented = url.searchParams.get('secret')
  if (!presented || !secretMatches(secret, presented)) {
    return new Response('Wrong or missing ?secret=', { status: 401 })
  }

  const { data, error } = await getServerSupabase()
    .from('users')
    .select('id, name')
    .order('name')
  if (error) {
    return new Response(`Could not load users: ${error.message}`, { status: 500 })
  }

  const origin = `${request.headers.get('x-forwarded-proto') ?? 'https'}://${request.headers.get('host') ?? url.host}`
  const lines = (data ?? []).map(
    (u) => `${u.name}\n${connectorUrl(origin, deriveFriendKey(secret, u.id))}\n`,
  )

  const body = [
    'Summer Plans — personal AI connector links',
    'Each link is personal: it acts in the app as that friend. Text each',
    'person their own link; they paste it into Claude under',
    'Settings → Connectors → Add custom connector.',
    '',
    ...lines,
  ].join('\n')

  return new Response(body, { headers: { 'content-type': 'text/plain; charset=utf-8' } })
}
