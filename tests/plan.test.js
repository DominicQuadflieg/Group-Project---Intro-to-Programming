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
  assert.deepEqual(r.value, { sex: "female", age: 21, kg: 62.5, cm: null });
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
  for (const s of p.sessions) assert.ok(["lauf", "yoga"].concat(Object.keys(P.WORKOUTS)).includes(s.workout));
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

/* ---------- strength splits (v2.8) ---------- */
test("every number of strength sessions offers at least three splits", () => {
  for (let n = 1; n <= 6; n++) {
    const list = P.splitsFor(n);
    assert.ok(list.length >= 3, `n=${n}`);
    for (const sp of list) assert.equal(sp.workouts.length, n, sp.id);
  }
  assert.deepEqual(P.splitsFor(0), []);
  assert.deepEqual(P.splitsFor(3).map(s => s.name), ["3× Full Body", "Push / Pull / Legs", "2× Upper + 1× Lower", "1× Upper + 2× Lower"]);
});

test("the recommended split follows the strength goal, then the level", () => {
  assert.equal(P.recommendSplit(3, ["hip20"], "advanced").split.id, "u1l2");
  assert.equal(P.recommendSplit(3, ["run5k", "pullup"], "advanced").split.id, "u2l1");
  assert.equal(P.recommendSplit(3, ["muscle"], "beginner").split.id, "ppl3");
  assert.equal(P.recommendSplit(3, ["toes"], "beginner").split.id, "full3");
  assert.equal(P.recommendSplit(3, ["toes"], "beginner").reason, "beginner");
  assert.equal(P.recommendSplit(4, ["toes"], "advanced").split.id, "ul4");
  assert.equal(P.recommendSplit(0, [], "beginner"), null);
});

test("a chosen split is used, and only if it fits the number of strength sessions", () => {
  const a = answers({ days: 4, mix: { s: 3, r: 1, y: 0 }, goals: ["muscle"], split: "full3" });
  assert.equal(P.validateAnswers(a).ok, true);
  const plan = P.suggestPlans(a)[0];
  assert.deepEqual(plan.split, { id: "full3", name: "3× Full Body" });
  assert.deepEqual(plan.sessions.filter(s => s.kind === "s").map(s => s.title), ["Full Body A", "Full Body B", "Full Body C"]);
  assert.equal(P.validateAnswers(answers({ split: "ppl6" })).ok, false);   // 6-day split for 2 strength sessions
  assert.equal(P.validateAnswers(answers({ split: "nope" })).ok, false);
  assert.equal(P.validateAnswers(answers({ mix: { s: 0, r: 3, y: 0 }, goals: ["run5k"], split: "ppl3" })).ok, true); // no strength: ignored
});

test("plans with another number of strength sessions keep the same kind of split", () => {
  // Push/Pull/Legs for 3 → PPL + Full Body when the focus plan adds a strength session
  const plans = P.suggestPlans(answers({ days: 5, mix: { s: 3, r: 2, y: 0 }, goals: ["muscle", "run5k"], split: "ppl3" }));
  assert.equal(plans[0].split.id, "ppl3");
  assert.equal(plans[1].split.id, "pplf");
  assert.equal(P.splitFor(2, "ppl3", answers({ goals: ["muscle"] })).id, "ul2"); // no PPL for 2 → recommendation
});

test("no run the day after a heavy leg session when it can be avoided", () => {
  const heavy = s => s.kind === "s" && P.HEAVY_LEGS.includes(P.WORKOUTS[s.workout].group);
  for (const split of ["u1l2", "full3", "ppl3", "u2l1"]) {
    const p = P.suggestPlans(answers({ days: 6, mix: { s: 3, r: 2, y: 1 }, goals: ["hip20"], split }))[0];
    for (let i = 1; i < p.sessions.length; i++) {
      const prev = p.sessions[i - 1], cur = p.sessions[i];
      assert.notEqual(cur.kind, prev.kind, split);
      if (split !== "full3") assert.ok(!(cur.kind === "r" && heavy(prev) && cur.day === prev.day + 1), `${split}: run after ${prev.title}`);
    }
  }
});

test("each strength session and run gets a matching mobility add-on", () => {
  const p = P.suggestPlans(answers({ days: 6, mix: { s: 3, r: 2, y: 1 }, goals: ["muscle"], split: "ppl3" }))[0];
  const by = t => p.sessions.find(s => s.title === t).addon.id;
  assert.equal(by("Push"), "shoulders");
  assert.equal(by("Pull"), "shoulders");
  assert.equal(by("Legs"), "hips");
  assert.ok(p.sessions.filter(s => s.kind === "r").every(s => s.addon.id === "runner"));
  assert.ok(p.sessions.filter(s => s.kind === "y").every(s => !s.addon));
  const f = P.suggestPlans(answers({ days: 3, mix: { s: 3, r: 0, y: 0 }, goals: ["muscle"], split: "full3" }))[0];
  assert.ok(f.sessions.every(s => s.addon.id === "stretch"));
});

/* ---------- Height and personal calorie factor ---------- */
test("height is optional, but must be plausible when given", () => {
  assert.equal(P.validateBody({ sex: "male", age: 21, kg: 72 }).value.cm, null);
  assert.equal(P.validateBody({ sex: "male", age: 21, kg: 72, cm: "" }).ok, true);
  assert.equal(P.validateBody({ sex: "male", age: 21, kg: 72, cm: "180" }).value.cm, 180);
  assert.equal(P.validateBody({ sex: "male", age: 21, kg: 72, cm: "179,6" }).value.cm, 180);
  assert.equal(P.validateBody({ sex: "male", age: 21, kg: 72, cm: 120 }).ok, true);
  assert.equal(P.validateBody({ sex: "male", age: 21, kg: 72, cm: 230 }).ok, true);
  assert.match(P.validateBody({ sex: "male", age: 21, kg: 72, cm: 119 }).errors.cm, /between 120 and 230/);
  assert.match(P.validateBody({ sex: "male", age: 21, kg: 72, cm: "1.80m" }).errors.cm, /in cm/);
});

test("resting burn follows Mifflin-St Jeor", () => {
  assert.equal(P.restingKcalPerDay({ sex: "male", age: 21, kg: 70, cm: 175 }), 1693.75);
  assert.equal(P.restingKcalPerDay({ sex: "female", age: 21, kg: 70, cm: 175 }), 1527.75);
  // without height: typical height for the sex
  assert.equal(P.restingKcalPerDay({ sex: "female", age: 21, kg: 60 }), P.restingKcalPerDay({ sex: "female", age: 21, kg: 60, cm: 165 }));
  // diverse and prefer not to say: between female and male
  const d = P.restingKcalPerDay({ sex: "diverse", age: 21, kg: 70, cm: 175 });
  assert.ok(d > 1527.75 && d < 1693.75);
  assert.equal(P.restingKcalPerDay({ sex: "male", age: "", kg: 70 }), null);
});

test("calorie factor: women and older people burn a bit less per MET", () => {
  const m = P.kcalFactor({ sex: "male", age: 21, kg: 70, cm: 175 });
  const w = P.kcalFactor({ sex: "female", age: 21, kg: 70, cm: 175 });
  assert.ok(Math.abs(m - 1) < 0.02, `young man ≈ MET standard (${m})`);
  assert.ok(w < m && w > 0.85, `same body, woman ≈ 10 % less (${w})`);
  assert.ok(P.kcalFactor({ sex: "male", age: 60, kg: 70, cm: 175 }) < m);
  // unknown sex or age: unchanged
  assert.equal(P.kcalFactor({ age: 21, kg: 70 }), 1);
  assert.equal(P.kcalFactor({ sex: "male", kg: 70 }), 1);
  assert.equal(P.kcalFactor(null), 1);
  // stays within sensible bounds
  assert.equal(P.kcalFactor({ sex: "female", age: 99, kg: 250, cm: 120 }), 0.7);
});

/* ---------- Own program (Build my own) ---------- */
test("own days start from the chosen split, a custom split has named own days", () => {
  const d = P.ownDaysFor("ppl3", 3);
  assert.deepEqual(d.map(x => [x.name, x.tpl, x.mode]), [["Push", "push", "rec"], ["Pull", "pull", "rec"], ["Legs", "legs", "rec"]]);
  const c = P.ownDaysFor("custom", 2);
  assert.deepEqual(c.map(x => [x.name, x.tpl, x.mode]), [["Day 1", null, "own"], ["Day 2", null, "own"]]);
  assert.deepEqual(P.ownDaysFor("nope", 3), []);
});

test("own days: recommended needs a template, own needs 1 to 15 different exercises", () => {
  const days = P.ownDaysFor("ppl3", 3);
  assert.equal(P.validateOwnDays(days, 3).ok, true);
  assert.match(P.validateOwnDays(days, 4).error, /Set up 4 strength days/);
  const own = JSON.parse(JSON.stringify(days)); own[0].mode = "own";
  assert.equal(P.validateOwnDays(own, 3).day, 0);
  assert.match(P.validateOwnDays(own, 3).error, /Add at least one exercise to Push/);
  own[0].ex = ["bench", "incl"];
  assert.equal(P.validateOwnDays(own, 3).ok, true);
  own[0].ex = ["bench", "bench"];
  assert.match(P.validateOwnDays(own, 3).error, /twice/);
  own[0].ex = Array.from({ length: 16 }, (_, i) => "x" + i);
  assert.match(P.validateOwnDays(own, 3).error, /15 exercises or fewer/);
});

test("own days: names are required, short and plain", () => {
  const c = P.ownDaysFor("custom", 1); c[0].ex = ["bench"];
  assert.equal(P.validateOwnDays(c, 1).ok, true);
  c[0].name = "  "; assert.match(P.validateOwnDays(c, 1).error, /Give day 1 a name/);
  c[0].name = "Chest <b>"; assert.match(P.validateOwnDays(c, 1).error, /letters, numbers and spaces/);
  c[0].name = "x".repeat(31); assert.match(P.validateOwnDays(c, 1).error, /30 characters or fewer/);
  c[0].name = "Arms"; c[0].mode = "rec"; assert.match(P.validateOwnDays(c, 1).error, /no template/);
  assert.equal(P.validateOwnDays([], 1).ok, false);
});

test("own days go into the plan's strength sessions in week order", () => {
  const a = answers({ days: 5, mix: { s: 3, r: 1, y: 1 }, goals: ["muscle"] });
  a.split = "ppl3";
  const plan = P.suggestPlans(a)[0];
  const days = P.ownDaysFor("ppl3", 3); days[0].mode = "own"; days[0].ex = ["bench"]; days[0].name = "My Push";
  const keys = P.ownDayKeys(days);
  assert.deepEqual(keys, [{ workout: "own1", title: "My Push" }, { workout: "pull", title: "Pull" }, { workout: "legs", title: "Legs" }]);
  const out = P.applyOwnDays(plan, keys);
  const st = out.sessions.filter(x => x.kind === "s").sort((x, y) => x.day - y.day);
  assert.deepEqual(st.map(x => x.workout), ["own1", "pull", "legs"]);
  assert.equal(st[0].title, "My Push");
  assert.equal(P.applyOwnDays(plan, keys, "Custom split").split.name, "Custom split");
  assert.equal(P.applyOwnDays(plan, keys).split.name, plan.split.name);
  // runs and yoga stay, the original plan is not changed
  assert.equal(out.sessions.filter(x => x.kind !== "s").length, plan.sessions.filter(x => x.kind !== "s").length);
  assert.notEqual(plan.sessions.find(x => x.kind === "s").workout, "own1");
});

/* ---------- signing out ---------- */
test("sign out removes only NOVAFit's own storage keys", () => {
  const keys = ["po-plan-app-v2", "po-wx", "nf-news", "nf-guide-snap", "novafit-strava", "novafit-strava-state", "novafit-hist-strava",
    "onesignal-notification-prompt", "other-site", "nfx", "po", "POOL"];
  assert.deepEqual(P.appKeys(keys), ["po-plan-app-v2", "po-wx", "nf-news", "nf-guide-snap", "novafit-strava", "novafit-strava-state", "novafit-hist-strava"]);
  assert.deepEqual(P.appKeys("nope"), []);
  assert.deepEqual(P.appKeys([null, 3, "po-x"]), ["po-x"]);
});

test("own template: every exercise needs 1 to 10 sets when sets are given", () => {
  const P = require("../app/plan.js");
  const ok = P.validateBuild({ name: "Push", ex: ["bench", "dips"], sets: { bench: 3, dips: 2 } });
  assert.deepEqual(ok, { ok: true, name: "Push", ex: ["bench", "dips"], sets: { bench: 3, dips: 2 } });
  const miss = P.validateBuild({ name: "Push", ex: ["bench", "dips"], sets: { bench: 3, dips: 0 } });
  assert.equal(miss.ok, false);
  assert.deepEqual(miss.errors.noSets, ["dips"]);
  assert.match(miss.errors.sets, /at least one set/);
  assert.equal(P.validateBuild({ name: "Big", ex: ["bench"], sets: { bench: 40 } }).sets.bench, P.OWN_MAX_SETS);
  // without sets (sign-up path) nothing changes
  assert.deepEqual(P.validateBuild({ name: "Push", ex: ["bench"] }), { ok: true, name: "Push", ex: ["bench"] });
});

test("own days at sign-up: every chosen exercise needs at least one set", () => {
  const P = require("../app/plan.js");
  const day = (sets) => [{ name: "Push", mode: "own", ex: ["bench", "dips"], sets }];
  assert.equal(P.validateOwnDays(day({ bench: 3, dips: 2 }), 1).ok, true);
  const bad = P.validateOwnDays(day({ bench: 3, dips: 0 }), 1);
  assert.equal(bad.ok, false);
  assert.match(bad.error, /at least one set/);
  assert.equal(bad.day, 0);
  assert.equal(P.validateOwnDays([{ name: "Push", mode: "own", ex: ["bench"] }], 1).ok, true);   // older answers without sets
});
