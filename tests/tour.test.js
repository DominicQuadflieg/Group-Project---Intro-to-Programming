const test = require("node:test");
const assert = require("node:assert/strict");
const T = require("../app/tour.js");

const now = new Date("2026-11-21T19:00:00").getTime();   // a Saturday
const exOf = () => [{ id: "bench", s: 3, r: [6, 10], type: "w", eq: "Barbell" }, { id: "pullup", s: 3, r: [5, 8], type: "a", eq: "Bodyweight" }];
const sessions = [{ day: 0, kind: "s", workout: "upper" }, { day: 2, kind: "r" }, { day: 3, kind: "y" }, { day: 5, kind: "s", workout: "lower" }];

test("example data follows the plan and the sports on Train", () => {
  const d = T.makeDemo({ now, kinds: ["s", "r", "y"], sessions, exOf });
  assert.ok(d.history.length > 20);
  assert.ok(d.history.some(e => e.type === "upper"));
  assert.ok(d.history.some(e => e.type === "lauf" && Number(e.run.km) > 0));
  assert.ok(d.history.some(e => e.type === "yoga" && e.yoga.calm.b === 4));
  assert.equal(d.flex.length, 3);
  const g = T.makeDemo({ now, kinds: ["s"], sessions, exOf });
  assert.ok(g.history.every(e => e.type === "upper" || e.type === "lower"));
  assert.equal(g.flex.length, 0);
});

test("nothing lands on today or later, and the history is in order", () => {
  const d = T.makeDemo({ now, kinds: ["s", "r", "y"], sessions, exOf });
  const today = new Date(now).setHours(0, 0, 0, 0);
  assert.ok(d.history.every(e => e.start < today));
  assert.ok(d.history.every((e, i, a) => !i || a[i - 1].start <= e.start));
});

test("gym sets hit the top of the rep range and get heavier, so the app suggests more", () => {
  const d = T.makeDemo({ now, kinds: ["s"], sessions, exOf });
  const up = d.history.filter(e => e.type === "upper");
  const kg = e => Number(e.sets.bench[0].kg);
  assert.ok(kg(up[up.length - 1]) > kg(up[0]));
  assert.ok(up.every(e => e.sets.bench.every(s => s.r === "10" && s.ok)));
  assert.equal(up[0].sets.pullup[0].kg, "");
});

test("a sport on Train without plan days still gets sessions", () => {
  const d = T.makeDemo({ now, kinds: ["r"], sessions: [], exOf });
  assert.ok(d.history.length >= 10 && d.history.every(e => e.type === "lauf"));
});

test("steps are numbered inside their chapter, pauses are not", () => {
  const s = T.number([{ ch: "Gym" }, { ch: "Gym", pause: true }, { ch: "Gym" }, { ch: "Run" }]);
  assert.deepEqual(s.map(x => [x.n, x.of]), [[1, 2], [0, 0], [2, 2], [1, 1]]);
});
