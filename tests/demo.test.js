// The demo file for trying the app (app/demo/novafit-demo.json, made by demo/make_demo.py)
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");

const d = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "app", "demo", "novafit-demo.json"), "utf8"));

test("demo file is a backup marked as demo, with history only", () => {
  assert.strictEqual(d.demo, true);
  assert.ok(Array.isArray(d.history) && d.history.length > 50);
  assert.deepStrictEqual(Object.keys(d).sort(), ["demo", "history", "v"]);
});

test("every demo session has a demo- id, so it can be removed again", () => {
  const ids = new Set();
  d.history.forEach(e => {
    assert.ok(e.id.startsWith("demo-"), e.id);
    assert.ok(!ids.has(e.id), "duplicate " + e.id); ids.add(e.id);
    assert.ok(e.end > e.start);
  });
});

test("demo covers gym, running and yoga", () => {
  assert.ok(d.history.some(e => e.sets));
  assert.ok(d.history.some(e => e.run && e.run.km > 0 && e.run.min > 0));
  assert.ok(d.history.some(e => e.yoga && e.yoga.min > 0));
});
