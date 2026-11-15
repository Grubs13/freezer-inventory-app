/** Same cookie name on server and browser, whatever address Supabase is reached at. */
export const cookieOptions = { name: 'sb-frostbox-auth' };

/**
 * Normally the Supabase URL. When NEXT_PUBLIC_SUPABASE_URL is a path such as "/sb", the browser reaches
 * Supabase through this app (see next.config.ts) and the server goes straight to SUPABASE_INTERNAL_URL.
 * That lets a preview that exposes only the app's port still work.
 */
export function supabaseUrl(): string {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  if (!url.startsWith('/')) return url;
  return typeof window === 'undefined' ? process.env.SUPABASE_INTERNAL_URL! : window.location.origin + url;
}
