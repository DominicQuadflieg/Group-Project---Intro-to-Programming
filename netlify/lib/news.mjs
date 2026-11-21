/* NOVAFit · reads the newest headlines from the Nova SBE news page.

   The school has no RSS feed. Its news page carries a plain list of links
   <a href="https://www.novasbe.unl.pt/en/whats-happening/news/news-detail/id/<n>/<slug>" title="<headline>">
   in page order (newest first). We keep only headline and link: the article itself is read on the school's site.
   If the school changes its page and nothing matches, the list is empty and the app just shows a link to the news page. */

export const NEWS_PAGE = "https://www.novasbe.unl.pt/en/whats-happening/news";
const DETAIL = /^https:\/\/www\.novasbe\.unl\.pt\/en\/whats-happening\/news\/news-detail\/id\/(\d+)\/[a-z0-9-]+$/;
export const MAX_ITEMS = 5;
export const MAX_TITLE = 160;

const ENT = { amp: "&", lt: "<", gt: ">", quot: "\"", apos: "'", nbsp: " " };
export function decode(s) {
  return String(s)
    .replace(/&#(\d+);/g, (_, n) => { const c = Number(n); return c > 0 && c < 0x110000 ? String.fromCodePoint(c) : ""; })
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => { const c = parseInt(h, 16); return c > 0 && c < 0x110000 ? String.fromCodePoint(c) : ""; })
    .replace(/&([a-z]+);/gi, (m, n) => ENT[n.toLowerCase()] ?? m);
}

// html → [{title, url}], newest first, no duplicates, at most `max`
export function parseNews(html, max = MAX_ITEMS) {
  const out = [], seen = new Set();
  const re = /<a\s+href="([^"]+)"\s+title="([^"]*)"/g;
  let m;
  while ((m = re.exec(String(html || ""))) && out.length < max) {
    const url = m[1], id = DETAIL.exec(url);
    if (!id || seen.has(id[1])) continue;
    const title = decode(m[2]).replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
    if (!title || title.length > MAX_TITLE) continue;
    seen.add(id[1]);
    out.push({ title, url });
  }
  return out;
}
