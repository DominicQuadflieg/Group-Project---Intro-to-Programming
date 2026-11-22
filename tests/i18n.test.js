const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const I = require("../app/i18n.js");

// i18n-data.js calls NFI18N.load([...]); give it the module under that name
global.NFI18N = I;
require("../app/i18n-data.js");

const ROWS = (() => { const rows = []; const real = I.load; I.load = r => rows.push(...r); delete require.cache[require.resolve("../app/i18n-data.js")]; require("../app/i18n-data.js"); I.load = real; I.load(rows); return rows; })();
const ph = s => (s.match(/\{[0-9a-j]\}/g) || []).sort().join();

test("every row has Portuguese, German and Italian, with the same placeholders as the English text", () => {
  assert.ok(ROWS.length > 1000);
  for (const r of ROWS) {
    assert.equal(r.length, 4, r[0]);
    for (const t of r.slice(1)) {
      assert.ok(t && t.trim(), "missing translation: " + r[0]);
      assert.equal(ph(t), ph(r[0]), r[0] + " → " + t);
    }
  }
});

test("English rows are unique", () => {
  const seen = new Set();
  for (const r of ROWS) { assert.ok(!seen.has(r[0]), "twice: " + r[0]); seen.add(r[0]); }
});

test("numbers, names, months and parts are filled back in", () => {
  I.keepNames(["Bench Press (Barbell)", "Julius"]);
  I.setLang("pt");
  assert.equal(I.t("3 of 4 sessions"), "3 de 4 treinos");
  assert.equal(I.t("Muscles in November"), "Músculos em novembro");
  assert.equal(I.t("How to do Bench Press (Barbell)"), "Como fazer Bench Press (Barbell)");
  assert.equal(I.t("Arms · Barbell"), "Braços · Barra");
  assert.equal(I.t("6.2 km"), "6,2 km");
  I.setLang("de");
  assert.equal(I.t("Finish session"), "Einheit beenden");
  assert.equal(I.t("Upper · Lower"), "Oberkörper · Unterkörper");
  I.setLang("it");
  assert.equal(I.t("Weekly goal"), "Obiettivo settimanale");
});

test("ordinary words are not taken for months, and unknown text stays English", () => {
  I.setLang("pt");
  assert.equal(I.t("Something nobody translated"), "Something nobody translated");
  assert.match(I.t("Hips up and back, heels toward the floor, knees may bend."), /podem dobrar/);
  I.setLang("en");
  assert.equal(I.t("Finish session"), "Finish session");
});

test("the phone's language is used when we have it", () => {
  assert.equal(I.detect(["pt-PT", "en"]), "pt");
  assert.equal(I.detect(["de-AT"]), "de");
  assert.equal(I.detect(["it-IT"]), "it");
  assert.equal(I.detect(["fr-FR", "es"]), "en");
  assert.equal(I.setLang("xx"), "en");
});

test("the page loads the language files before the app", () => {
  const html = fs.readFileSync(path.join(__dirname, "../app/index.html"), "utf8");
  assert.ok(html.indexOf("i18n.js") < html.indexOf("i18n-data.js") && html.indexOf("i18n-data.js") < html.indexOf('src="app.js"'));
});
