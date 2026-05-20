import Link from 'next/link';
import { SiteFooter } from '@/app/_components/site-footer';
import { SubmitButton } from '@/app/_components/submit-button';
import { Wordmark } from '@/app/_components/wordmark';
import { signIn } from '@/lib/actions/auth';
import { firstParam, type SearchParams } from '@/lib/search-params';

const inputClass =
  'w-full rounded-md border border-paper/15 bg-paper/5 px-3 py-2 text-sm text-paper placeholder:text-paper/30 outline-none focus:border-paper/40';

export default async function LoginPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;
  const error = firstParam(sp.error);
  const notice = firstParam(sp.notice);

  return (
    <div className="flex min-h-screen flex-col bg-ink text-paper">
      <header className="mx-auto flex w-full max-w-2xl items-center justify-between px-6 py-6">
        <Link href="/">
          <Wordmark className="text-paper" />
        </Link>
      </header>

      <main className="flex flex-1 items-center justify-center px-6 pb-12">
        <div className="w-full max-w-sm space-y-6">
          <h1 className="font-serif text-3xl font-semibold tracking-tight">
            Log in
          </h1>

          <form action={signIn} className="space-y-4">
            <div className="space-y-1">
              <label htmlFor="email" className="block text-sm font-medium">
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                autoComplete="email"
                className={inputClass}
              />
            </div>
            <div className="space-y-1">
              <label htmlFor="password" className="block text-sm font-medium">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                autoComplete="current-password"
                className={inputClass}
              />
            </div>
            <SubmitButton
              pendingText="Logging in…"
              className="w-full rounded-md bg-turf-bright px-4 py-2.5 text-sm font-semibold text-ink hover:opacity-90 disabled:opacity-50"
            >
              Log in
            </SubmitButton>
          </form>

          {notice ? <p className="text-sm text-turf-bright">{notice}</p> : null}
          {error ? <p className="text-sm text-red-400">{error}</p> : null}

          <p className="text-sm text-paper/65">
            New here?{' '}
            <Link href="/signup" className="text-turf-bright hover:underline">
              Create an account
            </Link>
            .
          </p>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
