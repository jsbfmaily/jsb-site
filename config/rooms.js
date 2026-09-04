/**
 * Room + pricing configuration.
 *
 * This file is loaded BOTH in the browser (via a plain <script> tag,
 * where it sets `window.JSB_ROOMS`) and on the server inside the
 * Vercel API functions (via `require("../config/rooms.js")`).
 * Keep it dependency-free so both sides work unmodified.
 *
 * --> nightlyRate is in WHOLE DOLLARS. Set the real rates before you
 *     go live — until a room has a rate > 0, its booking widget will
 *     show "pricing coming soon" and the pay button stays disabled,
 *     so nothing can be booked at $0 by accident.
 *
 * --> This file is served to the browser as-is, so it must NEVER
 *     contain secrets. Airbnb iCal feed URLs act like a password (
 *     anyone with the link can see your calendar), so those live
 *     only in server-side environment variables — see
 *     STUDIO_ICAL_URLS / LARGE_ROOM_ICAL_URLS / SMALL_ROOM_ICAL_URLS
 *     in .env.example, read by api/availability.js. Never add an
 *     icalUrls field to this file.
 */

var JSB_ROOMS = {
  studio: {
    id: "studio",
    name: "Private Studio",
    shortName: "Studio",
    nightlyRate: 0, // TODO: set real nightly rate in USD
    cleaningFee: 50,
    minNights: 1,
    maxGuests: 2,
  },
  "large-room": {
    id: "large-room",
    name: "Large Room — Basement Apartment",
    shortName: "Large Room",
    nightlyRate: 0, // TODO: set real nightly rate in USD
    cleaningFee: 50,
    minNights: 1,
    maxGuests: 2,
  },
  "small-room": {
    id: "small-room",
    name: "Small Room — Basement Apartment",
    shortName: "Small Room",
    nightlyRate: 0, // TODO: set real nightly rate in USD
    cleaningFee: 50,
    minNights: 1,
    maxGuests: 2,
  },
};

if (typeof module === "object" && module.exports) {
  module.exports = JSB_ROOMS;
} else if (typeof window !== "undefined") {
  window.JSB_ROOMS = JSB_ROOMS;
}
