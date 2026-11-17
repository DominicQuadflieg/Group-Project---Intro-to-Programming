/* NOVAFit · running logic
   Reads runs from the text of a screenshot (after text recognition).
   Pure functions without any DOM access, so they run in the browser (window.NFRun)
   and in Node for the tests in tests/run.test.js. */
(function (root) {
  "use strict";

  const KM_PER_MI = 1.609344;
  const MIN_RUN = 3, MAX_RUN = 24 * 60;          // a plausible run lasts 3 min to 24 h
  const MIN_PACE = 2.5, MAX_PACE = 20;           // plausible pace in min/km

  const MONTHS = { jan: 0, feb: 1, mar: 2, mär: 2, mrz: 2, apr: 3, may: 4, mai: 4, jun: 5, jul: 6, aug: 7,
    sep: 8, oct: 9, okt: 9, nov: 10, dec: 11, dez: 11 };

  // Words that name a value on running app screens (English and German).
  // "Tempo" means pace in German, so it counts as pace.
  const LABELS = [
    ["pace", /\b(?:avg\.?\s*)?(?:pace|tempo)\b|ø\s*pace/i],
    ["dist", /\b(?:distance|distanz|strecke|dist)\b/i],
    ["dur", /\b(?:moving time|elapsed time|workout time|total time|time|duration|zeit|dauer|gesamtzeit|bewegungszeit|laufzeit)\b/i],
    ["other", /\b(?:elevation|elev|höhe|calories|kcal|heart|bpm|hf|cadence|steps|schritte|power|watt)\b/i]
  ];

  const toNum = v => { const n = parseFloat(String(v == null ? "" : v).replace(",", ".")); return isFinite(n) ? n : 0; };
  const round2 = n => Math.round(n * 100) / 100;

  /* Text recognition often reads O for 0 and l, I or | for 1. Fix that inside numbers only. */
  function cleanText(text) {
    return String(text || "")
      .replace(/[’′´`‘]/g, "'").replace(/[”″“]/g, '"').replace(/\r/g, "")
      .replace(/(^|[^A-Za-zÄÖÜäöüß])([0-9oOlI|]*[0-9][0-9oOlI|:.,]*)/g,
        (m, pre, tok) => pre + tok.replace(/[oO]/g, "0").replace(/[lI|]/g, "1"));
  }

  /* "42:38" → 42.63 min, "1:05:10" → 65.17 min. hours=true reads "1:05" as 1 h 5 min. */
  function clockToMin(tok, hours) {
    const p = tok.split(":").map(Number);
    if (p.length === 3) return p[0] * 60 + p[1] + p[2] / 60;
    return hours ? p[0] * 60 + p[1] : p[0] + p[1] / 60;
  }

  /* All time-like values in a line, with what they probably are. */
  function timeTokens(line) {
    const out = [];
    const re = /(\d{1,2}:\d{2}(?::\d{2})?)|(\d{1,2})'(\d{2})"?|(\d{1,2})\s*h\s*(\d{1,2})\s*m(?:in)?|(\d{1,3})\s*m(?:in)?\s*(\d{1,2})\s*s\b/gi;
    let m;
    while ((m = re.exec(line))) {
      const after = line.slice(m.index + m[0].length, m.index + m[0].length + 10);
      let v, pace = false;
      if (m[1]) v = clockToMin(m[1]);
      else if (m[2]) { v = +m[2] + +m[3] / 60; pace = true; }       // 6'11" is how apps write a pace
      else if (m[4]) v = +m[4] * 60 + +m[5];
      else v = +m[6] + +m[7] / 60;
      if (/^\s*(?:min)?\s*\/\s*(?:km|mi)/i.test(after)) pace = true;
      const perMile = /^\s*(?:min)?\s*\/\s*mi/i.test(after);
      const clock = /^\s*(?:am|pm)\b/i.test(after);
      out.push({ tok: m[0], at: m.index, v, pace, perMile, clock, hms: !!(m[1] && m[1].split(":").length === 3) });
    }
    return out;
  }

  /* Distance with a unit, e.g. "7.72 km", "10 km", "3.1 mi". Not "/km" and not "km/h". */
  function distWithUnit(line) {
    const m = line.match(/(\d{1,3}(?:[.,]\d{1,3})?)\s*(km|kilomet(?:er|re)s?|mi|miles?)\b(?!\s*\/)/i);
    if (!m || /\/\s*$/.test(line.slice(0, m.index))) return 0;
    const v = toNum(m[1]);
    return /^mi/i.test(m[2]) ? v * KM_PER_MI : v;
  }

  /* Plain numbers and times in the order they appear (for table rows like "7.72 km  5:31 /km  42:38"). */
  function valuesIn(line) {
    const out = [], re = /\d{1,2}:\d{2}(?::\d{2})?|\d{1,2}'\d{2}"?|\d+(?:[.,]\d+)?/g;
    let m;
    while ((m = re.exec(line))) out.push(m[0]);
    return out;
  }

  function labelsIn(line) {
    const out = [];
    LABELS.forEach(([k, re]) => { const m = line.match(re); if (m) out.push({ k, at: m.index }); });
    // "Moving Time" and "Pace" both contain a label; keep each kind once, sorted by position
    return out.sort((a, b) => a.at - b.at);
  }

  /* Reads the value of one kind from a piece of text. */
  function readValue(kind, txt) {
    if (kind === "dist") {
      const d = distWithUnit(txt); if (d) return d;
      const m = txt.match(/^\s*(\d{1,3}(?:[.,]\d{1,3})?)\s*$/); return m ? toNum(m[1]) : 0;
    }
    const t = timeTokens(txt).filter(x => !x.clock);
    if (!t.length) return 0;
    if (kind === "pace") return t[0].perMile ? t[0].v / KM_PER_MI : t[0].v;
    // a duration written as "1:05" next to a "Time" label is minutes:seconds in running apps
    return t[0].v;
  }

  /* Finds a date (and time of day) in the text. Returns a timestamp or 0. */
  function parseDate(lines, now) {
    const today = new Date(now);
    for (const l of lines) {
      let y, mo, d, rest = "", m;
      if ((m = l.match(/\b(\d{4})-(\d{1,2})-(\d{1,2})\b/))) { y = +m[1]; mo = +m[2] - 1; d = +m[3]; }
      else if ((m = l.match(/\b(\d{1,2})([./])(\d{1,2})\2(\d{2,4})\b/))) {
        d = +m[1]; mo = +m[3] - 1; y = +m[4];
        if (m[2] === "/" && +m[3] > 12) { d = +m[3]; mo = +m[1] - 1; }      // US style 11/17/2026
      }
      else if ((m = l.match(/\b([A-Za-zÄäÖöÜü]{3})[a-zäöü]*\.?\s+(\d{1,2}),?\s*(\d{4})?\b/)) && MONTHS[m[1].toLowerCase()] != null) {
        mo = MONTHS[m[1].toLowerCase()]; d = +m[2]; y = m[3] ? +m[3] : 0;
      }
      else if ((m = l.match(/\b(\d{1,2})\.?\s+([A-Za-zÄäÖöÜü]{3})[a-zäöü]*\.?,?\s*(\d{4})?\b/)) && MONTHS[m[2].toLowerCase()] != null) {
        d = +m[1]; mo = MONTHS[m[2].toLowerCase()]; y = m[3] ? +m[3] : 0;
      }
      else if ((m = l.match(/\b(today|heute)\b/i))) { y = today.getFullYear(); mo = today.getMonth(); d = today.getDate(); }
      else if ((m = l.match(/\b(yesterday|gestern)\b/i))) { const t = new Date(now - 864e5); y = t.getFullYear(); mo = t.getMonth(); d = t.getDate(); }
      else continue;
      rest = l.slice(m.index + m[0].length);
      if (y && y < 100) y += 2000;
      if (!y) { y = today.getFullYear(); if (new Date(y, mo, d).getTime() > now + 864e5) y--; }
      let hh = 12, mm = 0;
      const tm = rest.match(/(\d{1,2})[:.](\d{2})\s*(am|pm)?/i);
      if (tm) {
        hh = +tm[1]; mm = +tm[2];
        if (tm[3]) { const pm = /pm/i.test(tm[3]); if (pm && hh < 12) hh += 12; if (!pm && hh === 12) hh = 0; }
      }
      if (mo < 0 || mo > 11 || d < 1 || d > 31 || hh > 23 || mm > 59) continue;
      const t = new Date(y, mo, d, hh, mm).getTime();
      if (t < now + 36e5 && t > now - 400 * 864e5) return t;
    }
    return 0;
  }

  /* Reads distance (km), time (min), pace (min/km) and date from the text of a screenshot.
     Returns null if nothing useful was found. */
  function parseShot(text, now) {
    now = now || Date.now();
    const lines = cleanText(text).split("\n").map(l => l.trim()).filter(Boolean);
    const found = { dist: 0, dur: 0, pace: 0 };
    const set = (k, v) => { if (k !== "other" && !found[k] && v > 0) found[k] = v; };

    // 1. Labelled values: "Distance 7.72 km", "Time\n42:38", or a table header with values below
    lines.forEach((l, i) => {
      const lab = labelsIn(l);
      if (!lab.length) return;
      const next = lines[i + 1] || "";
      if (lab.length >= 2) {
        const vals = valuesIn(l).length ? [] : valuesIn(next);
        if (vals.length === lab.length) {
          // column values in the line below; units like "km" or "/km" stay attached through the next line
          lab.forEach((x, j) => set(x.k, readValue(x.k, vals[j] + (x.k === "dist" ? " km" : ""))));
          return;
        }
      }
      lab.forEach((x, j) => {
        // the text that belongs to this label: up to the next label on the line
        const end = j + 1 < lab.length ? lab[j + 1].at : l.length;
        let txt = l.slice(x.at, end).replace(LABELS.find(L => L[0] === x.k)[1], " ");
        if (!/\d/.test(txt) && lab.length === 1) txt = next;
        set(x.k, readValue(x.k, txt));
      });
    });

    // 2. Values without a label
    if (!found.dist) for (const l of lines) { const d = distWithUnit(l); if (d) { found.dist = d; break; } }
    const dateLine = l => /\b\d{1,2}[./]\d{1,2}[./]\d{2,4}\b|\b\d{4}-\d{2}-\d{2}\b|\b(?:today|heute|yesterday|gestern)\b|\bat\b|\bum\b/i.test(l)
      || /\b(?:jan|feb|mar|mär|apr|may|mai|jun|jul|aug|sep|oct|okt|nov|dec|dez)[a-z]*\.?\s+\d/i.test(l);
    const all = [];
    let barSeen = false;
    lines.forEach((l, i) => timeTokens(l).forEach(t => {
      // the clock in the status bar is the first time that sits alone in one of the first lines
      const statusBar = !barSeen && i < 3 && l.replace(t.tok, "").replace(/[^A-Za-z0-9]/g, "").length <= 3 && !t.hms;
      if (statusBar) barSeen = true;
      all.push(Object.assign({ clockLike: t.clock || dateLine(l), statusBar }, t));
    }));
    if (!found.pace) { const p = all.find(t => t.pace && !t.clockLike); if (p) found.pace = p.perMile ? p.v / KM_PER_MI : p.v; }
    if (!found.dur) {
      // prefer times below the status bar; use a lone time at the top only if there is nothing else
      const c = all.filter(t => !t.pace && !t.clockLike && (t.hms || (t.v >= 8 && t.v <= 300)));
      const pick = c.find(t => t.hms && !t.statusBar) || c.find(t => !t.statusBar) || c[0];
      if (pick) found.dur = pick.v;
    }

    // 3. Check the numbers against each other
    let km = found.dist, min = found.dur;
    const pace = found.pace;
    if (min && pace) {
      const est = min / pace;
      const p = km ? min / km : 0;
      if (!km || p < MIN_PACE || p > MAX_PACE) km = est;
    } else if (!min && km && pace) min = km * pace;
    if (min && (min < MIN_RUN || min > MAX_RUN)) min = 0;
    if (km > 300) km = 0;
    if (!(min > 0) && !(km > 0)) return null;
    return { km: km > 0 ? round2(km) : 0, min: min > 0 ? min : 0, pace: km > 0 && min > 0 ? min / km : 0, at: parseDate(lines, now) };
  }

  /* Checks the values the runner confirms after reading a screenshot.
     km may be empty, time is required ("42:38", "1:05:10" or minutes), date optional. */
  function validateRun(input, now) {
    now = now || Date.now();
    const errors = {}, value = {};
    const kmTxt = String(input.km == null ? "" : input.km).trim();
    if (kmTxt) {
      if (!/^\d{1,3}([.,]\d{1,3})?$/.test(kmTxt)) errors.km = "Enter the distance as a number, e.g. 7.72";
      else if (toNum(kmTxt) <= 0 || toNum(kmTxt) > 300) errors.km = "The distance must be between 0 and 300 km";
      else value.km = toNum(kmTxt);
    } else value.km = 0;
    const t = String(input.time == null ? "" : input.time).trim();
    let min = 0;
    if (!t) errors.time = "Enter your time";
    else if (/^\d{1,2}:\d{2}(:\d{2})?$/.test(t)) {
      const p = t.split(":").map(Number);
      if (p.slice(1).some(x => x > 59)) errors.time = "Minutes and seconds go up to 59";
      else min = clockToMin(t);
    } else if (/^\d{1,4}([.,]\d+)?$/.test(t)) min = toNum(t);
    else errors.time = "Enter the time like 42:38 or 1:05:10";
    if (!errors.time) {
      if (min < MIN_RUN || min > MAX_RUN) errors.time = "The time must be between 3 minutes and 24 hours";
      else value.min = min;
    }
    if (!errors.km && !errors.time && value.km > 0) {
      const p = value.min / value.km;
      if (p < MIN_PACE) errors.km = "That would be faster than a world record – please check distance and time";
    }
    const d = String(input.date == null ? "" : input.date).trim();
    if (d) {
      const at = new Date(d).getTime();
      if (!isFinite(at)) errors.date = "Enter a valid date";
      else if (at > now + 36e5) errors.date = "The date can't be in the future";
      else value.at = at;
    } else value.at = 0;
    return { ok: Object.keys(errors).length === 0, errors, value };
  }

  const api = { KM_PER_MI, cleanText, timeTokens, parseDate, parseShot, validateRun };
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.NFRun = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
