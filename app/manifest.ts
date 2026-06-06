import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Cantivo',
    short_name: 'Cantivo',
    description: 'Il gestionale che lavora quanto te',
    start_url: '/login',
    display: 'standalone',
    background_color: '#fafafa',
    theme_color: '#e95624',
    orientation: 'portrait',
    icons: [
      {
        src: '/cantivo-logo.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/cantivo-logo.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: '/cantivo-logo.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/cantivo-logo.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  }
}
