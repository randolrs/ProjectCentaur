import type { RenderedDigest, RenderedDigestItem } from './schema';

// ---------------------------------------------------------------------------
// Digest email rendering.
//
// Produces the subject plus HTML and plain-text bodies for one digest. The
// HTML uses inline styles only — email clients do not apply <style> blocks
// or external CSS reliably.
// ---------------------------------------------------------------------------

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Human-readable date, e.g. "Sunday, May 17". */
function displayDate(raceDate: string): string {
  // raceDate is YYYY-MM-DD; parse as UTC to avoid a local-timezone shift.
  const parsed = new Date(`${raceDate}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return raceDate;
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(parsed);
}

function metaLine(item: RenderedDigestItem): string {
  return [
    item.raceClass,
    item.surface,
    item.distance,
    `field of ${item.fieldSize}`,
    item.postTime ? `post ${item.postTime}` : null,
  ]
    .filter((part): part is string => Boolean(part))
    .join(' · ');
}

function itemHtml(item: RenderedDigestItem): string {
  return `
    <tr><td style="padding:20px 0;border-top:1px solid #e5e5e5;">
      <div style="font-size:16px;font-weight:600;color:#111111;">
        ${escapeHtml(item.headline)}
      </div>
      <div style="font-size:13px;color:#888888;margin-top:4px;">
        ${escapeHtml(metaLine(item))}
      </div>
      <div style="font-size:14px;line-height:1.6;color:#333333;margin-top:8px;">
        ${escapeHtml(item.reasoning)}
      </div>
    </td></tr>`;
}

function itemText(item: RenderedDigestItem): string {
  return [
    item.headline,
    metaLine(item),
    item.reasoning,
  ].join('\n');
}

/** Render a finished digest into a deliverable email. */
export function renderDigestEmail(
  digest: RenderedDigest,
  raceDate: string,
): RenderedEmail {
  const count = digest.items.length;
  const noun = count === 1 ? 'race' : 'races';
  const subject = `Your race digest — ${displayDate(raceDate)} (${count} ${noun})`;

  const html = `<!doctype html>
<html><body style="margin:0;padding:0;background:#f4f4f4;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f4;">
    <tr><td align="center" style="padding:32px 16px;">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:8px;">
        <tr><td style="padding:32px 32px 8px 32px;">
          <div style="font-size:13px;letter-spacing:0.08em;text-transform:uppercase;color:#999999;">
            ${escapeHtml(displayDate(raceDate))}
          </div>
          <h1 style="font-size:22px;color:#111111;margin:8px 0 0 0;">Your race digest</h1>
          <p style="font-size:14px;line-height:1.6;color:#333333;margin:16px 0 0 0;">
            ${escapeHtml(digest.intro)}
          </p>
        </td></tr>
        <tr><td style="padding:8px 32px 24px 32px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            ${digest.items.map(itemHtml).join('')}
          </table>
        </td></tr>
        <tr><td style="padding:0 32px 32px 32px;">
          <p style="font-size:12px;color:#aaaaaa;border-top:1px solid #e5e5e5;padding-top:16px;margin:0;">
            These races match the tracks and preferences from your handicapping profile.
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;

  const text = [
    `YOUR RACE DIGEST — ${displayDate(raceDate)}`,
    '',
    digest.intro,
    '',
    digest.items.map(itemText).join('\n\n'),
    '',
    '—',
    'These races match the tracks and preferences from your handicapping profile.',
  ].join('\n');

  return { subject, html, text };
}
