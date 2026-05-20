import type { Metadata } from 'next';
import Link from 'next/link';
import { SiteFooter } from '@/app/_components/site-footer';
import { Wordmark } from '@/app/_components/wordmark';

export const metadata: Metadata = {
  title: 'Furlong — your morning races, handicapped',
  description:
    'Furlong reads every card at the tracks you follow and emails you the races worth your time, with the angle on each. For US thoroughbred handicappers.',
};

function Step({
  index,
  title,
  body,
}: {
  index: number;
  title: string;
  body: string;
}) {
  return (
    <div className="space-y-1.5">
      <div className="font-serif text-2xl font-semibold text-turf-bright">
        {index}
      </div>
      <h3 className="text-sm font-semibold text-paper">{title}</h3>
      <p className="text-sm leading-relaxed text-paper/60">{body}</p>
    </div>
  );
}

function DigestItem({
  headline,
  meta,
  reasoning,
}: {
  headline: string;
  meta: string;
  reasoning: string;
}) {
  return (
    <div className="border-t border-ink/10 pt-4">
      <div className="font-serif text-base font-semibold text-ink">
        {headline}
      </div>
      <div className="mt-1 text-xs text-ink/50">{meta}</div>
      <p className="mt-1.5 text-sm leading-relaxed text-ink/70">{reasoning}</p>
    </div>
  );
}

export default function Home() {
  return (
    <div className="min-h-screen bg-ink text-paper">
      <header className="mx-auto flex w-full max-w-2xl items-center justify-between px-6 py-6">
        <Wordmark className="text-paper" />
        <Link
          href="/login"
          className="text-sm text-paper/60 hover:text-paper"
        >
          Log in
        </Link>
      </header>

      <main className="mx-auto w-full max-w-2xl space-y-20 px-6 pb-20 pt-8">
        {/* Hero */}
        <section className="space-y-5">
          <h1 className="font-serif text-4xl font-semibold leading-[1.15] tracking-tight sm:text-5xl">
            The few races worth your morning.
          </h1>
          <p className="text-base leading-relaxed text-paper/70">
            Furlong reads every card at your tracks against how you handicap,
            and emails you only the races built for your game.
          </p>
          <div className="flex flex-col items-start gap-3 pt-2 sm:flex-row sm:items-center sm:gap-4">
            <Link
              href="/signup"
              className="w-full rounded-md bg-turf-bright px-5 py-2.5 text-center text-sm font-semibold text-ink hover:opacity-90 sm:w-auto"
            >
              Get your first digest free
            </Link>
            <span className="text-sm text-paper/50">
              Then $19/mo · cancel anytime
            </span>
          </div>
        </section>

        {/* Sample digest — rendered as the artifact itself */}
        <section className="space-y-4">
          <h2 className="font-serif text-xl font-semibold">
            Here&apos;s what a morning looks like
          </h2>
          <div className="rounded-lg bg-paper p-7 text-ink shadow-xl shadow-black/40">
            <div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-turf">
              <span>Sunday, May 17</span>
              <span className="text-ink/30">·</span>
              <span>Your race digest</span>
            </div>
            <p className="mt-3 font-serif text-base leading-relaxed text-ink/80">
              Quiet card at your tracks today — two races clear your filters,
              and one is the uncontested-lead spot you said you live for.
            </p>
            <div className="mt-5 space-y-5">
              <DigestItem
                headline="Gulfstream R7 — lone speed in a short field"
                meta="Allowance · dirt · 7f · field of 6 · post 4:12"
                reasoning="The 4 is the only true early-pace runner here and should draw clear of a field that all wants to come from off it. On a track playing speed-favoring after morning rain, that's exactly the angle you flagged as a favorite. Likely short, but the trip writes itself."
              />
              <DigestItem
                headline="Churchill R4 — class dropper, but mind the price"
                meta="Claiming · dirt · 1m · field of 8 · post 2:30"
                reasoning="The 6 drops out of allowance for a barn that hits 24% on this move. The angle is real — but at a likely 6-5 it's under your value threshold, so this is a watch, not a play. An honest digest says so."
              />
            </div>
          </div>
        </section>

        {/* How it works */}
        <section className="space-y-6">
          <h2 className="font-serif text-2xl font-semibold tracking-tight">
            How it works
          </h2>
          <div className="grid gap-7 sm:grid-cols-3">
            <Step
              index={1}
              title="Tell us how you play"
              body="Your tracks, classes, distances, field sizes — and the setups you love and avoid."
            />
            <Step
              index={2}
              title="We triage every card"
              body="Each morning Furlong scores every race at your tracks against your profile."
            />
            <Step
              index={3}
              title="Read what matters"
              body="A sharp, honest digest in your inbox before first post — five races, not fifty."
            />
          </div>
        </section>

        {/* Positioning */}
        <section className="space-y-3 rounded-lg border border-paper/10 bg-paper/5 p-7">
          <h2 className="font-serif text-2xl font-semibold tracking-tight">
            Your morning homework, done.
          </h2>
          <p className="text-sm leading-relaxed text-paper/65">
            Furlong does the grind — every card, every past performance, every
            angle — measured against the way you handicap. You sit down to a
            short list instead of a stack. It won&apos;t tell you what to bet;
            it tells you which races fit your game, and says so plainly when
            none do. The work, done. The decisions, still yours.
          </p>
        </section>

        {/* Pricing / CTA */}
        <section className="space-y-4 text-center">
          <h2 className="font-serif text-3xl font-semibold tracking-tight">
            Your first digest is free.
          </h2>
          <p className="mx-auto max-w-md text-sm leading-relaxed text-paper/65">
            Build your profile, get a digest for today&apos;s card, and decide
            for yourself. After that it&apos;s $19/month — cancel anytime.
          </p>
          <div className="flex flex-col items-center gap-3 pt-2">
            <Link
              href="/signup"
              className="w-full rounded-md bg-turf-bright px-6 py-3 text-center text-sm font-semibold text-ink hover:opacity-90 sm:w-auto"
            >
              Get your first digest free
            </Link>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
