import { createBrowserClient } from '@supabase/ssr';
import { cookieOptions, supabaseUrl } from './config';

export function supabaseBrowser() {
  return createBrowserClient(supabaseUrl(), process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, { cookieOptions });
}
