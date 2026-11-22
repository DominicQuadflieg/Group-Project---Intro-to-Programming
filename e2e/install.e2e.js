// End-to-end: iPhone install step before sign-up, and moving the data from Safari to the Home Screen app
const test = require("node:test");
const assert = require("node:assert/strict");
const { setup, signedIn } = require("./helpers");

let app;
test.before(async () => { app = await setup(); });
test.after(async () => { await app.close(); });

const fakeClipboard = page => page.evaluate(() => {
  Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: async t => { window.__clip = t; }, readText: async () => window.__clip || "" } });
});

test("in Safari on an iPhone, Create account first shows how to add NOVAFit to the Home Screen", async () => {
  const page = await app.open();
  await page.evaluate(() => { iosSafari = () => true; OB.step = "welcome"; screen = "onboard"; render(); });
  await page.click("[data-act=installfirst]");
  await page.waitForSelector(".sheet .instep");
  await page.click("[data-act=installskip]");
  await page.waitForSelector("#ob-form");
  assert.deepEqual(await page.done(), []);
});

test("Copy my data in Safari, Paste from Safari in the app: account and sessions come along", async () => {
  const page = await app.open();
  await fakeClipboard(page);
  await signedIn(page);
  await page.evaluate(() => { S.history.push({ id: "m1", type: "lauf", start: Date.now() - 864e5, end: Date.now() - 864e5 + 3e6, sets: {}, run: { km: "6.2", min: "36", mode: "out" } }); save(); });
  // the button on the Today hint
  await page.evaluate(() => { const b = document.createElement("button"); b.dataset.act = "copydata"; document.getElementById("app").appendChild(b); b.click(); });
  await page.waitForFunction(() => (window.__clip || "").startsWith("NOVAFIT-DATA:"));
  // a fresh app on the same phone
  await page.evaluate(() => { const c = window.__clip; localStorage.clear(); window.__clip = c; S = normalize({}); OB.step = "restore"; screen = "onboard"; render(); });
  await page.click("[data-act=pastedata]");
  await page.waitForFunction(() => screen === "home");
  assert.deepEqual(await page.evaluate(() => [S.settings.profile.email, S.history.length]), ["test@novasbe.pt", 1]);
  // something else in the clipboard is not loaded
  await page.evaluate(() => { window.__clip = "hello"; OB.step = "restore"; screen = "onboard"; render(); });
  await page.click("[data-act=pastedata]");
  assert.equal(await page.evaluate(() => S.history.length), 1);
  assert.deepEqual(await page.done(), []);
});
