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

/**
 * Split model prose into paragraphs on one-or-more newlines. The model is
 * asked to separate a caveat from the lead read with a blank line; without a
 * dedicated split, HTML collapses those breaks and the copy reads as one
 * block. Falls back to the whole (trimmed) string so output is never empty.
 */
function paragraphs(value: string): string[] {
  const parts = value
    .split(/\n+/)
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
  return parts.length > 0 ? parts : [value.trim()];
}

/** Render multi-paragraph prose as stacked, inline-styled <p> blocks. */
function proseHtml(value: string, css: string, firstMarginTop: string): string {
  return paragraphs(value)
    .map(
      (part, i) =>
        `<p style="${css}margin:${i === 0 ? firstMarginTop : '10px'} 0 0 0;">${escapeHtml(part)}</p>`,
    )
    .join('');
}

/** Surface with its going folded in when captured, e.g. "Dirt (Sloppy)". */
function surfaceLabel(item: RenderedDigestItem): string | null {
  if (!item.surface) return item.surfaceCondition ?? null;
  return item.surfaceCondition
    ? `${item.surface} (${item.surfaceCondition})`
    : item.surface;
}

function metaLine(item: RenderedDigestItem): string {
  return [
    item.raceClass,
    surfaceLabel(item),
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
      ${proseHtml(item.reasoning, 'font-size:14px;line-height:1.6;color:#333333;', '8px')}
    </td></tr>`;
}

function itemText(item: RenderedDigestItem): string {
  return [
    item.headline,
    metaLine(item),
    paragraphs(item.reasoning).join('\n\n'),
  ].join('\n');
}

/** Optional extras when rendering the email. */
export interface RenderDigestOptions {
  /** When set, append a "subscribe to keep these" call to action. */
  upgradeUrl?: string;
}

/** Subject line for a digest, reflecting how well the day fit the user. */
function subjectFor(digest: RenderedDigest, raceDate: string): string {
  const date = displayDate(raceDate);
  const count = digest.items.length;
  const noun = count === 1 ? 'race' : 'races';
  switch (digest.tier) {
    case 'dark':
      return `No racing at your tracks — ${date}`;
    case 'weak':
      return `Your race digest — ${date} — no strong matches`;
    default:
      return `Your race digest — ${date} (${count} ${noun})`;
  }
}

/** Closing line under the digest, reflecting how well the day fit the user. */
function footerFor(tier: RenderedDigest['tier']): string {
  switch (tier) {
    case 'dark':
      return "We'll send your next digest the day your tracks are running.";
    case 'weak':
      return 'None of today’s races fully matched your profile — these are the closest at your tracks.';
    default:
      return 'These races match the tracks and preferences from your handicapping profile.';
  }
}

/** Render a finished digest into a deliverable email. */
export function renderDigestEmail(
  digest: RenderedDigest,
  raceDate: string,
  options: RenderDigestOptions = {},
): RenderedEmail {
  const subject = subjectFor(digest, raceDate);
  const heading = digest.tier === 'dark' ? 'No racing today' : 'Your race digest';
  const footer = footerFor(digest.tier);

  const weakNoteHtml =
    digest.tier === 'weak'
      ? `<tr><td style="padding:8px 32px 0 32px;">
          <div style="background:#fff8e1;border:1px solid #f0e0a0;border-radius:8px;padding:14px 16px;font-size:13px;line-height:1.5;color:#7a5c00;">
            No races strongly matched your criteria today — here are the closest looks at your tracks.
          </div>
        </td></tr>`
      : '';

  const itemsHtml =
    digest.items.length > 0
      ? `<tr><td style="padding:8px 32px 24px 32px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            ${digest.items.map(itemHtml).join('')}
          </table>
        </td></tr>`
      : '';

  const upgradeUrl = options.upgradeUrl;
  const upgradeHtml = upgradeUrl
    ? `<tr><td style="padding:8px 32px 0 32px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            <tr><td style="background:#111111;border-radius:8px;padding:22px 24px;text-align:center;">
              <div style="font-size:15px;font-weight:600;color:#ffffff;">This digest was free.</div>
              <div style="font-size:13px;line-height:1.5;color:#aaaaaa;margin-top:6px;">
                Keep getting the races worth your morning, every day.
              </div>
              <a href="${escapeHtml(upgradeUrl)}" style="display:inline-block;margin-top:14px;background:#ffffff;color:#111111;font-size:14px;font-weight:600;text-decoration:none;padding:10px 22px;border-radius:6px;">
                Subscribe — $19/mo
              </a>
            </td></tr>
          </table>
        </td></tr>`
    : '';

  const html = `<!doctype html>
<html><body style="margin:0;padding:0;background:#f4f4f4;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f4;">
    <tr><td align="center" style="padding:32px 16px;">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:8px;">
        <tr><td style="padding:32px 32px 8px 32px;">
          <div style="font-size:13px;letter-spacing:0.08em;text-transform:uppercase;color:#999999;">
            ${escapeHtml(displayDate(raceDate))}
          </div>
          <h1 style="font-size:22px;color:#111111;margin:8px 0 0 0;">${escapeHtml(heading)}</h1>
          ${proseHtml(digest.intro, 'font-size:14px;line-height:1.6;color:#333333;', '16px')}
        </td></tr>
        ${weakNoteHtml}
        ${itemsHtml}
        ${upgradeHtml}
        <tr><td style="padding:24px 32px 32px 32px;">
          <p style="font-size:12px;color:#aaaaaa;border-top:1px solid #e5e5e5;padding-top:16px;margin:0;">
            ${escapeHtml(footer)}
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;

  const text = [
    `${heading.toUpperCase()} — ${displayDate(raceDate)}`,
    '',
    paragraphs(digest.intro).join('\n\n'),
    ...(digest.tier === 'weak'
      ? ['', 'No races strongly matched your criteria today — here are the closest looks at your tracks.']
      : []),
    ...(digest.items.length > 0
      ? ['', digest.items.map(itemText).join('\n\n')]
      : []),
    '',
    ...(upgradeUrl
      ? [
          '—',
          'This digest was free. Keep getting your morning races for $19/mo:',
          upgradeUrl,
          '',
        ]
      : []),
    '—',
    footer,
  ].join('\n');

  return { subject, html, text };
}
