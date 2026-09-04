/**
 * Minimal, dependency-free iCal (RFC 5545) reader.
 * Good enough for what Airbnb's "Export calendar" feed produces:
 * a list of VEVENT blocks, each with a DTSTART/DTEND that mark a
 * reservation or manually-blocked date range.
 *
 * We intentionally only pull what we need (start/end of each event)
 * rather than pulling in a full calendar-parsing library.
 */

function unfold(text) {
  // RFC 5545 line folding: a continuation line starts with a space or tab.
  return text.replace(/\r\n/g, "\n").replace(/\n[ \t]/g, "");
}

function parseDate(value) {
  // "20260901" (all-day) or "20260901T150000Z" (date-time)
  const m = /^(\d{4})(\d{2})(\d{2})/.exec(value);
  if (!m) return null;
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
}

function parseICS(text) {
  const lines = unfold(text).split("\n");
  const events = [];
  let cur = null;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    if (line === "BEGIN:VEVENT") {
      cur = {};
      continue;
    }
    if (line === "END:VEVENT") {
      if (cur && cur.start && cur.end) events.push({ start: cur.start, end: cur.end });
      cur = null;
      continue;
    }
    if (!cur) continue;

    const idx = line.indexOf(":");
    if (idx === -1) continue;
    const rawKey = line.slice(0, idx);
    const value = line.slice(idx + 1);
    const key = rawKey.split(";")[0].toUpperCase();

    if (key === "DTSTART") {
      cur.start = parseDate(value);
    } else if (key === "DTEND") {
      cur.end = parseDate(value);
    }
  }

  return events.filter((e) => e.start && e.end && e.end > e.start);
}

module.exports = { parseICS };
