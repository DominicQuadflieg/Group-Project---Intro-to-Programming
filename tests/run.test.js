// Tests for app/run.js · run with: node --test
const test = require("node:test");
const assert = require("node:assert/strict");
const R = require("../app/run.js");

const NOW = new Date(2026, 10, 17, 18, 0).getTime();   // 17 Nov 2026, 18:00
const shot = t => R.parseShot(t, NOW);
const close = (a, b, eps = 0.02) => assert.ok(Math.abs(a - b) < eps, `${a} ≉ ${b}`);
const mmss = (m, s) => m + s / 60;

/* ---------- screenshot layouts of different apps ---------- */
test("Strava: distance, pace and time in one row under a header", () => {
  const r = shot("9:41\nMorning Run\n17.11.2026 - 07:12\nDistance  Pace  Time\n7.72 km  5:31 /km  42:38\nElevation 34 m");
  assert.equal(r.km, 7.72);
  close(r.min, mmss(42, 38));
  assert.equal(r.at, new Date(2026, 10, 17, 7, 12).getTime());
});

test("Strava: same row without header", () => {
  const r = shot("Morning Run\n7.72 km  5:31 /km  42:38");
  assert.equal(r.km, 7.72);
  close(r.min, mmss(42, 38));
});

test("Garmin (German): label above value", () => {
  const r = shot("9:41\nLaufen\nDistanz\n10,02 km\nZeit\n52:11\nØ Pace\n5:13 /km\nHerzfrequenz 152");
  assert.equal(r.km, 10.02);
  close(r.min, mmss(52, 11));
});

test("run over one hour with hours:minutes:seconds", () => {
  const r = shot("21,10 km\n1:48:22\n5:08 /km");
  assert.equal(r.km, 21.1);
  close(r.min, 108 + 22 / 60);
});

test("Apple Fitness: labels in the same line, pace as 6'11\"", () => {
  const r = shot("Outdoor Run\nWorkout Time 0:31:05\nDistance 5.03KM\nAvg. Pace 6'11\"/KM");
  assert.equal(r.km, 5.03);
  close(r.min, mmss(31, 5));
});

test("whole kilometres without a decimal", () => {
  const r = shot("Run\n10 km\n55:00");
  assert.equal(r.km, 10);
  assert.equal(r.min, 55);
});

test("distance without a unit under its label", () => {
  const r = shot("9:41\nAvg Pace\n5:31\nTime\n42:38\nDistance\n7.72");
  assert.equal(r.km, 7.72);
  close(r.min, mmss(42, 38));
});

test("English date with AM/PM and pace without /km", () => {
  const r = shot("Nov 17, 2026 at 7:12 AM\n5.00 Kilometers\nAvg. Pace 6'00\"\nTime 30:00");
  assert.equal(r.km, 5);
  assert.equal(r.min, 30);
  assert.equal(r.at, new Date(2026, 10, 17, 7, 12).getTime());
});

test("reading errors: O instead of 0 and l instead of 1", () => {
  const r = shot("Distance 7.72 km\nTime 42:3O\nPace 5:3l /km");
  assert.equal(r.km, 7.72);
  close(r.min, mmss(42, 30));
});

test("clock in the status bar is not taken as the running time", () => {
  const r = shot("Vodafone\n14:22\n7,72 km\n42:38");
  close(r.min, mmss(42, 38));
  const r2 = shot("9:41\n7,72 km\n42:38");
  close(r2.min, mmss(42, 38));
});

test("a lone time is still used if there is nothing else", () => {
  const r = shot("7,72 km\n42:38");
  close(r.min, mmss(42, 38));
});

test("miles are converted to kilometres", () => {
  const r = shot("Distance 3.11 mi\nTime 28:40\nPace 9:13 /mi");
  close(r.km, 5.0, 0.01);
  close(r.min, mmss(28, 40));
});

test("distance is taken from pace and time when it was misread", () => {
  // "772 km" instead of "7.72 km" would mean an impossible pace
  const r = shot("Distance 77.2 km\nTime 42:38\nPace 5:31 /km");
  close(r.km, 7.72, 0.05);
});

test("speed in km/h is not taken as the distance", () => {
  const r = shot("Treadmill\n10.5 km/h\nTime 30:00\nDistance 5.25 km");
  assert.equal(r.km, 5.25);
});

test("returns null when there is no run in the text", () => {
  assert.equal(shot("Hello world\nNothing to see"), null);
  assert.equal(shot(""), null);
});

/* ---------- dates ---------- */
test("dates in different formats", () => {
  const d = (txt) => R.parseDate([txt], NOW);
  assert.equal(d("2026-11-16 18:30"), new Date(2026, 10, 16, 18, 30).getTime());
  assert.equal(d("16/11/2026"), new Date(2026, 10, 16, 12, 0).getTime());
  assert.equal(d("11/16/2026"), new Date(2026, 10, 16, 12, 0).getTime());
  assert.equal(d("16. Nov. 2026, 07:05"), new Date(2026, 10, 16, 7, 5).getTime());
  assert.equal(d("Yesterday at 6:45 PM"), new Date(2026, 10, 16, 18, 45).getTime());
  assert.equal(d("Today 07:00"), new Date(2026, 10, 17, 7, 0).getTime());
});

test("dates in the future or too far back are ignored", () => {
  assert.equal(R.parseDate(["24.12.2026"], NOW), 0);
  assert.equal(R.parseDate(["01.01.2020"], NOW), 0);
});

/* ---------- checking the confirmed values ---------- */
test("valid run is accepted", () => {
  const r = R.validateRun({ km: "7,72", time: "42:38", date: "2026-11-17T07:12" }, NOW);
  assert.equal(r.ok, true);
  assert.equal(r.value.km, 7.72);
  close(r.value.min, mmss(42, 38));
  assert.equal(r.value.at, new Date(2026, 10, 17, 7, 12).getTime());
});

test("distance is optional, time is required", () => {
  assert.equal(R.validateRun({ km: "", time: "30:00" }, NOW).ok, true);
  const r = R.validateRun({ km: "5", time: "" }, NOW);
  assert.equal(r.ok, false);
  assert.ok(r.errors.time);
});

test("invalid values get clear errors", () => {
  const r = R.validateRun({ km: "5km", time: "42:75", date: "2026-12-24T10:00" }, NOW);
  assert.equal(r.ok, false);
  assert.ok(r.errors.km && r.errors.time && r.errors.date);
  assert.ok(R.validateRun({ km: "10", time: "12:00" }, NOW).errors.km, "faster than a world record");
  assert.ok(R.validateRun({ km: "", time: "1:00" }, NOW).errors.time, "too short");
});
