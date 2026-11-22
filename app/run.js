/* NOVAFit · running logic
   Reads runs from the text of a screenshot (after text recognition).
   Pure functions without any DOM access, so they run in the browser (window.NFRun)
   and in Node for the tests in tests/run.test.js. */
(function (root) {
  "use strict";

  const KM_PER_MI = 1.609344;
  const MIN_RUN = 3, MAX_RUN = 24 * 60;          // a plausible run lasts 3 min to 24 h
  const MIN_PACE = 2.5, MAX_PACE = 20;           // plausible pace in min/km

  // First letters of month names in English, German, Portuguese, Spanish, French and Italian
  const MONTHS = { jan: 0, feb: 1, mar: 2, mär: 2, mrz: 2, apr: 3, may: 4, mai: 4, jun: 5, jul: 6, aug: 7,
    sep: 8, oct: 9, okt: 9, nov: 10, dec: 11, dez: 11,
    ene: 0, gen: 0, fev: 1, fév: 1, abr: 3, avr: 3, mag: 4, giu: 5, lug: 6, ago: 7, aoû: 7, aou: 7,
    set: 8, out: 9, ott: 9, dic: 11, déc: 11 };
  const monthOf = w => { const x = w.toLowerCase(); if (x.startsWith("juin")) return 5; if (x.startsWith("juil")) return 6; const v = MONTHS[x.slice(0, 3)]; return v == null ? null : v; };

  // Words that name a value on running app screens (English, German, Portuguese, Spanish, French, Italian).
  // "Tempo" is pace in German but time in Portuguese and Italian: "Tempo em movimento" is a time, and a plain
  // "Tempo" whose value is far too slow for a pace is read as the time too (see parseShot).
  const LABELS = [
    ["pace", /\b(?:avg\.?\s*)?(?:pace|tempo(?!\s+(?:em|en|de|di|total|decorrido|trascorso|in))|ritmo|allure|passo)\b|ø\s*pace/i],
    ["dist", /\b(?:distance|distanz|strecke|dist|distancia|distanza)\b|distância/i],
    ["dur", /\b(?:moving time|elapsed time|workout time|total time|time|duration|zeit|dauer|gesamtzeit|bewegungszeit|laufzeit|tempo (?:em|de|di|in) movimento|tempo (?:decorrido|total|trascorso)|tiempo(?: en movimiento| transcurrido)?|temps(?: de déplacement)?|durata)\b|duração|duracao|durée|duración/i],
    ["other", /\b(?:elevation|elev|höhe|calories|kcal|heart|bpm|hf|cadence|steps|schritte|power|watt|calorias|calorías|pasos|passos|dislivello)\b|elevação|elevación|dénivelé|frequência|cadência/i]
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
      else if ((m = l.match(/(?:^|[^A-Za-zÀ-ÿ])([A-Za-zÀ-ÿ]{3,})\.?\s+(\d{1,2}),?\s*(\d{4})?\b/)) && monthOf(m[1]) != null) {
        mo = monthOf(m[1]); d = +m[2]; y = m[3] ? +m[3] : 0;
      }
      else if ((m = l.match(/\b(\d{1,2})\.?\s+(?:de\s+)?([A-Za-zÀ-ÿ]{3,})\.?,?\s*(?:de\s+)?(\d{4})?\b/)) && monthOf(m[2]) != null) {
        d = +m[1]; mo = monthOf(m[2]); y = m[3] ? +m[3] : 0;
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
        const v = readValue(x.k, txt);
        if (x.k === "pace" && v > MAX_PACE && !/\/\s*(?:km|mi)/i.test(txt)) set("dur", readValue("dur", txt));
        else set(x.k, v);
      });
    });

    // 2. Values without a label
    if (!found.dist) for (const l of lines) { const d = distWithUnit(l); if (d) { found.dist = d; break; } }
    const dateLine = l => /\b\d{1,2}[./]\d{1,2}[./]\d{2,4}\b|\b\d{4}-\d{2}-\d{2}\b|\b(?:today|heute|yesterday|gestern|hoje|ontem|hoy|ayer|aujourd'hui|hier|oggi|ieri)\b|\bat\b|\bum\b|\bàs\b|(?:^|\s)às\s|\ba las\b|(?:^|\s)à\s|\balle\b/i.test(l)
      || /(?:^|[^A-Za-zÀ-ÿ])([A-Za-zÀ-ÿ]{3,})\.?\s+\d/.test(l) && monthOf(l.match(/(?:^|[^A-Za-zÀ-ÿ])([A-Za-zÀ-ÿ]{3,})\.?\s+\d/)[1]) != null
      || /\b\d{1,2}\.?\s+(?:de\s+)?([A-Za-zÀ-ÿ]{3,})/.test(l) && monthOf(l.match(/\b\d{1,2}\.?\s+(?:de\s+)?([A-Za-zÀ-ÿ]{3,})/)[1]) != null;
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
    const end = zipEnd(u8.subarray(Math.max(0, u8.length - 65557)));
    const list = zipList(u8.subarray(end.cdOffset, end.cdOffset + end.cdSize));
    const e = list.find(x => /\.(fit|gpx|tcx)(\.gz)?$/i.test(x.name));
    if (!e) throw new Error("There is no FIT, GPX or TCX file in this ZIP.");
    const start = e.lho + zipDataOffset(u8.subarray(e.lho, e.lho + 30));
    return { name: e.name, method: e.method, data: u8.subarray(start, start + e.csize) };
  }

  /* ZIP in parts, so big archives (Strava sends hundreds of MB) never have to be read completely.
     zipEnd: the last up to 64 KB of the file → where the list of files (central directory) is. */
  function zipEnd(tail) {
    const dv = new DataView(tail.buffer, tail.byteOffset, tail.byteLength);
    for (let i = tail.length - 22; i >= 0; i--) {
      if (dv.getUint32(i, true) !== 0x06054b50) continue;
      const count = dv.getUint16(i + 10, true), cdSize = dv.getUint32(i + 12, true), cdOffset = dv.getUint32(i + 16, true);
      if (cdOffset === 0xffffffff || count === 0xffff) throw new Error("This archive is too big to open here. Unpack it on a computer and choose activities.csv.");
      return { count, cdSize, cdOffset };
    }
    throw new Error("This ZIP file is damaged.");
  }
  /* zipList: the central directory → all files with name, packing method, size and where they start */
  function zipList(cd) {
    const dv = new DataView(cd.buffer, cd.byteOffset, cd.byteLength), out = [];
    let p = 0;
    while (p + 46 <= cd.length && dv.getUint32(p, true) === 0x02014b50) {
      const nl = dv.getUint16(p + 28, true), xl = dv.getUint16(p + 30, true), cl = dv.getUint16(p + 32, true);
      const name = new TextDecoder().decode(cd.subarray(p + 46, p + 46 + nl));
      if (!/\/$/.test(name) && !/(^|\/)(\.|__MACOSX)/.test(name))
        out.push({ name, method: dv.getUint16(p + 10, true), csize: dv.getUint32(p + 20, true), usize: dv.getUint32(p + 24, true), lho: dv.getUint32(p + 42, true) });
      p += 46 + nl + xl + cl;
    }
    return out;
  }
  /* zipDataOffset: the 30-byte local header of a file → how many bytes after it the packed data starts */
  function zipDataOffset(lh) {
    const dv = new DataView(lh.buffer, lh.byteOffset, lh.byteLength);
    if (lh.length < 30 || dv.getUint32(0, true) !== 0x04034b50) throw new Error("This ZIP file is damaged.");
    return 30 + dv.getUint16(26, true) + dv.getUint16(28, true);
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

  /* ================= Strava =================
     Garmin, Polar, Coros, Suunto and Apple Watch can all send runs to Strava automatically,
     so connecting Strava brings in the runs of almost every watch. */
  const STRAVA_RUN_TYPES = ["Run", "TrailRun", "VirtualRun", "Walk"];
  const STRAVA_SCOPE = "activity:read_all";

  function stravaAuthUrl(o) {
    const q = new URLSearchParams({ client_id: String(o.clientId), redirect_uri: o.redirect, response_type: "code",
      approval_prompt: "auto", scope: STRAVA_SCOPE, state: o.state });
    return "https://www.strava.com/oauth/authorize?" + q.toString();
  }

  /* Did the runner allow NOVAFit to read activities? (They can untick it on the Strava page.) */
  const stravaScopeOk = scope => String(scope || "").split(",").some(s => /^activity:read/.test(s));

  /* A Strava activity as a NOVAFit history entry. alsterKm: length of your usual loop (mode id "alster"). */
  function stravaEntry(a, alsterKm) {
    const km = round2((a.distance || 0) / 1000), min = (a.moving_time || a.elapsed_time || 0) / 60;
    const start = Date.parse(a.start_date) || 0;
    const band = !!a.trainer || a.sport_type === "VirtualRun";
    const mode = band ? "band" : km > 0 && alsterKm && Math.abs(km - alsterKm) < 1.2 ? "alster" : "out";
    const name = String(a.name || "").trim();
    // Strava's automatic names ("Morning Run") say nothing, real titles become the note
    const note = /^(morning|lunch|afternoon|evening|night) (run|walk|trail run)$/i.test(name) ? "" : name.slice(0, 200);
    return { id: "st" + a.id, type: "lauf", start, end: start + Math.round((a.elapsed_time || min * 60) * 1000),
      run: { mode, km, min, note, strava: String(a.id) } };
  }

  /* Runs from Strava that are not in NOVAFit yet (same Strava id, or the same run logged by hand). */
  function stravaNew(history, acts, alsterKm) {
    const have = new Set((history || []).filter(e => e && e.run && e.run.strava).map(e => String(e.run.strava)));
    return (acts || [])
      .filter(a => a && STRAVA_RUN_TYPES.includes(a.sport_type || a.type) && (a.distance > 0 || a.moving_time > 0))
      .filter(a => !have.has(String(a.id)))
      .map(a => stravaEntry(a, alsterKm))
      .filter(e => e.start > 0 && e.run.min >= 1 && !findDuplicate(history, e.start, e.run.km))
      .sort((x, y) => x.start - y.start);
  }

  /* ================= Training history: many runs at once =================
     Sources: Garmin Connect activity list (CSV), Strava archive (activities.csv, also inside the ZIP),
     several GPX/FIT/TCX files, or Strava's API. Every source becomes a list of items {entry, kind},
     kind = "run" or "walk"; planImport() then decides what is added. */

  /* CSV with quotes, commas or semicolons, line breaks inside quotes and a BOM */
  function parseCsv(text) {
    text = String(text || "").replace(/^﻿/, "");
    const nl = text.indexOf("\n"), first = nl < 0 ? text : text.slice(0, nl);
    const count = ch => first.split(ch).length - 1;
    const sep = count(";") > count(",") ? ";" : count("\t") > count(",") ? "\t" : ",";
    const rows = [];
    let row = [], cell = "", q = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (q) {
        if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; }
        else cell += c;
      } else if (c === '"') q = true;
      else if (c === sep) { row.push(cell); cell = ""; }
      else if (c === "\n") { row.push(cell); rows.push(row); row = []; cell = ""; }
      else if (c !== "\r") cell += c;
    }
    if (cell !== "" || row.length) { row.push(cell); rows.push(row); }
    return rows.filter(r => r.some(x => x.trim() !== ""));
  }

  /* "7.72", "7,72", "1,234.5", "1.234,5" → number; "--" or empty → 0 */
  function numLoose(v) {
    let t = String(v == null ? "" : v).trim().replace(/[^\d.,-]/g, "");
    if (!t || t === "-") return 0;
    if (t.includes(",") && t.includes(".")) t = t.lastIndexOf(",") > t.lastIndexOf(".") ? t.replace(/\./g, "").replace(",", ".") : t.replace(/,/g, "");
    else t = t.replace(",", ".");
    const n = parseFloat(t);
    return isFinite(n) ? n : 0;
  }
  /* "00:42:38", "42:38", "0:42:38.4" → minutes; a plain number counts as seconds (Strava) */
  function durMin(v) {
    const t = String(v == null ? "" : v).trim();
    if (/^\d+(:\d{1,2}){1,2}([.,]\d+)?$/.test(t)) { const p = t.split(":").map(x => numLoose(x)); return p.length === 3 ? p[0] * 60 + p[1] + p[2] / 60 : p[0] + p[1] / 60; }
    const n = numLoose(t);
    return n > 0 ? n / 60 : 0;
  }
  /* Dates as Garmin and Strava write them. utc: Strava's archive uses UTC, Garmin local time. */
  function parseStamp(v, utc) {
    const t = String(v || "").trim();
    let y, mo, d, h = 0, mi = 0, se = 0, m;
    const time = rest => { const x = rest.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(am|pm)?/i); if (!x) return; h = +x[1]; mi = +x[2]; se = +(x[3] || 0); if (x[4]) { const pm = /pm/i.test(x[4]); if (pm && h < 12) h += 12; if (!pm && h === 12) h = 0; } };
    if ((m = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/))) { y = +m[1]; mo = +m[2] - 1; d = +m[3]; }
    else if ((m = t.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})/))) { d = +m[1]; mo = +m[2] - 1; y = +m[3]; }
    else if ((m = t.match(/^([A-Za-zäÄ]{3})[a-zä]*\.?\s+(\d{1,2}),?\s+(\d{4})/)) && MONTHS[m[1].toLowerCase()] != null) { mo = MONTHS[m[1].toLowerCase()]; d = +m[2]; y = +m[3]; }
    else if ((m = t.match(/^(\d{1,2})\.?\s+([A-Za-zäÄ]{3})[a-zä]*\.?,?\s+(\d{4})/)) && MONTHS[m[2].toLowerCase()] != null) { d = +m[1]; mo = MONTHS[m[2].toLowerCase()]; y = +m[3]; }
    else return 0;
    time(t.slice(m[0].length));
    if (mo < 0 || mo > 11 || d < 1 || d > 31 || h > 23 || mi > 59) return 0;
    return utc ? Date.UTC(y, mo, d, h, mi, se) : new Date(y, mo, d, h, mi, se).getTime();
  }

  /* What kind of activity is it? run (outdoor or treadmill), walk, or something else */
  function sportKind(type) {
    const t = String(type || "").toLowerCase();
    if (/treadmill|laufband|indoor run|virtual ?run|virtueller lauf/.test(t)) return { kind: "run", band: true };
    if (/run|lauf|jog/.test(t)) return { kind: "run", band: false };
    if (/walk|hik|gehen|wander|spazier/.test(t)) return { kind: "walk", band: false };
    return { kind: "other", band: false };
  }

  /* One imported activity as a NOVAFit history entry (same shape as a logged run) */
  function historyEntry(o, alsterKm) {
    const km = round2(o.km || 0), min = o.min || 0;
    const mode = o.band ? "band" : km > 0 && alsterKm && Math.abs(km - alsterKm) < 1.2 ? "alster" : "out";
    const name = String(o.name || "").trim();
    const note = /^(morning|lunch|afternoon|evening|night) (run|walk|trail run)$|^[\w ]+ (running|laufen|walking|gehen)$/i.test(name) ? "" : name.slice(0, 200);
    const run = { mode, km, min, note };
    if (o.strava) run.strava = String(o.strava);
    const id = o.strava ? "st" + o.strava : "im" + Math.round(o.start / 1000);
    return { id, type: "lauf", start: o.start, end: o.start + Math.round((o.elapsed || min) * 60000), run };
  }

  /* Where does a column with one of these names start? (Strava has two "Distance" columns.) */
  function headerIndex(head) {
    const idx = {};
    head.forEach((h, i) => { const k = String(h).trim().toLowerCase(); (idx[k] = idx[k] || []).push(i); });
    return (names, which) => { for (const n of names) { const a = idx[n]; if (a) return which === "last" ? a[a.length - 1] : a[0]; } return -1; };
  }

  /* Reads an activity list. Returns {source, items, other, bad}. opts.miles: Garmin distances are in miles. */
  function readHistoryCsv(text, opts) {
    opts = opts || {};
    const rows = parseCsv(text);
    if (rows.length < 2) throw new Error("This file has no activities in it.");
    const col = headerIndex(rows[0]);
    const S = {
      id: col(["activity id", "aktivitäts-id", "aktivitäts id"]),
      date: col(["activity date", "datum der aktivität", "aktivitätsdatum"]),
      name: col(["activity name", "name der aktivität", "aktivitätsname"]),
      type: col(["activity type", "aktivitätsart", "aktivitätstyp"]),
      elapsed: col(["elapsed time", "verstrichene zeit"]),
      moving: col(["moving time", "bewegungszeit"]),
      distKm: col(["distance", "distanz", "entfernung"]),
      distM: col(["distance", "distanz", "entfernung"], "last")
    };
    const G = {
      type: col(["activity type", "aktivitätstyp", "aktivitätsart"]),
      date: col(["date", "datum"]),
      name: col(["title", "titel"]),
      dist: col(["distance", "distanz"]),
      time: col(["time", "zeit"]),
      moving: col(["moving time", "bewegungszeit"]),
      elapsed: col(["elapsed time", "verstrichene zeit", "gesamtzeit"])
    };
    const source = S.id >= 0 && S.date >= 0 && S.type >= 0 ? "strava" : G.type >= 0 && G.date >= 0 && G.dist >= 0 ? "garmin" : "";
    if (!source) throw new Error("This doesn't look like an activity list from Garmin Connect or Strava. Choose the CSV file you exported.");
    const items = [];
    let other = 0, bad = 0;
    rows.slice(1).forEach(r => {
      const get = i => (i >= 0 ? r[i] : "");
      let o;
      if (source === "strava") {
        const sk = sportKind(get(S.type));
        if (sk.kind === "other") { other++; return; }
        const m = numLoose(get(S.distM)), k = numLoose(get(S.distKm));
        // the second "Distance" column is in metres; the first one is rounded km
        const km = S.distM !== S.distKm && m > 0 ? m / 1000 : k;
        const elapsed = durMin(get(S.elapsed));
        o = Object.assign(sk, { start: parseStamp(get(S.date), true), km, min: durMin(get(S.moving)) || elapsed, elapsed, name: get(S.name), strava: String(get(S.id)).trim() || "" });
      } else {
        const sk = sportKind(get(G.type));
        if (sk.kind === "other") { other++; return; }
        const km = numLoose(get(G.dist)) * (opts.miles ? KM_PER_MI : 1);
        const elapsed = durMin(get(G.elapsed)) || durMin(get(G.time));
        o = Object.assign(sk, { start: parseStamp(get(G.date), false), km, min: durMin(get(G.moving)) || durMin(get(G.time)) || elapsed, elapsed, name: get(G.name) });
      }
      if (!o.start || !(o.min > 0 || o.km > 0) || o.km > 300 || o.min > MAX_RUN) { bad++; return; }
      items.push({ kind: o.kind, entry: historyEntry(o, opts.alsterKm) });
    });
    return { source, items, other, bad };
  }

  /* A file from a watch (result of parseActivity) as an import item */
  function fileItem(r, alsterKm) {
    const sk = sportKind(r.sport);
    return { kind: sk.kind === "walk" ? "walk" : "run", entry: historyEntry({ start: r.at, km: r.km, min: r.min, band: sk.band, name: r.name }, alsterKm) };
  }

  /* Start of the chosen time range: "year" = 1 January, "12m" = one year back, "all" = everything */
  function rangeStart(range, now) {
    now = now || Date.now();
    if (range === "year") return new Date(new Date(now).getFullYear(), 0, 1).getTime();
    if (range === "12m") return now - 365 * 864e5;
    return 0;
  }

  /* Decides what is added: only the time range, walks only if wanted, nothing twice. */
  function planImport(history, items, opts) {
    opts = opts || {};
    const now = opts.now || Date.now(), from = rangeStart(opts.range || "year", now);
    const ids = new Set((history || []).map(e => e && e.id));
    const seen = (history || []).filter(e => e && e.run).slice();
    const add = [];
    let dup = 0, outside = 0, walks = 0, noDate = 0;
    (items || []).slice().sort((a, b) => a.entry.start - b.entry.start).forEach(it => {
      const e = it.entry;
      if (!e.start) { noDate++; return; }
      if (e.start < from || e.start > now + 36e5) { outside++; return; }
      if (it.kind === "walk") { walks++; if (!opts.walks) return; }
      if (ids.has(e.id) || findDuplicate(seen, e.start, e.run.km)) { dup++; return; }
      ids.add(e.id); seen.push(e); add.push(e);
    });
    const km = add.reduce((a, e) => a + (e.run.km || 0), 0);
    return { add, dup, outside, walks, noDate, km: round2(km),
      first: add.length ? add[0].start : 0, last: add.length ? add[add.length - 1].start : 0 };
  }

  /* Activities from Strava's API as import items (walks marked, so the runner can leave them out) */
  function stravaItems(acts, alsterKm) {
    return (acts || []).filter(a => a && STRAVA_RUN_TYPES.includes(a.sport_type || a.type) && (a.distance > 0 || a.moving_time > 0))
      .map(a => ({ kind: (a.sport_type || a.type) === "Walk" ? "walk" : "run", entry: stravaEntry(a, alsterKm) }));
  }

  /* ---------- weather where you are & your own running loop ---------- */
  // Used when the phone does not share its location: Nova SBE in Carcavelos
  const WX_HOME = { lat: 38.678, lon: -9.326, place: "Carcavelos" };
  const LOOP_DEFAULT = "Home loop", LOOP_KM = 5, LOOP_NAME_MAX = 24;
  const okPos = p => !!p && isFinite(p.lat) && isFinite(p.lon) && Math.abs(p.lat) <= 90 && Math.abs(p.lon) <= 180;

  /* Open-Meteo forecast for a position, rounded to about 1 km so the exact spot is never sent. */
  function wxUrl(pos) {
    const p = okPos(pos) ? pos : WX_HOME, r = n => (Math.round(n * 100) / 100).toFixed(2);
    return "https://api.open-meteo.com/v1/forecast?latitude=" + r(p.lat) + "&longitude=" + r(p.lon) +
      "&current=temperature_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m,is_day" +
      "&hourly=precipitation_probability&forecast_hours=3&timezone=auto";
  }
  /* Same place for the weather? (within about 5 km) */
  function samePlace(a, b) {
    return okPos(a) && okPos(b) && Math.abs(a.lat - b.lat) < 0.05 && Math.abs(a.lon - b.lon) < 0.05;
  }
  /* Town name from a reverse-geocoding answer (BigDataCloud), "" if there is none. */
  function placeName(d) {
    if (!d || typeof d !== "object") return "";
    const n = [d.city, d.locality, d.principalSubdivision].find(x => typeof x === "string" && x.trim());
    return n ? n.trim().slice(0, 30) : "";
  }
  /* Name of your usual running loop. */
  function loopName(name) {
    const n = String(name == null ? "" : name).replace(/\s+/g, " ").trim();
    return n || LOOP_DEFAULT;
  }
  /* Checks the loop form: name up to 24 characters (empty = "Home loop"), length 1–50 km. */
  function validateLoop(name, km) {
    const err = {}, n = String(name == null ? "" : name).replace(/\s+/g, " ").trim(), k = toNum(km);
    if (n.length > LOOP_NAME_MAX) err.name = "Use at most " + LOOP_NAME_MAX + " characters.";
    else if (/[<>]/.test(n)) err.name = "Please leave out < and >.";
    if (!(k >= 1 && k <= 50)) err.km = "Enter a length between 1 and 50 km.";
    return { name: n, km: round2(k), err, ok: !err.name && !err.km };
  }

  /* ---------- runs near you ----------
     A few hand-picked routes (A) plus a loop made from where you stand (B, netlify/functions/route.mjs).
     Lengths are approximate and the starts are rounded: a demo set, check them before relying on them. */
  const NEARBY_ROUTES = [
    { id: "carcavelos", name: "Carcavelos seafront", km: 5, start: { lat: 38.678, lon: -9.326 },
      desc: "From Nova SBE along the beach promenade towards Parede and back. Flat, by the sea." },
    { id: "paredao", name: "Paredão Estoril–Cascais", km: 6, start: { lat: 38.700, lon: -9.374 },
      desc: "The seaside promenade from São João do Estoril to Cascais and back. Flat, busy on weekends." },
    { id: "oeiras", name: "Oeiras seafront", km: 6, start: { lat: 38.692, lon: -9.296 },
      desc: "Promenade from Paço de Arcos along the river mouth and back. Flat." },
    { id: "belem", name: "Lisbon riverside, Belém", km: 7, start: { lat: 38.692, lon: -9.216 },
      desc: "From the Belém Tower along the Tagus towards Alcântara and back. Flat, lots to see." }
  ];
  const MAX_SUGGESTIONS = 5, NEAR_KM = 50, LOOP_MIN = 2, LOOP_MAX = 30;

  /* The hand-picked routes closest to you (within 50 km), at most `n`.
     fits = the length is within 1.5 km of the run your plan has next. */
  function nearbyRoutes(pos, targetKm, n) {
    if (!okPos(pos)) return [];
    return NEARBY_ROUTES.map(r => Object.assign({}, r, { away: round2(gpsDist(pos, r.start) / 1000), fits: targetKm > 0 && Math.abs(r.km - targetKm) <= 1.5 }))
      .filter(r => r.away <= NEAR_KM)
      .sort((a, b) => a.away - b.away)
      .slice(0, Math.max(0, Math.min(n == null ? MAX_SUGGESTIONS - 1 : n, MAX_SUGGESTIONS)));
  }

  /* Length for a loop from here: 2–30 km, whole or half kilometres */
  function validLoopKm(v) {
    const k = toNum(v);
    if (!(k >= LOOP_MIN && k <= LOOP_MAX)) return { ok: false, err: `Choose between ${LOOP_MIN} and ${LOOP_MAX} km.` };
    return { ok: true, km: Math.round(k * 2) / 2 };
  }

  /* Google Maps walking directions along a loop ([lon, lat] points): start = end, up to 8 stops in between */
  function loopMapsUrl(coords) {
    const pts = (coords || []).filter(c => Array.isArray(c) && isFinite(c[0]) && isFinite(c[1]));
    if (pts.length < 2) return "";
    const ll = c => c[1].toFixed(5) + "," + c[0].toFixed(5), way = [];
    for (let i = 1; i <= 8; i++) way.push(pts[Math.round(i * (pts.length - 1) / 9)]);
    return "https://www.google.com/maps/dir/?api=1&travelmode=walking&origin=" + ll(pts[0]) + "&destination=" + ll(pts[0]) +
      "&waypoints=" + encodeURIComponent(way.map(ll).join("|"));
  }

  /* The shape of a loop as an SVG path in a w × h box (north up, distances kept true) */
  function loopSvg(coords, w, h, pad) {
    const pts = (coords || []).filter(c => Array.isArray(c) && isFinite(c[0]) && isFinite(c[1]));
    if (pts.length < 2) return null;
    pad = pad == null ? 10 : pad;
    const k = Math.cos((pts[0][1] * Math.PI) / 180), xs = pts.map(c => c[0] * k), ys = pts.map(c => -c[1]);
    const x0 = Math.min(...xs), y0 = Math.min(...ys), sw = Math.max(...xs) - x0 || 1e-9, sh = Math.max(...ys) - y0 || 1e-9;
    const sc = Math.min((w - 2 * pad) / sw, (h - 2 * pad) / sh), ox = (w - sw * sc) / 2, oy = (h - sh * sc) / 2;
    const P = pts.map((c, i) => [ox + (xs[i] - x0) * sc, oy + (ys[i] - y0) * sc].map(v => Math.round(v * 10) / 10));
    return { d: "M" + P.map(p => p.join(" ")).join("L"), start: { x: P[0][0], y: P[0][1] } };
  }

  const api = { KM_PER_MI, MAX_FILE_MB, cleanText, timeTokens, parseDate, parseShot, validateRun,
    parseCsv, numLoose, durMin, parseStamp, sportKind, historyEntry, readHistoryCsv, fileItem, rangeStart, planImport,
    zipEnd, zipList, zipDataOffset,
    gpsDist, parseGpx, parseTcx, parseFit, zipEntry, fileKind, parseActivity, findDuplicate, isRunSport,
    STRAVA_SCOPE, stravaAuthUrl, stravaScopeOk, stravaEntry, stravaNew, stravaItems,
    WX_HOME, LOOP_DEFAULT, LOOP_KM, LOOP_NAME_MAX, wxUrl, samePlace, placeName, loopName, validateLoop,
    NEARBY_ROUTES, MAX_SUGGESTIONS, nearbyRoutes, validLoopKm, loopMapsUrl, loopSvg };
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.NFRun = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
