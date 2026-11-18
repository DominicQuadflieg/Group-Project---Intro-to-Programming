// Tests for importing a training history (Garmin CSV, Strava archive, files, Strava API) · run with: node --test
const test = require("node:test");
const assert = require("node:assert/strict");
const zlib = require("node:zlib");
const R = require("../app/run.js");

const close = (a, b, eps = 0.02) => assert.ok(Math.abs(a - b) < eps, `${a} ≉ ${b}`);
const NOW = new Date(2026, 10, 17, 18, 0).getTime();   // 17 Nov 2026

/* ---------- example exports ---------- */
const GARMIN_EN = [
  'Activity Type,Date,Favorite,Title,Distance,Calories,Time,Avg HR,Max HR,Avg Pace,Best Pace,Total Ascent,Moving Time,Elapsed Time',
  'Running,2026-11-16 07:00:00,false,"Lisbon Running",7.72,"1,012",00:42:38,152,171,5:31,4:50,34,00:42:10,00:43:20',
  'Treadmill Running,2026-11-10 18:30:00,false,"Treadmill",5.00,350,00:27:30,140,160,5:30,5:00,--,00:27:30,00:27:30',
  'Cycling,2026-11-09 09:00:00,false,"Ride, with friends",30.1,800,01:10:00,130,150,--,--,200,01:08:00,01:15:00',
  'Walking,2026-11-08 12:00:00,false,"Walk",3.20,180,00:40:00,100,110,12:30,11:00,10,00:38:00,00:41:00',
  'Running,2025-12-30 10:00:00,false,"Last year",10.00,700,00:55:00,150,170,5:30,5:00,50,00:55:00,00:56:00'
].join("\n");

const GARMIN_DE = '﻿Aktivitätstyp;Datum;Favorit;Titel;Distanz;Kalorien;Zeit\r\nLaufen;2026-11-16 07:00:00;false;Lissabon Laufen;7,72;512;00:42:38\r\nLaufband;2026-11-10 18:30:00;false;Laufband;5,00;350;00:27:30\r\n';

const STRAVA = [
  'Activity ID,Activity Date,Activity Name,Activity Type,Activity Description,Elapsed Time,Distance,Max Heart Rate,Commute,Filename,Elapsed Time,Moving Time,Distance,Max Speed',
  '15000000001,"Nov 16, 2026, 7:00:00 AM",Morning Run,Run,"Easy, ""recovery"" run",2600,7.72,171,false,activities/1.fit.gz,2600.0,2558.0,7720.5,4.1',
  '15000000002,"Nov 12, 2026, 5:45:00 PM",Intervals on the bridge,Run,,3200,10.02,180,false,activities/2.fit.gz,3200.0,3131.0,10020.0,5.2',
  '15000000003,"Nov 11, 2026, 8:00:00 AM",Evening Ride,Ride,,3700,30.00,150,false,activities/3.fit.gz,3700.0,3600.0,30000.0,10.0',
  '15000000004,"Nov 9, 2026, 9:00:00 AM",Sunday walk,Walk,,2400,3.10,110,false,activities/4.gpx,2400.0,2300.0,3100.0,1.6',
  '15000000005,"Nov 5, 2026, 6:00:00 PM",Treadmill,Virtual Run,,1800,5.00,150,false,,1800.0,1800.0,5000.0,3.0'
].join("\n");

/* ---------- small helpers ---------- */
test("CSV: quotes, commas and line breaks inside quotes, semicolons, BOM", () => {
  assert.deepEqual(R.parseCsv('a,b,c\n1,"x, y","say ""hi"""\n'), [["a", "b", "c"], ["1", "x, y", 'say "hi"']]);
  assert.deepEqual(R.parseCsv('a;b\r\n"line\nbreak";2'), [["a", "b"], ["line\nbreak", "2"]]);
  assert.deepEqual(R.parseCsv("﻿x,y\n\n1,2\n"), [["x", "y"], ["1", "2"]]);
});

test("numbers and times in different formats", () => {
  assert.equal(R.numLoose("7.72"), 7.72);
  assert.equal(R.numLoose("7,72"), 7.72);
  assert.equal(R.numLoose("1,234.5"), 1234.5);
  assert.equal(R.numLoose("1.234,5"), 1234.5);
  assert.equal(R.numLoose("--"), 0);
  close(R.durMin("00:42:38"), 42 + 38 / 60);
  close(R.durMin("42:38"), 42 + 38 / 60);
  close(R.durMin("2558.0"), 2558 / 60);
  assert.equal(R.durMin("--"), 0);
});

test("dates: Garmin local time, Strava UTC", () => {
  assert.equal(R.parseStamp("2026-11-16 07:00:00", false), new Date(2026, 10, 16, 7, 0).getTime());
  assert.equal(R.parseStamp("Nov 16, 2026, 7:00:00 PM", true), Date.UTC(2026, 10, 16, 19, 0));
  assert.equal(R.parseStamp("16.11.2026, 07:00:00", true), Date.UTC(2026, 10, 16, 7, 0));
  assert.equal(R.parseStamp("16 Nov 2026, 07:00:00", true), Date.UTC(2026, 10, 16, 7, 0));
  assert.equal(R.parseStamp("yesterday", true), 0);
});

test("kinds of activities", () => {
  assert.deepEqual(R.sportKind("Running"), { kind: "run", band: false });
  assert.deepEqual(R.sportKind("Treadmill Running"), { kind: "run", band: true });
  assert.deepEqual(R.sportKind("Laufband"), { kind: "run", band: true });
  assert.deepEqual(R.sportKind("Virtual Run"), { kind: "run", band: true });
  assert.equal(R.sportKind("Trail Run").kind, "run");
  assert.equal(R.sportKind("Walk").kind, "walk");
  assert.equal(R.sportKind("Virtual Ride").kind, "other");
  assert.equal(R.sportKind("Swimming").kind, "other");
});

/* ---------- Garmin Connect ---------- */
test("Garmin (English): runs and walks, rides left out", () => {
  const r = R.readHistoryCsv(GARMIN_EN, { alsterKm: 7.4 });
  assert.equal(r.source, "garmin");
  assert.equal(r.other, 1);
  assert.equal(r.items.length, 4);
  const first = r.items[0].entry;
  assert.equal(first.start, new Date(2026, 10, 16, 7, 0).getTime());
  assert.equal(first.run.km, 7.72);
  close(first.run.min, 42 + 10 / 60);          // moving time
  assert.equal(first.end - first.start, (43 * 60 + 20) * 1000);
  assert.equal(first.run.mode, "alster");
  assert.equal(first.run.note, "");             // "Lisbon Running" is Garmin's automatic title
  assert.equal(r.items[1].entry.run.mode, "band");
  assert.equal(r.items[2].kind, "walk");
});

test("Garmin (German, semicolons, decimal comma)", () => {
  const r = R.readHistoryCsv(GARMIN_DE);
  assert.equal(r.source, "garmin");
  assert.equal(r.items.length, 2);
  assert.equal(r.items[0].entry.run.km, 7.72);
  assert.equal(r.items[1].entry.run.mode, "band");
});

test("Garmin in miles", () => {
  const r = R.readHistoryCsv(GARMIN_EN, { miles: true });
  close(r.items[0].entry.run.km, 7.72 * 1.609344);
});

/* ---------- Strava archive ---------- */
test("Strava activities.csv: metres column, moving time, UTC, notes", () => {
  const r = R.readHistoryCsv(STRAVA, { alsterKm: 7.4 });
  assert.equal(r.source, "strava");
  assert.equal(r.other, 1);
  assert.equal(r.items.length, 4);
  const e = r.items[0].entry;
  assert.equal(e.id, "st15000000001");          // same id as the Strava connection, so nothing comes in twice
  assert.equal(e.run.strava, "15000000001");
  assert.equal(e.start, Date.UTC(2026, 10, 16, 7, 0));
  assert.equal(e.run.km, 7.72);
  close(e.run.min, 2558 / 60);
  assert.equal(e.run.note, "");
  assert.equal(r.items[1].entry.run.note, "Intervals on the bridge");
  assert.equal(r.items[2].kind, "walk");
  assert.equal(r.items[3].entry.run.mode, "band");
});

test("other CSV files get a clear error", () => {
  assert.throws(() => R.readHistoryCsv("name,email\nJulius,j@x.pt"), /doesn't look like an activity list/);
  assert.throws(() => R.readHistoryCsv("Activity Type,Date,Distance"), /no activities/);
});

/* ---------- what gets added ---------- */
test("this year only, walks only if wanted, nothing twice", () => {
  const items = R.readHistoryCsv(GARMIN_EN, { alsterKm: 7.4 }).items;
  const history = [{ id: "s1", start: new Date(2026, 10, 10, 18, 31).getTime(), run: { km: 5 } }];   // treadmill already logged
  const p = R.planImport(history, items, { range: "year", now: NOW });
  assert.equal(p.add.length, 1);
  assert.equal(p.dup, 1);
  assert.equal(p.outside, 1);
  assert.equal(p.walks, 1);
  assert.equal(p.km, 7.72);
  const w = R.planImport(history, items, { range: "all", walks: true, now: NOW });
  assert.equal(w.add.length, 3);
  assert.equal(w.first, new Date(2025, 11, 30, 10, 0).getTime());
  assert.equal(w.add[0].start <= w.add[1].start, true, "sorted by date");
});

test("the same run from two sources is added once", () => {
  // Strava stores UTC, Garmin local time: write Strava's time as the UTC of Garmin's 7:00 local
  const utc = new Date(new Date(2026, 10, 16, 7, 0).getTime());
  const stamp = `Nov ${utc.getUTCDate()}, 2026, ${utc.getUTCHours() % 12 || 12}:00:00 ${utc.getUTCHours() < 12 ? "AM" : "PM"}`;
  const g = R.readHistoryCsv(GARMIN_EN).items, s = R.readHistoryCsv(STRAVA.replace("Nov 16, 2026, 7:00:00 AM", stamp)).items;
  const p = R.planImport([], g.concat(s), { range: "year", now: NOW });
  const day16 = p.add.filter(e => new Date(e.start).getDate() === 16);
  assert.equal(day16.length, 1);
  assert.ok(p.dup >= 1);
});

test("ranges: this year, last 12 months, everything", () => {
  assert.equal(R.rangeStart("year", NOW), new Date(2026, 0, 1).getTime());
  assert.equal(R.rangeStart("12m", NOW), NOW - 365 * 864e5);
  assert.equal(R.rangeStart("all", NOW), 0);
});

test("files from a watch become items", () => {
  const it = R.fileItem({ km: 7.72, min: 42.6, at: Date.UTC(2026, 10, 16, 7), sport: "running", name: "Morning Run" }, 7.4);
  assert.equal(it.kind, "run");
  assert.equal(it.entry.run.mode, "alster");
  assert.equal(R.fileItem({ km: 3, min: 40, at: 1, sport: "walking", name: "" }).kind, "walk");
});

test("Strava API activities become items", () => {
  const acts = [
    { id: 1, sport_type: "Run", distance: 5000, moving_time: 1500, elapsed_time: 1500, start_date: "2026-11-01T07:00:00Z" },
    { id: 2, sport_type: "Walk", distance: 3000, moving_time: 2400, elapsed_time: 2400, start_date: "2026-11-02T07:00:00Z" },
    { id: 3, sport_type: "Ride", distance: 30000, moving_time: 3600, elapsed_time: 3600, start_date: "2026-11-03T07:00:00Z" }
  ];
  assert.deepEqual(R.stravaItems(acts, 7.4).map(x => [x.entry.id, x.kind]), [["st1", "run"], ["st2", "walk"]]);
});

/* ---------- big Strava archive: read only the list of files and activities.csv ---------- */
test("ZIP read in parts: find activities.csv in a Strava archive", () => {
  const files = [["export_123/activities/1.fit.gz", zlib.gzipSync("x".repeat(2000))], ["export_123/activities.csv", Buffer.from(STRAVA)]];
  const locals = [], centrals = [];
  let off = 0;
  files.forEach(([name, raw]) => {
    const nm = Buffer.from(name), data = zlib.deflateRawSync(raw);
    const lh = Buffer.alloc(30); lh.writeUInt32LE(0x04034b50, 0); lh.writeUInt16LE(8, 8); lh.writeUInt32LE(data.length, 18); lh.writeUInt32LE(raw.length, 22); lh.writeUInt16LE(nm.length, 26);
    const ch = Buffer.alloc(46); ch.writeUInt32LE(0x02014b50, 0); ch.writeUInt16LE(8, 10); ch.writeUInt32LE(data.length, 20); ch.writeUInt32LE(raw.length, 24); ch.writeUInt16LE(nm.length, 28); ch.writeUInt32LE(off, 42);
    locals.push(lh, nm, data); centrals.push(ch, nm); off += 30 + nm.length + data.length;
  });
  const cd = Buffer.concat(centrals), end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(2, 8); end.writeUInt16LE(2, 10); end.writeUInt32LE(cd.length, 12); end.writeUInt32LE(off, 16);
  const zip = new Uint8Array(Buffer.concat([...locals, cd, end]));

  const e = R.zipEnd(zip.subarray(zip.length - 100));        // only the end of the file
  assert.equal(e.count, 2);
  const list = R.zipList(zip.subarray(e.cdOffset, e.cdOffset + e.cdSize));
  const csv = list.find(x => /(^|\/)activities\.csv$/.test(x.name));
  assert.ok(csv);
  const start = csv.lho + R.zipDataOffset(zip.subarray(csv.lho, csv.lho + 30));
  const text = zlib.inflateRawSync(zip.subarray(start, start + csv.csize)).toString();
  assert.equal(R.readHistoryCsv(text).items.length, 4);
});
