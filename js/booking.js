// Booking widget: date selection, live-availability check against the
// Airbnb calendar (via /api/availability), price calculation, and
// kicking off Stripe Checkout (via /api/create-checkout-session).
(function () {
  function $(sel, ctx) {
    return (ctx || document).querySelector(sel);
  }

  function fmtMoney(n) {
    return "$" + n.toFixed(2).replace(/\.00$/, "");
  }

  function toISODate(d) {
    return d.toISOString().slice(0, 10);
  }

  function parseISODate(s) {
    var parts = s.split("-").map(Number);
    return new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]));
  }

  function nightsBetween(inDate, outDate) {
    return Math.round((outDate - inDate) / 86400000);
  }

  function rangesOverlap(aStart, aEnd, bStart, bEnd) {
    return aStart < bEnd && bStart < aEnd;
  }

  document.querySelectorAll(".booking-card[data-room-id]").forEach(function (card) {
    var roomId = card.getAttribute("data-room-id");
    var room = window.JSB_ROOMS && window.JSB_ROOMS[roomId];
    if (!room) return;

    var checkin = $(".js-checkin", card);
    var checkout = $(".js-checkout", card);
    var guestsEl = $(".js-guests", card);
    var emailEl = $(".js-email", card);
    var nameEl = $(".js-name", card);
    var payBtn = $(".js-pay-btn", card);
    var statusEl = $(".js-booking-status", card);
    var subtotalEl = $(".js-subtotal", card);
    var cleaningEl = $(".js-cleaning-fee", card);
    var totalEl = $(".js-total", card);
    var nightsEl = $(".js-nights-count", card);

    var today = new Date();
    var todayUTC = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()));
    var todayISO = toISODate(todayUTC);
    if (checkin) checkin.min = todayISO;
    if (checkout) checkout.min = todayISO;
    if (cleaningEl) cleaningEl.textContent = fmtMoney(room.cleaningFee);

    function setStatus(msg, kind) {
      if (!statusEl) return;
      statusEl.textContent = msg || "";
      statusEl.className = "booking-status" + (kind ? " " + kind : "");
    }

    // Pricing not set yet: keep the widget informative, point people to
    // contact you directly instead of pretending a $0 room is bookable.
    if (!room.nightlyRate || room.nightlyRate <= 0) {
      setStatus("Online pricing for this room is coming soon — contact us directly to book.", "");
      [checkin, checkout, guestsEl, emailEl, nameEl].forEach(function (el) {
        if (el) el.disabled = true;
      });
      if (payBtn) {
        payBtn.textContent = "Contact us to book";
        payBtn.addEventListener("click", function (e) {
          e.preventDefault();
          window.location.href =
            "mailto:?subject=" + encodeURIComponent("Booking request: " + room.name);
        });
      }
      return;
    }

    var busyRanges = [];
    var availabilitySynced = false;

    fetch("/api/availability?room=" + encodeURIComponent(roomId))
      .then(function (res) {
        return res.ok ? res.json() : { busy: [], synced: false };
      })
      .then(function (data) {
        busyRanges = (data.busy || []).map(function (r) {
          return { start: parseISODate(r.start), end: parseISODate(r.end) };
        });
        availabilitySynced = Boolean(data.synced);
        if (!availabilitySynced) {
          setStatus("Note: live Airbnb calendar sync isn't connected yet for this room — double-check availability before paying.", "");
        }
      })
      .catch(function () {
        setStatus("Couldn't reach the availability check right now — you can still request to book.", "");
      });

    function updateSummary() {
      if (!checkin.value || !checkout.value) {
        subtotalEl.textContent = "—";
        totalEl.textContent = "—";
        nightsEl.textContent = "0";
        return null;
      }

      var inD = parseISODate(checkin.value);
      var outD = parseISODate(checkout.value);
      var nights = nightsBetween(inD, outD);

      if (nights <= 0) {
        setStatus("Check-out must be after check-in.", "error");
        subtotalEl.textContent = "—";
        totalEl.textContent = "—";
        nightsEl.textContent = "0";
        return null;
      }

      if (nights < room.minNights) {
        setStatus("This room requires a minimum stay of " + room.minNights + " night(s).", "error");
        subtotalEl.textContent = "—";
        totalEl.textContent = "—";
        nightsEl.textContent = String(nights);
        return null;
      }

      var overlap = busyRanges.some(function (r) {
        return rangesOverlap(inD, outD, r.start, r.end);
      });
      if (overlap) {
        setStatus("Those dates overlap a stay already on our Airbnb calendar. Please choose different dates.", "error");
        subtotalEl.textContent = "—";
        totalEl.textContent = "—";
        nightsEl.textContent = String(nights);
        return null;
      }

      setStatus(availabilitySynced ? "" : statusEl.textContent, availabilitySynced ? "" : "");

      var subtotal = nights * room.nightlyRate;
      var total = subtotal + room.cleaningFee;
      nightsEl.textContent = String(nights);
      subtotalEl.textContent = fmtMoney(subtotal);
      totalEl.textContent = fmtMoney(total);
      return { inD: inD, outD: outD, nights: nights, subtotal: subtotal, total: total };
    }

    [checkin, checkout].forEach(function (el) {
      if (!el) return;
      el.addEventListener("change", function () {
        if (checkin.value) {
          var minOut = parseISODate(checkin.value);
          minOut.setUTCDate(minOut.getUTCDate() + 1);
          checkout.min = toISODate(minOut);
          if (checkout.value && checkout.value <= checkin.value) {
            checkout.value = toISODate(minOut);
          }
        }
        updateSummary();
      });
    });

    if (payBtn) {
      payBtn.addEventListener("click", function (e) {
        e.preventDefault();
        var calc = updateSummary();
        if (!calc) return;
        if (!nameEl.value.trim() || !emailEl.value.trim()) {
          setStatus("Please enter your name and email so we can send your confirmation.", "error");
          return;
        }

        payBtn.disabled = true;
        var originalLabel = payBtn.textContent;
        payBtn.textContent = "Redirecting to secure payment…";
        setStatus("");

        fetch("/api/create-checkout-session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            room: roomId,
            checkin: checkin.value,
            checkout: checkout.value,
            guests: guestsEl ? guestsEl.value : "",
            name: nameEl.value.trim(),
            email: emailEl.value.trim(),
          }),
        })
          .then(function (res) {
            return res.json().then(function (data) {
              return { ok: res.ok, data: data };
            });
          })
          .then(function (result) {
            if (!result.ok || !result.data.url) {
              throw new Error((result.data && result.data.error) || "Could not start checkout.");
            }
            window.location.href = result.data.url;
          })
          .catch(function (err) {
            setStatus(err.message || "Something went wrong. Please try again or contact us directly.", "error");
            payBtn.disabled = false;
            payBtn.textContent = originalLabel;
          });
      });
    }
  });
})();
