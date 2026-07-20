// The MCP endpoint — AI tools (Claude, ChatGPT, Cursor, …) connect here as a
// custom connector and get read/write tools over Summer Plans data.
//
// Auth: each friend gets a personal link, /api/mcp?key=<their-key>, generated
// from MCP_SECRET (see lib/mcp/keys.ts and /api/mcp-keys). The key both gates
// access and identifies who is acting — every write lands as that friend.
// URL-embedded keys (not OAuth) because the claude.ai custom-connector UI
// accepts exactly one thing: a URL.

import { createMcpHandler } from 'mcp-handler'
import { getServerSupabase } from '@/lib/serverSupabase'
import { findFriendForKey } from '@/lib/mcp/keys'
import { mcpFriendStorage, type McpFriend } from '@/lib/mcp/context'
import { registerSummerTools } from '@/lib/mcp/tools'

export const runtime = 'nodejs'
export const maxDuration = 60

const handler = createMcpHandler(
  registerSummerTools,
  {
    serverInfo: { name: 'summer-plans', version: '1.0.0' },
  },
  {
    basePath: '/api', // endpoint lives at /api/mcp
    maxDuration: 60,
    disableSse: true, // streamable HTTP only — SSE would need Redis
  },
)

async function withFriend(request: Request): Promise<Response> {
  const secret = process.env.MCP_SECRET
  if (!secret) {
    return Response.json(
      { error: 'The connector is not set up yet — MCP_SECRET is missing from the environment.' },
      { status: 503 },
    )
  }

  const key = new URL(request.url).searchParams.get('key')
  if (!key) {
    return Response.json(
      { error: 'Missing key. Use your personal connector link: /api/mcp?key=…' },
      { status: 401 },
    )
  }

  const { data, error } = await getServerSupabase().from('users').select('id, name, email')
  if (error) {
    return Response.json({ error: `Could not load users: ${error.message}` }, { status: 500 })
  }

  const friend = findFriendForKey((data ?? []) as McpFriend[], secret, key)
  if (!friend) {
    return Response.json(
      { error: 'That connector key is not valid (it may have been rotated). Ask Tad for a fresh link.' },
      { status: 401 },
    )
  }

  return mcpFriendStorage.run(friend, () => handler(request))
}

export { withFriend as GET, withFriend as POST, withFriend as DELETE }
