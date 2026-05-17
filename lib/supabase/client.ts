import { createBrowserClient } from '@supabase/ssr';

// Browser-side Supabase client. The publishable (anon) key is safe to expose.
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
