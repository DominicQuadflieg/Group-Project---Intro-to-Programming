/* NOVAFit · onboarding logic
   Sign-up validation, questionnaire answers, strength splits and training plan suggestions.
   Pure functions without any DOM access, so they run in the browser (window.NFPlan)
   and in Node for the tests in tests/plan.test.js. */
(function (root) {
  "use strict";

  // Kinds of training: s = strength, r = running, y = yoga and mobility
  const KINDS = ["s", "r", "y"];
  const KIND_LABEL = { s: "Strength", r: "Running", y: "Yoga and mobility" };
  // Workout keys of the main app (W in index.html) a session starts
  const WORKOUT = { r: "lauf", y: "yoga" };
  const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  // Which weekdays (Mon = 0) get a session, so rest days are spread out
  const DAY_SETS = { 2: [0, 3], 3: [0, 2, 4], 4: [0, 1, 3, 5], 5: [0, 1, 2, 4, 5], 6: [0, 1, 2, 3, 4, 5] };
  const MIN_DAYS = 2, MAX_DAYS = 6, MAX_GOALS = 6, MAX_PER_KIND = 2;
  const LEVELS = ["beginner", "intermediate", "advanced"];
  const SEXES = ["female", "male", "diverse", "na"];
  const MIN_CM = 120, MAX_CM = 230;
  const MIN_AGE = 16, MAX_AGE = 99, MIN_KG = 30, MAX_KG = 250;
  const MINUTES = [30, 45, 60];

  // Predefined goals per kind. plan = name of the goal-focused plan.
  const GOALS = {
    r: [
      { id: "run5k", label: "Run 5 km without stopping", plan: "Road to 5 km" },
      { id: "run10k", label: "10 km under 60 minutes", plan: "Road to 10 km" },
      { id: "half", label: "Half marathon in 12 weeks", plan: "Half marathon build-up" },
      { id: "marathon", label: "Finish a marathon", plan: "Marathon build-up" },
      { id: "coast", label: "Seaside 10 km along the coast", plan: "Seaside 10 km build-up" }
    ],
    s: [
      { id: "pullup", label: "Your first pull-up", plan: "First pull-up plan" },
      { id: "hip20", label: "Hip thrust +20 kg", plan: "Glute strength plan" },
      { id: "muscle", label: "Build visible muscle", plan: "Muscle builder" },
      { id: "squat50", label: "50 bodyweight squats", plan: "Leg endurance plan" }
    ],
    y: [
      { id: "toes", label: "Touch your toes", plan: "Flexibility plan" },
      { id: "back", label: "Desk-proof back", plan: "Desk-proof back plan" },
      { id: "exam", label: "Exam-week stress relief", plan: "Calm through exams" },
      { id: "sleep", label: "Sleep better", plan: "Sleep and recover" }
    ]
  };

  function goalById(id) {
    for (const k of KINDS) {
      const g = GOALS[k].find(x => x.id === id);
      if (g) return Object.assign({ kind: k }, g);
    }
    return null;
  }

  /* ---------- Sign-up ---------- */
  const EMAIL_RE = /^[^\s@<>"]+@[^\s@<>"]+\.[A-Za-z]{2,}$/;

  function validateSignup(input) {
    const name = String((input && input.name) || "").trim();
    const email = String((input && input.email) || "").trim();
    const password = String((input && input.password) || "");
    const errors = {};
    if (!name) errors.name = "Enter your name";
    else if (name.length > 40) errors.name = "Use 40 characters or fewer";
    else if (/[<>{}]/.test(name)) errors.name = "Use letters, spaces or hyphens only";
    if (!email) errors.email = "Enter your email address";
    else if (email.length > 120 || !EMAIL_RE.test(email)) errors.email = "Enter a valid email address";
    if (password.length < 8) errors.password = "Use at least 8 characters";
    else if (password.length > 128) errors.password = "Use 128 characters or fewer";
    else if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) errors.password = "Include at least one letter and one number";
    return { ok: Object.keys(errors).length === 0, errors, value: { name, email: email.toLowerCase() } };
  }

  /* ---------- About you: sex, age, body weight ---------- */
  // Accepts numbers or text like "62,5" from the input fields
  function toNumber(v) {
    if (typeof v === "number") return v;
    const t = String(v == null ? "" : v).trim().replace(",", ".");
    return /^\d+(\.\d+)?$/.test(t) ? Number(t) : NaN;
  }

  // Height is optional: empty is fine, anything else must be a plausible height in cm
  /* A backup file brings training data and settings, never the account of this phone:
     name, email, password hash and the lock stay as they are. Only a phone without an
     account (Welcome back › Load backup file) takes the account from the file. */
  const ACCOUNT_KEYS = ["profile", "locked"];
  function backupSettings(settings, hasAccount) {
    const out = Object.assign({}, settings && typeof settings === "object" ? settings : {});
    if (hasAccount) ACCOUNT_KEYS.forEach(k => { delete out[k]; });
    return out;
  }

  /* One field at a time, for sign-up and for Settings › Profile and body: the error text, or "" when fine */
  function kgError(v) {
    const kg = toNumber(v);
    if (!Number.isFinite(kg)) return "Enter your weight in kg, e.g. 68 or 68.5";
    if (kg < MIN_KG || kg > MAX_KG) return `Enter a weight between ${MIN_KG} and ${MAX_KG} kg`;
    return "";
  }
  function cmError(v) {                       // height is optional: empty is fine
    const t = String(v == null ? "" : v).trim(); if (t === "") return "";
    const cm = toNumber(t);
    if (!Number.isFinite(cm)) return "Enter your height in cm, e.g. 175";
    if (cm < MIN_CM || cm > MAX_CM) return `Enter a height between ${MIN_CM} and ${MAX_CM} cm`;
    return "";
  }
  function validateBody(input) {
    const sex = (input && input.sex) || "", age = toNumber(input && input.age), kg = toNumber(input && input.kg);
    const cmRaw = String((input && input.cm) == null ? "" : input.cm).trim(), cm = cmRaw === "" ? null : toNumber(cmRaw);
    const errors = {};
    if (!SEXES.includes(sex)) errors.sex = "Choose an option";
    if (!Number.isInteger(age)) errors.age = "Enter your age in whole years";
    else if (age < MIN_AGE || age > MAX_AGE) errors.age = `Enter an age between ${MIN_AGE} and ${MAX_AGE}`;
    if (kgError(input && input.kg)) errors.kg = kgError(input && input.kg);
    if (cmError(cmRaw)) errors.cm = cmError(cmRaw);
    const ok = Object.keys(errors).length === 0;
    return { ok, errors, value: ok ? { sex, age, kg: Math.round(kg * 10) / 10, cm: cm === null ? null : Math.round(cm) } : null };
  }

  /* ---------- Calories: personal resting burn ---------- */
  // A MET counts 1 kcal per kg and hour at rest for everyone. Real resting burn is lower
  // for women than for men and drops with age, so MET estimates are personalised with the
  // Mifflin-St Jeor equation. Without a height, a typical height for the sex is used;
  // "diverse" and "prefer not to say" use the average of the female and male equations.
  const TYPICAL_CM = { female: 165, male: 178 };
  const SEX_OFFSET = { female: -161, male: 5 };

  function restingKcalPerDay(body) {
    const b = body || {}, kg = toNumber(b.kg), age = toNumber(b.age);
    if (!(kg > 0) || !(age > 0)) return null;
    const known = b.sex === "female" || b.sex === "male";
    let cm = toNumber(b.cm);
    if (!(cm >= MIN_CM && cm <= MAX_CM)) cm = known ? TYPICAL_CM[b.sex] : (TYPICAL_CM.female + TYPICAL_CM.male) / 2;
    const offset = known ? SEX_OFFSET[b.sex] : (SEX_OFFSET.female + SEX_OFFSET.male) / 2;
    return 10 * kg + 6.25 * cm - 5 * age + offset;
  }

  // Multiplier for MET-based calories: resting kcal per kg and hour (1 = the MET standard).
  // 1 when sex or age are unknown, so older profiles keep their numbers.
  function kcalFactor(body) {
    const b = body || {};
    if (!SEXES.includes(b.sex)) return 1;
    const r = restingKcalPerDay(b), kg = toNumber(b.kg);
    if (!r) return 1;
    return Math.min(1.25, Math.max(0.7, r / 24 / kg));
  }

  /* ---------- Questionnaire ---------- */
  const isInt = v => Number.isInteger(v);

  function validateDays(days) {
    if (!isInt(days) || days < MIN_DAYS || days > MAX_DAYS) return { ok: false, error: `Choose between ${MIN_DAYS} and ${MAX_DAYS} sessions` };
    return { ok: true };
  }

  function mixTotal(mix) { return KINDS.reduce((a, k) => a + ((mix && mix[k]) || 0), 0); }

  // Brings a mix to exactly `days` sessions: adds strength and running in turn,
  // removes yoga first, then whichever of strength and running is larger.
  function rebalanceMix(mix, days) {
    const m = { s: Math.max(0, (mix && mix.s) | 0), r: Math.max(0, (mix && mix.r) | 0), y: Math.max(0, (mix && mix.y) | 0) };
    while (mixTotal(m) < days) { if (m.s <= m.r) m.s++; else m.r++; }
    while (mixTotal(m) > days) { if (m.y > 0) m.y--; else if (m.s >= m.r) m.s--; else m.r--; }
    return m;
  }

  function validateMix(mix, days) {
    if (!mix || KINDS.some(k => !isInt(mix[k]) || mix[k] < 0)) return { ok: false, error: "Use whole numbers of 0 or more" };
    const t = mixTotal(mix);
    if (t !== days) return { ok: false, error: `Plan exactly ${days} sessions (${t} planned)` };
    return { ok: true };
  }

  function validateGoals(goals, mix) {
    if (!Array.isArray(goals) || goals.length === 0) return { ok: false, error: "Pick at least one goal" };
    if (goals.length > MAX_GOALS) return { ok: false, error: `Pick up to ${MAX_GOALS} goals` };
    if (new Set(goals).size !== goals.length) return { ok: false, error: "Each goal can only be picked once" };
    const per = { s: 0, r: 0, y: 0 };
    for (const id of goals) {
      const g = goalById(id);
      if (!g) return { ok: false, error: "Unknown goal" };
      if (mix && !(mix[g.kind] > 0)) return { ok: false, error: `Add a ${KIND_LABEL[g.kind].toLowerCase()} session for “${g.label}”` };
      if (++per[g.kind] > MAX_PER_KIND) return { ok: false, error: `Pick up to ${MAX_PER_KIND} ${KIND_LABEL[g.kind].toLowerCase()} goals` };
    }
    return { ok: true };
  }

  function validateAnswers(a) {
    if (!a) return { ok: false, error: "Answers are missing" };
    const checks = [validateDays(a.days), validateMix(a.mix, a.days), validateGoals(a.goals, a.mix)];
    if (!LEVELS.includes(a.level)) checks.push({ ok: false, error: "Choose your level" });
    if (!MINUTES.includes(a.min)) checks.push({ ok: false, error: "Choose a session length" });
    if (a.split != null && a.mix) checks.push(validateSplit(a.split, a.mix.s));
    const bad = checks.find(c => !c.ok);
    return bad || { ok: true };
  }

  /* ---------- Plans ---------- */
  function runTitles(a) {
    if (a.level === "beginner") return ["Easy run", "Run-walk intervals", "Easy run"];
    if (a.goals.includes("half") || a.goals.includes("marathon") || a.goals.includes("coast")) return ["Easy run", "Intervals 6 × 1 min", "Long run"];
    return ["Easy run", "Intervals 6 × 1 min", "Tempo run"];
  }

  /* ---------- Strength splits ---------- */
  // Strength workouts of the main app (W in index.html). group decides the mobility add-on.
  const WORKOUTS = {
    fbA: { title: "Full Body A", group: "full" }, fbB: { title: "Full Body B", group: "full" }, fbC: { title: "Full Body C", group: "full" },
    oben: { title: "Upper Body", group: "upper" }, upB: { title: "Upper Body B", group: "upper" },
    po: { title: "Lower Body", group: "lower" }, loB: { title: "Lower Body B", group: "lower" },
    push: { title: "Push", group: "push" }, pull: { title: "Pull", group: "pull" }, legs: { title: "Legs", group: "legs" }
  };
  // Sessions that load the legs heavily. A run the day after one of them is avoided.
  const HEAVY_LEGS = ["full", "lower", "legs"];
  // Short mobility routine suggested after a session (minutes match the routines in index.html)
  const ADDONS = {
    hips: { id: "hips", name: "Hip mobility", min: 10 },
    shoulders: { id: "shoulders", name: "Shoulder mobility", min: 6 },
    stretch: { id: "stretch", name: "Full-body stretch", min: 7 },
    runner: { id: "runner", name: "Runner's stretch", min: 6 }
  };
  const ADDON_FOR = { lower: "hips", legs: "hips", upper: "shoulders", push: "shoulders", pull: "shoulders", full: "stretch", run: "runner" };

  // Ways to split 1–6 strength sessions. fam links similar splits across session counts,
  // tags say which goals (or "beginner" / "none") a split is recommended for.
  const SPLITS = {
    1: [
      { id: "full1", fam: "full", name: "Full Body", workouts: ["fbA"], why: "Every muscle in one session", tags: ["beginner", "none", "muscle", "squat50"] },
      { id: "lower1", fam: "lower", name: "Lower Body", workouts: ["po"], why: "Legs and glutes, your runs cover the rest", tags: ["hip20"] },
      { id: "upper1", fam: "upper", name: "Upper Body", workouts: ["oben"], why: "Back, chest and arms", tags: ["pullup"] }
    ],
    2: [
      { id: "full2", fam: "full", name: "2× Full Body", workouts: ["fbA", "fbB"], why: "Every muscle twice a week. Simple and effective", tags: ["beginner", "none", "squat50"] },
      { id: "ul2", fam: "ul", name: "Upper + Lower", workouts: ["oben", "po"], why: "More exercises per muscle, longer rest in between", tags: ["muscle", "pullup"] },
      { id: "lf2", fam: "lower", name: "Lower + Full Body", workouts: ["po", "fbB"], why: "Glutes and legs twice, upper body once", tags: ["hip20"] }
    ],
    3: [
      { id: "full3", fam: "full", name: "3× Full Body", workouts: ["fbA", "fbB", "fbC"], why: "Each muscle three times a week. Great to learn the lifts", tags: ["beginner", "none", "squat50"] },
      { id: "ppl3", fam: "ppl", name: "Push / Pull / Legs", workouts: ["push", "pull", "legs"], why: "One focus per day, lots of volume per muscle", tags: ["muscle"] },
      { id: "u2l1", fam: "upper", name: "2× Upper + 1× Lower", workouts: ["oben", "po", "upB"], why: "Extra back and arm work", tags: ["pullup"] },
      { id: "u1l2", fam: "lower", name: "1× Upper + 2× Lower", workouts: ["po", "oben", "loB"], why: "Extra glute and leg work", tags: ["hip20"] }
    ],
    4: [
      { id: "ul4", fam: "ul", name: "Upper / Lower ×2", workouts: ["oben", "po", "upB", "loB"], why: "The classic for four days: each muscle twice", tags: ["muscle", "none", "pullup"] },
      { id: "pplf", fam: "ppl", name: "Push / Pull / Legs + Full Body", workouts: ["push", "pull", "legs", "fbA"], why: "Focused days plus one session for everything", tags: [] },
      { id: "f2ul", fam: "full", name: "2× Full Body + Upper + Lower", workouts: ["fbA", "oben", "fbB", "po"], why: "Easy to follow, each muscle two to three times", tags: ["beginner", "squat50"] },
      { id: "glute4", fam: "lower", name: "Glute focus", workouts: ["po", "oben", "loB", "fbB"], why: "Three sessions with glute work", tags: ["hip20"] }
    ],
    5: [
      { id: "pplul", fam: "ppl", name: "Push / Pull / Legs + Upper / Lower", workouts: ["push", "pull", "legs", "oben", "po"], why: "High volume for building muscle", tags: ["muscle", "none"] },
      { id: "ulf", fam: "ul", name: "Upper / Lower ×2 + Full Body", workouts: ["oben", "po", "upB", "loB", "fbA"], why: "Balanced and easy to recover from", tags: ["beginner", "pullup", "squat50"] },
      { id: "glute5", fam: "lower", name: "Glute focus", workouts: ["po", "oben", "loB", "upB", "fbB"], why: "Glutes and legs three times a week", tags: ["hip20"] }
    ],
    6: [
      { id: "ppl6", fam: "ppl", name: "Push / Pull / Legs ×2", workouts: ["push", "pull", "legs", "push", "pull", "legs"], why: "Every muscle twice with one focus per day", tags: ["muscle", "none"] },
      { id: "ul6", fam: "ul", name: "Upper / Lower ×3", workouts: ["oben", "po", "upB", "loB", "oben", "po"], why: "Simple rotation, each muscle three times", tags: ["pullup", "beginner", "squat50"] },
      { id: "glute6", fam: "lower", name: "Glute focus", workouts: ["po", "oben", "loB", "upB", "po", "fbB"], why: "Four sessions with glute work", tags: ["hip20"] }
    ]
  };

  const splitsFor = n => SPLITS[n] || [];
  function splitById(id) {
    for (const n of Object.keys(SPLITS)) { const s = SPLITS[n].find(x => x.id === id); if (s) return s; }
    return null;
  }

  // Best split for n strength sessions: one tagged with a strength goal (in the order picked),
  // otherwise the beginner split for beginners, otherwise the general one.
  function recommendSplit(n, goals, level) {
    const list = splitsFor(n);
    if (!list.length) return null;
    for (const g of goals || []) { const s = list.find(x => x.tags.includes(g)); if (s) return { split: s, reason: "goal", goal: g }; }
    if (level === "beginner") { const s = list.find(x => x.tags.includes("beginner")); if (s) return { split: s, reason: "beginner" }; }
    return { split: list.find(x => x.tags.includes("none")) || list[0], reason: "general" };
  }

  // The split a plan with n strength sessions uses: the chosen one, else the same family, else the recommendation.
  function splitFor(n, preferred, a) {
    const list = splitsFor(n);
    if (!list.length) return null;
    const pick = list.find(x => x.id === preferred);
    if (pick) return pick;
    const pref = splitById(preferred), fam = pref && list.find(x => x.fam === pref.fam);
    return fam || recommendSplit(n, a && a.goals, a && a.level).split;
  }

  function validateSplit(id, n) {
    if (!(n > 0)) return { ok: true };
    if (!splitsFor(n).some(x => x.id === id)) return { ok: false, error: "Choose how to split your strength training" };
    return { ok: true };
  }

  /* ---------- Week schedule ---------- */
  // All orders of a mix, e.g. s, r, s and s, s, r for {s: 2, r: 1}
  function kindOrders(mix) {
    const left = { s: mix.s, r: mix.r, y: mix.y }, cur = [], out = [], n = mixTotal(mix);
    (function rec() {
      if (cur.length === n) { out.push(cur.slice()); return; }
      for (const k of KINDS) if (left[k] > 0) { left[k]--; cur.push(k); rec(); cur.pop(); left[k]++; }
    })();
    return out;
  }
  // The old greedy order: most sessions left first, never the same kind twice in a row
  function greedyOrder(mix) {
    const left = { s: mix.s, r: mix.r, y: mix.y }, out = [];
    let last = "";
    for (let i = 0; i < mixTotal(mix); i++) {
      const open = KINDS.filter(k => left[k] > 0).sort((x, y) => left[y] - left[x] || KINDS.indexOf(x) - KINDS.indexOf(y));
      const k = open.find(o => o !== last) || open[0];
      left[k]--; out.push(k); last = k;
    }
    return out;
  }

  function buildSessions(order, days, a, min, split) {
    const used = { s: 0, r: 0, y: 0 }, runs = runTitles(a), strength = split ? split.workouts : [];
    return order.map((k, i) => {
      const j = used[k]++;
      let workout, title, group;
      if (k === "s") { workout = strength[j % strength.length]; title = WORKOUTS[workout].title; group = WORKOUTS[workout].group; }
      else if (k === "r") { workout = WORKOUT.r; title = runs[j % runs.length]; group = "run"; }
      else { workout = WORKOUT.y; title = j % 2 ? "Mobility flow" : "Vinyasa flow"; }
      const s = { day: days[i], kind: k, workout, title, min: k === "y" ? Math.min(min, 30) : min };
      if (group) s.addon = Object.assign({}, ADDONS[ADDON_FOR[group]]);
      return s;
    });
  }

  // 100 per pair of the same kind back to back, 10 per run on the day after a heavy leg session
  function scheduleScore(sessions) {
    let score = 0;
    for (let i = 1; i < sessions.length; i++) {
      const p = sessions[i - 1], c = sessions[i];
      if (p.kind === c.kind) score += 100;
      if (c.kind === "r" && p.kind === "s" && c.day === p.day + 1 && HEAVY_LEGS.includes(WORKOUTS[p.workout].group)) score += 10;
    }
    return score;
  }

  // Spreads the sessions of a mix over the week: never the same kind twice in a row and no run
  // the day after heavy legs, if it can be avoided. Strength sessions follow the split's order.
  // Returns [{day, kind, workout, title, min, addon}].
  function scheduleWeek(mix, a, min, split) {
    const n = mixTotal(mix), days = DAY_SETS[n] || DAY_SETS[MAX_DAYS].slice(0, n);
    const sp = mix.s > 0 ? (split || splitFor(mix.s, a.split, a)) : null;
    let best = null, bestScore = Infinity;
    for (const order of [greedyOrder(mix)].concat(kindOrders(mix))) {
      const sessions = buildSessions(order, days, a, min, sp), score = scheduleScore(sessions);
      if (score < bestScore) { best = sessions; bestScore = score; }
      if (score === 0) break;
    }
    return best;
  }

  function mainKind(goals) {
    const count = { s: 0, r: 0, y: 0 };
    goals.forEach(id => { const g = goalById(id); if (g) count[g.kind]++; });
    const first = goalById(goals[0]);
    return KINDS.slice().sort((x, y) => count[y] - count[x] || (first && x === first.kind ? -1 : first && y === first.kind ? 1 : 0))[0];
  }

  function makePlan(id, name, why, mix, a, min, best) {
    const split = mix.s > 0 ? splitFor(mix.s, a.split, a) : null;
    return { id, name, why, best: !!best, days: mixTotal(mix), mix: Object.assign({}, mix), min, level: a.level, goals: a.goals.slice(),
      split: split ? { id: split.id, name: split.name } : null, sessions: scheduleWeek(mix, a, min, split) };
  }

  // Three suggestions: the mix as chosen, one shifted towards the main goal, and an easier start.
  function suggestPlans(a) {
    const check = validateAnswers(a);
    if (!check.ok) throw new Error(check.error);
    const main = mainKind(a.goals);
    const goalKinds = new Set(a.goals.map(id => goalById(id).kind));
    const plans = [makePlan("balanced", "Your balanced week", "Exactly the mix you chose", a.mix, a, a.min, false)];

    const focus = Object.assign({}, a.mix);
    const donor = KINDS.filter(k => k !== main && focus[k] > 0 && !(goalKinds.has(k) && focus[k] === 1))
      .sort((x, y) => focus[y] - focus[x])[0];
    let why = `Already centred on ${KIND_LABEL[main].toLowerCase()}`;
    if (donor) { focus[donor]--; focus[main]++; why = `One ${KIND_LABEL[donor].toLowerCase()} session becomes ${KIND_LABEL[main].toLowerCase()}`; }
    else if (a.days < MAX_DAYS) { focus[main]++; why = `One extra ${KIND_LABEL[main].toLowerCase()} session`; }
    const goal = goalById(a.goals.find(id => goalById(id).kind === main));
    plans.push(makePlan("focus", goal.plan, why, focus, a, a.min, true));

    const easy = Object.assign({}, a.mix);
    if (a.days > MIN_DAYS) {
      const cut = KINDS.filter(k => easy[k] > 0 && !(goalKinds.has(k) && easy[k] === 1)).sort((x, y) => (x === main) - (y === main) || easy[y] - easy[x])[0];
      if (cut) easy[cut]--;
    }
    const easyMin = Math.max(30, a.min - 15);
    plans.push(makePlan("easy", "Easy start", mixTotal(easy) < a.days ? "One session less a week" : "Shorter yoga sessions", easy, a, easyMin, false));
    return plans;
  }

  /* ---------- Using a plan ---------- */
  const weekdayIndex = date => (new Date(date).getDay() + 6) % 7; // Mon = 0 … Sun = 6

  function sessionOn(plan, date) {
    if (!plan || !Array.isArray(plan.sessions)) return null;
    const d = weekdayIndex(date);
    return plan.sessions.find(s => s.day === d) || null;
  }

  function nextSession(plan, date) {
    if (!plan || !Array.isArray(plan.sessions) || !plan.sessions.length) return null;
    const d = weekdayIndex(date);
    const sorted = plan.sessions.slice().sort((x, y) => x.day - y.day);
    const s = sorted.find(x => x.day >= d) || sorted[0];
    return Object.assign({ inDays: (s.day - d + 7) % 7 }, s);
  }

  /* ---------- Own program ("Build my own") ---------- */
  // Each strength day is either "rec" (a ready-made template, exercises can still be added in the
  // workout) or "own" (the user picks every exercise, no suggestions). A custom split has only
  // own days with names the user gives them.
  const OWN_MAX_EX = 15, OWN_NAME_MAX = 30, OWN_MAX_SETS = 10;
  const STRENGTH_MODES = ["rec", "own"];

  function ownDaysFor(splitId, n) {
    if (splitId === "custom") return Array.from({ length: n }, (_, i) => ({ name: `Day ${i + 1}`, tpl: null, mode: "own", ex: [] }));
    const sp = splitById(splitId);
    if (!sp) return [];
    return sp.workouts.map(k => ({ name: WORKOUTS[k].title, tpl: k, mode: "rec", ex: [] }));
  }

  function validateOwnDays(days, n) {
    if (!Array.isArray(days) || !days.length) return { ok: false, error: "Choose a split first", day: -1 };
    if (Number.isInteger(n) && days.length !== n) return { ok: false, error: `Set up ${n} strength ${n === 1 ? "day" : "days"}`, day: -1 };
    for (let i = 0; i < days.length; i++) {
      const d = days[i] || {}, name = String(d.name || "").trim(), label = name || `Day ${i + 1}`;
      if (!name) return { ok: false, error: `Give day ${i + 1} a name`, day: i };
      if (name.length > OWN_NAME_MAX) return { ok: false, error: `Use ${OWN_NAME_MAX} characters or fewer for “${label.slice(0, 12)}…”`, day: i };
      if (/[<>{}]/.test(name)) return { ok: false, error: `Use letters, numbers and spaces for “${label}”`, day: i };
      if (!STRENGTH_MODES.includes(d.mode)) return { ok: false, error: `Choose Recommended or Choose my own for ${label}`, day: i };
      if (d.mode === "rec" && !WORKOUTS[d.tpl]) return { ok: false, error: `${label} has no template, choose your own exercises`, day: i };
      if (d.mode === "own") {
        const ex = Array.isArray(d.ex) ? d.ex : [];
        if (!ex.length) return { ok: false, error: `Add at least one exercise to ${label}`, day: i };
        if (ex.length > OWN_MAX_EX) return { ok: false, error: `Use ${OWN_MAX_EX} exercises or fewer on ${label}`, day: i };
        if (new Set(ex).size !== ex.length) return { ok: false, error: `${label} has an exercise twice`, day: i };
        if (d.sets && typeof d.sets === "object" && ex.some(id => !(Math.floor(Number(d.sets[id]) || 0) >= 1)))
          return { ok: false, error: `Add at least one set to every exercise on ${label}`, day: i };
      }
    }
    return { ok: true };
  }

  // The workout key and title each own day stands for: a template key, or own1, own2, … for own days
  function ownDayKeys(days) {
    return (days || []).map((d, i) => ({ workout: d.mode === "own" ? `own${i + 1}` : d.tpl, title: String(d.name || "").trim() || `Day ${i + 1}` }));
  }

  // Puts the own days into a suggested plan: the strength sessions, in week order, take them in turn
  // name (optional) replaces the split's name in the plan, e.g. "Custom split"
  function applyOwnDays(plan, keys, name) {
    if (!plan || !Array.isArray(plan.sessions) || !keys || !keys.length) return plan;
    const out = JSON.parse(JSON.stringify(plan));
    out.sessions.filter(x => x.kind === "s").sort((x, y) => x.day - y.day)
      .forEach((x, i) => { const k = keys[i % keys.length]; x.workout = k.workout; x.title = k.title; });
    if (out.split) out.split = Object.assign({}, out.split, { own: true }, name ? { name } : {});
    return out;
  }

  /* ---------- Which sports the Train tab shows ---------- */
  // "s" gym, "r" run, "y" yoga, always in that order. chosen: what the person picked in "Edit Train";
  // without a valid choice: the sports in the plan, and without a plan all three.
  const SPORTS = ["s", "r", "y"];
  function trainKinds(plan, chosen) {
    const pick = Array.isArray(chosen) ? SPORTS.filter(k => chosen.includes(k)) : [];
    if (pick.length) return pick;
    const inPlan = plan && Array.isArray(plan.sessions) ? SPORTS.filter(k => plan.sessions.some(x => x && x.kind === k)) : [];
    return inPlan.length ? inPlan : SPORTS.slice();
  }
  // Switch one sport on or off. At least one has to stay on.
  function toggleKind(kinds, k) {
    if (!SPORTS.includes(k)) return { ok: false, kinds: kinds.slice(), error: "Unknown sport" };
    const next = kinds.includes(k) ? kinds.filter(x => x !== k) : SPORTS.filter(x => x === k || kinds.includes(x));
    return next.length ? { ok: true, kinds: next } : { ok: false, kinds: kinds.slice(), error: "Keep at least one sport on Train" };
  }

  /* ---------- Which chapters a review shows ---------- */
  // kinds: the sports done in the period ("s", "r", "y"); has: {goal, flex} extra data that exists.
  // Every sport gets the same room: up to two slides each, always in the order gym, run, yoga.
  function reviewPlan(kinds, has) {
    const h = has || {}, k = Array.isArray(kinds) ? kinds : [], out = [];
    if (k.includes("s")) out.push("gym", "muscles");
    if (k.includes("r")) { out.push("run"); if (h.goal) out.push("goal"); }
    if (k.includes("y")) { out.push("yoga"); if (h.flex) out.push("flex"); }
    if (out.length) out.push("next");
    return out;
  }

  /* ---------- Build your own gym workout (from "Edit Train") ---------- */
  // name: 1–OWN_NAME_MAX characters, ex: 1–OWN_MAX_EX known exercise ids (known(id) → true/false).
  // Returns {ok, name, ex} or {ok:false, errors:{name?, ex?}} with a message for each field.
  function validateBuild(b, known) {
    const name = String((b && b.name) || "").replace(/\s+/g, " ").trim();
    const ex = [...new Set((Array.isArray(b && b.ex) ? b.ex : []).filter(id => typeof id === "string" && (!known || known(id))))];
    const errors = {};
    if (!name) errors.name = "Give your workout a name";
    else if (name.length > OWN_NAME_MAX) errors.name = `At most ${OWN_NAME_MAX} characters`;
    if (!ex.length) errors.ex = "Add at least one exercise";
    else if (ex.length > OWN_MAX_EX) errors.ex = `At most ${OWN_MAX_EX} exercises`;
    // Sets per exercise (from the template builder): every exercise needs 1 to OWN_MAX_SETS sets
    let sets;
    if (b && b.sets && typeof b.sets === "object") {
      sets = {};
      const none = [];
      ex.forEach(id => { const n = Math.floor(Number(b.sets[id]) || 0); if (n < 1) none.push(id); sets[id] = Math.min(OWN_MAX_SETS, Math.max(0, n)); });
      if (none.length && !errors.ex) { errors.sets = none.length === 1 ? "Add at least one set to the exercise marked red" : `Add at least one set to the ${none.length} exercises marked red`; errors.noSets = none; }
    }
    return Object.keys(errors).length ? { ok: false, errors } : (sets ? { ok: true, name, ex, sets } : { ok: true, name, ex });
  }
  // Puts a workout on a strength day of the plan (replaces that day's workout). Other days stay as they are;
  // a day without a strength session leaves the plan unchanged. Never changes the plan it was given.
  function placeInPlan(plan, day, key, title) {
    if (!plan || !Array.isArray(plan.sessions)) return plan;
    const out = JSON.parse(JSON.stringify(plan));
    const s = out.sessions.find(x => x.day === day && x.kind === "s");
    if (s && typeof key === "string" && key) { s.workout = key; s.title = String(title || s.title); }
    return out;
  }

  /* ---------- signing out ----------
     Everything NOVAFit keeps in the browser's storage starts with one of these prefixes:
     po- (training data, weather), nf- (news, tab, tour), novafit- (Strava login, imports).
     Signing out removes exactly these and leaves other sites' or tools' keys alone. */
  const APP_KEY = /^(po-|nf-|novafit-)/;
  function appKeys(keys) {
    return (Array.isArray(keys) ? keys : []).filter(k => typeof k === "string" && APP_KEY.test(k));
  }

  const api = {
    appKeys,
    KINDS, KIND_LABEL, DAY_NAMES, GOALS, LEVELS, MINUTES, MIN_DAYS, MAX_DAYS, MAX_GOALS, MAX_PER_KIND,
    SEXES, MIN_AGE, MAX_AGE, MIN_KG, MAX_KG, MIN_CM, MAX_CM, backupSettings, kgError, cmError,
    goalById, validateSignup, validateBody, toNumber, restingKcalPerDay, kcalFactor, validateDays, validateMix, validateGoals, validateAnswers,
    rebalanceMix, mixTotal, scheduleWeek, suggestPlans, weekdayIndex, sessionOn, nextSession,
    WORKOUTS, HEAVY_LEGS, ADDONS, ADDON_FOR, SPLITS, splitsFor, splitById, recommendSplit, splitFor, validateSplit,
    OWN_MAX_EX, OWN_NAME_MAX, STRENGTH_MODES, ownDaysFor, validateOwnDays, ownDayKeys, applyOwnDays,
    SPORTS, trainKinds, toggleKind, reviewPlan, validateBuild, placeInPlan, OWN_MAX_SETS
  };
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.NFPlan = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
