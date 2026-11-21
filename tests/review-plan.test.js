const test = require("node:test");
const assert = require("node:assert/strict");
const { reviewPlan } = require("../app/plan.js");

test("only gym: only gym chapters", () => {
  assert.deepEqual(reviewPlan(["s"], {}), ["gym", "muscles", "next"]);
});

test("only running: run, and the goal when there is one", () => {
  assert.deepEqual(reviewPlan(["r"], {}), ["run", "next"]);
  assert.deepEqual(reviewPlan(["r"], { goal: true }), ["run", "goal", "next"]);
});

test("only yoga: yoga, and flexibility when there are checks", () => {
  assert.deepEqual(reviewPlan(["y"], { flex: true }), ["yoga", "flex", "next"]);
});

test("several sports: each at most two slides, in the order gym, run, yoga", () => {
  assert.deepEqual(reviewPlan(["y", "s", "r"], { goal: true, flex: true }), ["gym", "muscles", "run", "goal", "yoga", "flex", "next"]);
  assert.deepEqual(reviewPlan(["r", "y"], {}), ["run", "yoga", "next"]);
});

test("nothing done: no chapters", () => {
  assert.deepEqual(reviewPlan([], { goal: true }), []);
  assert.deepEqual(reviewPlan(null), []);
});
