'use server';

import { redirect } from 'next/navigation';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';

const credentialsSchema = z.object({
  email: z.email(),
  password: z.string().min(8, 'Password must be at least 8 characters.'),
});

function errorRedirect(path: string, message: string): never {
  redirect(`${path}?error=${encodeURIComponent(message)}`);
}

export async function signUp(formData: FormData): Promise<void> {
  const parsed = credentialsSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  });
  if (!parsed.success) {
    errorRedirect(
      '/signup',
      'Enter a valid email and a password of at least 8 characters.',
    );
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp(parsed.data);
  if (error) {
    errorRedirect('/signup', error.message);
  }

  // With email confirmation enabled, no session is returned until the user
  // confirms. Without it, the session is live immediately.
  if (data.session) {
    redirect('/onboarding');
  }
  redirect(
    `/login?notice=${encodeURIComponent(
      'Check your email to confirm your account, then log in.',
    )}`,
  );
}

export async function signIn(formData: FormData): Promise<void> {
  const parsed = credentialsSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  });
  if (!parsed.success) {
    errorRedirect('/login', 'Enter your email and password.');
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    const message =
      error.code === 'email_not_confirmed'
        ? 'Confirm your email address before logging in — check your inbox for the confirmation link.'
        : 'Email or password is incorrect.';
    errorRedirect('/login', message);
  }
  redirect('/dashboard');
}

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/login');
}
