const { parseICS } = require("./ical.js");

/**
 * Reads the iCal feed URL(s) for a room from an environment variable
 * named e.g. STUDIO_ICAL_URLS (comma-separated if there's more than
 * one calendar to merge), fetches each, and returns the combined
 * list of busy {start, end} Date ranges. Never throws — a feed that
 * fails to load is just skipped, so a booking never gets silently
 * stuck because of a flaky network call.
 */
async function getBusyRangesForRoom(room) {
  const envKey = room.id.toUpperCase().replace(/-/g, "_") + "_ICAL_URLS";
  const raw = process.env[envKey];
  const urls = raw
    ? raw.split(",").map((s) => s.trim()).filter(Boolean)
    : [];

  const busy = [];
  for (const url of urls) {
    try {
      const r = await fetch(url);
      if (!r.ok) {
        console.error("iCal fetch failed", url, r.status);
        continue;
      }
      const text = await r.text();
      busy.push(...parseICS(text));
    } catch (e) {
      console.error("iCal fetch error", url, e && e.message);
    }
  }
  return busy;
}

module.exports = { getBusyRangesForRoom };
