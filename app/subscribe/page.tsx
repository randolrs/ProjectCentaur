import { redirect } from 'next/navigation';
import {
  getHandicapperProfile,
  getSubscription,
  getUserPreferences,
} from '@/db/queries';
import { isSubscriptionActive } from '@/lib/stripe/subscription';
import { createClient } from '@/lib/supabase/server';
import { SubscribeForm } from './subscribe-form';

export default async function SubscribePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // The paywall sits after onboarding — both steps must be complete.
  const prefs = await getUserPreferences(user.id);
  if (!prefs) redirect('/onboarding');
  const handicapper = await getHandicapperProfile(user.id);
  if (!handicapper) redirect('/onboarding/conversation');

  const subscription = await getSubscription(user.id);
  if (isSubscriptionActive(subscription?.status)) redirect('/dashboard');

  return <SubscribeForm />;
}
