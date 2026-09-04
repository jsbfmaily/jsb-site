// Minimal local dev server that mimics Vercel's routing well enough to
// smoke-test the site: static files from the project root, and any
// /api/<name> request dispatched to api/<name>.js's exported handler,
// with req.query/req.body populated the way Vercel's Node runtime does.
// Not meant for production — just for local verification.
const http = require("http");
const fs = require("fs");
const path = require("path");
const { URL } = require("url");

const ROOT = path.join(__dirname, "..");
const PORT = process.env.PORT || 4173;

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".png": "image/png",
  ".json": "application/json",
};

function send(res, status, body, headers) {
  res.writeHead(status, headers || {});
  res.end(body);
}

async function handleApi(name, req, res, url) {
  const modPath = path.join(ROOT, "api", name + ".js");
  if (!fs.existsSync(modPath)) {
    send(res, 404, JSON.stringify({ error: "not found" }), { "Content-Type": "application/json" });
    return;
  }
  delete require.cache[require.resolve(modPath)];
  const handler = require(modPath);

  req.query = {};
  url.searchParams.forEach((v, k) => { req.query[k] = v; });

  if (req.method === "POST") {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const raw = Buffer.concat(chunks).toString("utf8");
    try {
      req.body = raw ? JSON.parse(raw) : {};
    } catch (e) {
      req.body = raw;
    }
  }

  const shimRes = {
    statusCode: 200,
    status(c) { this.statusCode = c; return this; },
    setHeader(k, v) { res.setHeader(k, v); },
    json(obj) {
      res.writeHead(this.statusCode, { "Content-Type": "application/json" });
      res.end(JSON.stringify(obj));
    },
  };

  try {
    await handler(req, shimRes);
  } catch (e) {
    console.error("API handler error:", e);
    send(res, 500, JSON.stringify({ error: "internal error" }), { "Content-Type": "application/json" });
  }
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost");
  if (url.pathname.startsWith("/api/")) {
    await handleApi(url.pathname.slice(5), req, res, url);
    return;
  }

  let filePath = path.join(ROOT, decodeURIComponent(url.pathname));
  if (url.pathname === "/") filePath = path.join(ROOT, "index.html");
  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    send(res, 404, "Not found");
    return;
  }
  const ext = path.extname(filePath);
  const body = fs.readFileSync(filePath);
  send(res, 200, body, { "Content-Type": MIME[ext] || "application/octet-stream" });
});

server.listen(PORT, () => console.log("dev server listening on " + PORT));
