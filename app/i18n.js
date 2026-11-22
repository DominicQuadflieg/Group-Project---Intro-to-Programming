/* NOVAFit · languages
   The app is written in English. This file shows it in Portuguese, German or Italian.

   How it works: every English text the app puts on screen is looked up in a table
   (i18n-data.js, one row per text: English, Portuguese, German, Italian).
   - Numbers become {0}, {1} … so "3 of 4 sessions" and "1 of 5 sessions" share one row.
   - Names that stay in English everywhere (exercises like "Bench Press (Barbell)", workouts
     like "Upper Body") become {a}, {b} … and are put back unchanged.
   - Month and weekday names become {a}, {b} … too, and are put back translated.
   - A text without a row stays in English, so the screen is never empty.
   The pure part (t, template) runs in Node for tests/i18n.test.js; apply() and watch()
   translate the page in the browser as it is drawn. */
(function (root) {
  "use strict";

  const LANGS = [
    { id: "en", name: "English", en: "English", locale: "en-GB" },
    { id: "pt", name: "Português", en: "Portuguese", locale: "pt-PT" },
    { id: "de", name: "Deutsch", en: "German", locale: "de-DE" },
    { id: "it", name: "Italiano", en: "Italian", locale: "it-IT" }
  ];
  const COL = { pt: 1, de: 2, it: 3 };
  const LETTERS = "abcdefghij";

  // Months and weekdays (long and short), translated word by word inside longer texts
  const CAL = {
    january: ["janeiro", "Januar", "gennaio"], february: ["fevereiro", "Februar", "febbraio"], march: ["março", "März", "marzo"],
    april: ["abril", "April", "aprile"], may: ["maio", "Mai", "maggio"], june: ["junho", "Juni", "giugno"], july: ["julho", "Juli", "luglio"],
    august: ["agosto", "August", "agosto"], september: ["setembro", "September", "settembre"], october: ["outubro", "Oktober", "ottobre"],
    november: ["novembro", "November", "novembre"], december: ["dezembro", "Dezember", "dicembre"],
    jan: ["jan", "Jan", "gen"], feb: ["fev", "Feb", "feb"], mar: ["mar", "Mär", "mar"], apr: ["abr", "Apr", "apr"], jun: ["jun", "Jun", "giu"],
    jul: ["jul", "Jul", "lug"], aug: ["ago", "Aug", "ago"], sep: ["set", "Sep", "set"], sept: ["set", "Sep", "set"], oct: ["out", "Okt", "ott"],
    nov: ["nov", "Nov", "nov"], dec: ["dez", "Dez", "dic"],
    monday: ["segunda-feira", "Montag", "lunedì"], tuesday: ["terça-feira", "Dienstag", "martedì"], wednesday: ["quarta-feira", "Mittwoch", "mercoledì"],
    thursday: ["quinta-feira", "Donnerstag", "giovedì"], friday: ["sexta-feira", "Freitag", "venerdì"], saturday: ["sábado", "Samstag", "sabato"],
    sunday: ["domingo", "Sonntag", "domenica"],
    mon: ["seg", "Mo", "lun"], tue: ["ter", "Di", "mar"], wed: ["qua", "Mi", "mer"], thu: ["qui", "Do", "gio"], fri: ["sex", "Fr", "ven"],
    sat: ["sáb", "Sa", "sab"], sun: ["dom", "So", "dom"]
  };
  // Long names only when capitalised ("November", "SUNDAY"); short ones only next to a number ("Sun 22", "22 Nov"),
  // so words like "may", "sun" or "mar" in a sentence stay as they are.
  const LONG = Object.keys(CAL).filter(k => k.length > 4 || k === "june" || k === "july"), SHORT = Object.keys(CAL).filter(k => !LONG.includes(k));
  const cap = k => k[0].toUpperCase() + k.slice(1);
  const CAL_RE = new RegExp(
    "\\b(?:" + LONG.map(k => cap(k) + "|" + k.toUpperCase()).join("|") + ")\\b" +
    "|\\b(?:" + SHORT.map(k => cap(k) + "|" + k.toUpperCase()).join("|") + ")\\b(?=\\.?\\s+\\d|[:,.]|$)" +
    "|(?<=\\d\\.?\\s)(?:" + SHORT.map(k => cap(k) + "|" + k.toUpperCase()).join("|") + ")\\b", "g");
  const NUM_RE = /\d+(?:[.,]\d+)?/g;

  let lang = "en", table = new Map(), keep = [], keepRe = null;

  /* Rows: [English, Portuguese, German, Italian]. Called by i18n-data.js. */
  function load(rows) {
    table = new Map();
    for (const r of rows || []) if (r && r[0]) table.set(norm(r[0]), r);
  }
  /* Names that stay in English (exercises, workouts). Longest first, so "Bench Press (Dumbbell)" wins over "Bench Press". */
  let keepFn = null, keepKey = "";
  /* A function that returns the names to keep; asked again before each pass over the page (the user's name can change). */
  function keepFrom(fn) { keepFn = fn; refreshKeep(); }
  function refreshKeep() {
    if (!keepFn) return;
    const l = keepFn() || [], k = l.length + ":" + l.join("|").length + ":" + (l[l.length - 1] || "");
    if (k !== keepKey) { keepKey = k; keepNames(l); }
  }
  function keepNames(list) {
    keep = [...new Set((list || []).filter(s => s && s.length > 2))].sort((a, b) => b.length - a.length);
    keepRe = keep.length ? new RegExp("(?<![\\w])(" + keep.map(esc).join("|") + ")(?![\\w])", "g") : null;
  }
  const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const norm = s => String(s).replace(/\s+/g, " ").trim();

  function setLang(id) { lang = COL[id] ? id : "en"; return lang; }
  const getLang = () => lang;
  const locale = () => (LANGS.find(l => l.id === lang) || LANGS[0]).locale;
  /* The language of the phone, if we have it; otherwise English. */
  function detect(list) {
    for (const l of list || []) { const id = String(l || "").slice(0, 2).toLowerCase(); if (COL[id] || id === "en") return id; }
    return "en";
  }

  /* Turns a text into its row key and remembers the parts that were taken out. */
  function template(text, withNames) {
    const nums = [], parts = [];
    let s = norm(text);
    if (withNames) {
      if (keepRe) s = s.replace(keepRe, m => { parts.push({ v: m, keep: true }); return "\u0001"; });
      s = s.replace(CAL_RE, m => { parts.push({ v: m, cal: true }); return "\u0001"; });
    }
    s = s.replace(NUM_RE, m => { nums.push(m); return "{" + (nums.length - 1) + "}"; });
    let i = 0;
    s = s.replace(/\u0001/g, () => "{" + LETTERS[i++] + "}");
    return { key: s, nums, parts };
  }

  function calWord(w) {
    const r = CAL[w.toLowerCase()];
    if (!r) return w;
    const t = r[COL[lang] - 1];
    return w === w.toUpperCase() && w.length > 1 ? t.toUpperCase() : (/^[A-Z]/.test(w) && lang !== "pt" && lang !== "it" ? t[0].toUpperCase() + t.slice(1) : t);
  }
  function numOut(n) { return lang === "en" ? n : n.replace(/^(\d+)\.(\d+)$/, "$1,$2"); }
  function fill(out, tp) {
    return out.replace(/\{(\d+)\}/g, (m, i) => tp.nums[i] != null ? numOut(tp.nums[i]) : m)
      .replace(/\{([a-j])\}/g, (m, l) => { const p = tp.parts[LETTERS.indexOf(l)]; return !p ? m : p.cal ? calWord(p.v) : p.v; });
  }

  /* The translation of one English text, or null when there is none (or the language is English). */
  function lookup(text) {
    if (lang === "en") return null;
    const c = COL[lang];
    let tp = template(text, false), r = table.get(tp.key);
    if (!r || !r[c]) { tp = template(text, true); r = table.get(tp.key); }
    if (r && r[c]) return fill(r[c], tp);
    // "Arms · Barbell", "Easy run · 30 min": translate each part on its own
    const seg = norm(text).split(" · ");
    if (seg.length > 1) {
      let any = false;
      const out = seg.map(p => { const v = lookup(p); if (v != null) any = true; return v == null ? p : v; });
      if (any) return out.join(" · ");
    }
    // a single month or weekday on its own
    if (/^[A-Za-z]+\.?$/.test(norm(text)) && CAL[norm(text).replace(".", "").toLowerCase()]) return calWord(norm(text).replace(".", ""));
    return null;
  }
  /* For code: t("Start yoga") gives the text in the chosen language, or the English text. */
  function t(text) { const v = lookup(text); return v == null ? String(text) : v; }

  /* ---------- in the browser: translate what is on the page ---------- */
  const ATTRS = ["placeholder", "aria-label", "title", "alt"];
  const SKIP = /^(SCRIPT|STYLE|TEXTAREA|CODE)$/;
  function textNode(n) {
    const v = n.nodeValue;
    if (!v || !/[A-Za-z]{2}/.test(v)) return;
    const p = n.parentElement;
    if (!p || SKIP.test(p.tagName) || p.closest("[data-i18n-skip],[contenteditable]")) return;
    const tr = lookup(v);
    if (tr != null && tr !== norm(v)) {
      const lead = v.match(/^\s*/)[0], trail = v.match(/\s*$/)[0];
      n.nodeValue = lead + tr + trail;
    }
  }
  function element(e) {
    for (const a of ATTRS) if (e.hasAttribute && e.hasAttribute(a)) { const tr = lookup(e.getAttribute(a)); if (tr != null) e.setAttribute(a, tr); }
  }
  function apply(rootEl) {
    if (lang === "en" || !rootEl) return;
    refreshKeep();
    if (rootEl.nodeType === 3) return textNode(rootEl);
    if (rootEl.nodeType !== 1 || SKIP.test(rootEl.tagName) || rootEl.closest("[data-i18n-skip]")) return;
    element(rootEl);
    const w = rootEl.ownerDocument.createTreeWalker(rootEl, 5 /* elements and text */);
    let n;
    while ((n = w.nextNode())) n.nodeType === 3 ? textNode(n) : element(n);
  }
  let obs = null;
  /* Translates the page now and everything the app draws later. */
  function watch(doc) {
    if (obs) obs.disconnect();
    if (lang === "en" || typeof MutationObserver !== "function") return;
    doc.documentElement.lang = lang;
    apply(doc.body);
    obs = new MutationObserver(list => {
      for (const m of list) {
        if (m.type === "characterData") textNode(m.target);
        else if (m.type === "attributes") element(m.target);
        else m.addedNodes.forEach(apply);
      }
      obs.takeRecords();   // our own changes come back here; nothing to do for them
    });
    obs.observe(doc.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTRS });
  }

  const api = { LANGS, load, keepNames, keepFrom, setLang, getLang, locale, detect, template, lookup, t, apply, watch, size: () => table.size };
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.NFI18N = api;
})(typeof window !== "undefined" ? window : globalThis);
