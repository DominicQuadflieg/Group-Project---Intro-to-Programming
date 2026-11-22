// End-to-end: "Runs near you" from the running menu · run with: npm run e2e
const test = require("node:test");
const assert = require("node:assert/strict");
const { setup, text } = require("./helpers");

let app;
test.before(async () => { app = await setup(); });
test.after(async () => { await app.close(); });

const NOVA = { latitude: 38.6795, longitude: -9.3247 };
// The route function answers like openrouteservice would: a closed loop of about the asked length
async function fakeRoutes(page, mode = "ok") {
  await page.route("**/.netlify/functions/route", r => {
    if (r.request().method() === "GET") return mode === "off" ? r.fulfill({ status: 503, json: { error: "not_configured" } }) : r.fulfill({ json: { ok: true } });
    const q = r.request().postDataJSON(), c = [];
    for (let i = 0; i <= 40; i++) { const a = i / 40 * 2 * Math.PI; c.push([q.lon + 0.008 * Math.sin(a), q.lat + 0.006 * (1 - Math.cos(a))]); }
    return r.fulfill({ json: { km: q.km, coords: c } });
  });
}
// Train › Running opens the running menu; "Runs near you" is one of its rows
async function runningMenu(page) {
  await page.evaluate(() => { S.settings.profile = { name: "T" }; save(); screen = "home"; render(); runSheet(); });
  await page.waitForSelector('.run-menu [data-act="near"]');
}

test("the running menu opens Runs near you: nearby routes first, then a loop from here", async () => {
  const page = await app.open({ context: { geolocation: NOVA, permissions: ["geolocation"] } });
  await fakeRoutes(page);
  await runningMenu(page);
  await page.click('[data-act="near"]');
  await page.waitForSelector(".sheet .loopc");
  const routes = await page.$$eval(".sheet .nearc:not(.loopc) b", b => b.map(x => x.textContent));
  assert.ok(routes.length >= 1 && routes.length <= 4, "1 to 4 routes");
  assert.equal(routes[0], "Carcavelos seafront", "closest first");
  await page.click('.loopc [data-act="nearkm"][data-k="5"]');
  await page.click('.loopc [data-act="nearloop"]:not([data-seed])');
  await page.waitForSelector(".nearmap path");
  assert.match(await text(page, ".loopc"), /5 km loop from where you are/);
  assert.match(await page.$eval('.loopc a', a => a.href), /^https:\/\/www\.google\.com\/maps\/dir\//);
  await page.click('.loopc [data-act="nearstart"]');
  await page.waitForFunction(() => !document.querySelector(".sheet"));
  assert.deepEqual(await page.evaluate(() => [S.active.run.km, S.active.run.note]), ["5", "Route: 5 km loop"]);
  assert.deepEqual(await page.done(), []);
});

test("without the route key the routes still work and the loop says it needs setting up", async () => {
  const page = await app.open();
  await fakeRoutes(page, "off");
  await runningMenu(page);
  await page.click('[data-act="near"]');
  await page.waitForFunction(() => /one-time setup/.test((document.querySelector(".loopc") || {}).textContent || ""));
  assert.ok(await page.$$eval(".sheet .nearc:not(.loopc)", x => x.length) >= 1);
  assert.equal(await page.$('.loopc [data-act="nearloop"]'), null, "no loop button without the key");
  assert.deepEqual(await page.done(), []);
});

test("in German nothing in the sheet stays English (names marked translate=no aside)", async () => {
  const page = await app.open({ context: { geolocation: NOVA, permissions: ["geolocation"] } });
  await fakeRoutes(page);
  // every text in the sheet, with a loop drawn
  const texts = async () => {
    await runningMenu(page);
    await page.click('[data-act="near"]');
    await page.click('.loopc [data-act="nearloop"]:not([data-seed])');
    await page.waitForSelector(".nearmap path");
    return page.evaluate(() => { const out = [], w = document.createTreeWalker(document.querySelector("#layer"), NodeFilter.SHOW_TEXT); let n;
      while ((n = w.nextNode())) { const t = n.nodeValue.replace(/\s+/g, " ").trim();
        if (t && /[a-z]{3}/i.test(t) && !n.parentElement.closest("[translate=no]")) out.push(t); } return out; });
  };
  const english = new Set(await texts());
  // like choosing Deutsch in the menu: save the language and start fresh
  await page.evaluate(() => { S.settings.lang = "de"; save(); location.reload(); });
  await page.waitForFunction(() => typeof NFI18N !== "undefined" && NFI18N.getLang() === "de");
  const german = await texts();
  // left in English = the same text in both, unless it is the same word in every language (a place name)
  const left = await page.evaluate(l => l.filter(t => NFI18N.lookup(t) !== t), german.filter(t => english.has(t)));
  assert.deepEqual(left, []);
  assert.match(await text(page, ".sheet h3"), /Läufe in deiner Nähe/);
  assert.deepEqual(await page.done(), []);
});
