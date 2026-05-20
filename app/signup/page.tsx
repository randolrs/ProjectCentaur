import Link from 'next/link';
import { SiteFooter } from '@/app/_components/site-footer';
import { SubmitButton } from '@/app/_components/submit-button';
import { Wordmark } from '@/app/_components/wordmark';
import { signUp } from '@/lib/actions/auth';
import { firstParam, type SearchParams } from '@/lib/search-params';

const inputClass =
  'w-full rounded-md border border-paper/15 bg-paper/5 px-3 py-2 text-sm text-paper placeholder:text-paper/30 outline-none focus:border-paper/40';

export default async function SignupPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;
  const error = firstParam(sp.error);

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
            Create your account
          </h1>

          <form action={signUp} className="space-y-4">
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
                minLength={8}
                autoComplete="new-password"
                className={inputClass}
              />
              <p className="text-xs text-paper/45">At least 8 characters.</p>
            </div>
            <SubmitButton
              pendingText="Creating account…"
              className="w-full rounded-md bg-turf-bright px-4 py-2.5 text-sm font-semibold text-ink hover:opacity-90 disabled:opacity-50"
            >
              Sign up
            </SubmitButton>
          </form>

          {error ? <p className="text-sm text-red-400">{error}</p> : null}

          <p className="text-sm text-paper/65">
            Already have an account?{' '}
            <Link href="/login" className="text-turf-bright hover:underline">
              Log in
            </Link>
            .
          </p>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
