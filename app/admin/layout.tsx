import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import { isAdminEmail } from '@/lib/admin';
import { createClient } from '@/lib/supabase/server';

// Guards every /admin route against the ADMIN_EMAILS allowlist, so the
// explorer sub-pages don't each repeat the check.
export default async function AdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  if (!isAdminEmail(user.email)) redirect('/dashboard');

  return <>{children}</>;
}
