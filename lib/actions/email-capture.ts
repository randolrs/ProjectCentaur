'use server';

import { redirect } from 'next/navigation';
import { z } from 'zod';
import { getDb } from '@/db';
import { emailSignups } from '@/db/schema';

const emailSchema = z.email();

export async function captureEmail(formData: FormData): Promise<void> {
  const parsed = emailSchema.safeParse(formData.get('email'));
  if (!parsed.success) {
    redirect(`/?error=${encodeURIComponent('Enter a valid email address.')}`);
  }

  const db = getDb();
  await db
    .insert(emailSignups)
    .values({ email: parsed.data.toLowerCase(), source: 'landing' })
    .onConflictDoNothing({ target: emailSignups.email });

  redirect(
    `/?notice=${encodeURIComponent(
      "You're on the list — your first digest is on the way once we launch.",
    )}`,
  );
}
