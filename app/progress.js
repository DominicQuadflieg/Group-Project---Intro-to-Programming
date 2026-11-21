/* NOVAFit · Progress logic
   Cards per sport, the special Nova badges and small calculations for the Progress page.
   Pure functions without any DOM access, so they run in the browser (window.NFProg)
   and in Node for the tests in tests/progress.test.js. */
(function (root) {
  "use strict";

  const DAY = 864e5, WEEK = 7 * DAY;
  const mondayOf = ts => { const d = new Date(ts); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - (d.getDay() + 6) % 7); return d.getTime(); };

  /* ---- Cards on the Progress page ---- */
  const CARDS = {
    s: [
      { id: "score", t: "Strength score", d: "Your main lifts added up, as a curve" },
      { id: "record", t: "Last record & records this month", d: "Your newest best weight" },
      { id: "balance", t: "Balance", d: "Push vs pull, upper vs lower" },
      { id: "volume", t: "Volume per week", d: "With every exercise curve below" },
      { id: "max", t: "Estimated max (1 rep)", d: "What you could lift once, per exercise", nw: true },
      { id: "when", t: "When you train", d: "Your best hours of the day", nw: true },
      { id: "muscles", t: "Muscle map", d: "Which muscles got the most this month", nw: true },
      { id: "time", t: "Time in the gym", d: "Hours this month and per session", nw: true },
      { id: "heat", t: "Consistency", d: "Every session of the last 12 weeks", nw: true }
    ],
    r: [
      { id: "km", t: "Kilometres per week", d: "Last 8 weeks with your goal" },
      { id: "race", t: "If you raced today", d: "5 km, 10 km and half marathon" },
      { id: "pace", t: "Pace trend", d: "Your average pace per week" },
      { id: "goals", t: "Your goals", d: "Loop time and kilometres per month" },
      { id: "pbs", t: "Personal bests", d: "Fastest 5 km, fastest km, longest run", nw: true },
      { id: "story", t: "Distance story", d: "How far you would be from Nova SBE", nw: true },
      { id: "when", t: "When you run", d: "Your best hours of the day", nw: true },
      { id: "heat", t: "Consistency", d: "Every run of the last 12 weeks", nw: true }
    ],
    y: [
      { id: "calm", t: "Calm effect", d: "How much your tension drops" },
      { id: "flex", t: "Flexibility", d: "Your forward fold, step by step" },
      { id: "month", t: "This month", d: "Minutes on the mat and short routines" },
      { id: "fav", t: "Favourite sessions", d: "What you come back to", nw: true },
      { id: "when", t: "When you do yoga", d: "Your best hours of the day", nw: true },
      { id: "heat", t: "Consistency", d: "Every session of the last 12 weeks", nw: true }
    ]
  };
  const DEFAULT_CARDS = { s: ["score", "record", "balance", "volume"], r: ["km", "race", "pace", "goals"], y: ["calm", "flex", "month"] };
  const MAX_CARDS = 5;

  // The cards to show for one sport: saved choice (only known ids) or the defaults
  function cardsFor(saved, k) {
    const ok = new Set((CARDS[k] || []).map(c => c.id));
    const l = saved && Array.isArray(saved[k]) ? saved[k].filter(id => ok.has(id)) : null;
    return l && l.length ? l.slice(0, MAX_CARDS) : DEFAULT_CARDS[k].slice();
  }
  // Switch one card on or off. Returns {list, err}; at least one card stays, at most MAX_CARDS.
  function toggleCard(list, id, k) {
    const l = (list || []).slice(), i = l.indexOf(id);
    if (!(CARDS[k] || []).some(c => c.id === id)) return { list: l, err: "unknown" };
    if (i >= 0) { if (l.length <= 1) return { list: l, err: "min" }; l.splice(i, 1); return { list: l, err: "" }; }
    if (l.length >= MAX_CARDS) return { list: l, err: "max" };
    // keep the order of the catalogue so the page doesn't jump around
    const order = CARDS[k].map(c => c.id);
    l.push(id); l.sort((a, b) => order.indexOf(a) - order.indexOf(b));
    return { list: l, err: "" };
  }

  /* ---- Small calculations ---- */
  // Sum per week for the last n weeks (oldest first). items: [{t, v}]
  function perWeek(items, n, now) {
    const ws = mondayOf(now), out = Array(n).fill(0);
    (items || []).forEach(x => { const i = n - 1 - Math.round((ws - mondayOf(x.t)) / WEEK); if (i >= 0 && i < n) out[i] += x.v; });
    return out;
  }
  // Sessions per two-hour slot from 6 to 22 h; best = the busiest slot
  function hours(times) {
    const slots = [6, 8, 10, 12, 14, 16, 18, 20].map(h => ({ h, n: 0 }));
    (times || []).forEach(t => { const h = new Date(t).getHours(); const s = slots.find(x => h >= x.h && h < x.h + 2) || (h < 6 ? slots[0] : slots[7]); s.n++; });
    const best = slots.reduce((a, b) => b.n > a.n ? b : a, slots[0]);
    return { slots, best: best.n ? best : null };
  }
  // 12 weeks × 7 days: for each cell the kinds trained that day (oldest week first)
  function heat(items, now, weeks) {
    const n = weeks || 12, ws = mondayOf(now) - (n - 1) * WEEK, grid = Array.from({ length: n }, () => Array.from({ length: 7 }, () => []));
    (items || []).forEach(x => {
      if (x.t < ws || x.t >= ws + n * WEEK) return;
      const w = Math.floor((mondayOf(x.t) - ws) / WEEK + .01), d = Math.round((new Date(x.t).setHours(0, 0, 0, 0) - mondayOf(x.t)) / DAY);
      if (w >= 0 && w < n && d >= 0 && d < 7 && !grid[w][d].includes(x.k)) grid[w][d].push(x.k);
    });
    return grid;
  }
  // How far you'd be from Nova SBE in Carcavelos (rough road distances)
  const STOPS = [{ n: "Cascais", km: 8 }, { n: "Lisbon", km: 20 }, { n: "Setúbal", km: 55 }, { n: "Évora", km: 150 }, { n: "Porto", km: 320 }, { n: "Madrid", km: 640 }];
  function story(km) {
    const past = STOPS.filter(s => km >= s.km), next = STOPS.find(s => km < s.km) || null;
    return { past: past.length ? past[past.length - 1] : null, next, stops: STOPS.slice(0, 5), done: past.length };
  }

  /* ---- Special Nova badges ---- */
  // H: [{t: start, k: "s"|"r"|"y"}], mob: short routines done
  function specials(H, mob) {
    const L = (H || []).slice().sort((a, b) => a.t - b.t), weeks = {};
    L.forEach(x => { const w = mondayOf(x.t); (weeks[w] = weeks[w] || { n: 0, k: new Set() }).n++; weeks[w].k.add(x.k); });
    const W = Object.keys(weeks).map(Number);
    const triple = W.some(w => ["s", "r", "y"].every(k => weeks[w].k.has(k)));
    const sunrise = L.some(x => x.k === "r" && [0, 6].includes(new Date(x.t).getDay()) && new Date(x.t).getHours() < 8);
    const night = L.some(x => new Date(x.t).getHours() >= 21);
    let comeback = false;
    for (let i = 1; i < L.length; i++) if (L[i].t - L[i - 1].t >= 14 * DAY) { comeback = true; break; }
    // Advent: a session in each of the four weeks 1–7, 8–14, 15–21, 22–28 December of one year
    const advent = [...new Set(L.map(x => new Date(x.t).getFullYear()))].some(y =>
      [1, 8, 15, 22].every(d => L.some(x => { const a = new Date(x.t); return a.getFullYear() === y && a.getMonth() === 11 && a.getDate() >= d && a.getDate() < d + 7; })));
    return { triple, sunrise, night, comeback, advent, breaks: mob || 0 };
  }

  // Which badge groups someone sees: general and special always, a sport only if it's on Train
  function badgeVisible(b, kinds) {
    const k = kinds || [];
    if (b.all3) return ["s", "r", "y"].every(x => k.includes(x));
    if (b.g === "gym") return k.includes("s");
    if (b.g === "run" || b.need === "r") return k.includes("r");
    if (b.g === "yoga" || b.need === "y") return k.includes("y");
    return true;
  }

  const api = { CARDS, DEFAULT_CARDS, MAX_CARDS, cardsFor, toggleCard, perWeek, hours, heat, STOPS, story, specials, badgeVisible, mondayOf };
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.NFProg = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
