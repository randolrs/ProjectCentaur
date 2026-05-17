import { getDigestFromEmail, getResendApiKey } from '@/lib/env';

// ---------------------------------------------------------------------------
// Resend email delivery.
//
// A thin `fetch` wrapper over the Resend REST API — no SDK dependency. Used
// by the digest pipeline to deliver one email per user.
// ---------------------------------------------------------------------------

const RESEND_ENDPOINT = 'https://api.resend.com/emails';

export interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export interface SendEmailResult {
  id: string;
}

/** Send one email via Resend. Throws when the API rejects the request. */
export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const response = await fetch(RESEND_ENDPOINT, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${getResendApiKey()}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      from: getDigestFromEmail(),
      to: input.to,
      subject: input.subject,
      html: input.html,
      text: input.text,
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(
      `Resend API error ${response.status}${detail ? `: ${detail}` : ''}`,
    );
  }

  const data = (await response.json()) as { id?: string };
  return { id: data.id ?? '' };
}
