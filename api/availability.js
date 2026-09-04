const rooms = require("../config/rooms.js");
const { getBusyRangesForRoom } = require("../lib/availability.js");

/**
 * GET /api/availability?room=studio
 * Returns { busy: [{start:"YYYY-MM-DD", end:"YYYY-MM-DD"}], synced: bool }
 * "synced": false means no iCal feed is configured for this room yet,
 * so the front end shouldn't claim dates are verified against Airbnb.
 */
module.exports = async (req, res) => {
  if (req.method !== "GET") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const roomId = req.query && req.query.room;
  const room = rooms[roomId];
  if (!room) {
    res.status(400).json({ error: "Unknown room." });
    return;
  }

  const envKey = room.id.toUpperCase().replace(/-/g, "_") + "_ICAL_URLS";
  const synced = Boolean(process.env[envKey]);

  const busy = await getBusyRangesForRoom(room);

  res.setHeader("Cache-Control", "s-maxage=900, stale-while-revalidate=300");
  res.status(200).json({
    synced,
    busy: busy.map((r) => ({
      start: r.start.toISOString().slice(0, 10),
      end: r.end.toISOString().slice(0, 10),
    })),
  });
};
