import Link from 'next/link';
import { Wordmark } from './wordmark';

/** Marketing-surface footer: brand mark, contact, and the legal links. */
export function SiteFooter() {
  return (
    <footer className="border-t border-paper/10">
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 px-6 py-10 text-sm sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <Wordmark className="text-paper" />
          <p className="text-paper/45">The morning&apos;s races, handicapped.</p>
        </div>
        <nav className="flex flex-wrap gap-x-5 gap-y-2 text-paper/55">
          <a href="mailto:hello@furlong.co" className="hover:text-paper">
            Contact
          </a>
          <Link href="/terms" className="hover:text-paper">
            Terms
          </Link>
          <Link href="/privacy" className="hover:text-paper">
            Privacy
          </Link>
        </nav>
      </div>
    </footer>
  );
}
