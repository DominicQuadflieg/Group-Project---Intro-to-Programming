// The service worker keeps the app working offline and receives push messages.
// It must never be empty and must keep its cache name and the OneSignal import.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const src = fs.readFileSync(path.join(__dirname, "..", "app", "OneSignalSDKWorker.js"), "utf8");

test("service worker file is not empty", () => {
  assert.ok(src.trim().length > 500, "app/OneSignalSDKWorker.js looks empty");
});

test("service worker has a versioned cache name", () => {
  assert.match(src, /const CACHE = "novafit-v\d+";/);
});

test("service worker still loads OneSignal", () => {
  assert.match(src, /importScripts\(/);
});
