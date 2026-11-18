// Shared setup for the end-to-end tests: the real app in a real browser.
//  - serves app/ like Netlify would, with the headers from netlify.toml (so the Content-Security-Policy is tested too)
//  - blocks the internet: weather, push and the CDN are not needed for these tests
//  - every test fails on a page error or a CSP violation
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");

const ROOT = path.join(__dirname, "..", "app");
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".json": "application/json", ".css": "text/css", ".svg": "image/svg+xml",
  ".png": "image/png", ".jpg": "image/jpeg", ".webmanifest": "application/manifest+json", ".txt": "text/plain" };

// The headers for "/*" from netlify.toml (simple reader for our own file: Key = "value" lines)
function siteHeaders() {
  const toml = fs.readFileSync(path.join(__dirname, "..", "netlify.toml"), "utf8");
  const block = toml.split("[[headers]]").find(b => /for\s*=\s*"\/\*"/.test(b)) || "";
  const out = {};
  for (const m of block.matchAll(/^\s*([A-Za-z-]+)\s*=\s*"(.*)"\s*$/gm)) if (m[1] !== "for") out[m[1]] = m[2];
  return out;
}

function startServer() {
  const headers = siteHeaders();
  const server = http.createServer((req, res) => {
    const url = decodeURIComponent(req.url.split("?")[0]);
    const file = path.join(ROOT, url === "/" ? "index.html" : url);
    if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404, headers); return res.end("not found"); }
    res.writeHead(200, Object.assign({ "Content-Type": TYPES[path.extname(file)] || "application/octet-stream" }, headers));
    fs.createReadStream(file).pipe(res);
  });
  return new Promise(r => server.listen(0, "127.0.0.1", () => r({ server, url: `http://127.0.0.1:${server.address().port}`, headers })));
}

/* One browser for the file, a fresh phone-sized page per test. */
async function setup() {
  const srv = await startServer();
  const browser = await chromium.launch();
  const open = async (opts = {}) => {
    const ctx = await browser.newContext(Object.assign({ viewport: { width: 390, height: 844 }, serviceWorkers: "block" }, opts.context || {}));
    const problems = [];
    await ctx.addInitScript(() => document.addEventListener("securitypolicyviolation", e => console.error("CSP " + e.violatedDirective + " " + e.blockedURI)));
    await ctx.route(url => !url.href.startsWith(srv.url), r => r.abort());   // offline except our own site
    const page = await ctx.newPage();
    page.on("pageerror", e => problems.push("page error: " + e.message));
    page.on("console", m => { if (m.type() === "error" && /^CSP /.test(m.text())) problems.push(m.text()); });
    if (opts.clock) await page.clock.install({ time: opts.clock });
    await page.goto(srv.url + "/index.html");
    page.problems = problems;
    page.done = async () => { await ctx.close(); return problems; };
    return page;
  };
  const close = async () => { await browser.close(); srv.server.close(); };
  return { open, close, url: srv.url, headers: srv.headers };
}

/* A user who already signed up, so a test can start on the home screen. */
async function signedIn(page, extra) {
  await page.evaluate(x => {
    S.settings.profile = { name: "Test Runner", email: "test@novasbe.pt" };
    const a = defaultAnswers(); a.days = 4; a.goals = ["run10k"]; a.mix = { s: 2, r: 1, y: 1 }; S.settings.answers = a;
    S.settings.plan = Object.assign({ chosen: Date.now() }, NFPlan.suggestPlans(a)[0]);
    Object.assign(S.settings, x || {});
    save(); screen = "home"; render();
  }, extra || null);
}

const text = (page, sel) => page.$eval(sel, e => e.innerText.replace(/\s+/g, " ").trim());
const fixture = name => path.join(__dirname, "fixtures", name);

module.exports = { setup, signedIn, text, fixture };
