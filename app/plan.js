/* NOVAFit · onboarding logic
   Sign-up validation, questionnaire answers and training plan suggestions.
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
  const MIN_DAYS = 2, MAX_DAYS = 6, MAX_GOALS = 3;
  const LEVELS = ["beginner", "intermediate", "advanced"];
  const MINUTES = [30, 45, 60];

  // Predefined goals per kind. plan = name of the goal-focused plan.
  const GOALS = {
    r: [
      { id: "run5k", label: "Run 5 km without stopping", plan: "Road to 5 km" },
      { id: "run10k", label: "10 km under 60 minutes", plan: "Road to 10 km" },
      { id: "half", label: "Half marathon in 12 weeks", plan: "Half marathon build-up" },
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
    for (const id of goals) {
      const g = goalById(id);
      if (!g) return { ok: false, error: "Unknown goal" };
      if (mix && !(mix[g.kind] > 0)) return { ok: false, error: `Add a ${KIND_LABEL[g.kind].toLowerCase()} session for “${g.label}”` };
    }
    return { ok: true };
  }

  function validateAnswers(a) {
    if (!a) return { ok: false, error: "Answers are missing" };
    const checks = [validateDays(a.days), validateMix(a.mix, a.days), validateGoals(a.goals, a.mix)];
    if (!LEVELS.includes(a.level)) checks.push({ ok: false, error: "Choose your level" });
    if (!MINUTES.includes(a.min)) checks.push({ ok: false, error: "Choose a session length" });
    const bad = checks.find(c => !c.ok);
    return bad || { ok: true };
  }

  /* ---------- Plans ---------- */
  function runTitles(a) {
    if (a.level === "beginner") return ["Easy run", "Run-walk intervals", "Easy run"];
    if (a.goals.includes("half") || a.goals.includes("coast")) return ["Easy run", "Intervals 6 × 1 min", "Long run"];
    return ["Easy run", "Intervals 6 × 1 min", "Tempo run"];
  }

  // Spreads the sessions of a mix over the week, never the same kind twice in a row
  // if it can be avoided. Returns [{day, kind, workout, title, min}].
  function scheduleWeek(mix, a, min) {
    const n = mixTotal(mix), days = DAY_SETS[n] || DAY_SETS[MAX_DAYS].slice(0, n);
    const left = { s: mix.s, r: mix.r, y: mix.y }, used = { s: 0, r: 0, y: 0 };
    const strength = a.goals.includes("pullup") ? ["oben", "po"] : ["po", "oben"];
    const runs = runTitles(a), out = [];
    let last = "";
    for (let i = 0; i < n; i++) {
      const open = KINDS.filter(k => left[k] > 0).sort((x, y) => left[y] - left[x] || KINDS.indexOf(x) - KINDS.indexOf(y));
      const k = open.find(o => o !== last) || open[0];
      const j = used[k]++;
      left[k]--; last = k;
      let workout, title;
      if (k === "s") { workout = strength[j % 2]; title = workout === "po" ? "Glute Day" : "Upper Body"; }
      else if (k === "r") { workout = WORKOUT.r; title = runs[j % runs.length]; }
      else { workout = WORKOUT.y; title = j % 2 ? "Mobility flow" : "Vinyasa flow"; }
      out.push({ day: days[i], kind: k, workout, title, min: k === "y" ? Math.min(min, 30) : min });
    }
    return out;
  }

  function mainKind(goals) {
    const count = { s: 0, r: 0, y: 0 };
    goals.forEach(id => { const g = goalById(id); if (g) count[g.kind]++; });
    const first = goalById(goals[0]);
    return KINDS.slice().sort((x, y) => count[y] - count[x] || (first && x === first.kind ? -1 : first && y === first.kind ? 1 : 0))[0];
  }

  function makePlan(id, name, why, mix, a, min, best) {
    return { id, name, why, best: !!best, days: mixTotal(mix), mix: Object.assign({}, mix), min, level: a.level, goals: a.goals.slice(), sessions: scheduleWeek(mix, a, min) };
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
    plans.push(makePlan("easy", "Easy start", mixTotal(easy) < a.days ? `One session less, ${easyMin} minutes each` : `Shorter sessions, ${easyMin} minutes each`, easy, a, easyMin, false));
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

  const api = {
    KINDS, KIND_LABEL, DAY_NAMES, GOALS, LEVELS, MINUTES, MIN_DAYS, MAX_DAYS, MAX_GOALS,
    goalById, validateSignup, validateDays, validateMix, validateGoals, validateAnswers,
    rebalanceMix, mixTotal, scheduleWeek, suggestPlans, weekdayIndex, sessionOn, nextSession
  };
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.NFPlan = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
