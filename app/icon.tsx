import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

export const size = {
  width: 112,
  height: 112,
}

export const contentType = 'image/png'

export default async function Icon() {
  const icon = await readFile(join(process.cwd(), 'public', 'home-screen-icon.png'))
  return new Response(icon, {
    headers: {
      'Content-Type': contentType,
    },
  })
}
