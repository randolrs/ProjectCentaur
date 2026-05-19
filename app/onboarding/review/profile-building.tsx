'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

// Shown while the handicapper profile is being synthesized in the background.
// Re-checks the server every few seconds until the profile lands, at which
// point the review page renders the summary instead of this component.
export function ProfileBuilding() {
  const router = useRouter();
  const [slow, setSlow] = useState(false);

  useEffect(() => {
    let polls = 0;
    const timer = setInterval(() => {
      polls += 1;
      if (polls > 40) setSlow(true);
      router.refresh();
    }, 2500);
    return () => clearInterval(timer);
  }, [router]);

  return (
    <div className="space-y-3">
      <h1 className="text-xl font-semibold tracking-tight">
        Building your profile…
      </h1>
      <p className="text-sm text-neutral-400">
        We&apos;re reading back through your answers and putting together how
        you play. This takes a few seconds.
      </p>
      {slow ? (
        <p className="text-sm text-neutral-500">
          Still working — if this doesn&apos;t update shortly, refresh the page.
        </p>
      ) : null}
    </div>
  );
}
