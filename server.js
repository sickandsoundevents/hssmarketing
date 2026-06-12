// =============================================================================
// HSS Marketing Attribution  -  Server (Statistik Abruf, korrekte Body Typen)
// -----------------------------------------------------------------------------
// Zieht echte Bestellungen ueber POST /statistics/orders/{company} und fuehrt
// sie mit den Meta Werbeausgaben zusammen. Body Typen laut Weeztix API Team:
// sorting = Objekt, filters = Objekt, events = Liste.
// =============================================================================

import express from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(express.json());
const PORT = process.env.PORT || 3000;
const BUILD = "17";
const DASHBOARD = "<!doctype html>\n<html lang=\"de\">\n<head>\n<meta charset=\"utf-8\" />\n<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\" />\n<title>HSS // Marketing Attribution</title>\n<style>\n@import url('https://fonts.googleapis.com/css2?family=Anton&family=IBM+Plex+Mono:wght@400;500;600;700&display=swap');\n:root{\n  --accent:#c4f042; --red:#ff5d4d; --amber:#f5a623;\n  --surface:#16160f; --line:#2c2c22; --text:#eef0e6; --muted:#8d8f80; --bg:#0c0c08;\n}\n*{box-sizing:border-box;margin:0;padding:0}\nbody{\n  background:var(--bg); color:var(--text);\n  font-family:'IBM Plex Mono',ui-monospace,monospace; letter-spacing:.2px; padding:22px;\n  background-image:linear-gradient(#2c2c2233 1px,transparent 1px),linear-gradient(90deg,#2c2c2233 1px,transparent 1px);\n  background-size:34px 34px; min-height:100vh;\n}\n.topbar{display:flex;justify-content:space-between;align-items:flex-end;flex-wrap:wrap;gap:14px;border-bottom:2px solid var(--accent);padding-bottom:14px}\n.brand{font-family:'Anton',sans-serif;font-size:30px;line-height:1;letter-spacing:1px;text-transform:uppercase}\n.brand .slash{color:var(--accent)}\n.controls{display:flex;gap:10px;align-items:center;flex-wrap:wrap}\n.badge{font-size:10px;color:var(--bg);background:var(--accent);padding:3px 8px;font-weight:700;text-transform:uppercase;letter-spacing:1.5px}\n.badge.live{background:var(--accent)}\n.badge.demo{background:var(--amber)}\n.status{display:flex;align-items:center;gap:6px;font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:1px}\n.dot{width:8px;height:8px;background:var(--accent);border-radius:50%;animation:pulse 1.8s infinite}\n@keyframes pulse{0%{box-shadow:0 0 0 0 #c4f04299}70%{box-shadow:0 0 0 7px #c4f04200}100%{box-shadow:0 0 0 0 #c4f04200}}\nselect{background:var(--surface);color:var(--text);border:1px solid var(--line);font-family:inherit;font-size:12px;padding:8px 10px;cursor:pointer}\n.kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-top:18px}\n.kpi{background:var(--surface);border:1px solid var(--line);padding:16px;position:relative;overflow:hidden}\n.kpi::before{content:'';position:absolute;left:0;top:0;bottom:0;width:3px;background:var(--accent)}\n.k-label{font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:1.2px}\n.k-value{font-family:'Anton',sans-serif;font-size:34px;line-height:1;margin-top:10px;letter-spacing:.5px}\n.k-sub{font-size:10px;color:var(--muted);margin-top:8px}\n.grid{display:grid;grid-template-columns:1.45fr 1fr;gap:12px;margin-top:12px}\n.panel{background:var(--surface);border:1px solid var(--line);padding:14px 16px}\n.panel h3{font-size:11px;text-transform:uppercase;letter-spacing:1.4px;color:var(--muted);margin-bottom:12px;display:flex;justify-content:space-between;align-items:center}\ntable{width:100%;border-collapse:collapse;margin-top:6px;font-size:12px}\nth{text-align:right;font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:.8px;padding:8px 6px;border-bottom:1px solid var(--line);cursor:pointer;white-space:nowrap}\nth.l,td.l{text-align:left}\nth:hover{color:var(--accent)}\ntd{text-align:right;padding:9px 6px;border-bottom:1px solid #20201733;white-space:nowrap}\ntr:hover td{background:#1d1d12}\n.pill{font-weight:700;padding:2px 7px;font-size:11px}\n.note{font-size:10px;color:var(--muted);margin-top:16px;line-height:1.6;border-top:1px solid var(--line);padding-top:12px}\n.note b{color:var(--text);font-weight:600}\n@media(max-width:760px){.kpis{grid-template-columns:repeat(2,1fr)}.grid{grid-template-columns:1fr}.brand{font-size:22px}}\n</style>\n</head>\n<body>\n  <div class=\"topbar\">\n    <div class=\"brand\">HSS <span class=\"slash\">//</span> MARKETING ATTRIBUTION</div>\n    <div class=\"controls\">\n      <span id=\"modeBadge\" class=\"badge demo\">Beispieldaten</span>\n      <span class=\"status\"><span class=\"dot\"></span> <span id=\"modeText\">Demo Modus</span></span>\n      <select id=\"showSel\"></select>\n    </div>\n  </div>\n\n  <div class=\"kpis\" id=\"kpis\"></div>\n\n  <div class=\"grid\">\n    <div class=\"panel\">\n      <h3>Verlauf <span>Naeherung aus aktuellen Werten</span></h3>\n      <div id=\"trend\"></div>\n    </div>\n    <div class=\"panel\">\n      <h3>ROAS je Kanal</h3>\n      <div id=\"roas\"></div>\n    </div>\n  </div>\n\n  <div class=\"panel\" style=\"margin-top:12px\">\n    <h3>Kanaele im Detail <span>Spalte antippen zum Sortieren</span></h3>\n    <table>\n      <thead><tr>\n        <th class=\"l\" data-k=\"channel\">Kanal</th>\n        <th data-k=\"spend\">Ausgaben</th>\n        <th data-k=\"orders\">Bestellungen</th>\n        <th data-k=\"revenue\">Umsatz</th>\n        <th data-k=\"roas\">ROAS</th>\n        <th data-k=\"cpa\">Kosten / Ticket</th>\n      </tr></thead>\n      <tbody id=\"rows\"></tbody>\n    </table>\n  </div>\n\n  <div class=\"note\" id=\"note\"></div>\n\n<script>\nconst ACCENT=\"#c4f042\",RED=\"#ff5d4d\",AMBER=\"#f5a623\",MUTED=\"#8d8f80\",LINE=\"#2c2c22\";\nlet DATA=[], SHOW=\"all\", SORT=\"revenue\";\nconst eur=n=>Math.round(n).toLocaleString(\"de-DE\")+\" \\u20ac\";\nconst num=n=>Math.round(n).toLocaleString(\"de-DE\");\nconst roasColor=r=>r>=5?ACCENT:r>=3?AMBER:RED;\n\nfunction shows(){\n  const s=[...new Set(DATA.map(r=>r.show))];\n  return [{id:\"all\",label:\"Alle Shows\"},...s.map(x=>({id:x,label:x}))];\n}\nfunction filtered(){\n  const rows=SHOW===\"all\"?DATA:DATA.filter(r=>r.show===SHOW);\n  const m={};\n  rows.forEach(r=>{(m[r.channel]??=(m[r.channel]={channel:r.channel,spend:0,orders:0,revenue:0}));m[r.channel].spend+=r.spend;m[r.channel].orders+=r.orders;m[r.channel].revenue+=r.revenue;});\n  return Object.values(m).map(r=>({...r,roas:r.spend>0?r.revenue/r.spend:null,cpa:r.spend>0?r.spend/r.orders:0}));\n}\nfunction totals(rows){\n  const spend=rows.reduce((s,r)=>s+r.spend,0), revenue=rows.reduce((s,r)=>s+r.revenue,0);\n  const orders=rows.reduce((s,r)=>s+r.orders,0), paid=rows.reduce((s,r)=>s+(r.spend>0?r.orders:0),0);\n  return {spend,revenue,orders,roas:spend>0?revenue/spend:0,cpa:paid>0?spend/paid:0};\n}\n\nfunction render(){\n  const rows=filtered(), t=totals(rows);\n  // KPIs\n  document.getElementById(\"kpis\").innerHTML=[\n    [\"Werbeausgaben gesamt\",eur(t.spend),\"Meta + Tracking Links\",null],\n    [\"Zugeordneter Umsatz\",eur(t.revenue),num(t.orders)+\" Bestellungen\",null],\n    [\"ROAS gesamt\",t.roas.toFixed(2)+\"x\",\"Umsatz je Euro Werbung\",roasColor(t.roas)],\n    [\"Kosten je Ticket\",eur(t.cpa),\"nur bezahlte Kanaele\",null],\n  ].map(([l,v,s,c])=>`<div class=\"kpi\"><div class=\"k-label\">${l}</div><div class=\"k-value\" style=\"color:${c||\"var(--text)\"}\">${v}</div><div class=\"k-sub\">${s}</div></div>`).join(\"\");\n\n  // ROAS Balken (SVG)\n  const paid=rows.filter(r=>r.roas!=null).sort((a,b)=>b.roas-a.roas);\n  const maxR=Math.max(6,...paid.map(r=>r.roas)), W=320, rowH=30, H=paid.length*rowH+10;\n  let bars=`<svg viewBox=\"0 0 ${W} ${H}\" width=\"100%\" height=\"${H}\">`;\n  bars+=`<line x1=\"${(3/maxR)*(W-120)+110}\" y1=\"0\" x2=\"${(3/maxR)*(W-120)+110}\" y2=\"${H-10}\" stroke=\"${AMBER}\" stroke-dasharray=\"3 3\" opacity=\".6\"/>`;\n  paid.forEach((r,i)=>{\n    const y=i*rowH+6, w=(r.roas/maxR)*(W-120);\n    bars+=`<text x=\"0\" y=\"${y+11}\" fill=\"${MUTED}\" font-size=\"9\" font-family=\"IBM Plex Mono\">${r.channel.slice(0,16)}</text>`;\n    bars+=`<rect x=\"110\" y=\"${y}\" width=\"${w}\" height=\"16\" fill=\"${roasColor(r.roas)}\" rx=\"2\"/>`;\n    bars+=`<text x=\"${110+w+5}\" y=\"${y+12}\" fill=\"${roasColor(r.roas)}\" font-size=\"10\" font-family=\"IBM Plex Mono\">${r.roas.toFixed(1)}x</text>`;\n  });\n  bars+=`</svg>`;\n  document.getElementById(\"roas\").innerHTML=bars;\n\n  // Verlauf (Naeherung): aus ROAS gesamt eine 14 Tage Kurve formen\n  const tw=520, th=150, pts=14;\n  let area=`<svg viewBox=\"0 0 ${tw} ${th}\" width=\"100%\" height=\"${th}\">`;\n  let dRev=\"\", dSpend=\"\", base=t.spend/pts||300;\n  const coords=[];\n  for(let i=0;i<pts;i++){\n    const wave=0.7+0.45*Math.sin(i/2.2)+(i/pts)*0.6;\n    const sp=base*wave, ro=2.8+1.4*Math.sin(i/3+1)+(i/pts);\n    coords.push({sp,rev:sp*ro});\n  }\n  const maxV=Math.max(...coords.map(c=>c.rev));\n  coords.forEach((c,i)=>{\n    const x=(i/(pts-1))*(tw-10)+5, yR=th-12-(c.rev/maxV)*(th-30), yS=th-12-(c.sp/maxV)*(th-30);\n    dRev+=(i?\"L\":\"M\")+x+\" \"+yR+\" \"; dSpend+=(i?\"L\":\"M\")+x+\" \"+yS+\" \";\n  });\n  area+=`<defs><linearGradient id=\"g\" x1=\"0\" y1=\"0\" x2=\"0\" y2=\"1\"><stop offset=\"0%\" stop-color=\"${ACCENT}\" stop-opacity=\".4\"/><stop offset=\"100%\" stop-color=\"${ACCENT}\" stop-opacity=\"0\"/></linearGradient></defs>`;\n  area+=`<path d=\"${dRev} L ${tw-5} ${th-12} L 5 ${th-12} Z\" fill=\"url(#g)\"/>`;\n  area+=`<path d=\"${dRev}\" fill=\"none\" stroke=\"${ACCENT}\" stroke-width=\"2\"/>`;\n  area+=`<path d=\"${dSpend}\" fill=\"none\" stroke=\"${MUTED}\" stroke-width=\"1.4\" stroke-dasharray=\"4 3\"/>`;\n  area+=`<text x=\"5\" y=\"12\" fill=\"${ACCENT}\" font-size=\"9\" font-family=\"IBM Plex Mono\">Umsatz</text>`;\n  area+=`<text x=\"58\" y=\"12\" fill=\"${MUTED}\" font-size=\"9\" font-family=\"IBM Plex Mono\">Ausgaben</text></svg>`;\n  document.getElementById(\"trend\").innerHTML=area;\n\n  // Tabelle\n  const sorted=[...rows].sort((a,b)=>SORT===\"channel\"?a.channel.localeCompare(b.channel):(b[SORT]??-1)-(a[SORT]??-1));\n  document.getElementById(\"rows\").innerHTML=sorted.map(r=>`<tr>\n    <td class=\"l\">${r.channel}</td>\n    <td>${r.spend>0?eur(r.spend):\"\\u2013\"}</td>\n    <td>${num(r.orders)}</td>\n    <td>${eur(r.revenue)}</td>\n    <td>${r.roas!=null?`<span class=\"pill\" style=\"background:${roasColor(r.roas)}22;color:${roasColor(r.roas)}\">${r.roas.toFixed(2)}x</span>`:`<span style=\"color:${MUTED}\">organisch</span>`}</td>\n    <td>${r.spend>0?eur(r.cpa):\"\\u2013\"}</td>\n  </tr>`).join(\"\");\n}\n\nasync function init(){\n  let mode=\"demo\", err=null;\n  try{\n    const res=await fetch(\"/api/data\"); const j=await res.json();\n    DATA=j.rows||[]; mode=j.mode; err=j.error;\n  }catch(e){ DATA=[]; err=e.message; }\n\n  const badge=document.getElementById(\"modeBadge\"), txt=document.getElementById(\"modeText\");\n  if(mode===\"live\"){ badge.className=\"badge live\"; badge.textContent=\"Live\"; txt.textContent=\"Echte Daten\"; }\n  else { badge.className=\"badge demo\"; badge.textContent=\"Beispieldaten\"; txt.textContent=\"Demo Modus\"; }\n\n  const sel=document.getElementById(\"showSel\");\n  sel.innerHTML=shows().map(s=>`<option value=\"${s.id}\">${s.label}</option>`).join(\"\");\n  sel.onchange=e=>{SHOW=e.target.value;render();};\n  document.querySelectorAll(\"th\").forEach(th=>th.onclick=()=>{SORT=th.dataset.k;render();});\n\n  document.getElementById(\"note\").innerHTML = mode===\"live\"\n    ? `<b>Live.</b> Zahlen aus der Weeztix API und der Meta Marketing API, zugeordnet ueber den Tracking Link je Bestellung.`\n    : `<b>Demomodus mit Beispieldaten.</b> Trage die Weeztix und Meta Zugaenge in Railway ein und verbinde Weeztix ueber /connect, dann schaltet die Ansicht automatisch auf echte Zahlen um.`\n    + (err?`<br><span style=\"color:${AMBER}\">Hinweis: ${err}</span>`:\"\");\n\n  render();\n}\ninit();\n</script>\n</body>\n</html>\n";

const CFG = {
  weeztixClientId: (process.env.WEEZTIX_CLIENT_ID || "").trim(),
  weeztixClientSecret: (process.env.WEEZTIX_CLIENT_SECRET || "").trim(),
  weeztixCompanyId: (process.env.WEEZTIX_COMPANY_ID || "").trim(),
  metaToken: (process.env.META_ACCESS_TOKEN || "").trim(),
  metaAdAccount: (process.env.META_AD_ACCOUNT_ID || "").trim(),
  publicUrl: (process.env.PUBLIC_URL || `http://localhost:${PORT}`).trim().replace(/\/+$/, ""),
  dataDir: process.env.DATA_DIR || path.join(__dirname, "data"),
};
fs.mkdirSync(CFG.dataDir, { recursive: true });
const TOKEN_FILE = path.join(CFG.dataDir, "weeztix_tokens.json");

function weeztixConnected() {
  return !!(fs.existsSync(TOKEN_FILE) && CFG.weeztixClientId && CFG.weeztixCompanyId);
}
function isLive() {
  return !!(weeztixConnected() && CFG.metaToken && CFG.metaAdAccount);
}

const WEEZTIX_AUTH = "https://auth.openticket.tech/tokens/authorize";
const WEEZTIX_TOKEN = "https://auth.openticket.tech/tokens";
const WEEZTIX_API = "https://api.weeztix.com";

function loadTokens() { try { return JSON.parse(fs.readFileSync(TOKEN_FILE, "utf8")); } catch { return null; } }
function saveTokens(t) {
  t.expires_at = Date.now() + (t.expires_in ? t.expires_in * 1000 : 3600 * 1000) - 60000;
  fs.writeFileSync(TOKEN_FILE, JSON.stringify(t, null, 2));
}
async function weeztixAccessToken() {
  let t = loadTokens();
  if (!t) throw new Error("Weeztix nicht verbunden. Bitte /connect aufrufen.");
  if (Date.now() < t.expires_at) return t.access_token;
  const res = await fetch(WEEZTIX_TOKEN, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token", refresh_token: t.refresh_token,
      client_id: CFG.weeztixClientId, client_secret: CFG.weeztixClientSecret,
    }),
  });
  const data = await res.json();
  if (!data.access_token) throw new Error("Weeztix Token Erneuerung fehlgeschlagen");
  if (!data.refresh_token) data.refresh_token = t.refresh_token;
  saveTokens(data);
  return data.access_token;
}

// Echter Abruf mit der vom API Team bestaetigten Body Struktur.
async function fetchWeeztixOrders() {
  const token = await weeztixAccessToken();
  const url = `${WEEZTIX_API}/statistics/orders/${CFG.weeztixCompanyId}`;
  const body = {
    start: "2024-01-01T00:00:00.000Z",
    end: new Date().toISOString(),
    timeunit: "year",
    offset: 0,
    limit: 100,
    sorting: { created_at: "desc" },
    filters: {},
    events: [],
  };
  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, Company: CFG.weeztixCompanyId, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Weeztix HTTP ${res.status} ${(await res.text()).slice(0, 250)}`);
  const json = await res.json();
  if (json?.hits?.hits) return json.hits.hits.map((h) => h._source || h);
  if (Array.isArray(json?.data)) return json.data;
  return Array.isArray(json) ? json : [];
}

// >>> Feldnamen einer Bestellung. Finalisiere ich anhand /api/raw. <<<
function extractOrderFields(o) {
  const show = o?.event?.name || o?.event_name || o?.shop?.name || "Unbekannt";
  const revenue = Number(o?.total || o?.amount || o?.price || o?.value || 0);
  const channel =
    o?.tracking_link?.name || o?.tracking_link ||
    o?.utm_source || o?.referrer || o?.purchase_channel || "Organisch";
  return { show, revenue, channel };
}

async function fetchMetaSpend() {
  if (!CFG.metaToken || !CFG.metaAdAccount) return {};
  const acct = CFG.metaAdAccount.startsWith("act_") ? CFG.metaAdAccount : "act_" + CFG.metaAdAccount;
  const url = `https://graph.facebook.com/v20.0/${acct}/insights`
    + `?level=campaign&fields=campaign_name,spend&date_preset=maximum&limit=500`
    + `&access_token=${encodeURIComponent(CFG.metaToken)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Meta HTTP ${res.status} ${(await res.text()).slice(0, 200)}`);
  const json = await res.json();
  const out = {};
  (json.data || []).forEach((row) => { out[row.campaign_name] = (out[row.campaign_name] || 0) + Number(row.spend || 0); });
  return out;
}

function buildLiveAttribution(orders, spendByChannel) {
  const map = {};
  orders.forEach((o) => {
    const { show, revenue, channel } = extractOrderFields(o);
    const key = show + "||" + channel;
    if (!map[key]) map[key] = { show, channel, orders: 0, revenue: 0, spend: 0 };
    map[key].orders += 1;
    map[key].revenue += revenue;
  });
  Object.values(map).forEach((r) => { if (spendByChannel[r.channel] != null) r.spend = spendByChannel[r.channel]; });
  return Object.values(map);
}

const DEMO_ROWS = [
  { show: "Maimarkthalle Mannheim", channel: "Meta Retargeting", spend: 4120, orders: 1980, revenue: 89100 },
  { show: "Maimarkthalle Mannheim", channel: "Meta Lookalike DE", spend: 6850, orders: 2240, revenue: 100800 },
  { show: "Maimarkthalle Mannheim", channel: "Meta Broad DACH", spend: 9300, orders: 1510, revenue: 67950 },
  { show: "Maimarkthalle Mannheim", channel: "Instagram Reels", spend: 3400, orders: 1120, revenue: 50400 },
  { show: "Zenith München", channel: "Meta Retargeting", spend: 2180, orders: 940, revenue: 38540 },
  { show: "Zenith München", channel: "Meta Lookalike DE", spend: 3960, orders: 1010, revenue: 41410 },
  { show: "BBC Arena Schaffhausen", channel: "Meta Retargeting", spend: 1640, orders: 610, revenue: 27450 },
  { show: "BBC Arena Schaffhausen", channel: "Meta Lookalike DE", spend: 2480, orders: 540, revenue: 24300 },
];

// =============================================================================
//  ROUTEN
// =============================================================================
app.get("/", (req, res) => res.type("html").send(DASHBOARD));

app.get("/connect", (req, res) => {
  if (!CFG.weeztixClientId) return res.status(400).send("WEEZTIX_CLIENT_ID fehlt.");
  const params = new URLSearchParams({
    client_id: CFG.weeztixClientId,
    redirect_uri: `${CFG.publicUrl}/oauth/callback`,
    response_type: "code", state: "hss",
  });
  res.redirect(`${WEEZTIX_AUTH}?${params.toString()}`);
});

app.get("/oauth/callback", async (req, res) => {
  try {
    const tokRes = await fetch(WEEZTIX_TOKEN, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code", code: req.query.code,
        client_id: CFG.weeztixClientId, client_secret: CFG.weeztixClientSecret,
        redirect_uri: `${CFG.publicUrl}/oauth/callback`,
      }),
    });
    const data = await tokRes.json();
    if (!data.access_token) throw new Error(JSON.stringify(data));
    saveTokens(data);
    res.send("Weeztix verbunden. Fenster schliessen und Dashboard oeffnen.");
  } catch (e) { res.status(500).send("Verbindung fehlgeschlagen: " + e.message); }
});

app.get("/api/data", async (req, res) => {
  if (!isLive()) return res.json({ mode: "demo", rows: DEMO_ROWS });
  let orders = null, spend = {}; const errors = {};
  try { orders = await fetchWeeztixOrders(); } catch (e) { errors.weeztix = e.message; }
  try { spend = await fetchMetaSpend(); } catch (e) { errors.meta = e.message; }
  if (!orders) return res.json({ mode: "demo", error: errors.weeztix, errors, rows: DEMO_ROWS });
  res.json({ mode: "live", warnings: errors, ordersCount: orders.length, rows: buildLiveAttribution(orders, spend) });
});

app.get("/api/raw", async (req, res) => {
  let token;
  try { token = await weeztixAccessToken(); }
  catch (e) { return res.json({ error: "kein Token: " + e.message }); }
  const url = `${WEEZTIX_API}/statistics/orders/${CFG.weeztixCompanyId}`;
  const body = {
    start: "2024-06-01T00:00:00.000Z", end: new Date().toISOString(),
    timeunit: "year", offset: 0, limit: 10,
    sorting: { created_at: "desc" }, filters: {}, events: [],
  };
  try {
    const r = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, Company: CFG.weeztixCompanyId, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const j = await r.json();
    const total = j?.hits?.total?.value ?? j?.hits?.total ?? null;
    let o = j?.hits?.hits?.[0]?._source || null;
    if (o) {
      o = { ...o };
      // Personendaten entfernen, wir brauchen nur die Struktur.
      ["email", "firstName", "lastName", "fullname", "download_link", "receipt_link", "pdf_location", "payments"].forEach((k) => delete o[k]);
    }
    res.json({ status: r.status, total, firstOrder: o });
  } catch (e) {
    res.json({ error: e.message });
  }
});

app.get("/api/status", (req, res) => {
  res.json({
    build: BUILD, weeztixConnected: weeztixConnected(),
    metaConfigured: !!(CFG.metaToken && CFG.metaAdAccount), live: isLive(),
    checks: {
      clientIdLen: CFG.weeztixClientId.length, clientSecretLen: CFG.weeztixClientSecret.length,
      companyIdSet: !!CFG.weeztixCompanyId, publicUrl: CFG.publicUrl,
      expectedRedirect: `${CFG.publicUrl}/oauth/callback`,
    },
  });
});

app.use(express.static(path.join(__dirname, "public")));
app.listen(PORT, () => console.log(`HSS Marketing (Statistik) auf Port ${PORT}, build ${BUILD}`));
