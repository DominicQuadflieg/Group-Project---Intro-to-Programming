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

  /* ================= Activity files (GPX, TCX, FIT) =================
     Every reader returns {km, min, at, sport, name} or throws an Error with a message for the runner.
     min is the moving time when pauses can be seen, otherwise the elapsed time. */

  // Sports that count as a run. Everything else (ride, swim, …) is refused.
  const RUN_SPORTS = ["run", "running", "trail_running", "treadmill_running", "walking", "walk", "hiking", "jogging", ""];
  const isRunSport = s => RUN_SPORTS.includes(String(s || "").toLowerCase().replace(/\s+/g, "_"));
  const MAX_FILE_MB = 30;

  /* Distance in metres between two GPS points (haversine formula) */
  function gpsDist(a, b) {
    const R = 6371e3, rad = Math.PI / 180;
    const dLat = (b.lat - a.lat) * rad, dLon = (b.lon - a.lon) * rad;
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLon / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(h));
  }

  const xmlText = (xml, tag) => { const m = xml.match(new RegExp(`<(?:\\w+:)?${tag}\\b[^>]*>([\\s\\S]*?)</(?:\\w+:)?${tag}>`, "i")); return m ? m[1].replace(/<!\[CDATA\[|\]\]>/g, "").trim() : ""; };

  function parseGpx(xml) {
    xml = String(xml || "");
    if (!/<gpx\b/i.test(xml)) throw new Error("This is not a GPX file.");
    const trk = xmlText(xml, "trk") || xml;
    let km = 0, moving = 0, first = 0, last = 0, pts = 0;
    // every <trkseg> is a part of the track; time between segments is a pause
    const segs = trk.match(/<(?:\w+:)?trkseg\b[\s\S]*?<\/(?:\w+:)?trkseg>/gi) || [trk];
    segs.forEach(seg => {
      let prev = null;
      const re = /<(?:\w+:)?trkpt\b([^>]*)>([\s\S]*?)<\/(?:\w+:)?trkpt>|<(?:\w+:)?trkpt\b([^>]*)\/>/gi;
      let m;
      while ((m = re.exec(seg))) {
        const attrs = m[1] || m[3] || "", body = m[2] || "";
        const lat = parseFloat((attrs.match(/lat\s*=\s*["']([-\d.]+)/) || [])[1]);
        const lon = parseFloat((attrs.match(/lon\s*=\s*["']([-\d.]+)/) || [])[1]);
        const t = Date.parse(xmlText(body, "time"));
        if (!isFinite(lat) || !isFinite(lon)) continue;
        const p = { lat, lon, t: isFinite(t) ? t : 0 };
        pts++;
        if (p.t) { if (!first || p.t < first) first = p.t; if (p.t > last) last = p.t; }
        if (prev) {
          const d = gpsDist(prev, p), dt = prev.t && p.t ? (p.t - prev.t) / 1000 : 0;
          km += d / 1000;
          // a pause: more than 10 s with less than 0.5 m/s (standing at a traffic light)
          if (dt > 0 && !(dt > 10 && d / dt < 0.5)) moving += dt;
        }
        prev = p;
      }
    });
    if (pts < 2) throw new Error("This GPX file has no track with GPS points.");
    const elapsed = first && last ? (last - first) / 60000 : 0;
    const min = moving > 0 ? moving / 60 : elapsed;
    return { km: round2(km), min, at: first, sport: xmlText(trk, "type"), name: xmlText(trk, "name") };
  }

  function parseTcx(xml) {
    xml = String(xml || "");
    if (!/<TrainingCenterDatabase\b/i.test(xml)) throw new Error("This is not a TCX file.");
    const act = xml.match(/<Activity\b[^>]*Sport\s*=\s*["']([^"']*)["']/i);
    const laps = xml.match(/<Lap\b[\s\S]*?<\/Lap>/gi) || [];
    if (!laps.length) throw new Error("This TCX file has no laps.");
    let sec = 0, m = 0, at = 0;
    laps.forEach((l, i) => {
      sec += parseFloat(xmlText(l, "TotalTimeSeconds")) || 0;
      // DistanceMeters of the lap itself, not of the last track point
      const own = l.replace(/<Track\b[\s\S]*?<\/Track>/gi, "");
      m += parseFloat(xmlText(own, "DistanceMeters")) || 0;
      if (i === 0) { const st = l.match(/StartTime\s*=\s*["']([^"']+)/i); if (st) at = Date.parse(st[1]) || 0; }
    });
    if (!at) at = Date.parse(xmlText(xml, "Id")) || 0;
    const sport = act ? act[1] : "";
    return { km: round2(m / 1000), min: sec / 60, at, sport: /other/i.test(sport) ? "" : sport, name: xmlText(xml, "Notes") };
  }

  /* FIT is the binary format of Garmin, Coros, Suunto, Polar and Wahoo watches.
     We only read the "session" summary (or add up the laps if there is none). */
  const FIT_EPOCH = 631065600;            // FIT time starts on 31 Dec 1989
  const FIT_SPORT = { 0: "", 1: "running", 2: "cycling", 5: "swimming", 11: "walking", 17: "hiking" };
  function parseFit(buf) {
    const u8 = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
    const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
    if (u8.length < 14 || String.fromCharCode(u8[8], u8[9], u8[10], u8[11]) !== ".FIT") throw new Error("This is not a FIT file.");
    const hsize = u8[0], dataEnd = Math.min(u8.length, hsize + dv.getUint32(4, true));
    const defs = {}, sessions = [], laps = [];
    let first = 0, lastTs = 0, lastDist = 0, pos = hsize;
    const read = (off, size, base, little) => {
      const t = base & 0x1f;
      if (size === 1) { const v = u8[off]; return v === 0xff ? null : v; }
      if (size === 2 && (t === 3 || t === 4)) { const v = dv.getUint16(off, little); return v === 0xffff ? null : v; }
      if (size === 4 && (t === 5 || t === 6)) { const v = dv.getUint32(off, little); return v === 0xffffffff ? null : v; }
      return null;
    };
    while (pos < dataEnd) {
      const h = u8[pos++];
      if (h & 0x80) {                                   // compressed timestamp header: a data message
        const def = defs[(h >> 5) & 3];
        if (!def) throw new Error("This FIT file is damaged.");
        pos += def.len; continue;
      }
      const local = h & 0x0f;
      if (h & 0x40) {                                   // definition message
        const little = u8[pos + 1] === 0, gnum = little ? dv.getUint16(pos + 2, true) : dv.getUint16(pos + 2, false);
        const n = u8[pos + 4]; pos += 5;
        const fields = []; let len = 0;
        for (let i = 0; i < n; i++) { fields.push({ num: u8[pos], size: u8[pos + 1], base: u8[pos + 2], off: len }); len += u8[pos + 1]; pos += 3; }
        if (h & 0x20) { const nd = u8[pos]; pos++; for (let i = 0; i < nd; i++) { len += u8[pos + 1]; pos += 3; } }
        defs[local] = { gnum, little, fields, len };
        continue;
      }
      const def = defs[local];
      if (!def) throw new Error("This FIT file is damaged.");
      if (pos + def.len > dataEnd) break;
      const msg = {};
      def.fields.forEach(f => { msg[f.num] = read(pos + f.off, f.size, f.base, def.little); });
      if (def.gnum === 18) sessions.push(msg);
      else if (def.gnum === 19) laps.push(msg);
      else if (def.gnum === 20) {                       // record: one point of the track
        if (msg[253] != null) { if (!first) first = msg[253]; lastTs = msg[253]; }
        if (msg[5] != null) lastDist = msg[5];
      }
      pos += def.len;
    }
    // session fields: 2 start time, 5 sport, 7 elapsed time, 8 timer (moving) time in ms, 9 distance in cm
    const sum = (arr, k) => arr.reduce((a, m) => a + (m[k] || 0), 0);
    let src = sessions.length ? sessions : laps;
    let sec, cm, start, sport;
    if (src.length) {
      sec = (sum(src, 8) || sum(src, 7)) / 1000; cm = sum(src, 9);
      start = src[0][2] || first; sport = sessions.length ? FIT_SPORT[sessions[0][5]] : "";
      if (sport === undefined) sport = "other";
    } else if (lastTs) {
      sec = lastTs - first; cm = lastDist; start = first; sport = "";
    } else throw new Error("This FIT file has no activity in it.");
    return { km: round2(cm / 100000), min: sec / 60, at: start ? (start + FIT_EPOCH) * 1000 : 0, sport, name: "" };
  }

  /* Finds the first activity file in a ZIP (Garmin Connect exports a ZIP with a .fit file inside).
     Returns {name, method, data}: method 0 = stored, 8 = deflate (unpacked in the browser). */
  function zipEntry(buf) {
    const u8 = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
    const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
    // the central directory lists all files with their real sizes
    let eocd = -1;
    for (let i = u8.length - 22; i >= Math.max(0, u8.length - 65557); i--) if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
    if (eocd < 0) throw new Error("This ZIP file is damaged.");
    let p = dv.getUint32(eocd + 16, true);
    const n = dv.getUint16(eocd + 10, true);
    for (let i = 0; i < n && dv.getUint32(p, true) === 0x02014b50; i++) {
      const method = dv.getUint16(p + 10, true), csize = dv.getUint32(p + 20, true);
      const nl = dv.getUint16(p + 28, true), xl = dv.getUint16(p + 30, true), cl = dv.getUint16(p + 32, true);
      const lho = dv.getUint32(p + 42, true);
      const name = new TextDecoder().decode(u8.subarray(p + 46, p + 46 + nl));
      p += 46 + nl + xl + cl;
      if (!/\.(fit|gpx|tcx)$/i.test(name) || /(^|\/)\./.test(name)) continue;
      const start = lho + 30 + dv.getUint16(lho + 26, true) + dv.getUint16(lho + 28, true);
      return { name, method, data: u8.subarray(start, start + csize) };
    }
    throw new Error("There is no FIT, GPX or TCX file in this ZIP.");
  }

  /* What kind of file is it? Looks at the content, not only the name. */
  function fileKind(name, u8) {
    const head = String.fromCharCode(...u8.subarray(0, 512));
    if (u8[0] === 0x50 && u8[1] === 0x4b) return "zip";
    if (u8[0] === 0x1f && u8[1] === 0x8b) return "gz";
    if (u8.length > 12 && String.fromCharCode(u8[8], u8[9], u8[10], u8[11]) === ".FIT") return "fit";
    if (/<gpx\b/i.test(head)) return "gpx";
    if (/<TrainingCenterDatabase\b/i.test(head)) return "tcx";
    const ext = (String(name).match(/\.(\w+)$/) || [])[1];
    return ext ? ext.toLowerCase() : "";
  }

  /* Reads an unpacked activity file. kind from fileKind(). */
  function parseActivity(kind, u8) {
    const txt = () => new TextDecoder().decode(u8);
    let r;
    if (kind === "gpx") r = parseGpx(txt());
    else if (kind === "tcx") r = parseTcx(txt());
    else if (kind === "fit") r = parseFit(u8);
    else throw new Error("NOVAFit can read GPX, TCX and FIT files (also in a ZIP). Export your run as one of these.");
    if (!isRunSport(r.sport)) throw new Error(`This is a ${String(r.sport).replace(/_/g, " ")} activity, not a run.`);
    if (!(r.min > 0) && !(r.km > 0)) throw new Error("No time or distance found in this file.");
    return r;
  }

  /* Is this run already in the history? Same start within 5 minutes, or same day and nearly the same distance. */
  function findDuplicate(history, at, km) {
    if (!at) return null;
    return (history || []).find(e => e && e.run && (
      Math.abs(e.start - at) < 5 * 60000 ||
      (km > 0 && new Date(e.start).toDateString() === new Date(at).toDateString() && Math.abs(toNum(e.run.km) - km) < 0.05)
    )) || null;
  }

  const api = { KM_PER_MI, MAX_FILE_MB, cleanText, timeTokens, parseDate, parseShot, validateRun,
    gpsDist, parseGpx, parseTcx, parseFit, zipEntry, fileKind, parseActivity, findDuplicate, isRunSport };
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.NFRun = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
