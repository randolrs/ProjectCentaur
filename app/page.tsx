import Link from 'next/link';
import { captureEmail } from '@/lib/actions/email-capture';
import { firstParam, type SearchParams } from '@/lib/search-params';

export default async function Home({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;
  const error = firstParam(sp.error);
  const notice = firstParam(sp.notice);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-neutral-950 px-6 py-16 text-neutral-100">
      <div className="w-full max-w-md space-y-6">
        <header className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">
            [PRODUCT_NAME]
          </h1>
          <p className="text-sm leading-relaxed text-neutral-400">
            A personalized AI morning digest for US thoroughbred handicappers.
            Tell us your handicapping style; we triage every card you follow and
            send the five races worth your time. Coming soon.
          </p>
        </header>

        <form action={captureEmail} className="space-y-3">
          <label htmlFor="email" className="block text-sm font-medium">
            Get your first digest free
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
            placeholder="you@example.com"
            className="w-full rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm outline-none focus:border-neutral-400"
          />
          <button
            type="submit"
            className="w-full rounded-md bg-neutral-100 px-4 py-2 text-sm font-medium text-neutral-900 hover:bg-white"
          >
            Notify me
          </button>
        </form>

        {notice ? <p className="text-sm text-green-400">{notice}</p> : null}
        {error ? <p className="text-sm text-red-400">{error}</p> : null}

        <p className="text-sm text-neutral-400">
          Want the full experience?{' '}
          <Link href="/signup" className="text-neutral-200 underline">
            Create an account
          </Link>{' '}
          or{' '}
          <Link href="/login" className="text-neutral-200 underline">
            log in
          </Link>
          .
        </p>
      </div>
    </main>
  );
}
