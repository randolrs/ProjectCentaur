import { redirect } from 'next/navigation';
import { isAdminEmail } from '@/lib/admin';
import { createClient } from '@/lib/supabase/server';
import { AdminConsole } from './admin-client';

// Ingestion makes many sequential provider calls; give server actions
// triggered from this page a generous execution window.
export const maxDuration = 300;

export default async function AdminPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  if (!isAdminEmail(user.email)) redirect('/dashboard');

  return <AdminConsole email={user.email ?? ''} />;
}
