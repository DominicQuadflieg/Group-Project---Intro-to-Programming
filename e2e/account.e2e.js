// End-to-end: first start, account and questionnaire · run with: npm run e2e
const test = require("node:test");
const assert = require("node:assert/strict");
const { setup, text } = require("./helpers");

let app;
test.before(async () => { app = await setup(); });
test.after(async () => { await app.close(); });

test("the live headers are in place: inline scripts are not allowed", () => {
  const csp = app.headers["Content-Security-Policy"];
  assert.match(csp, /script-src 'self'/);
  assert.doesNotMatch(csp.match(/script-src[^;]*/)[0], /unsafe-inline/);
  assert.match(csp, /frame-ancestors 'none'/);
});

test("sign-up refuses empty and invalid input with an error next to each field", async () => {
  const page = await app.open();
  await page.click('[data-to="signup"]');
  await page.click('#ob-form button[type="submit"]');
  for (const id of ["ob-name-err", "ob-email-err", "ob-pw-err"]) assert.notEqual(await text(page, "#" + id), "", id);

  await page.fill("#ob-name", "Julius");
  await page.fill("#ob-email", "julius@novasbe");          // no top-level domain
  await page.fill("#ob-pw", "short");
  await page.click('#ob-form button[type="submit"]');
  assert.equal(await text(page, "#ob-name-err"), "");
  assert.notEqual(await text(page, "#ob-email-err"), "");
  assert.notEqual(await text(page, "#ob-pw-err"), "");
  assert.equal(await page.evaluate(() => !!S.settings.profile), false, "nothing is saved");
  assert.deepEqual(await page.done(), []);
});

test("a valid sign-up stores only a password hash and leads to the questionnaire", async () => {
  const page = await app.open();
  await page.click('[data-to="signup"]');
  await page.fill("#ob-name", "Julius Veith");
  await page.fill("#ob-email", "Julius@NovaSBE.pt");
  await page.fill("#ob-pw", "secret123");
  await page.click('#ob-form button[type="submit"]');
  await page.waitForSelector("#ob-age");
  const stored = await page.evaluate(() => localStorage.getItem("po-plan-app-v2"));
  assert.ok(stored.includes("julius@novasbe.pt"), "email saved in lower case");
  assert.ok(!stored.includes("secret123"), "password is never stored as text");

  // body data: too young and a weight with letters are refused
  await page.click('[data-do="sex"][data-v="male"]');
  await page.fill("#ob-age", "15");
  await page.fill("#ob-kg", "68kg");
  await page.click('#ob-form button[type="submit"]');
  assert.notEqual(await text(page, "#ob-age-err"), "");
  assert.notEqual(await text(page, "#ob-kg-err"), "");
  await page.fill("#ob-age", "22");
  await page.fill("#ob-kg", "68,5");
  await page.click('#ob-form button[type="submit"]');
  await page.waitForFunction(() => OB.step === "days");
  assert.equal(await page.evaluate(() => S.settings.bodyKg), "68.5");
  assert.deepEqual(await page.done(), []);
});

test("the locked app asks for the password and refuses a wrong one", async () => {
  const page = await app.open();
  await page.click('[data-to="signup"]');
  await page.fill("#ob-name", "Dominic");
  await page.fill("#ob-email", "dominic@novasbe.pt");
  await page.fill("#ob-pw", "secret123");
  await page.click('#ob-form button[type="submit"]');
  await page.waitForSelector("#ob-age");
  await page.evaluate(() => { S.settings.locked = true; save(); location.reload(); });
  await page.waitForSelector('#ob-form[data-form="login"]');
  await page.fill("#ob-pw", "wrongpass1");
  await page.click('#ob-form button[type="submit"]');
  await page.waitForFunction(() => document.querySelector("#ob-pw-err").textContent.length > 0);
  assert.match(await text(page, "#ob-pw-err"), /isn't right/);
  await page.fill("#ob-pw", "secret123");
  await page.click('#ob-form button[type="submit"]');
  await page.waitForFunction(() => !S.settings.locked);
  assert.deepEqual(await page.done(), []);
});
