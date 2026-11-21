/* NOVAFit · newest Nova SBE headlines for the Today page (Netlify Function)

   GET → {items:[{title, url}], at}   at most 5 headlines, newest first, each linking to the article on novasbe.unl.pt
         {items:[], at}               when the school's page can't be read; the app then only shows a link to it

   No key, no user data. Netlify's CDN keeps the answer for 3 hours, so the school's site is asked
   at most a few times a day, however many people open the app. */

import { guard, makeLimiter } from "../lib/guard.mjs";
import { NEWS_PAGE, parseNews } from "../lib/news.mjs";

const limiter = makeLimiter(30, 10 * 60 * 1000);
let last = null;   // the last good answer in this function instance

const json = (body, status = 200, cache = true) => new Response(JSON.stringify(body), {
  status,
  headers: Object.assign({ "Content-Type": "application/json" }, cache
    ? { "Cache-Control": "public, max-age=1800", "Netlify-CDN-Cache-Control": "public, s-maxage=10800, stale-while-revalidate=86400" }
    : { "Cache-Control": "no-store" })
});

export default async function handler(req, context) {
  const refused = guard(req, context, limiter);
  if (refused) return refused;
  if (req.method !== "GET") return json({ error: "method_not_allowed" }, 405, false);
  if (last && Date.now() - last.at < 3 * 3600e3) return json(last);
  let items = [];
  try {
    const r = await fetch(NEWS_PAGE, { headers: { "User-Agent": "NOVAFit student app (news headlines)", Accept: "text/html" }, signal: AbortSignal.timeout(8000) });
    if (r.ok) items = parseNews(await r.text());
  } catch (e) { items = []; }
  if (items.length) { last = { items, at: Date.now() }; return json(last); }
  // Page not readable right now: give the last good list if there is one, else an empty list (not cached long)
  return last ? json(last) : json({ items: [], at: Date.now() }, 200, false);
}
