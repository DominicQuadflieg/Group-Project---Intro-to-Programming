// End-to-end: signing out of NOVAFit · run with: npm run e2e
const test = require("node:test");
const assert = require("node:assert/strict");
const { setup, text } = require("./helpers");

let app;
test.before(async () => { app = await setup(); });
test.after(async () => { await app.close(); });

// A real account with a password, one run, a Strava login, a photo and a key from another site
async function accountWithData(page) {
  await page.click('[data-to="signup"]');
  await page.fill("#ob-name", "Tassilo");
  await page.fill("#ob-email", "tassilo@novasbe.pt");
  await page.fill("#ob-pw", "secret123");
  await page.click('#ob-form button[type="submit"]');
  await page.waitForFunction(() => typeof OB !== "undefined" && OB.step === "body");
  await page.evaluate(async () => {
    const a = defaultAnswers(); a.days = 3; a.goals = ["run10k"]; a.mix = { s: 2, r: 1, y: 0 }; S.settings.answers = a;
    S.settings.plan = Object.assign({ chosen: Date.now() }, NFPlan.suggestPlans(a)[0]);
    S.history.push({ id: "s1", type: "lauf", start: Date.now() - 864e5, end: Date.now() - 864e5 + 1800e3, run: { mode: "out", km: 5, min: 30, note: "" } });
    save(); screen = "home"; render();
    localStorage.setItem("novafit-strava", JSON.stringify({ access: "a".repeat(40), refresh: "b".repeat(40), expires: 0 }));
    localStorage.setItem("other-site", "keep me");
    await new Promise(res => { const r = indexedDB.open("workout-photos", 1); r.onupgradeneeded = () => r.result.createObjectStore("p", { keyPath: "id" });
      r.onsuccess = () => { const tx = r.result.transaction("p", "readwrite"); tx.objectStore("p").put({ id: "x1", blob: "photo" }); tx.oncomplete = () => { r.result.close(); res(); }; }; });
  });
}
const photos = page => page.evaluate(() => new Promise(res => { const r = indexedDB.open("workout-photos"); r.onsuccess = () => {
  const db = r.result; if (!db.objectStoreNames.contains("p")) { db.close(); return res(0); }
  const q = db.transaction("p").objectStore("p").count(); q.onsuccess = () => { db.close(); res(q.result); }; }; }));

test("sign out asks for the password: empty and wrong are refused, nothing is removed", async () => {
  const page = await app.open();
  await accountWithData(page);
  await page.evaluate(() => settingsSheet("account"));
  await page.click('[data-act="signout"]');
  assert.match(await text(page, ".sheet h3"), /Sign out of NOVAFit/);
  await page.click('#so-form [type="submit"]');
  assert.equal(await text(page, "#so-pw-err"), "Enter your password");
  await page.fill("#so-pw", "wrongpass1");
  await page.click('#so-form [type="submit"]');
  await page.waitForFunction(() => /isn't right/.test(document.querySelector("#so-pw-err").textContent));
  assert.equal(await page.getAttribute("#so-pw", "aria-invalid"), "true");
  assert.equal(await page.evaluate(() => S.history.length), 1);
  assert.equal(await photos(page), 1);
  assert.deepEqual(await page.done(), []);
});

test("only lock the app: everything stays, the password brings it back", async () => {
  const page = await app.open();
  await accountWithData(page);
  await page.evaluate(() => settingsSheet("account"));
  await page.click('[data-act="signout"]');
  await page.click('.sheet [data-do="lock"]');
  await page.waitForSelector('#ob-form[data-form="login"]');
  assert.equal(await page.evaluate(() => S.history.length), 1);
  assert.deepEqual(await page.done(), []);
});

test("sign out with the right password removes everything of NOVAFit from this phone", async () => {
  const page = await app.open();
  await accountWithData(page);
  await page.evaluate(() => settingsSheet("account"));
  await page.click('[data-act="signout"]');
  await page.fill("#so-pw", "secret123");
  await Promise.all([page.waitForURL(/index\.html$/), page.click('#so-form [type="submit"]')]);
  await page.waitForSelector('[data-to="signup"]');                       // welcome screen
  await page.waitForSelector(".toast");
  assert.match(await text(page, ".toast"), /Signed out/);
  const left = await page.evaluate(() => ({ keys: Object.keys(localStorage).sort(), profile: !!S.settings.profile, runs: S.history.length,
    stored: JSON.parse(localStorage.getItem("po-plan-app-v2") || "null") }));
  assert.equal(left.profile, false);
  assert.equal(left.runs, 0);
  assert.ok(!left.keys.includes("novafit-strava"), "Strava login removed");
  assert.ok(left.keys.includes("other-site"), "other sites' data is left alone");
  assert.ok(!left.stored || !left.stored.settings.profile, "no account left in storage");
  assert.ok(!JSON.stringify(left.stored || {}).includes("tassilo@novasbe.pt"));
  assert.equal(await photos(page), 0, "photos removed");
  assert.deepEqual(await page.done(), []);
});
