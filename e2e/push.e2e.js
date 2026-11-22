// End-to-end: "Allow notifications" asks right in the tap (iPhone needs that) and always says what happened
const test = require("node:test");
const assert = require("node:assert/strict");
const { setup, signedIn, text } = require("./helpers");

let app;
test.before(async () => { app = await setup(); });
test.after(async () => { await app.close(); });

// A stand-in for OneSignal and the browser's permission question
const fakePush = (page, answer) => page.evaluate(answer => {
  window.__log = [];
  let perm = "default";
  Object.defineProperty(window, "Notification", { configurable: true, value: {
    get permission(){ return perm; },
    requestPermission(){ window.__log.push("native-ask"); perm = answer; return Promise.resolve(answer); }
  }});
  let opted = false;
  OS = { Notifications: { isPushSupported: () => true, get permission(){ return perm === "granted"; }, get permissionNative(){ return perm; },
                          requestPermission: async () => { window.__log.push("onesignal-ask"); } },
         User: { PushSubscription: { get optedIn(){ return opted; }, optIn: async () => { window.__log.push("optin"); opted = true; } }, addTags(){} } };
  refreshPush();
}, answer);

test("the permission question starts right in the tap, then OneSignal subscribes", async () => {
  const page = await app.open();
  await signedIn(page);
  await fakePush(page, "granted");
  await page.evaluate(() => { enablePush(); window.__sync = window.__log.slice(); });
  assert.deepEqual(await page.evaluate(() => window.__sync), ["native-ask"]);   // asked before anything waited
  await page.waitForSelector(".toast");
  assert.match(await text(page, ".toast"), /Notifications are on/);
  assert.deepEqual(await page.evaluate(() => window.__log), ["native-ask", "optin"]);
  assert.deepEqual(await page.done(), []);
});

test("a refused question explains where to allow notifications", async () => {
  const page = await app.open();
  await signedIn(page);
  await fakePush(page, "denied");
  await page.evaluate(() => enablePush());
  await page.waitForSelector(".toast");
  assert.match(await text(page, ".toast"), /blocked/);
  assert.deepEqual(await page.done(), []);
});
