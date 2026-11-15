import type { NextConfig } from 'next';

const publicUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';

const config: NextConfig = {
  // When the browser is told to reach Supabase at a path on this app, pass those requests through.
  async rewrites() {
    return publicUrl.startsWith('/') ? [{ source: `${publicUrl}/:path*`, destination: `${process.env.SUPABASE_INTERNAL_URL}/:path*` }] : [];
  },
};

export default config;
