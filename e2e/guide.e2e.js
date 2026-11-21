// End-to-end: the guided tour after sign-up · run with: npm run e2e
const test = require("node:test");
const assert = require("node:assert/strict");
const { setup, signedIn } = require("./helpers");

let app;
test.before(async () => { app = await setup(); });
test.after(async () => { await app.close(); });

// Walks the tour like a person: Next on info steps, the highlighted button on tap steps,
// anywhere on pauses, "Continue tour" on the free library step
async function walk(page) {
  const seen = [];
  for (let k = 0; k < 140; k++) {
    const st = await page.evaluate(() => {
      if (!TOUR) return { done: true };
      const s = TOUR.steps && TOUR.steps[TOUR.i];
      return { i: TOUR.i, busy: !!TOUR.busy, kind: TOUR.i < 0 ? "welcome" : !s ? "end" : s.pause ? "pause" : s.free ? "free" : s.tap ? "tap" : "info",
        t: s ? (s.t || s.pause || s.free) : "", card: !!document.querySelector("#guide .tg-card, #guide .tg-bar, #guide .tg-pill, #guide .tg-full"), rect: TOUR.rect || null };
    });
    if (st.done) return seen;
    if (st.busy || !st.card) { await page.waitForTimeout(200); continue; }
    if (st.kind === "welcome") await page.click("[data-tg=go]");
    else if (st.kind === "end") await page.click("[data-tg=done]");
    else if (st.kind === "pause") await page.click(".tg-bar");
    else if (st.kind === "free") await page.click(".tg-pill");
    else if (st.kind === "tap") await page.mouse.click(st.rect.l + st.rect.w / 2, st.rect.t + Math.min(st.rect.h, 60) / 2);
    else await page.click(".tg-next");
    if (seen[seen.length - 1] !== st.t) seen.push(st.t);
    await page.waitForTimeout(450);
  }
  throw new Error("tour did not end: " + seen.join(" › "));
}

test("the tour starts after sign-up, walks every page and leaves no trace", async () => {
  const page = await app.open();
  await signedIn(page, { trainKinds: ["s", "r", "y"] });
  await page.evaluate(() => { OB.mode = "new"; finishOnboarding(); });
  await page.waitForSelector("#guide [data-tg=go]");
  const seen = await walk(page);
  for (const t of ["Your next session", "Lift a bit more", "New record!", "Just upload a screenshot", "Guided, pose by pose", "Your week as a story", "Collect them all"])
    assert.ok(seen.includes(t), `missing step: ${t}`);
  const after = await page.evaluate(() => ({ n: S.history.length, active: !!S.active, seen: S.settings.guideSeen, snap: localStorage.getItem("nf-guide-snap"), tab: TAB }));
  assert.deepEqual(after, { n: 0, active: false, seen: true, snap: null, tab: "today" });
  // signing up again later doesn't start it again; the menu does
  await page.evaluate(() => { OB.mode = "new"; finishOnboarding(); });
  await page.waitForTimeout(600);
  assert.equal(await page.$("#guide"), null);
  assert.deepEqual(await page.done(), []);
});

test("skipping the tour keeps the account as it was", async () => {
  const page = await app.open();
  await signedIn(page);
  await page.evaluate(() => startGuide());
  await page.click("[data-tg=end]");
  assert.deepEqual(await page.evaluate(() => ({ n: S.history.length, seen: S.settings.guideSeen, open: !!TOUR })), { n: 0, seen: true, open: false });
  assert.deepEqual(await page.done(), []);
});
