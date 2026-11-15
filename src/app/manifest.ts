import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Frostbox',
    short_name: 'Frostbox',
    description: 'What is in the deep freeze',
    start_url: '/',
    display: 'standalone',
    background_color: '#f6f8fa',
    theme_color: '#0b6bcb',
    icons: [
      { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml' },
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
  };
}
