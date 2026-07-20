// Who is talking to the MCP server right now.
//
// The route handler authenticates the ?key= in the URL, then runs the MCP
// handler inside this AsyncLocalStorage context so every tool can ask
// currentFriend() without the request being threaded through mcp-handler.

import { AsyncLocalStorage } from 'async_hooks'

export type McpFriend = {
  id: string
  name: string
  email: string
}

export const mcpFriendStorage = new AsyncLocalStorage<McpFriend>()

export function currentFriend(): McpFriend {
  const friend = mcpFriendStorage.getStore()
  if (!friend) {
    throw new Error('No authenticated friend on this request — this tool must run behind the key check.')
  }
  return friend
}
