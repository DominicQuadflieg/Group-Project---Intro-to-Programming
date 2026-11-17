// Tests for app/yoga.js · run with: node --test
const test = require("node:test");
const assert = require("node:assert/strict");
const Y = require("../app/yoga.js");

const at = (y, m, d, h) => new Date(y, m - 1, d, h, 0).getTime();

test("every session has an id, a name, lengths and valid steps", () => {
  const ids = new Set();
  for (const s of Y.SESSIONS) {
    assert.ok(s.id && !ids.has(s.id), s.id); ids.add(s.id);
    assert.ok(s.n && s.desc && s.where);
    assert.ok([1, 2, 3].includes(s.level));
    assert.ok(s.lens.length >= 1 && s.lens.every(n => n > 0));
    if (s.id === "vinyasa") { assert.equal(s.steps, null); continue; }
    for (const x of s.steps) {
      assert.ok(x.n && x.i && x.pose, `${s.id}: ${x.n}`);
      assert.ok(x.d >= Y.MIN_STEP, `${s.id}: ${x.n} too short`);
    }
  }
});

test("each session's steps add up to about its default length", () => {
  for (const s of Y.SESSIONS) {
    if (!s.steps) continue;
    const m = Y.minutes(Y.stepsFor(s.id, s.lens[0]));
    assert.ok(Math.abs(m - s.lens[0]) <= 1, `${s.id}: ${m} min instead of ${s.lens[0]}`);
  }
});

test("the study break takes 5 minutes and needs no mat", () => {
  const s = Y.byId("study");
  assert.equal(s.where, "Chair");
  assert.equal(Y.minutes(Y.stepsFor("study", 5)), 5);
  assert.ok(!s.steps.some(x => ["dog", "plank", "cobra", "sava"].includes(x.pose)));
});

test("stepsFor scales holds to the chosen length, never below 15 s", () => {
  const long = Y.stepsFor("winddown", 20), short = Y.stepsFor("winddown", 10);
  assert.ok(Math.abs(Y.minutes(long) - 20) <= 1);
  assert.ok(Math.abs(Y.minutes(short) - 10) <= 1);
  assert.ok(short.every(x => x.d >= 15 && x.d % 5 === 0));
  assert.ok(long[0].d > short[0].d);
});

test("stepsFor changes the number of Sun Salutation rounds with the length", () => {
  assert.match(Y.stepsFor("morning", 10).find(x => /Sun/.test(x.n)).n, /2 rounds/);
  assert.match(Y.stepsFor("morning", 15).find(x => /Sun/.test(x.n)).n, /3 rounds/);
});

test("a length the session doesn't offer falls back to its default", () => {
  assert.equal(Y.lengthFor("study", 45), 5);
  assert.equal(Y.lengthFor("study", "10"), 10);
  assert.equal(Y.lengthFor("nope", 10), 0);
  assert.deepEqual(Y.stepsFor("nope", 10), []);
  assert.deepEqual(Y.stepsFor("vinyasa", 30), []);
});

test("stepsFor does not change the stored sessions", () => {
  const before = Y.byId("back").steps[0].d;
  Y.stepsFor("back", 20);
  assert.equal(Y.byId("back").steps[0].d, before);
});

test("suggest: evening wind down, after a run, morning, study break in exam weeks", () => {
  assert.equal(Y.suggest(at(2026, 11, 17, 22), false), "winddown");
  assert.equal(Y.suggest(at(2026, 11, 17, 2), true), "winddown");
  assert.equal(Y.suggest(at(2026, 11, 17, 18), true), "afterrun");
  assert.equal(Y.suggest(at(2026, 11, 17, 7), false), "morning");
  assert.equal(Y.suggest(at(2026, 11, 17, 15), false), "");
  assert.equal(Y.suggest(at(2026, 12, 9, 15), false), "study");
  assert.equal(Y.suggest(at(2026, 12, 21, 19), false), "study");
  assert.equal(Y.suggest(at(2026, 12, 22, 15), false), "");
});

test("examWeek includes the first and last day", () => {
  assert.equal(Y.examWeek(at(2026, 12, 7, 9)), true);
  assert.equal(Y.examWeek(at(2026, 12, 6, 23)), false);
  assert.equal(Y.examWeek(at(2027, 1, 5, 12), [["2027-01-04", "2027-01-15"]]), true);
});
