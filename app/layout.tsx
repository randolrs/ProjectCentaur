import type { Metadata } from 'next';
import { type ReactNode, Suspense } from 'react';
import { AnalyticsProvider } from '@/app/_analytics/analytics-provider';
import { IdentifyUser } from '@/app/_analytics/identify-user';
import { PageviewTracker } from '@/app/_analytics/pageview-tracker';
import './globals.css';

export const metadata: Metadata = {
  title: 'Furlong',
  description: 'Personalized AI morning digest for US thoroughbred handicappers.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="antialiased">
        <AnalyticsProvider>
          <Suspense fallback={null}>
            <PageviewTracker />
          </Suspense>
          <IdentifyUser />
          {children}
        </AnalyticsProvider>
      </body>
    </html>
  );
}
