// End-to-end: "Runs near you" from the running menu · run with: npm run e2e
const test = require("node:test");
const assert = require("node:assert/strict");
const { setup, text } = require("./helpers");

let app;
test.before(async () => { app = await setup(); });
test.after(async () => { await app.close(); });

const NOVA = { latitude: 38.6795, longitude: -9.3247 };
// Train › Running opens the running menu; "Runs near you" is one of its rows
async function runningMenu(page) {
  await page.evaluate(() => { S.settings.profile = { name: "T" }; save(); screen = "home"; render(); runSheet(); });
  await page.waitForSelector('.run-menu [data-act="near"]');
}

test("the running page (Train › Running) shows Runs near you in its own section", async () => {
  const page = await app.open();
  await page.evaluate(() => { S.settings.profile = { name: "T" }; save(); SPORT = "r"; screen = "sport"; render(); });
  const sec = await page.$$eval(".spsec span", x => x.map(e => e.textContent));
  assert.ok(sec.includes("Where to run"), "section heading");
  await page.click('#app [data-act="near"]');
  await page.waitForSelector(".sheet .nearsheet .nearrow");
  assert.match(await text(page, ".sheet h3"), /Runs near you/);
  assert.deepEqual(await page.done(), []);
});

test("the running menu opens Runs near you: the closest routes, each with the way there and a start button", async () => {
  const page = await app.open({ context: { geolocation: NOVA, permissions: ["geolocation"] } });
  await runningMenu(page);
  await page.click('[data-act="near"]');
  await page.waitForSelector(".sheet .nearrow");
  const routes = await page.$$eval(".sheet .nearrow b", b => b.map(x => x.textContent));
  assert.ok(routes.length >= 1 && routes.length <= 4, "1 to 4 routes");
  assert.equal(routes[0], "Carcavelos seafront", "closest first");
  assert.equal(await page.$(".loopc, .nearmap, [data-act=nearloop]"), null, "no loop from here any more");
  // a route opens to show the way there and a start button; tapping again closes it
  await page.click('.nearrow[data-id="carcavelos"]');
  assert.equal(await page.getAttribute('.nearrow[data-id="carcavelos"]', "aria-expanded"), "true");
  assert.match(await page.$eval(".nearpanel a", a => a.href), /^https:\/\/www\.google\.com\/maps\/dir\//);
  await page.click('.nearrow[data-id="carcavelos"]');
  assert.equal(await page.$(".nearpanel"), null);
  await page.click('.nearrow[data-id="carcavelos"]');
  await page.click('.nearpanel [data-act="nearstart"]');
  await page.waitForFunction(() => !document.querySelector(".sheet"));
  assert.deepEqual(await page.evaluate(() => [S.active.run.km, S.active.run.note]), ["5", "Route: Carcavelos seafront"]);
  assert.deepEqual(await page.done(), []);
});

test("in German nothing in the sheet stays English (names marked translate=no aside)", async () => {
  const page = await app.open({ context: { geolocation: NOVA, permissions: ["geolocation"] } });
  // every text in the sheet, with a route opened
  const texts = async () => {
    await runningMenu(page);
    await page.click('[data-act="near"]');
    await page.click('.nearrow[data-id="carcavelos"]');
    await page.waitForSelector(".nearpanel");
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
