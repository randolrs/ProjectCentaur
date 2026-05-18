import Link from 'next/link';
import type { ReactNode } from 'react';

/** Shared page chrome for the admin data explorer. */
export function AdminShell({
  title,
  subtitle,
  backHref,
  backLabel,
  children,
}: {
  title: string;
  subtitle?: string;
  backHref: string;
  backLabel: string;
  children: ReactNode;
}) {
  return (
    <main className="flex min-h-screen flex-col items-center bg-neutral-950 px-6 text-neutral-100">
      <div className="w-full max-w-2xl space-y-6 py-12">
        <div className="space-y-1">
          <Link
            href={backHref}
            className="text-sm text-neutral-500 hover:text-neutral-300"
          >
            ← {backLabel}
          </Link>
          <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
          {subtitle && <p className="text-sm text-neutral-400">{subtitle}</p>}
        </div>
        {children}
      </div>
    </main>
  );
}
