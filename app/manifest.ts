import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Summer Plans',
    short_name: 'Summer Plans',
    description: 'Friend group coordination for summer 2026.',
    start_url: '/',
    display: 'standalone',
    background_color: '#f8f4ee',
    theme_color: '#6b7444',
    icons: [
      {
        src: '/icon',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: '/apple-icon',
        sizes: '180x180',
        type: 'image/png',
      },
    ],
  }
}
