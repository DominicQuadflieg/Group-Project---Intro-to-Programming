const test = require("node:test");
const assert = require("node:assert/strict");
const P = require("../app/plan.js");

const VALID = ["oben", "po", "upB", "loB", "lauf", "yoga", "push", "fbA"];
const BASE = ["oben", "lauf", "po", "upB", "yoga"];

test("without edits Train shows the plan's sessions", () => {
  assert.deepEqual(P.trainList(BASE, null, VALID), BASE);
  assert.deepEqual(P.trainList(BASE, {}, VALID), BASE);
});

test("hidden sessions drop out, added ones come after", () => {
  assert.deepEqual(P.trainList(BASE, { hide: ["yoga", "upB"], add: ["push"] }, VALID), ["oben", "lauf", "po", "push"]);
});

test("unknown keys and duplicates are ignored", () => {
  assert.deepEqual(P.trainList(BASE, { hide: ["nope"], add: ["push", "push", "x", "oben"] }, VALID), [...BASE, "push"]);
  assert.deepEqual(P.trainList(BASE, { hide: "yoga", add: 5 }, VALID), BASE);
});

test("everything hidden gives an empty list", () => {
  assert.deepEqual(P.trainList(BASE, { hide: BASE }, VALID), []);
});

test("toggle hides and shows a plan session", () => {
  let e = P.trainToggle({}, "yoga", BASE);
  assert.deepEqual(e, { hide: ["yoga"], add: [] });
  e = P.trainToggle(e, "yoga", BASE);
  assert.deepEqual(e, { hide: [], add: [] });
});

test("toggle adds and removes an extra workout", () => {
  let e = P.trainToggle(null, "push", BASE);
  assert.deepEqual(e, { hide: [], add: ["push"] });
  assert.deepEqual(P.trainList(BASE, e, VALID), [...BASE, "push"]);
  e = P.trainToggle(e, "push", BASE);
  assert.deepEqual(e, { hide: [], add: [] });
});

test("toggle does not change the edit it was given", () => {
  const e = { hide: ["yoga"], add: [] };
  P.trainToggle(e, "push", BASE);
  assert.deepEqual(e, { hide: ["yoga"], add: [] });
});

test("toggle copes with a broken edit from an old backup", () => {
  assert.deepEqual(P.trainToggle({ hide: "yoga", add: [1, "push"] }, "yoga", BASE), { hide: ["yoga"], add: ["push"] });
});
