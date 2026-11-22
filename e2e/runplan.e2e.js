// End-to-end: the running goal (Train › Running › My running goal) · run with: npm run e2e
const test = require("node:test");
const assert = require("node:assert/strict");
const { setup } = require("./helpers");

let app;
test.before(async () => { app = await setup(); });
test.after(async () => { await app.close(); });

// From the running menu through the goal wizard to the plan (10 km goal)
async function makePlan(page) {
  await page.evaluate(() => { S.settings.profile = { name: "T" }; S.settings.guideDone = true; delete S.settings.runPlan; save(); PLW = null; screen = "home"; render(); runSheet(); });
  await page.click('.run-menu [data-act="runplan"]');
  await page.click('#app [data-act="plgoal"][data-g="k10"]');
  for (let i = 0; i < 6 && !(await page.$(".rweek")); i++) await page.click("#app .primary");
  await page.waitForSelector(".rweek");
}
const texts = page => page.evaluate(() => { const out = [], w = document.createTreeWalker(document.querySelector("#app"), NodeFilter.SHOW_TEXT); let n;
  while ((n = w.nextNode())) { const t = n.nodeValue.replace(/\s+/g, " ").trim(); if (t && /[a-z]{3}/i.test(t) && !n.parentElement.closest("[translate=no]")) out.push(t); } return out; });

test("the weeks of the plan are cards with the runs under each other, full width", async () => {
  const page = await app.open();
  await makePlan(page);
  const g = await page.evaluate(() => [...document.querySelectorAll(".rweek")].map(c => {
    const inner = c.clientWidth - parseFloat(getComputedStyle(c).paddingLeft) - parseFloat(getComputedStyle(c).paddingRight);
    const rows = [...c.querySelectorAll(".prun")].map(r => r.getBoundingClientRect());
    return { display: getComputedStyle(c).display, inner, widths: rows.map(r => r.width), lefts: rows.map(r => Math.round(r.left)), tops: rows.map(r => r.top) };
  }));
  assert.ok(g.length >= 2, "this week and next week");
  for (const w of g) {
    assert.equal(w.display, "flex", "not the 7-column grid of the Progress week strip");
    w.widths.forEach(x => assert.ok(x >= w.inner * 0.9, `row ${x}px of ${w.inner}px`));
    for (let i = 1; i < w.tops.length; i++) assert.ok(w.tops[i] > w.tops[i - 1], "runs under each other");
  }
  assert.ok(await page.$(".rweek em.rnext"), "the next run is marked");
  assert.deepEqual(await page.done(), []);
});

test("in German nothing on the goal wizard and the plan stays English", async () => {
  const page = await app.open();
  await makePlan(page);
  const english = new Set(await texts(page));
  await page.evaluate(() => { S.settings.lang = "de"; save(); location.reload(); });
  await page.waitForFunction(() => typeof NFI18N !== "undefined" && NFI18N.getLang() === "de");
  await makePlan(page);
  const left = await page.evaluate(l => [...new Set(l.filter(t => NFI18N.lookup(t) !== t))], (await texts(page)).filter(t => english.has(t)));
  assert.deepEqual(left, []);
  assert.deepEqual(await page.done(), []);
});
