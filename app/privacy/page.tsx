import type { Metadata } from 'next';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { SiteFooter } from '@/app/_components/site-footer';
import { Wordmark } from '@/app/_components/wordmark';

export const metadata: Metadata = { title: 'Privacy — Furlong' };

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="font-serif text-lg font-semibold tracking-tight text-paper">
        {title}
      </h2>
      <div className="space-y-2 text-sm leading-relaxed text-paper/70">
        {children}
      </div>
    </section>
  );
}

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-ink text-paper">
      <header className="mx-auto flex w-full max-w-2xl items-center justify-between px-6 py-6">
        <Link href="/">
          <Wordmark className="text-paper" />
        </Link>
        <Link href="/login" className="text-sm text-paper/60 hover:text-paper">
          Log in
        </Link>
      </header>

      <main className="mx-auto w-full max-w-2xl space-y-8 px-6 pb-20 pt-8">
        <div className="space-y-1">
          <h1 className="font-serif text-3xl font-semibold tracking-tight">
            Privacy Policy
          </h1>
          <p className="text-sm text-paper/45">Last updated May 2026</p>
        </div>

        <Section title="What we collect">
          <p>
            Your account email address, the handicapping preferences you give
            us during onboarding (tracks, classes, distances, the setups you
            describe), and your subscription status. We never collect or store
            your payment card details — those go directly to Stripe.
          </p>
        </Section>

        <Section title="How we use it">
          <p>
            We use your information to generate and email your daily digest, to
            operate your subscription, and to contact you about your account.
            That&apos;s all.
          </p>
        </Section>

        <Section title="Service providers">
          <p>
            Furlong relies on a few trusted providers, each handling data only
            to perform its function: Supabase (authentication and database),
            Stripe (payments), Resend (email delivery), Anthropic (generates
            your digest&apos;s written analysis from your preferences and public
            racing data), and Vercel (hosting).
          </p>
        </Section>

        <Section title="We don't sell your data">
          <p>
            Furlong does not sell or rent your personal information to anyone.
          </p>
        </Section>

        <Section title="Retention and deletion">
          <p>
            We keep your data while your account is active. To delete your
            account and associated data, email{' '}
            <a
              href="mailto:hello@furlong.co"
              className="text-turf-bright hover:underline"
            >
              hello@furlong.co
            </a>
            .
          </p>
        </Section>

        <Section title="Contact">
          <p>
            Questions about privacy? Email{' '}
            <a
              href="mailto:hello@furlong.co"
              className="text-turf-bright hover:underline"
            >
              hello@furlong.co
            </a>
            .
          </p>
        </Section>
      </main>

      <SiteFooter />
    </div>
  );
}
