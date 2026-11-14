import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Freezer',
    short_name: 'Freezer',
    description: 'What is in the deep freeze',
    start_url: '/',
    display: 'standalone',
    background_color: '#f4f7fb',
    theme_color: '#1f6feb',
    icons: [
      { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml' },
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
  };
}
