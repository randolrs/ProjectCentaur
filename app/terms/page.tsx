import type { Metadata } from 'next';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { SiteFooter } from '@/app/_components/site-footer';
import { Wordmark } from '@/app/_components/wordmark';

export const metadata: Metadata = { title: 'Terms — Furlong' };

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

export default function TermsPage() {
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
            Terms of Service
          </h1>
          <p className="text-sm text-paper/45">Last updated May 2026</p>
        </div>

        <Section title="What Furlong is">
          <p>
            Furlong is a personalized horse-racing handicapping digest. It
            provides informational analysis to help you decide which races are
            worth your attention. It is not betting advice, not financial
            advice, and it does not predict or guarantee any outcome.
          </p>
        </Section>

        <Section title="Your account">
          <p>
            You are responsible for the activity on your account and for
            keeping your login secure. Provide accurate information so your
            digest reflects how you actually play.
          </p>
        </Section>

        <Section title="Subscription and billing">
          <p>
            Furlong is $19 per month, billed through Stripe, and renews
            automatically until you cancel. You can cancel anytime from your
            dashboard — cancellation stops future renewals, and you keep access
            through the end of the period you&apos;ve paid for. We may change
            pricing with advance notice.
          </p>
        </Section>

        <Section title="Acceptable use">
          <p>
            Furlong is for your personal use. Please don&apos;t resell,
            redistribute, or republish the digests, and don&apos;t attempt to
            disrupt or abuse the service.
          </p>
        </Section>

        <Section title="Disclaimer and risk">
          <p>
            Furlong is provided &ldquo;as is.&rdquo; Horse racing and wagering
            involve real financial risk, and any decision you make is your own.
            Wager only what you can afford to lose, only where it is legal, and
            only if you meet the legal age for wagering in your jurisdiction.
          </p>
        </Section>

        <Section title="Changes and contact">
          <p>
            We may update these terms; continued use of Furlong means you
            accept the current version. Questions? Email{' '}
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
