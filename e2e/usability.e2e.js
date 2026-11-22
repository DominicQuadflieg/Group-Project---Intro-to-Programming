// End-to-end: impossible numbers are refused, and deleting or replacing things can be undone · run with: npm run e2e
const test = require("node:test");
const assert = require("node:assert/strict");
const { setup, signedIn, text } = require("./helpers");

let app;
test.before(async () => { app = await setup(); });
test.after(async () => { await app.close(); });

const typeRun = (page, km, min) => page.evaluate(([km, min]) => {
  for (const [f, v] of [["km", km], ["min", min]]) { const i = document.querySelector(`[data-in=run][data-f=${f}]`); i.value = v; i.dispatchEvent(new Event("input", { bubbles: true })); }
}, [km, min]);

test("run: 100 km in 30 minutes is refused with a message, a real run is saved", async () => {
  const page = await app.open();
  await signedIn(page);
  await page.evaluate(() => startSession("lauf", "out"));
  await typeRun(page, "100", "3000");
  await page.click('[data-act="finish"] >> nth=0');
  assert.match(await text(page, "#run-err"), /world record/);
  assert.equal(await page.$eval("#run-km", i => i.getAttribute("aria-invalid")), "true");
  assert.equal(await page.evaluate(() => S.history.length), 0);
  assert.equal(await page.evaluate(() => Object.keys(S.badges || {}).length), 0);

  await typeRun(page, "5", "2800");
  assert.equal(await text(page, "#run-err"), "", "the message goes away once the numbers fit");
  await page.click('[data-act="finish"] >> nth=0');
  await page.waitForFunction(() => S.history.length === 1);
  assert.deepEqual(await page.evaluate(() => ({ km: S.history[0].run.km, min: S.history[0].run.min })), { km: 5, min: 28 });
  assert.deepEqual(await page.done(), []);
});

test("treadmill and yoga: an incline of 80 % and 600 minutes are refused", async () => {
  const page = await app.open();
  await signedIn(page);
  await page.evaluate(() => startSession("lauf", "band"));
  await typeRun(page, "5", "3000");
  await page.fill("#run-inc", "80");
  await page.click('[data-act="finish"] >> nth=0');
  assert.match(await text(page, "#run-err"), /Incline/);
  assert.equal(await page.evaluate(() => S.history.length), 0);
  await page.evaluate(() => { S.active = null; startSession("yoga"); });
  await page.fill("#yo-min", "600");
  assert.match(await text(page, "#yo-min-err"), /300/);
  await page.click('[data-act="finish"] >> nth=0');
  assert.equal(await page.evaluate(() => S.history.length), 0);
  assert.deepEqual(await page.done(), []);
});

test("body weight: letters or 3 kg show a message and are not kept", async () => {
  const page = await app.open();
  await signedIn(page, { bodyKg: "70" });
  await page.evaluate(() => settingsSheet("profile"));
  await page.fill("#set-kg", "abc");
  assert.match(await text(page, "#set-kg-err"), /between 30 and 250/);
  await page.fill("#set-kg", "3");
  assert.equal(await page.evaluate(() => S.settings.bodyKg), "70");
  await page.fill("#set-kg", "72,5");
  assert.equal(await text(page, "#set-kg-err"), "");
  assert.equal(await page.evaluate(() => S.settings.bodyKg), "72.5");
  assert.deepEqual(await page.done(), []);
});

test("delete a session: badges it alone earned go, Undo brings both back", async () => {
  const page = await app.open();
  await signedIn(page);
  await page.evaluate(() => {
    const t = Date.now() - 3600e3;
    S.history.push({ id: "s" + t, type: "lauf", start: t, end: t + 3000e3, run: { mode: "out", km: 12, min: 50, note: "" } });
    checkBadges(true); save(); render();
  });
  assert.equal(await page.evaluate(() => !!S.badges.km10), true);
  await page.evaluate(() => histSheet(S.history[0].id));
  await page.click("[data-act=delask]");
  await page.click("[data-act=delok]");
  assert.equal(await page.evaluate(() => S.history.length), 0);
  assert.equal(await page.evaluate(() => !!S.badges.km10), false, "the 10 km badge came only from this run");
  await page.click(".toast.undo [data-act=undo]");
  assert.equal(await page.evaluate(() => S.history.length), 1);
  assert.equal(await page.evaluate(() => !!S.badges.km10), true);
  assert.deepEqual(await page.done(), []);
});

test("edit a saved workout: 80 kg instead of 8 is fixed, a wrong number is refused", async () => {
  const page = await app.open();
  await signedIn(page);
  await page.evaluate(() => {
    const t = Date.now() - 3600e3, ex = Object.keys(EXN).find(k => EXN[k].type === "w");
    S.history.push({ id: "s" + t, type: startKeys()[0], start: t, end: t + 2400e3, sets: { [ex]: [{ r: 10, kg: 80 }, { r: 10, kg: 8 }] } });
    save(); render(); window.__ex = ex;
  });
  const ex = await page.evaluate(() => window.__ex);
  await page.evaluate(() => histSheet(S.history[0].id));
  await page.click("[data-act=editsess]");
  await page.fill(`#ed-kg-${ex}-0`, "9999");
  await page.click("[data-act=editsave]");
  assert.match(await text(page, `#ed-se-${ex}-0`), /Weight/);
  assert.equal(await page.evaluate(ex => S.history[0].sets[ex][0].kg, ex), 80, "nothing changed yet");
  await page.fill(`#ed-kg-${ex}-0`, "8");
  await page.fill(`#ed-r-${ex}-1`, "");   // empty reps: the second set is removed
  await page.click("[data-act=editsave]");
  assert.deepEqual(await page.evaluate(ex => S.history[0].sets[ex], ex), [{ r: 10, kg: 8 }]);
  await page.click(".toast.undo [data-act=undo]");
  assert.equal(await page.evaluate(ex => S.history[0].sets[ex].length, ex), 2);
  assert.deepEqual(await page.done(), []);
});

test("a backup from another account asks first and never replaces name, email or password", async () => {
  const page = await app.open();
  await signedIn(page);
  const foreign = { v: 2, history: [{ id: "s1", type: "yoga", start: Date.now() - 864e5, end: Date.now() - 860e5, yoga: { min: 20 } }],
    settings: { name: "Someone", goal: 6, profile: { name: "Someone", email: "someone@else.pt" } }, badges: {} };
  await page.evaluate(t => loadBackupText(t), JSON.stringify(foreign));
  assert.match(await text(page, ".sheet"), /another account/);
  assert.equal(await page.evaluate(() => S.history.length), 0, "nothing happens before the answer");
  await page.click("[data-act=backupok]");
  assert.deepEqual(await page.evaluate(() => ({ email: S.settings.profile.email, n: S.history.length, goal: S.settings.goal })), { email: "test@novasbe.pt", n: 1, goal: 6 });
  await page.click(".toast.undo [data-act=undo]");
  assert.deepEqual(await page.evaluate(() => ({ n: S.history.length, goal: S.settings.goal })), { n: 0, goal: 3 });
  assert.deepEqual(await page.done(), []);
});

test("own exercises can be renamed and deleted; past workouts keep the name", async () => {
  const page = await app.open();
  await signedIn(page);
  await page.evaluate(() => {
    const c = NFEx.makeCustom({ n: "Cosack Squat", eq: "Bodyweight", part: "Legs", type: "r" }, "cx1");
    S.settings.custom = [c]; addCustomToEXN();
    const t = Date.now() - 3600e3; S.history.push({ id: "s" + t, type: startKeys()[0], start: t, end: t + 1800e3, sets: { cx1: [{ r: 10, kg: 0 }] } });
    save(); LIB = { q: "", part: "", eq: "", mode: "browse" }; guideSheet("cx1", true);
  });
  await page.click("[data-act=cxedit]");
  assert.equal(await page.$eval("#cx-type", s => s.disabled), true, "already logged: the log type stays");
  await page.fill("#cx-name", "Cossack Squat");
  await page.click("#cx-form [type=submit]");
  assert.equal(await page.evaluate(() => EXN.cx1.n), "Cossack Squat");
  await page.click("[data-act=cxdel]");
  await page.click("[data-act=cxdelok]");
  assert.equal(await page.evaluate(() => customList().length), 0);
  assert.equal(await page.evaluate(() => EXN.cx1 && EXN.cx1.n), "Cossack Squat", "history still shows it");
  await page.click(".toast.undo [data-act=undo]");
  assert.equal(await page.evaluate(() => customList().length), 1);
  assert.deepEqual(await page.done(), []);
});

test("skipping an optional exercise with ticked sets asks first", async () => {
  const page = await app.open();
  await signedIn(page);
  const found = await page.evaluate(() => {
    for (const k of Object.keys(W)) {
      const o = (W[k].ex || []).find(e => e.opt); if (!o) continue;
      startSession(k); S.active.open[o.id] = true; const x = eff(exIn(k, o.id));
      S.active.sets[x.id] = [{ r: "8", kg: "10", ok: true }]; save(); renderSession(); return { base: o.id, id: x.id };
    }
    return null;
  });
  assert.ok(found, "a workout with an optional exercise");
  await page.evaluate(b => { const el = document.createElement("button"); el.dataset.act = "closeopt"; el.dataset.ex = b; document.body.appendChild(el); el.click(); el.remove(); }, found.base);
  assert.match(await text(page, ".sheet"), /won't be saved/);
  assert.equal(await page.evaluate(id => !!S.active.sets[id], found.id), true);
  await page.click("[data-act=closeoptok]");
  assert.equal(await page.evaluate(id => !!S.active.sets[id], found.id), false);
  assert.deepEqual(await page.done(), []);
});
