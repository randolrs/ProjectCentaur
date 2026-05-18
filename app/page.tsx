import type { Metadata } from 'next';
import Link from 'next/link';

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
    <div className="space-y-1">
      <div className="text-xs font-semibold tracking-wider text-neutral-500">
        STEP {index}
      </div>
      <h3 className="text-sm font-semibold text-neutral-100">{title}</h3>
      <p className="text-sm leading-relaxed text-neutral-400">{body}</p>
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
    <div className="border-t border-neutral-800 pt-4">
      <div className="text-sm font-semibold text-neutral-100">{headline}</div>
      <div className="mt-1 text-xs text-neutral-500">{meta}</div>
      <p className="mt-2 text-sm leading-relaxed text-neutral-300">
        {reasoning}
      </p>
    </div>
  );
}

export default function Home() {
  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-100">
      <div className="mx-auto w-full max-w-2xl space-y-20 px-6 py-16">
        {/* Hero */}
        <section className="space-y-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
            For US thoroughbred handicappers
          </p>
          <h1 className="text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
            Stop scanning 200 races to find the five that matter.
          </h1>
          <p className="text-base leading-relaxed text-neutral-400">
            Furlong reads every card at the tracks you follow, every morning,
            and emails you the handful of races worth your time — with the
            angle on each. A triage tool, not a tout service.
          </p>
          <div className="flex flex-wrap items-center gap-4 pt-2">
            <Link
              href="/signup"
              className="rounded-md bg-neutral-100 px-5 py-2.5 text-sm font-semibold text-neutral-950 hover:bg-white"
            >
              Get your first digest free
            </Link>
            <span className="text-sm text-neutral-500">
              Then $19/mo · cancel anytime
            </span>
          </div>
        </section>

        {/* Sample digest */}
        <section className="space-y-4">
          <h2 className="text-sm font-semibold text-neutral-300">
            A morning at your tracks looks like this
          </h2>
          <div className="rounded-lg border border-neutral-800 bg-neutral-900 p-6">
            <div className="text-xs uppercase tracking-wider text-neutral-500">
              Sunday, May 17 · Your race digest
            </div>
            <p className="mt-3 text-sm leading-relaxed text-neutral-300">
              Quiet card at your tracks today — two races clear your filters,
              and one is the uncontested-lead spot you said you live for.
            </p>
            <div className="mt-4 space-y-4">
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
        <section className="space-y-5">
          <h2 className="text-lg font-semibold tracking-tight">How it works</h2>
          <div className="grid gap-6 sm:grid-cols-3">
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
        <section className="space-y-3 rounded-lg border border-neutral-800 bg-neutral-900 p-6">
          <h2 className="text-lg font-semibold tracking-tight">
            Not picks. Not hype.
          </h2>
          <p className="text-sm leading-relaxed text-neutral-400">
            Furlong won&apos;t tell you what to bet. It tells you which races
            deserve your attention — and says so plainly when one doesn&apos;t.
            The morning&apos;s homework, done. The decisions, still yours.
          </p>
        </section>

        {/* Pricing / CTA */}
        <section className="space-y-4 text-center">
          <h2 className="text-2xl font-semibold tracking-tight">
            Your first digest is free.
          </h2>
          <p className="text-sm leading-relaxed text-neutral-400">
            Build your profile, get a digest for today&apos;s card, and decide
            for yourself. After that it&apos;s $19/month — cancel anytime.
          </p>
          <div className="flex flex-col items-center gap-3 pt-2">
            <Link
              href="/signup"
              className="rounded-md bg-neutral-100 px-5 py-2.5 text-sm font-semibold text-neutral-950 hover:bg-white"
            >
              Get your first digest free
            </Link>
            <Link
              href="/login"
              className="text-sm text-neutral-500 underline hover:text-neutral-300"
            >
              Already have an account? Log in
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
