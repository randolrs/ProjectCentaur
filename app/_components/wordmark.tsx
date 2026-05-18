/** The Furlong wordmark — the brand's primary visual mark. Inherits color
 *  from its parent so it can sit on both the ink and paper surfaces. */
export function Wordmark({ className = '' }: { className?: string }) {
  return (
    <span
      className={`font-serif text-lg font-semibold tracking-tight ${className}`}
    >
      Furlong
    </span>
  );
}
