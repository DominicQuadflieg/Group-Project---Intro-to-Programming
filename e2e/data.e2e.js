// End-to-end: bringing data in (training history, backups) · run with: npm run e2e
const test = require("node:test");
const assert = require("node:assert/strict");
const { setup, signedIn, text, fixture } = require("./helpers");

let app;
test.before(async () => { app = await setup(); });
test.after(async () => { await app.close(); });

test("training history: a wrong CSV is refused, a Garmin list shows a preview and nothing comes in twice", async () => {
  const page = await app.open({ clock: new Date(2026, 10, 18, 12, 0) });
  await signedIn(page);
  await page.evaluate(() => impSheet());
  await page.setInputFiles(".sheet .histin >> nth=0", fixture("not-activities.csv"));
  await page.waitForSelector('.sheet h3:has-text("Couldn\'t import")');
  assert.match(await text(page, ".sheet"), /doesn't look like an activity list/);
  assert.equal(await page.evaluate(() => S.history.length), 0);

  await page.click('.sheet [data-act="histback"]');
  await page.setInputFiles(".sheet .histin >> nth=0", fixture("garmin-activities.csv"));
  await page.waitForSelector('[data-act="histadd"]');
  assert.match(await text(page, ".sheet .hsum"), /^2 runs/);              // this year, without the walk
  assert.match(await text(page, ".sheet .hskip"), /ride or other sport left out/);
  await page.click('[data-act="histadd"]');
  await page.waitForFunction(() => S.history.length === 2);

  await page.evaluate(() => { closeSheet(); impSheet(); });
  await page.setInputFiles(".sheet .histin >> nth=0", fixture("garmin-activities.csv"));
  await page.waitForSelector('[data-act="histadd"]');
  assert.match(await text(page, ".sheet .hsum"), /^0 runs/);
  assert.equal(await page.$eval('[data-act="histadd"]', b => b.disabled), true);
  assert.deepEqual(await page.done(), []);
});

test("backup: a broken file is refused and changes nothing", async () => {
  const page = await app.open();
  await signedIn(page);
  await page.evaluate(() => settingsSheet());
  await page.setInputFiles("#importf", fixture("broken-backup.json"));
  await page.waitForSelector(".toast");
  assert.match(await text(page, ".toast"), /not a valid backup/);
  assert.equal(await page.evaluate(() => S.history.length), 0);
  assert.deepEqual(await page.done(), []);
});

test("backup: markup in a changed file is shown as text, never run", async () => {
  const page = await app.open();
  await signedIn(page);
  await page.evaluate(() => settingsSheet());
  await page.setInputFiles("#importf", fixture("changed-backup.json"));
  await page.waitForFunction(() => S.history.length === 1);
  for (const tab of ["today", "train", "progress"]) {
    await page.evaluate(t => { TAB = t; screen = "home"; render(); }, tab);
    const hit = await page.evaluate(() => ({ ran: !!window.__pwn, img: document.querySelectorAll('img[src="x"]').length, tag: !!document.getElementById("inj") }));
    assert.deepEqual(hit, { ran: false, img: 0, tag: false }, tab);
  }
  assert.equal(await page.evaluate(() => S.settings.custom[0].n.includes("<")), false);
  assert.deepEqual(await page.done(), []);
});
