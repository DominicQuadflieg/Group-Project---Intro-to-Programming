const test = require("node:test");
const assert = require("node:assert/strict");
const P = require("../app/progress.js");

const at = (s, h) => new Date(`${s}T${String(h == null ? 12 : h).padStart(2, "0")}:00:00`).getTime();

test("cards: defaults, saved choice and unknown ids", () => {
  assert.deepEqual(P.cardsFor(null, "s"), ["score", "record", "balance", "volume"]);
  assert.deepEqual(P.cardsFor({ r: ["pbs", "nope"] }, "r"), ["pbs"]);
  assert.deepEqual(P.cardsFor({ y: [] }, "y"), ["calm", "flex", "month"]);
});

test("cards: toggle keeps catalogue order, at least one and at most five", () => {
  assert.deepEqual(P.toggleCard(["score", "volume"], "record", "s").list, ["score", "record", "volume"]);
  assert.equal(P.toggleCard(["score"], "score", "s").err, "min");
  assert.equal(P.toggleCard(["score", "record", "balance", "volume", "max"], "when", "s").err, "max");
  assert.equal(P.toggleCard(["score"], "zzz", "s").err, "unknown");
});

test("per week: sums land in the right week, oldest first", () => {
  const now = at("2026-11-21");
  const w = P.perWeek([{ t: at("2026-11-17"), v: 5 }, { t: at("2026-11-19"), v: 2 }, { t: at("2026-11-10"), v: 4 }, { t: at("2026-01-01"), v: 9 }], 3, now);
  assert.deepEqual(w, [0, 4, 7]);
});

test("hours: busiest two-hour slot", () => {
  const h = P.hours([at("2026-11-02", 17), at("2026-11-03", 16), at("2026-11-04", 9)]);
  assert.equal(h.best.h, 16);
  assert.equal(P.hours([]).best, null);
});

test("heat: a day with gym and run keeps both kinds", () => {
  const g = P.heat([{ t: at("2026-11-19", 8), k: "s" }, { t: at("2026-11-19", 18), k: "r" }], at("2026-11-21"), 2);
  assert.deepEqual(g[1][3], ["s", "r"]);
  assert.deepEqual(g[0][3], []);
});

test("distance story: past Lisbon, next stop Setúbal", () => {
  const s = P.story(48);
  assert.equal(s.past.n, "Lisbon");
  assert.equal(s.next.n, "Setúbal");
  assert.equal(P.story(3).past, null);
});

test("special badges", () => {
  const H = [
    { t: at("2026-11-16", 18), k: "s" }, { t: at("2026-11-17", 7), k: "r" }, { t: at("2026-11-18", 22), k: "y" },
    { t: at("2026-11-21", 7), k: "r" }
  ];
  const f = P.specials(H, 4);
  assert.equal(f.triple, true);
  assert.equal(f.sunrise, true);   // Saturday 7 am run
  assert.equal(f.night, true);     // 22 h yoga
  assert.equal(f.comeback, false);
  assert.equal(f.breaks, 4);
  assert.equal(P.specials([{ t: at("2026-10-01"), k: "s" }, { t: at("2026-10-20"), k: "s" }], 0).comeback, true);
  const adv = [1, 9, 16, 23].map(d => ({ t: at(`2026-12-${String(d).padStart(2, "0")}`), k: "y" }));
  assert.equal(P.specials(adv, 0).advent, true);
  assert.equal(P.specials(adv.slice(0, 3), 0).advent, false);
});

test("badge groups follow the sports on Train", () => {
  assert.equal(P.badgeVisible({ g: "run" }, ["s"]), false);
  assert.equal(P.badgeVisible({ g: "general" }, ["s"]), true);
  assert.equal(P.badgeVisible({ g: "special", need: "r" }, ["s", "y"]), false);
  assert.equal(P.badgeVisible({ g: "special", all3: true }, ["s", "r"]), false);
  assert.equal(P.badgeVisible({ g: "special", all3: true }, ["s", "r", "y"]), true);
});
