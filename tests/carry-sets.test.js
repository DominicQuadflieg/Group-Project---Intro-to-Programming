const test = require("node:test");
const assert = require("node:assert/strict");
const { carryForward } = require("../app/exercises.js");

test("reps and weight from set 1 fill the empty later sets as suggestions", () => {
  const sets = [{ r: "10", kg: "62.5", ok: true }, { r: "", kg: "" }, { r: "", kg: "", ok: false }];
  assert.deepEqual(carryForward(sets, 0, "r", "10"), [1, 2]);
  assert.deepEqual(carryForward(sets, 0, "kg", "62.5"), [1, 2]);
  assert.deepEqual(sets[1], { r: "10", kg: "62.5", ok: false });
  assert.deepEqual(sets[2], { r: "10", kg: "62.5", ok: false });
});

test("sets the person already entered or ticked stay as they are", () => {
  const sets = [{ r: "8", ok: true }, { r: "6", kg: "60", ok: true }, { r: "", kg: "" }];
  assert.deepEqual(carryForward(sets, 0, "r", "8"), [2]);
  assert.equal(sets[1].r, "6");
});

test("a suggestion from last time is replaced, earlier sets are not touched", () => {
  const sets = [{ r: "10", kg: "60", ok: false }, { r: "12", kg: "50", ok: true }, { r: "10", kg: "60", ok: false }];
  assert.deepEqual(carryForward(sets, 1, "kg", "52.5"), [2]);
  assert.equal(sets[0].kg, "60");
  assert.equal(sets[2].kg, "52.5");
});

test("other fields, bad input and the last set change nothing", () => {
  const sets = [{ r: "10" }, { r: "" }];
  assert.deepEqual(carryForward(sets, 0, "note", "x"), []);
  assert.deepEqual(carryForward(null, 0, "r", "10"), []);
  assert.deepEqual(carryForward(sets, 1, "r", "10"), []);
});
