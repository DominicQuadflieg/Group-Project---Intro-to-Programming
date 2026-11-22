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
         User: { PushSubscription: { get optedIn(){ return opted; }, get id(){ return opted && window.__noId !== true ? "test-sub-id" : null; },
                                     optIn: async () => { window.__log.push("optin"); opted = true; } }, addTags(){} } };
  refreshPush();
}, answer);
// Permission was already given earlier (iPhone: Settings, or a first tap that only asked)
const grantedBefore = page => page.evaluate(() => {
  Object.defineProperty(window, "Notification", { configurable: true, value: { permission: "granted", requestPermission: () => Promise.resolve("granted") } });
  Object.defineProperty(OS.Notifications, "permission", { configurable: true, get: () => true });
  Object.defineProperty(OS.Notifications, "permissionNative", { configurable: true, get: () => "granted" });
  refreshPush();
});

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

test("with notifications on, a test notification is shown straight from the device", async () => {
  const page = await app.open();
  await signedIn(page);
  await fakePush(page, "granted");
  await page.evaluate(async () => {
    await enablePush();
    navigator.serviceWorker.getRegistration = async () => ({ showNotification: async (t, o) => { window.__log.push("shown:" + t + ":" + o.tag); } });
    document.querySelectorAll(".toast").forEach(t => t.remove());
    screen = "me"; render();
  });
  await page.click("[data-act=setp][data-p=push]");
  await page.click("[data-act=pushtest]");
  await page.waitForSelector(".toast");
  assert.match(await text(page, ".toast"), /Test sent/);
  assert.ok((await page.evaluate(() => window.__log)).includes("shown:NOVAFit:nf-test"));
  assert.deepEqual(await page.done(), []);
});

test("Check notifications shows the state and the last problem", async () => {
  const page = await app.open();
  await signedIn(page);
  await page.evaluate(() => { OS = null; push = "unsupported"; PUSH_ERR = "OneSignal start: Can only be used on: https://old.example"; screen = "me"; render(); });
  await page.click("[data-act=setp][data-p=push]");
  await page.click(".pushdiag summary");
  const t = await text(page, ".pushdiag");
  assert.match(t, /Permission/);
  assert.match(t, /Last problem/);
  assert.match(t, /Can only be used on: https:\/\/old\.example/);
  assert.match(t, /No OneSignal subscription/);
  assert.deepEqual(await page.done(), []);
});

test("permission already granted: subscribing starts right in the tap (iPhone needs that)", async () => {
  const page = await app.open();
  await signedIn(page);
  await fakePush(page, "granted");
  await grantedBefore(page);
  await page.evaluate(() => { enablePush(); window.__sync = window.__log.slice(); });
  assert.deepEqual(await page.evaluate(() => window.__sync), ["optin"]);   // no waiting before subscribing
  await page.waitForSelector(".toast");
  assert.match(await text(page, ".toast"), /Notifications are on/);
  assert.deepEqual(await page.done(), []);
});

test("granted but no subscription: the app says to tap once more and names the reason", async () => {
  const page = await app.open();
  await signedIn(page);
  await fakePush(page, "granted");
  await grantedBefore(page);
  await page.evaluate(() => { window.__noId = true; OS.User.PushSubscription.optIn = async () => { window.__log.push("optin"); }; });
  await page.evaluate(() => enablePush());
  await page.waitForSelector(".toast", { timeout: 8000 });
  assert.match(await text(page, ".toast"), /once more/);
  assert.match(await page.evaluate(() => PUSH_ERR), /subscription|service worker/i);
  assert.deepEqual(await page.done(), []);
});
