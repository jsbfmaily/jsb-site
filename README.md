# JSB Hospitality — direct booking site

A plain HTML/CSS/JS site (no build step, no npm dependencies) with two small
serverless functions for taking real payments and checking your Airbnb
calendar, so guests can book and pay you directly instead of through Airbnb.

## What's here

```
index.html            Home page — links to all three rooms
studio.html            Private Studio listing + booking widget
large-room.html         Large Room listing + booking widget (photos TBD)
small-room.html         Small Room listing + booking widget (photos TBD)
recommendations.html   Local food/beaches/breweries guide
booking-confirmed.html  Stripe redirects here after a successful payment
booking-cancelled.html  Stripe redirects here if checkout is abandoned
css/styles.css         All site styling
js/main.js             Mobile nav toggle
js/booking.js           Booking widget: dates, live pricing, checkout
config/rooms.js         Room names + nightly rates + cleaning fee (EDIT THIS)
api/availability.js      Serverless: checks a room's Airbnb calendar
api/create-checkout-session.js   Serverless: creates a Stripe payment link
lib/ical.js              Tiny iCal (.ics) file reader, no dependencies
lib/availability.js      Fetches + merges a room's calendar feed(s)
images/studio/            Your 10 uploaded Studio photos
images/qr/site-qr.svg     QR code that points at the site (see below)
scripts/generate_qr.py    Regenerates the QR code for a new URL
```

Nothing here needs `npm install` — there are zero third-party packages. The
Stripe and calendar-sync code talks to those services with plain `fetch`
calls instead of an SDK, on purpose, so the site deploys as-is.

## 1. Set your nightly rates

Open `config/rooms.js` and change `nightlyRate: 0` to a real number (in
whole dollars) for each room. Until a room has a rate greater than 0, its
booking widget automatically shows "pricing coming soon" and points people
to contact you instead — it will never let anyone book a $0 stay by
accident.

The $50 cleaning fee is already set from your listing notes; change
`cleaningFee` there too if that ever changes.

## 2. Deploy it (Vercel — free, and this is what the code assumes)

1. Create a free account at vercel.com if you don't have one.
2. Install their CLI once: `npm install -g vercel` (or use the Vercel
   website's "Import Project" flow with this folder pushed to a GitHub repo
   — either works).
3. From inside this folder, run `vercel` and follow the prompts to deploy.
   Run `vercel --prod` when you're ready to go live.
4. In the Vercel dashboard for the project: **Settings → Domains** → add
   your domain and follow their DNS instructions (usually one CNAME or A
   record at your domain registrar).
5. In **Settings → Environment Variables**, add the variables from
   `.env.example` (see steps 3 and 4 below for what goes in them), then
   redeploy so the functions pick them up.

## 3. Turn on real payments (Stripe)

1. Create a Stripe account at stripe.com if you don't have one — it's free
   to set up; Stripe takes a small percentage per transaction (their
   current pricing is on stripe.com/pricing).
2. In the Stripe dashboard, grab your **secret key** (Developers → API
   keys). Use the test key first to try a full booking with Stripe's test
   card `4242 4242 4242 4242`, then switch to the live key when you're
   ready to take real payments.
3. Add it to Vercel as `STRIPE_SECRET_KEY`.
4. Add `SITE_URL` set to your real domain (e.g. `https://staybaysine.com`,
   no trailing slash) so Stripe's redirect back to your site after payment
   goes to the right place.

Money lands directly in your Stripe account/bank — this site never touches
or stores card numbers itself.

## 4. Sync your Airbnb calendar (recommended)

This is what keeps you from getting double-booked between Airbnb and this
site.

1. In Airbnb, open a listing → **Availability** → **Export calendar** →
   copy the iCal link it gives you.
2. Paste it into the matching Vercel environment variable:
   `STUDIO_ICAL_URLS`, `LARGE_ROOM_ICAL_URLS`, or `SMALL_ROOM_ICAL_URLS`.
   If a room is listed on more than one platform, separate multiple links
   with a comma.
3. Redeploy. The booking widget now checks that feed before letting anyone
   pay for overlapping dates, and the server double-checks it again at
   checkout time so a guest can't slip through a stale page.

Until a room has a feed configured, its widget just shows a small note that
live sync isn't connected yet, and lets people request those dates anyway —
so nothing breaks if you add rooms before you've grabbed every iCal link.

**Heads up on timing:** Airbnb's exported calendar isn't instant — it can
lag by up to a few hours. For anything booked in the last hour or two on
either side, double check manually before confirming.

## 5. The QR code

`images/qr/site-qr.svg` currently points at a placeholder URL
(`https://your-domain-goes-here.com`). Once your real domain is live,
regenerate it:

```
python3 scripts/generate_qr.py "https://your-real-domain.com" images/qr/site-qr.svg
```

That overwrites the SVG used on the home page. Print it on a welcome card,
business card, or a small sign — anywhere a guest can scan it in person,
rather than relying on a link surviving Airbnb's message filters.

## 6. Add the Basement Room photos later

Drop new photos into `images/large-room/` and `images/small-room/`
(already created, currently empty), then in `large-room.html` /
`small-room.html` replace the `<div class="photos-coming-soon">…</div>`
block with a `<div class="gallery">` block like the one in `studio.html`,
pointing at your new file names.

## Limitations, so nothing here surprises you later

- **No admin dashboard.** Reservations show up in your Stripe dashboard
  (with guest name/email/dates in the payment's metadata) and as a Stripe
  email receipt to the guest — there's no separate booking calendar UI on
  your side yet. Stripe's dashboard is usable for this at first; a proper
  admin view would be a follow-up project.
- **No cancellation/refund flow.** Refunds are issued manually from the
  Stripe dashboard, matching your stated no-refund policy.
- **No confirmation email from you** beyond Stripe's payment receipt — you
  may want to follow up personally with check-in instructions, same as you
  would today.
- **Availability sync is calendar-based, not a live lock.** Two people
  could theoretically pay for overlapping dates in the same few minutes;
  the server rechecks at the moment of payment, which makes this rare, but
  it isn't impossible. Keep an eye on new bookings.
- **The iCal parser is intentionally minimal** — it reads the DTSTART/DTEND
  of each event, which is all Airbnb's export needs, but it isn't a
  full RFC 5545 implementation.

## A note on Airbnb's Terms of Service

Airbnb's ToS prohibit directing guests to book or pay off-platform once
you've been connected to them through Airbnb, and Airbnb actively filters
links and phone numbers in their messaging for that reason — which is
likely why links haven't been going through. Keeping "Instant Book" off and
requiring approval reduces accidental bookings, but sending Airbnb-sourced
guests to this site (by link, QR code, or otherwise) still carries a real
risk of listing suspension if it's reported. This isn't legal advice — just
flagging the factual risk so it's an informed call. Plenty of hosts run a
parallel direct-booking site like this one; some choose to share it only
with returning/repeat guests or people who found them outside Airbnb, to
keep that risk lower.

## Previewing locally

The static pages open fine straight from disk, but the booking widget's
`/api/*` calls need a server that runs serverless functions. The simplest
way is `vercel dev` (from the Vercel CLI) inside this folder, which runs
the whole site — pages and API — the same way production will.
