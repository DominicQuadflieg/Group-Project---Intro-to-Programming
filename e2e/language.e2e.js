// End-to-end: choosing a language on the welcome screen and in the menu
const test = require("node:test");
const assert = require("node:assert/strict");
const { setup, signedIn, text } = require("./helpers");

let app;
test.before(async () => { app = await setup(); });
test.after(async () => { await app.close(); });

test("the welcome screen switches to Portuguese, and the choice stays after a reload", async () => {
  const page = await app.open();
  await page.click("[data-act=langsheet]");
  await page.waitForSelector(".sheet .langlist");
  await Promise.all([page.waitForEvent("load"), page.click('.sheet [data-act=setlang][data-v=pt]')]);
  await page.waitForSelector(".ob-hero");
  assert.match(await text(page, ".ob-hero h1"), /Treina como/);
  assert.match(await text(page, ".foot .primary"), /Criar conta/i);
  assert.equal(await page.evaluate(() => document.documentElement.lang), "pt");
  assert.deepEqual(await page.done(), []);
});

test("German from the menu: Today, the tab bar and dates are translated, exercise names stay English", async () => {
  const page = await app.open({ clock: new Date(2026, 10, 22, 10, 0) });
  await signedIn(page);
  await page.evaluate(() => { screen = "me"; render(); });
  await page.click('[data-act=setp][data-p=lang]');
  await Promise.all([page.waitForEvent("load"), page.click('[data-act=setlang][data-v=de]')]);
  await page.evaluate(() => { const g = document.getElementById("guide"); if(g) g.remove(); TOUR = null; screen = "home"; TAB = "today"; render(); });
  assert.match(await text(page, ".tabbar"), /Heute.*Training.*Fortschritt/s);
  assert.match(await text(page, "#app"), /Sonntag/);
  assert.match(await page.evaluate(() => NFI18N.t("How to do Bench Press (Barbell)")), /So geht Bench Press \(Barbell\)/);
  assert.deepEqual(await page.done(), []);
});
