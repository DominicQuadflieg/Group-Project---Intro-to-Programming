// Tests for netlify/lib/news.mjs (Nova SBE headlines) · run with: node --test
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const html = fs.readFileSync(path.join(__dirname, "fixtures", "novasbe-news.html"), "utf8");
const lib = () => import("../netlify/lib/news.mjs");

test("reads the newest headlines in page order, menu links ignored", async () => {
  const { parseNews } = await lib();
  const items = parseNews(html, 3);
  assert.equal(items.length, 3);
  assert.equal(items[0].title, "Pedro Oliveira Re-Elected Dean of Nova SBE for the 2027–2030 Term");
  assert.match(items[0].url, /^https:\/\/www\.novasbe\.unl\.pt\/en\/whats-happening\/news\/news-detail\/id\/1467\//);
  assert.equal(items[1].title, "Nova SBE Renews Superbrand Recognition in 2026");
});

test("decodes entities and skips links to other sites", async () => {
  const { parseNews } = await lib();
  const items = parseNews(html, 10);
  assert.equal(items.length, 5);
  assert.equal(items[4].title, "Students & Alumni Win 'Big' Prize");
  assert.ok(items.every(i => i.url.startsWith("https://www.novasbe.unl.pt/")));
});

test("no duplicates, empty or broken input gives an empty list", async () => {
  const { parseNews } = await lib();
  const a = '<a href="https://www.novasbe.unl.pt/en/whats-happening/news/news-detail/id/7/a-b" title="One">';
  assert.equal(parseNews(a + a).length, 1);
  assert.deepEqual(parseNews(""), []);
  assert.deepEqual(parseNews(null), []);
  assert.deepEqual(parseNews("<html><body>new layout</body></html>"), []);
});

test("headlines can't carry markup or run on forever", async () => {
  const { parseNews, MAX_TITLE } = await lib();
  const u = "https://www.novasbe.unl.pt/en/whats-happening/news/news-detail/id/9/x";
  assert.equal(parseNews(`<a href="${u}" title="&lt;b&gt;Bold&lt;/b&gt; news">`)[0].title, "Bold news");
  assert.deepEqual(parseNews(`<a href="${u}" title="${"a".repeat(MAX_TITLE + 1)}">`), []);
});

test("a link with extra path or query is not taken", async () => {
  const { parseNews } = await lib();
  assert.deepEqual(parseNews('<a href="https://www.novasbe.unl.pt/en/whats-happening/news/news-detail/id/9/x?u=https://evil" title="X">'), []);
});
