/* NOVAFit · example data for the guided tour
   Eight weeks of sessions that fit the user's own plan, so the tour can show records, suggestions,
   Progress cards and badges on a brand-new account. The tour removes them again when it ends.
   Pure functions without any DOM access, so they run in the browser (window.NFTour)
   and in Node for the tests in tests/tour.test.js. */
(function (root) {
  "use strict";

  const DAY = 864e5, WEEK = 7 * DAY;
  const mondayOf = ts => { const d = new Date(ts); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - (d.getDay() + 6) % 7); return d.getTime(); };
  const BASE = { Barbell: 40, Dumbbell: 14, Machine: 35, Cable: 25, "Smith Machine": 35, Kettlebell: 12 };
  const round = (v, step) => Math.round(v / step) * step;

  /* o = {now, kinds: ["s","r","y"], sessions: [{day 0-6 (Mon-Sun), kind, workout}],
          exOf: workout -> [{id, s, r:[lo,hi], type, eq}], weeks?: 8}
     Returns {history, flex, mob}. Nothing lands on today, so Today still shows the next session. */
  function makeDemo(o) {
    const now = o.now, kinds = o.kinds || [], weeks = o.weeks || 8, ws = mondayOf(now);
    let ses = (o.sessions || []).filter(x => kinds.includes(x.kind) && x.day >= 0 && x.day < 7);
    // A sport on Train without plan days still gets a few example sessions
    if (kinds.includes("s") && !ses.some(x => x.kind === "s") && o.gymWorkout) ses = ses.concat([{ day: 0, kind: "s", workout: o.gymWorkout }, { day: 3, kind: "s", workout: o.gymWorkout }]);
    if (kinds.includes("r") && !ses.some(x => x.kind === "r")) ses = ses.concat([{ day: 1, kind: "r" }, { day: 5, kind: "r" }]);
    if (kinds.includes("y") && !ses.some(x => x.kind === "y")) ses = ses.concat([{ day: 3, kind: "y" }]);
    const out = []; let n = 0;
    for (let w = weeks; w >= 1; w--) {   // the current week stays empty, so Today shows the next session
      ses.forEach((x, j) => {
        const hour = x.kind === "r" ? 8 : x.kind === "y" ? 20 : 17;
        const start = ws - w * WEEK + x.day * DAY + hour * 3600e3 + j * 60e3, grow = (weeks - w) / weeks;
        const e = { id: "demo" + (n++), type: "", start, end: start, sets: {}, tread: null, run: null };
        if (x.kind === "s") {
          e.type = x.workout;
          (o.exOf(x.workout) || []).forEach(ex => {
            const top = ex.r && ex.r[1] ? ex.r[1] : 10, step = ex.eq === "Dumbbell" ? 1 : 2.5;
            const kg = ex.type && ex.type !== "w" ? "" : String(round((BASE[ex.eq] || 20) * (1 + 0.25 * grow), step));
            e.sets[ex.id] = Array.from({ length: ex.s || 3 }, () => ({ r: String(top), kg, ok: true }));
          });
          e.end = start + 55 * 60e3;
        } else if (x.kind === "r") {
          e.type = "lauf";
          const km = Math.round((5 + (j % 2 ? 3 : 0) + 2 * grow) * 10) / 10;
          e.run = { mode: "out", km: String(km), min: String(Math.round(km * (6.3 - 0.4 * grow) * 10) / 10), note: "" };
          e.end = start + Math.round(km * 6) * 60e3;
        } else {
          e.type = "yoga";
          e.yoga = { min: "30", flow: true, sid: w % 2 ? "vinyasa" : "winddown", note: "", calm: { b: 4, a: 2 } };
          e.end = start + 30 * 60e3;
        }
        out.push(e);
      });
    }
    out.sort((a, b) => a.start - b.start);
    const y = kinds.includes("y");
    return {
      history: out,
      flex: y ? [{ t: now - 40 * DAY, v: 1 }, { t: now - 26 * DAY, v: 2 }, { t: now - 12 * DAY, v: 3 }] : [],
      mob: y ? [now - 3 * DAY, now - 5 * DAY, now - 9 * DAY] : []
    };
  }

  // Numbers each step inside its chapter ("Gym · 3 / 14"); pauses and full-screen steps get none
  function number(steps) {
    const tot = {}, cnt = {};
    steps.forEach(s => { if (s.ch && !s.pause && !s.free) tot[s.ch] = (tot[s.ch] || 0) + 1; });
    return steps.map(s => {
      if (!s.ch || s.pause || s.free) return Object.assign({}, s, { n: 0, of: 0 });
      cnt[s.ch] = (cnt[s.ch] || 0) + 1;
      return Object.assign({}, s, { n: cnt[s.ch], of: tot[s.ch] });
    });
  }

  const api = { makeDemo, number, mondayOf };
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.NFTour = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
