import Link from 'next/link';
import { SubmitButton } from '@/app/_components/submit-button';
import { signUp } from '@/lib/actions/auth';
import { firstParam, type SearchParams } from '@/lib/search-params';

export default async function SignupPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;
  const error = firstParam(sp.error);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-neutral-950 px-6 py-16 text-neutral-100">
      <div className="w-full max-w-sm space-y-6">
        <h1 className="text-xl font-semibold tracking-tight">
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
              className="w-full rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm outline-none focus:border-neutral-400"
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
              className="w-full rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm outline-none focus:border-neutral-400"
            />
            <p className="text-xs text-neutral-500">At least 8 characters.</p>
          </div>
          <SubmitButton
            pendingText="Creating account…"
            className="w-full rounded-md bg-neutral-100 px-4 py-2 text-sm font-medium text-neutral-900 hover:bg-white disabled:opacity-50"
          >
            Sign up
          </SubmitButton>
        </form>

        {error ? <p className="text-sm text-red-400">{error}</p> : null}

        <p className="text-sm text-neutral-400">
          Already have an account?{' '}
          <Link href="/login" className="text-neutral-200 underline">
            Log in
          </Link>
          .
        </p>
      </div>
    </main>
  );
}
