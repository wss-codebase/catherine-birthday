// Keeper lottery backend: holds Kenton's one real draft.
// Static files in ./public are served as before; this Worker only handles
// /api/*, /draft/<key> and /reset/<key>.
//
// The repo is public, so the secret keys are never stored here. Only their
// SHA-256 hashes are. The keys themselves live in the commissioner's links.
import { DurableObject } from "cloudflare:workers";

const DRAFT_KEY_HASH = "1b1137a2aed815de0b332e1c66c5d0f8ba054bae76fad44cffc88433378b8227";
const RESET_KEY_HASH = "0e48fcdac53691030a0644b1b6341204db84127104cf3a2816c735812f730f27";

const POTS = 5, PER_POT = 11;

// Same data as LEAGUE in public/index.html. Ranks are overall Hashtag Basketball
// dynasty ranks (updated 24 Sep 2026).
const LEAGUE = [
  { name: "BSOD", players: [["Chet Holmgren", 14], ["Dylan Harper", 17], ["Amen Thompson", 21], ["Josh Giddey", 33], ["VJ Edgecombe", 49]] },
  { name: "Eastern Promises", players: [["Luka Doncic", 3], ["Nikola Jokic", 4], ["Tyrese Maxey", 8], ["Donovan Mitchell", 18], ["Stephen Curry", 66]] },
  { name: "Tropics", players: [["Alex Sarr", 31], ["Matas Buzelis", 41], ["Bam Adebayo", 46], ["Jaylen Brown", 50], ["Onyeka Okongwu", 60]] },
  { name: "Boogies", players: [["Tyler Herro", 53], ["James Harden", 65], ["Derik Queen", 80], ["Isaiah Hartenstein", 91], ["Kawhi Leonard", 102]] },
  { name: "Curryous Klay", players: [["Domantas Sabonis", 64], ["Kyrie Irving", 95], ["Jalen Green", 98], ["Coby White", 104], ["Norman Powell", 116]] },
  { name: "QuickleyIsTRASH", players: [["Brandon Miller", 44], ["Paolo Banchero", 47], ["Lauri Markkanen", 54], ["Zach Edey", 55], ["Reed Sheppard", 84]] },
  { name: "Knicks", players: [["Karl Anthony Towns", 27], ["LaMelo Ball", 40], ["Zion Williamson", 81], ["Julius Randle", 99], ["Damian Lillard", 178]] },
  { name: "AVINJUREDS", players: [["Jaren Jackson Jr.", 35], ["Anthony Davis", 52], ["Pascal Siakam", 61], ["Ja Morant", 83], ["Jarrett Allen", 109]] },
  { name: "The Basketball Team", players: [["Tyrese Haliburton", 13], ["Austin Reaves", 22], ["Kon Knueppel", 25], ["Kevin Durant", 76], ["Joel Embiid", 100]] },
  { name: "Paul Rudd All Stars", players: [["Cade Cunningham", 5], ["Scottie Barnes", 12], ["Franz Wagner", 30], ["Deni Avdija", 36], ["Darius Garland", 42]] },
  { name: "What Does the Cat Say", players: [["Jalen Williams", 19], ["Trae Young", 29], ["Jalen Duren", 34], ["Donovan Clingan", 48], ["Walker Kessler", 68]] },
];

// Pots by overall rank: top 11 in Pot 1, next 11 in Pot 2, and so on.
function rankedPots() {
  const all = LEAGUE.flatMap(t => t.players.map(([player, rank]) => ({ player, rank, team: t.name })))
    .sort((a, b) => a.rank - b.rank);
  return Array.from({ length: POTS }, (_, p) => all.slice(p * PER_POT, (p + 1) * PER_POT));
}

function rint(n) {
  const lim = Math.floor(0x100000000 / n) * n, a = new Uint32Array(1);
  do { crypto.getRandomValues(a); } while (a[0] >= lim);
  return a[0] % n;
}
function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) { const j = rint(i + 1); [arr[i], arr[j]] = [arr[j], arr[i]]; }
  return arr;
}

async function sha256(s) {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(d)].map(b => b.toString(16).padStart(2, "0")).join("");
}
async function keyMatches(key, hash) {
  return typeof key === "string" && key.length > 0 && key.length <= 100 && (await sha256(key)) === hash;
}

// One instance holds the whole draft. Durable Objects handle one request at a
// time, so two taps can't both record a pick for the same pot.
export class Draft extends DurableObject {
  async load() {
    let s = await this.ctx.storage.get("state");
    if (!s) {
      s = {
        pots: rankedPots().map(pot => shuffle([...pot]).map((x, i) => ({ ...x, num: i + 1 }))),
        picks: [],
        createdAt: Date.now(),
      };
      await this.ctx.storage.put("state", s);
    }
    return s;
  }

  // What Kenton's page may see: pot membership (public anyway), but never the
  // number-to-player mapping until the draft is finished.
  view(s) {
    const complete = s.picks.length >= POTS;
    return {
      round: s.picks.length,
      complete,
      picks: s.picks,
      pots: rankedPots(),
      board: complete ? s.pots : null,
    };
  }

  async getState() {
    return this.view(await this.load());
  }

  async pick(pot, num) {
    const s = await this.load();
    if (s.picks.length >= POTS) return { error: "The draft is already complete.", state: this.view(s) };
    if (pot !== s.picks.length) return { error: `Pot ${s.picks.length + 1} is up next.`, state: this.view(s) };
    if (!Number.isInteger(num) || num < 1 || num > PER_POT) return { error: "Pick a number from 1 to 11.", state: this.view(s) };
    const x = s.pots[pot][num - 1];
    const pick = { pot: pot + 1, num, player: x.player, team: x.team, rank: x.rank, at: Date.now() };
    s.picks.push(pick);
    await this.ctx.storage.put("state", s);
    return { pick, state: this.view(s) };
  }

  // For the public practice page: only finished results, nothing mid-draft.
  async results() {
    const s = await this.ctx.storage.get("state");
    if (!s) return { started: false, complete: false };
    if (s.picks.length < POTS) return { started: s.picks.length > 0, complete: false, round: s.picks.length };
    return { started: true, complete: true, picks: s.picks, board: s.pots };
  }

  async reset() {
    await this.ctx.storage.deleteAll();
    return { ok: true };
  }
}

const json = (data, status = 200) => new Response(JSON.stringify(data), {
  status,
  headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
});

const RESET_PAGE = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex"><title>Reset Keeper Draft</title>
<style>
:root{color-scheme:dark}
body{margin:0;min-height:100vh;display:grid;place-items:center;background:#06080d;color:#eef2fa;
  font:16px/1.5 "Segoe UI",system-ui,sans-serif;padding:24px 16px;box-sizing:border-box}
main{max-width:460px;display:grid;gap:14px}
h1{margin:0;font-size:28px;text-transform:uppercase;letter-spacing:.02em}
p{margin:0;color:#8693ad}
button{font:inherit;font-weight:700;border:0;border-radius:999px;padding:12px 22px;cursor:pointer;justify-self:start}
.danger{background:#ff5a5f;color:#1a0002}
.ghost{background:none;color:#eef2fa;border:1px solid #22304a}
.row{display:flex;gap:10px;flex-wrap:wrap}
#msg{color:#eef2fa}
</style></head><body><main>
<h1>Reset Kenton's draft</h1>
<p>This permanently erases every pick on Kenton's lock-down link and reshuffles the pots the next time it's opened. Only do this if the real draft needs a do-over.</p>
<div class="row" id="step1"><button class="danger" id="go" type="button">Erase the draft</button></div>
<div class="row" id="step2" hidden><button class="danger" id="yes" type="button">Yes, erase it</button><button class="ghost" id="no" type="button">Cancel</button></div>
<p id="msg" role="status"></p>
</main><script>
const key = location.pathname.split("/").filter(Boolean)[1] || "";
const $ = id => document.getElementById(id);
$("go").onclick = () => { $("step1").hidden = true; $("step2").hidden = false; };
$("no").onclick = () => { $("step2").hidden = true; $("step1").hidden = false; };
$("yes").onclick = async () => {
  $("step2").hidden = true; $("msg").textContent = "Erasing...";
  try {
    const r = await fetch("/api/reset", { method: "POST", headers: { "x-reset-key": key } });
    $("msg").textContent = r.ok ? "Done. Kenton's link now starts a fresh draft." : "That reset link isn't valid. Nothing was erased.";
  } catch (e) { $("msg").textContent = "Couldn't reach the server. Nothing was erased. Check your connection and try again."; $("step1").hidden = false; }
};
</script></body></html>`;

export default {
  async fetch(req, env) {
    const url = new URL(req.url), path = url.pathname;
    const draft = () => env.DRAFT.get(env.DRAFT.idFromName("kenton"));

    if (path === "/api/results" && req.method === "GET") {
      return json(await draft().results());
    }

    if (path === "/api/draft") {
      if (!(await keyMatches(req.headers.get("x-draft-key"), DRAFT_KEY_HASH))) {
        return json({ error: "This draft link isn't valid." }, 403);
      }
      if (req.method === "GET") return json(await draft().getState());
      if (req.method === "POST") {
        let body;
        try { body = await req.json(); } catch { return json({ error: "Bad request." }, 400); }
        const out = await draft().pick(body.pot, body.num);
        return json(out, out.error ? 409 : 200);
      }
      return json({ error: "Method not allowed." }, 405);
    }

    if (path === "/api/reset" && req.method === "POST") {
      if (!(await keyMatches(req.headers.get("x-reset-key"), RESET_KEY_HASH))) {
        return json({ error: "This reset link isn't valid." }, 403);
      }
      return json(await draft().reset());
    }

    // Kenton's link serves the same page; the page reads the key from the URL.
    if (/^\/draft\/[^/]+\/?$/.test(path) && req.method === "GET") {
      const res = await env.ASSETS.fetch(new Request(new URL("/", url), req));
      const out = new Response(res.body, res);
      out.headers.set("cache-control", "no-store");
      out.headers.set("x-robots-tag", "noindex");
      return out;
    }

    if (/^\/reset\/[^/]+\/?$/.test(path) && req.method === "GET") {
      return new Response(RESET_PAGE, {
        headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store", "x-robots-tag": "noindex" },
      });
    }

    return env.ASSETS.fetch(req);
  },
};
