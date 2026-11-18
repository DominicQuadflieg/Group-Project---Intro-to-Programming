// End-to-end: logging strength, runs and yoga · run with: npm run e2e
const test = require("node:test");
const assert = require("node:assert/strict");
const { setup, signedIn, text, fixture } = require("./helpers");

let app;
test.before(async () => { app = await setup(); });
test.after(async () => { await app.close(); });

test("strength: an empty session can't be saved, a logged set can", async () => {
  const page = await app.open();
  await signedIn(page);
  const t = await page.evaluate(() => startKeys()[0]);
  await page.evaluate(t => startSession(t), t);
  await page.waitForSelector('[data-act="finish"]');

  // finishing with nothing logged: the app says so and keeps the session
  await page.evaluate(() => { Object.values(S.active.sets).forEach(a => a.forEach(s => { s.r = ""; s.kg = ""; s.ok = false; })); renderSession(); });
  await page.click('[data-act="finish"] >> nth=0');
  await page.waitForSelector(".sheet");
  assert.match(await text(page, ".sheet"), /Nothing logged yet/);
  await page.click('.sheet [data-act="closesheet"]');

  // log the first set of the first exercise and finish
  const first = await page.$('input[data-in="set"][data-f="r"]');
  const ex = await first.getAttribute("data-ex");
  await first.fill("10");
  await page.fill(`input[data-in="set"][data-f="kg"][data-ex="${ex}"][data-i="0"]`, "40");
  // typing a value ticks the set off by itself
  assert.equal(await page.evaluate(ex => S.active.sets[ex][0].ok, ex), true);
  await page.click('[data-act="finish"] >> nth=0');
  const ok = await page.$('.sheet [data-act="finishok"]');
  if (ok) await ok.click();                                   // "save checked sets only"
  await page.waitForFunction(() => screen === "summary");
  const saved = await page.evaluate(ex => S.history[S.history.length - 1].sets[ex], ex);
  assert.deepEqual(saved, [{ r: 10, kg: 40 }]);
  assert.deepEqual(await page.done(), []);
});

test("run: no time means no save; a valid run shows the pace and is saved", async () => {
  const page = await app.open();
  await signedIn(page);
  await page.evaluate(() => startSession("lauf", "out"));
  await page.waitForSelector("#run-min");
  await page.fill("#run-km", "5");
  await page.click('[data-act="finish"] >> nth=0');
  await page.waitForSelector(".toast");
  assert.match(await text(page, ".toast"), /Enter your time/);
  assert.equal(await page.evaluate(() => S.history.length), 0);

  await page.fill("#run-min", "2730");                       // typed digits become 27:30
  assert.equal(await page.inputValue("#run-min"), "27:30");
  assert.match(await text(page, "#runinfo"), /5:30 \/km/);
  await page.click('[data-act="finish"] >> nth=0');
  await page.waitForFunction(() => S.history.length === 1);
  const r = await page.evaluate(() => S.history[0].run);
  assert.equal(r.km, 5);
  assert.equal(r.min, 27.5);
  assert.deepEqual(await page.done(), []);
});

test("run from a watch file: a wrong file gets a clear message, a GPX file fills in the run", async () => {
  const page = await app.open();
  await signedIn(page);
  await page.evaluate(() => startSession("lauf", "out"));
  await page.setInputFiles("#runfile", fixture("notes.txt"));
  await page.waitForSelector('.sheet h3:has-text("Couldn\'t import")');
  assert.match(await text(page, ".sheet"), /GPX, TCX and FIT/);
  await page.click('.sheet [data-act="closesheet"]');

  await page.setInputFiles("#runfile", fixture("run.gpx"));
  await page.waitForSelector('[data-act="shotuse"]');
  assert.equal(await page.inputValue("#sh-km"), "5");
  // a time that can't be right is refused next to the field
  await page.fill("#sh-time", "25:99");
  await page.click('[data-act="shotuse"]');
  assert.match(await text(page, ".sheet"), /up to 59/);
  await page.fill("#sh-time", "25:00");
  await page.click('[data-act="shotuse"]');
  await page.waitForFunction(() => !document.querySelector(".sheet"));
  assert.deepEqual(await page.evaluate(() => [S.active.run.km, S.active.run.min]), ["5", "25:00"]);
  assert.deepEqual(await page.done(), []);
});

test("yoga: the flexibility check saves a level and shows it on the Progress tab", async () => {
  const page = await app.open({ clock: new Date(2026, 10, 18, 15, 0) });
  await signedIn(page);
  await page.evaluate(() => yogaSheet());
  await page.click('.sheet [data-act="flexcheck"]');
  await page.click('[data-act="flexpick"][data-v="3"]');
  assert.match(await text(page, ".sheet h3"), /starting point: Ankles/);
  await page.click('.sheet [data-act="closesheet"]');
  await page.evaluate(() => { TAB = "progress"; render(); });
  assert.match(await text(page, 'section:has(h2:has-text("Flexibility"))'), /Ankles/);
  assert.deepEqual(await page.done(), []);
});
