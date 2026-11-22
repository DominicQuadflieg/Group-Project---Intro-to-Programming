// Tests for the activity file readers in app/run.js (GPX, TCX, FIT, ZIP) · run with: node --test
const test = require("node:test");
const assert = require("node:assert/strict");
const zlib = require("node:zlib");
const R = require("../app/run.js");

const close = (a, b, eps = 0.02) => assert.ok(Math.abs(a - b) < eps, `${a} ≉ ${b}`);
const START = Date.UTC(2026, 10, 16, 7, 0, 0);

/* ---------- helpers that build small example files ---------- */
// A straight line north: 0.009° latitude ≈ 1 km. One point every 30 s.
function gpx({ points = 21, step = 0.0009, every = 30, type = "running", pauseAt = -1, pauseSec = 0, segs = 1 } = {}) {
  let t = START, pts = [];
  const pt = (i, t) => `<trkpt lat="${(38.7 + i * step).toFixed(6)}" lon="-9.15"><ele>10</ele><time>${new Date(t).toISOString()}</time></trkpt>`;
  for (let i = 0; i < points; i++) {
    // standing still: one more point at the same place after the pause
    if (i === pauseAt) { t += pauseSec * 1000; pts.push(pt(i - 1, t - every * 1000)); }
    pts.push(`<trkpt lat="${(38.7 + i * step).toFixed(6)}" lon="-9.15"><ele>10</ele><time>${new Date(t).toISOString()}</time></trkpt>`);
    t += every * 1000;
  }
  const per = Math.ceil(pts.length / segs), body = [];
  for (let s = 0; s < segs; s++) body.push(`<trkseg>${pts.slice(s * per, (s + 1) * per).join("")}</trkseg>`);
  return `<?xml version="1.0"?><gpx version="1.1" creator="Test"><trk><name>Morning Run</name><type>${type}</type>${body.join("")}</trk></gpx>`;
}

// Minimal FIT file: a definition and a data message for "session" (global message 18)
function fit({ sport = 1, timerMs = 2558000, elapsedMs = 2600000, cm = 772000, start = START / 1000 - 631065600, withSession = true } = {}) {
  const bytes = [];
  const u8 = v => bytes.push(v & 0xff), u16 = v => { u8(v); u8(v >> 8); }, u32 = v => { u16(v & 0xffff); u16(v >>> 16); };
  if (withSession) {
    u8(0x40); u8(0); u8(0); u16(18); u8(5);          // definition, local 0, little endian, session, 5 fields
    [[2, 4, 0x86], [5, 1, 0x00], [7, 4, 0x86], [8, 4, 0x86], [9, 4, 0x86]].forEach(([n, s, b]) => { u8(n); u8(s); u8(b); });
    u8(0x00); u32(start); u8(sport); u32(elapsedMs); u32(timerMs); u32(cm);
  } else {
    u8(0x41); u8(0); u8(0); u16(20); u8(2);          // definition, local 1, record: timestamp + distance
    [[253, 4, 0x86], [5, 4, 0x86]].forEach(([n, s, b]) => { u8(n); u8(s); u8(b); });
    [[0, 0], [600, 200000], [1200, 400000]].forEach(([dt, d]) => { u8(0x01); u32(start + dt); u32(d); });
  }
  const data = Uint8Array.from(bytes), out = new Uint8Array(14 + data.length + 2), dv = new DataView(out.buffer);
  out[0] = 14; out[1] = 0x20; dv.setUint16(2, 2132, true); dv.setUint32(4, data.length, true);
  out.set([0x2e, 0x46, 0x49, 0x54], 8); out.set(data, 14);
  return out;
}

// ZIP with one file; method 0 (stored) or 8 (deflate)
function zip(name, content, method = 0) {
  const nm = Buffer.from(name), raw = Buffer.from(content);
  const data = method === 8 ? zlib.deflateRawSync(raw) : raw;
  const local = Buffer.alloc(30); local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(method, 8);
  local.writeUInt32LE(data.length, 18); local.writeUInt32LE(raw.length, 22); local.writeUInt16LE(nm.length, 26);
  const central = Buffer.alloc(46); central.writeUInt32LE(0x02014b50, 0); central.writeUInt16LE(method, 10);
  central.writeUInt32LE(data.length, 20); central.writeUInt32LE(raw.length, 24); central.writeUInt16LE(nm.length, 28); central.writeUInt32LE(0, 42);
  const cdOff = 30 + nm.length + data.length;
  const end = Buffer.alloc(22); end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(1, 8); end.writeUInt16LE(1, 10);
  end.writeUInt32LE(46 + nm.length, 12); end.writeUInt32LE(cdOff, 16);
  return new Uint8Array(Buffer.concat([local, nm, data, central, nm, end]));
}

/* ---------- GPX ---------- */
test("GPX: distance, time, start and name", () => {
  const r = R.parseGpx(gpx());                       // 20 steps of 100 m, 30 s each
  close(r.km, 2.0, 0.01);
  assert.equal(r.min, 10);
  assert.equal(r.at, START);
  assert.equal(r.name, "Morning Run");
});

test("GPX: a pause at a traffic light does not count", () => {
  const r = R.parseGpx(gpx({ pauseAt: 10, pauseSec: 120 }));
  assert.equal(r.min, 10);
});

test("GPX: time between track segments does not count", () => {
  const r = R.parseGpx(gpx({ segs: 2, pauseAt: 11, pauseSec: 300 }));
  assert.ok(r.min < 10.1, `moving time ${r.min}`);
});

test("GPX: errors for other files and empty tracks", () => {
  assert.throws(() => R.parseGpx("<html></html>"), /not a GPX/);
  assert.throws(() => R.parseGpx('<gpx><trk><trkseg></trkseg></trk></gpx>'), /no track/);
});

/* ---------- TCX ---------- */
test("TCX: laps are added up", () => {
  const lap = (s, sec, m) => `<Lap StartTime="${s}"><TotalTimeSeconds>${sec}</TotalTimeSeconds><DistanceMeters>${m}</DistanceMeters><Track><Trackpoint><DistanceMeters>99999</DistanceMeters></Trackpoint></Track></Lap>`;
  const x = `<?xml version="1.0"?><TrainingCenterDatabase><Activities><Activity Sport="Running"><Id>2026-11-16T07:00:00Z</Id>${lap("2026-11-16T07:00:00Z", 1500, 5000)}${lap("2026-11-16T07:25:00Z", 1058, 2720)}</Activity></Activities></TrainingCenterDatabase>`;
  const r = R.parseTcx(x);
  assert.equal(r.km, 7.72);
  close(r.min, 2558 / 60);
  assert.equal(r.at, START);
  assert.equal(r.sport, "Running");
});

/* ---------- FIT ---------- */
test("FIT: session with moving time, distance and start", () => {
  const r = R.parseFit(fit());
  assert.equal(r.km, 7.72);
  close(r.min, 2558 / 60);
  assert.equal(r.at, START);
  assert.equal(r.sport, "running");
});

test("FIT: without a session the track points are used", () => {
  const r = R.parseFit(fit({ withSession: false }));
  assert.equal(r.km, 4);
  assert.equal(r.min, 20);
});

test("FIT: other files are refused", () => {
  assert.throws(() => R.parseFit(new Uint8Array(20)), /not a FIT/);
});

/* ---------- recognising and reading files ---------- */
test("file type is recognised from the content", () => {
  const enc = s => new TextEncoder().encode(s);
  assert.equal(R.fileKind("run.fit", fit()), "fit");
  assert.equal(R.fileKind("export.xml", enc(gpx())), "gpx");
  assert.equal(R.fileKind("a", enc("<TrainingCenterDatabase>")), "tcx");
  assert.equal(R.fileKind("a.zip", zip("a.fit", "x")), "zip");
  assert.equal(R.fileKind("a.gz", zlib.gzipSync("x")), "gz");
});

test("ZIP from Garmin Connect: the FIT file inside is found", () => {
  const f = fit(), z = R.zipEntry(zip("12345_ACTIVITY.fit", f));
  assert.equal(z.name, "12345_ACTIVITY.fit");
  assert.equal(z.method, 0);
  assert.equal(R.parseActivity("fit", z.data).km, 7.72);
  const d = R.zipEntry(zip("run.gpx", gpx(), 8));
  assert.equal(d.method, 8);
  assert.equal(R.parseGpx(zlib.inflateRawSync(d.data).toString()).name, "Morning Run");
});

test("ZIP without an activity file gives an error", () => {
  assert.throws(() => R.zipEntry(zip("readme.txt", "hi")), /no FIT, GPX or TCX/);
});

test("rides and swims are refused, walks and unknown sports are accepted", () => {
  assert.throws(() => R.parseActivity("fit", fit({ sport: 2 })), /cycling activity, not a run/);
  assert.throws(() => R.parseActivity("gpx", new TextEncoder().encode(gpx({ type: "Ride" }))), /Ride activity/);
  assert.equal(R.parseActivity("fit", fit({ sport: 11 })).sport, "walking");
  assert.equal(R.parseActivity("fit", fit({ sport: 0 })).sport, "");
  assert.throws(() => R.parseActivity("pdf", new Uint8Array(4)), /GPX, TCX and FIT/);
});

/* ---------- duplicates ---------- */
test("a run that is already saved is found", () => {
  const h = [{ start: START + 2 * 60000, run: { km: 7.7 } }, { start: START - 864e5, sets: {} }];
  assert.ok(R.findDuplicate(h, START, 7.72));
  // morning and afternoon of the same local day, whatever the time zone of the computer
  const am = new Date(2026, 10, 16, 8).getTime(), pm = new Date(2026, 10, 16, 17).getTime();
  assert.ok(R.findDuplicate([{ start: pm, run: { km: 7.72 } }], am, 7.72), "same day, same distance");
  assert.equal(R.findDuplicate([{ start: pm, run: { km: 5 } }], am, 7.72), null);
  assert.equal(R.findDuplicate(h, 0, 7.72), null);
});

/* ---------- Polar Flow CSV ---------- */
// Built like Polar Flow's export: summary header and row, then one row per second
function polarCsv({ sport = "RUNNING", km = "12.52", dur = "01:13:43", date = "2026-11-15", time = "17:40:36", lastM = "12518.20", german = false } = {}) {
  const head = german
    ? "Name,Sportart,Datum,Startzeit,Dauer,Gesamtdistanz (km),Durchschnittliche Herzfrequenz (bpm)"
    : "Name,Sport,Date,Start time,Duration,Total distance (km),Average heart rate (bpm),Average speed (km/h),Calories";
  return [head, `Test Runner,${sport},${date},${time},${dur},${km},139,10.2,946`,
    "Sample rate,Time,HR (bpm),Speed (km/h),Pace (min/km),Cadence,Altitude (m),Stride length (m),Distances (m),Temperatures (C),Power (W)",
    "1,00:00:00,,0.0,00:00,0,,,0.00,,", ",00:00:01,120,9.0,06:40,78,23,,2.50,,", `,01:13:43,151,4.6,13:09,79,22,,${lastM},,`].join("\r\n");
}
const u8 = s => new TextEncoder().encode(s);

test("Polar CSV is recognised by its content, also with an upper-case .CSV name", () => {
  assert.equal(R.fileKind("Julius_2026-11-15_17-40-36.CSV", u8(polarCsv())), "polarcsv");
  assert.equal(R.fileKind("run.csv", u8(polarCsv({ german: true }))), "polarcsv");
  assert.equal(R.fileKind("activities.csv", u8("Activity ID,Activity Date,Activity Name,Activity Type\n1,x,y,Run")), "csv"); // Strava stays a list
});

test("Polar CSV gives date, distance and time of the session", () => {
  const r = R.parseActivity("polarcsv", u8(polarCsv()));
  assert.equal(r.km, 12.52);
  close(r.min, 73 + 43 / 60);
  assert.equal(r.at, new Date(2026, 10, 15, 17, 40, 36).getTime()); // local time like on the watch
  assert.equal(r.sport, "running");
});

test("Polar CSV without a summary distance uses the per-second distances", () => {
  const r = R.parsePolarCsv(polarCsv({ km: "", lastM: "5000.00" }));
  assert.equal(r.km, 5);
});

test("Polar CSV: other sports are refused, broken files explained", () => {
  assert.throws(() => R.parseActivity("polarcsv", u8(polarCsv({ sport: "CYCLING" }))), /not a run/);
  assert.throws(() => R.parsePolarCsv(polarCsv({ date: "", time: "" })), /date/);
  assert.throws(() => R.parsePolarCsv("Name,Foo\n1,2"), /not a Polar/);
  assert.ok(R.parseActivity("polarcsv", u8(polarCsv({ sport: "TREADMILL_RUNNING" }))).km > 0);
});

test("Polar CSV in the history import becomes one run", () => {
  const h = R.readHistoryCsv(polarCsv());
  assert.equal(h.source, "polar");
  assert.equal(h.items.length, 1);
  assert.equal(h.items[0].entry.run.km, 12.52);
  const bike = R.readHistoryCsv(polarCsv({ sport: "CYCLING" }));
  assert.equal(bike.items.length, 0);
  assert.equal(bike.other, 1);
  const tread = R.readHistoryCsv(polarCsv({ sport: "TREADMILL_RUNNING" }));
  assert.equal(tread.items[0].entry.run.mode, "band");
});
