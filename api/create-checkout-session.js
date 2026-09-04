const rooms = require("../config/rooms.js");
const { getBusyRangesForRoom } = require("../lib/availability.js");

const SUCCESS_PATH = "/booking-confirmed.html";
const CANCEL_PATH = "/booking-cancelled.html";

/**
 * POST /api/create-checkout-session
 * body: { room, checkin, checkout, guests, name, email }
 *
 * Recomputes price and re-checks Airbnb-calendar availability on the
 * SERVER (never trusts numbers a browser sends), then creates a
 * Stripe Checkout Session by calling Stripe's REST API directly with
 * fetch — no `stripe` npm package required, so this deploys with zero
 * dependencies.
 */
module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  let body = req.body;
  if (!body || typeof body === "string") {
    try {
      body = JSON.parse(body || "{}");
    } catch (e) {
      res.status(400).json({ error: "Invalid request body." });
      return;
    }
  }

  const { room: roomId, checkin, checkout, guests, name, email } = body || {};
  const room = rooms[roomId];

  if (!room) {
    res.status(400).json({ error: "Unknown room." });
    return;
  }
  if (!room.nightlyRate || room.nightlyRate <= 0) {
    res.status(400).json({ error: "Online pricing isn't set up for this room yet. Please contact us directly." });
    return;
  }
  if (!checkin || !checkout || !/^\d{4}-\d{2}-\d{2}$/.test(checkin) || !/^\d{4}-\d{2}-\d{2}$/.test(checkout)) {
    res.status(400).json({ error: "Please provide valid check-in and check-out dates." });
    return;
  }
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    res.status(400).json({ error: "Please provide a valid email address." });
    return;
  }
  if (!name || !name.trim()) {
    res.status(400).json({ error: "Please provide the name for the reservation." });
    return;
  }

  const inDate = new Date(checkin + "T00:00:00Z");
  const outDate = new Date(checkout + "T00:00:00Z");
  const nights = Math.round((outDate - inDate) / 86400000);

  if (!(nights > 0)) {
    res.status(400).json({ error: "Check-out must be after check-in." });
    return;
  }
  if (nights < room.minNights) {
    res.status(400).json({ error: `This room requires a minimum stay of ${room.minNights} night(s).` });
    return;
  }
  if (inDate < new Date(new Date().toISOString().slice(0, 10) + "T00:00:00Z")) {
    res.status(400).json({ error: "Check-in date is in the past." });
    return;
  }

  // Re-check availability server-side so a guest can't bypass the
  // Airbnb-calendar block by skipping the browser-side check.
  try {
    const busy = await getBusyRangesForRoom(room);
    const overlaps = busy.some((r) => inDate < r.end && r.start < outDate);
    if (overlaps) {
      res.status(409).json({ error: "Those dates were just booked elsewhere. Please choose different dates." });
      return;
    }
  } catch (e) {
    console.error("Availability check failed:", e);
    // Don't hard-block the booking if the calendar feed itself is down —
    // fall through and let the reservation happen; you'll still see it.
  }

  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeKey) {
    res.status(500).json({ error: "Payments aren't configured yet. Please contact us directly to book." });
    return;
  }

  const subtotalCents = Math.round(nights * room.nightlyRate * 100);
  const cleaningCents = Math.round(room.cleaningFee * 100);
  const siteUrl = process.env.SITE_URL || `https://${req.headers.host}`;
  const nightsLabel = `${nights} night${nights > 1 ? "s" : ""}`;

  const params = new URLSearchParams();
  params.append("mode", "payment");
  params.append("success_url", `${siteUrl}${SUCCESS_PATH}?session_id={CHECKOUT_SESSION_ID}`);
  params.append("cancel_url", `${siteUrl}${CANCEL_PATH}`);
  params.append("customer_email", email);
  params.append("line_items[0][quantity]", "1");
  params.append("line_items[0][price_data][currency]", "usd");
  params.append("line_items[0][price_data][unit_amount]", String(subtotalCents));
  params.append(
    "line_items[0][price_data][product_data][name]",
    `${room.name} — ${nightsLabel} (${checkin} to ${checkout})`
  );
  params.append("line_items[1][quantity]", "1");
  params.append("line_items[1][price_data][currency]", "usd");
  params.append("line_items[1][price_data][unit_amount]", String(cleaningCents));
  params.append("line_items[1][price_data][product_data][name]", "Cleaning fee");
  params.append("metadata[room]", roomId);
  params.append("metadata[checkin]", checkin);
  params.append("metadata[checkout]", checkout);
  params.append("metadata[nights]", String(nights));
  params.append("metadata[guests]", guests || "");
  params.append("metadata[guest_name]", name);

  try {
    const stripeRes = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: {
        Authorization: "Basic " + Buffer.from(stripeKey + ":").toString("base64"),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    });
    const data = await stripeRes.json();
    if (!stripeRes.ok) {
      console.error("Stripe error:", data);
      res.status(502).json({ error: (data.error && data.error.message) || "Payment provider error." });
      return;
    }
    res.status(200).json({ url: data.url });
  } catch (e) {
    console.error("Stripe request failed:", e);
    res.status(502).json({ error: "Could not reach the payment provider. Please try again." });
  }
};
