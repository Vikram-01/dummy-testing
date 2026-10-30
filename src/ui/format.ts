export function timeAgo(ms: number | null | undefined, now = Date.now()): string {
  if (!ms) return 'never';
  const d = now - ms;
  const abs = Math.abs(d);
  const fut = d < 0;
  const m = Math.round(abs / 60_000);
  let s: string;
  if (m < 1) s = 'just now';
  else if (m < 60) s = `${m}m`;
  else if (m < 60 * 24) s = `${Math.round(m / 60)}h`;
  else s = `${Math.round(m / 1440)}d`;
  if (s === 'just now') return s;
  return fut ? `in ${s}` : `${s} ago`;
}

export function fmtDate(ms: number | null | undefined, withTime = false): string {
  if (!ms) return 'Unknown';
  const d = new Date(ms);
  const date = d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  if (!withTime) return date;
  return `${date}, ${d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}`;
}

/** KEV dates are calendar dates stored as UTC midnight; render without TZ shift. */
export function fmtUtcDate(ms: number | null | undefined): string {
  if (!ms) return 'Unknown';
  return new Date(ms).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' });
}

export function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

export function sevLabel(s: string): string {
  return s === 'UNKNOWN' ? 'Unknown' : s === 'NONE' ? 'None' : s.charAt(0) + s.slice(1).toLowerCase();
}

export function fmtDuration(ms: number | null | undefined): string {
  if (ms == null) return '';
  return ms < 1000 ? `${ms} ms` : `${(ms / 1000).toFixed(1)} s`;
}
