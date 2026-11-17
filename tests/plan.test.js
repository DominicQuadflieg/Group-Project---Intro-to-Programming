// Tests for app/plan.js · run with: node --test
const test = require("node:test");
const assert = require("node:assert/strict");
const P = require("../app/plan.js");

const answers = (over = {}) => Object.assign({ days: 3, mix: { s: 2, r: 1, y: 0 }, goals: ["hip20"], level: "beginner", min: 45 }, over);

/* ---------- sign-up ---------- */
test("sign-up accepts a valid account", () => {
  const r = P.validateSignup({ name: "  Julius Veith ", email: "Julius@NovaSBE.pt", password: "secret123" });
  assert.equal(r.ok, true);
  assert.deepEqual(r.value, { name: "Julius Veith", email: "julius@novasbe.pt" });
});

test("sign-up rejects empty fields", () => {
  const r = P.validateSignup({ name: "", email: "", password: "" });
  assert.equal(r.ok, false);
  assert.ok(r.errors.name && r.errors.email && r.errors.password);
});

test("sign-up rejects invalid email addresses", () => {
  for (const email of ["julius", "julius@", "@nova.pt", "a b@nova.pt", "julius@nova", "x@y.c"]) {
    assert.equal(P.validateSignup({ name: "J", email, password: "secret123" }).errors.email !== undefined, true, email);
  }
});

test("sign-up enforces password rules", () => {
  const pw = p => P.validateSignup({ name: "J", email: "j@nova.pt", password: p }).errors.password;
  assert.ok(pw("short1"));            // too short
  assert.ok(pw("onlyletters"));       // no number
  assert.ok(pw("12345678"));          // no letter
  assert.ok(pw("a1".repeat(65)));     // 130 characters, too long
  assert.equal(pw("abcdefg1"), undefined); // exactly 8 is fine
});

test("sign-up rejects markup in the name and over-long names", () => {
  assert.ok(P.validateSignup({ name: "<script>", email: "j@nova.pt", password: "secret123" }).errors.name);
  assert.ok(P.validateSignup({ name: "x".repeat(41), email: "j@nova.pt", password: "secret123" }).errors.name);
  assert.equal(P.validateSignup({ name: "x".repeat(40), email: "j@nova.pt", password: "secret123" }).ok, true);
});

/* ---------- about you ---------- */
test("body data accepts realistic values, also with a decimal comma", () => {
  const r = P.validateBody({ sex: "female", age: "21", kg: "62,5" });
  assert.equal(r.ok, true);
  assert.deepEqual(r.value, { sex: "female", age: 21, kg: 62.5 });
  assert.equal(P.validateBody({ sex: "na", age: 16, kg: 30 }).ok, true);   // lower limits
  assert.equal(P.validateBody({ sex: "male", age: 99, kg: 250 }).ok, true); // upper limits
});

test("body data rejects missing, out-of-range and non-numeric input", () => {
  const e = x => P.validateBody(Object.assign({ sex: "male", age: 25, kg: 75 }, x)).errors;
  assert.ok(e({ sex: "" }).sex);
  assert.ok(e({ sex: "robot" }).sex);
  assert.ok(e({ age: "" }).age);
  assert.ok(e({ age: 15 }).age);
  assert.ok(e({ age: 100 }).age);
  assert.ok(e({ age: "21.5" }).age);
  assert.ok(e({ age: "abc" }).age);
  assert.ok(e({ kg: "" }).kg);
  assert.ok(e({ kg: 29.9 }).kg);
  assert.ok(e({ kg: 251 }).kg);
  assert.ok(e({ kg: "-70" }).kg);
  assert.ok(e({ kg: "70kg" }).kg);
});

/* ---------- questionnaire ---------- */
test("days per week must be a whole number from 2 to 6", () => {
  for (const d of [2, 3, 6]) assert.equal(P.validateDays(d).ok, true, d);
  for (const d of [0, 1, 7, 3.5, "3", null]) assert.equal(P.validateDays(d).ok, false, String(d));
});

test("rebalanceMix always reaches the chosen number of sessions", () => {
  for (let days = 2; days <= 6; days++) {
    for (const mix of [{ s: 0, r: 0, y: 0 }, { s: 6, r: 6, y: 6 }, { s: 1, r: 0, y: 4 }]) {
      const m = P.rebalanceMix(mix, days);
      assert.equal(P.mixTotal(m), days);
      assert.ok(m.s >= 0 && m.r >= 0 && m.y >= 0);
    }
  }
  assert.deepEqual(P.rebalanceMix({ s: 1, r: 1, y: 2 }, 3), { s: 1, r: 1, y: 1 }); // yoga is removed first
});

test("the mix must add up exactly", () => {
  assert.equal(P.validateMix({ s: 2, r: 1, y: 0 }, 3).ok, true);
  assert.equal(P.validateMix({ s: 2, r: 2, y: 0 }, 3).ok, false);
  assert.equal(P.validateMix({ s: -1, r: 4, y: 0 }, 3).ok, false);
  assert.equal(P.validateMix({ s: 1.5, r: 1.5, y: 0 }, 3).ok, false);
});

test("goals: between 1 and 6, at most 2 per type, known, unique and matching the mix", () => {
  const mix = { s: 1, r: 1, y: 1 };
  assert.equal(P.validateGoals(["hip20", "run5k", "exam"], mix).ok, true);
  assert.equal(P.validateGoals(["hip20", "pullup", "run5k", "half", "exam", "toes"], mix).ok, true); // 6 = 2 per type
  assert.equal(P.validateGoals([], mix).ok, false);
  assert.equal(P.validateGoals(["hip20", "pullup", "muscle"], mix).ok, false);   // 3 strength goals
  assert.equal(P.validateGoals(["run5k", "run10k", "half"], mix).ok, false);      // 3 running goals
  assert.equal(P.validateGoals(["hip20", "pullup", "run5k", "half", "exam", "toes", "sleep"], mix).ok, false); // 7
  assert.equal(P.validateGoals(["hip20", "hip20"], mix).ok, false);
  assert.equal(P.validateGoals(["fly"], mix).ok, false);
  assert.equal(P.validateGoals(["half"], { s: 3, r: 0, y: 0 }).ok, false); // running goal without a run
});

test("level and session length must come from the lists", () => {
  assert.equal(P.validateAnswers(answers()).ok, true);
  assert.equal(P.validateAnswers(answers({ level: "pro" })).ok, false);
  assert.equal(P.validateAnswers(answers({ min: 50 })).ok, false);
});

/* ---------- plans ---------- */
test("suggestPlans returns three plans and marks the goal plan as best match", () => {
  const plans = P.suggestPlans(answers({ days: 4, mix: { s: 2, r: 2, y: 0 }, goals: ["run10k"] , level: "intermediate" }));
  assert.equal(plans.length, 3);
  assert.deepEqual(plans.map(p => p.id), ["balanced", "focus", "easy"]);
  assert.equal(plans.filter(p => p.best).length, 1);
  assert.equal(plans[1].name, "Road to 10 km");
  assert.deepEqual(plans[1].mix, { s: 1, r: 3, y: 0 }); // one strength session moved to running
});

test("the balanced plan keeps exactly the chosen mix and days", () => {
  const a = answers({ days: 5, mix: { s: 2, r: 2, y: 1 }, goals: ["muscle", "sleep"] });
  const p = P.suggestPlans(a)[0];
  assert.deepEqual(p.mix, a.mix);
  assert.equal(p.sessions.length, 5);
  assert.deepEqual(p.sessions.map(s => s.day), [0, 1, 2, 4, 5]);
});

test("the focus plan never removes the only session of a chosen goal", () => {
  const a = answers({ days: 3, mix: { s: 1, r: 1, y: 1 }, goals: ["run5k", "toes", "hip20"] });
  const f = P.suggestPlans(a)[1];
  assert.ok(f.mix.s >= 1 && f.mix.r >= 1 && f.mix.y >= 1);
});

test("if nothing can be moved, the focus plan adds one session for the main goal", () => {
  const plans = P.suggestPlans(answers({ days: 3, mix: { s: 1, r: 1, y: 1 }, goals: ["run5k", "toes", "hip20"] }));
  assert.deepEqual(plans[1].mix, { s: 1, r: 2, y: 1 });
  assert.equal(plans[1].days, 4);
  assert.notDeepEqual(plans[0].mix, plans[1].mix);
  const six = P.suggestPlans(answers({ days: 6, mix: { s: 2, r: 2, y: 2 }, goals: ["hip20", "half", "exam"] }))[1];
  assert.equal(six.days, 6); // never more than 6 sessions
});

test("the easy start has one session less (minimum 2) and shorter sessions", () => {
  const e = P.suggestPlans(answers({ days: 4, mix: { s: 2, r: 2, y: 0 }, goals: ["hip20"], min: 60 }))[2];
  assert.equal(e.days, 3);
  assert.equal(e.min, 45);
  const e2 = P.suggestPlans(answers({ days: 2, mix: { s: 1, r: 1, y: 0 }, goals: ["hip20"], min: 30 }))[2];
  assert.equal(e2.days, 2);
  assert.equal(e2.min, 30);
});

test("sessions never repeat the same kind back to back when avoidable", () => {
  const p = P.suggestPlans(answers({ days: 6, mix: { s: 3, r: 2, y: 1 }, goals: ["hip20"] }))[0];
  for (let i = 1; i < p.sessions.length; i++) assert.notEqual(p.sessions[i].kind, p.sessions[i - 1].kind);
});

test("sessions map to workouts the app can start", () => {
  const p = P.suggestPlans(answers({ days: 6, mix: { s: 2, r: 2, y: 2 }, goals: ["pullup", "half"], level: "advanced", min: 60 }))[0];
  for (const s of p.sessions) assert.ok(["po", "oben", "lauf", "yoga"].includes(s.workout));
  assert.equal(p.sessions.find(s => s.kind === "s").workout, "oben"); // pull-up goal starts with upper body
  assert.deepEqual(p.sessions.filter(s => s.kind === "s").map(s => s.title), ["Upper Body", "Lower Body"]);
  assert.ok(p.sessions.filter(s => s.kind === "y").every(s => s.min <= 30));
});

test("invalid answers are rejected instead of producing a plan", () => {
  assert.throws(() => P.suggestPlans(answers({ mix: { s: 1, r: 1, y: 0 } })));
  assert.throws(() => P.suggestPlans(answers({ goals: [] })));
});

test("nextSession and sessionOn find the right day", () => {
  const plan = P.suggestPlans(answers())[0];               // Mon, Wed, Fri
  const tue = new Date(2026, 10, 17);                       // Tuesday 17 November 2026
  assert.equal(P.weekdayIndex(tue), 1);
  assert.equal(P.sessionOn(plan, tue), null);
  assert.equal(P.nextSession(plan, tue).day, 2);
  assert.equal(P.nextSession(plan, tue).inDays, 1);
  const sun = new Date(2026, 10, 22);
  assert.equal(P.nextSession(plan, sun).day, 0);            // wraps to Monday
  assert.equal(P.nextSession(plan, sun).inDays, 1);
  assert.equal(P.nextSession(null, sun), null);
});
