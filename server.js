// =============================================================================
// HSS Marketing Attribution  -  Server
// -----------------------------------------------------------------------------
// Laeuft in zwei Modi:
//   DEMO  -> keine Schluessel gesetzt, zeigt Beispieldaten (sofort lauffaehig)
//   LIVE  -> Weeztix + Meta Schluessel gesetzt, zieht echte Zahlen
// Der Wechsel passiert automatisch, sobald die Umgebungsvariablen da sind.
// =============================================================================

import express from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;
const BUILD = "3"; // erhoehen bei jeder Aenderung, sichtbar unter /api/status

// --- Konfiguration aus Umgebungsvariablen (in Railway eintragen) -------------
const CFG = {
  weeztixClientId: (process.env.WEEZTIX_CLIENT_ID || "").trim(),
  weeztixClientSecret: (process.env.WEEZTIX_CLIENT_SECRET || "").trim(),
  weeztixCompanyId: (process.env.WEEZTIX_COMPANY_ID || "").trim(),
  metaToken: (process.env.META_ACCESS_TOKEN || "").trim(),
  metaAdAccount: (process.env.META_AD_ACCOUNT_ID || "").trim(), // Format: act_1234567890
  publicUrl: (process.env.PUBLIC_URL || `http://localhost:${PORT}`).trim().replace(/\/+$/, ""),
  dataDir: process.env.DATA_DIR || path.join(__dirname, "data"),
};
const TOKEN_FILE = path.join(CFG.dataDir, "weeztix_tokens.json");
fs.mkdirSync(CFG.dataDir, { recursive: true });

// LIVE nur, wenn Weeztix konfiguriert UND einmalig verbunden wurde.
function weeztixConnected() {
  return fs.existsSync(TOKEN_FILE) && CFG.weeztixClientId && CFG.weeztixCompanyId;
}
function isLive() {
  return weeztixConnected() && CFG.metaToken && CFG.metaAdAccount;
}

// =============================================================================
//  WEEZTIX  (OAuth Authorization Code Flow, siehe docs.weeztix.com)
// =============================================================================
const WEEZTIX_AUTH = "https://auth.openticket.tech/tokens/authorize";
const WEEZTIX_TOKEN = "https://auth.openticket.tech/tokens";
const WEEZTIX_API = "https://api.weeztix.com";

function loadTokens() {
  try { return JSON.parse(fs.readFileSync(TOKEN_FILE, "utf8")); } catch { return null; }
}
function saveTokens(t) {
  t.expires_at = Date.now() + (t.expires_in ? t.expires_in * 1000 : 3600 * 1000) - 60000;
  fs.writeFileSync(TOKEN_FILE, JSON.stringify(t, null, 2));
}

async function weeztixAccessToken() {
  let t = loadTokens();
  if (!t) throw new Error("Weeztix nicht verbunden. Bitte /connect aufrufen.");
  if (Date.now() < t.expires_at) return t.access_token;
  // Token abgelaufen -> erneuern
  const res = await fetch(WEEZTIX_TOKEN, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: t.refresh_token,
      client_id: CFG.weeztixClientId,
      client_secret: CFG.weeztixClientSecret,
    }),
  });
  const data = await res.json();
  if (!data.access_token) throw new Error("Weeztix Token Erneuerung fehlgeschlagen");
  if (!data.refresh_token) data.refresh_token = t.refresh_token;
  saveTokens(data);
  return data.access_token;
}

// Holt die Bestellungen der Company. Endpunktpfad bitte einmal gegen die
// Live Antwort pruefen (docs.weeztix.com -> Dashboard -> Company Orders).
async function fetchWeeztixOrders() {
  const token = await weeztixAccessToken();
  const url = `${WEEZTIX_API}/company/${CFG.weeztixCompanyId}/orders`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`Weeztix Orders HTTP ${res.status}`);
  const json = await res.json();
  return Array.isArray(json) ? json : json.data || json.hits || [];
}

// >>> EINZIGE STELLE, die du ggf. an die echte Order Struktur anpasst. <<<
// Liest aus einer Bestellung: Show Name, Umsatz, Kanal (aus Tracking Link / UTM).
function extractOrderFields(order) {
  const show = order?.event?.name || order?.event_name || "Unbekannt";
  const revenue = Number(order?.total || order?.amount || 0);
  // Tracking Link / UTM Quelle. Weeztix haengt die Marketing Quelle an die Order.
  const channel =
    order?.tracking_link?.name ||
    order?.utm_source ||
    order?.referrer ||
    "Organisch";
  return { show, revenue, channel };
}

// =============================================================================
//  META  (Marketing API, Werbeausgaben je Kampagne)
// =============================================================================
async function fetchMetaSpend() {
  const fields = "campaign_name,spend";
  const url = `https://graph.facebook.com/v20.0/${CFG.metaAdAccount}/insights`
    + `?level=campaign&fields=${fields}&date_preset=maximum&limit=500`
    + `&access_token=${encodeURIComponent(CFG.metaToken)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Meta Insights HTTP ${res.status}`);
  const json = await res.json();
  const out = {};
  (json.data || []).forEach((row) => {
    // Kampagnenname -> Kanal. Passe das Mapping an deine Namenskonvention an,
    // z.B. wenn die Kampagne "MNH_Retargeting" heisst.
    const channel = row.campaign_name;
    out[channel] = (out[channel] || 0) + Number(row.spend || 0);
  });
  return out;
}

// =============================================================================
//  ATTRIBUTION  (Orders + Ausgaben zusammenfuehren)
// =============================================================================
function buildLiveAttribution(orders, spendByChannel) {
  const map = {}; // key: show||channel
  orders.forEach((o) => {
    const { show, revenue, channel } = extractOrderFields(o);
    const key = show + "||" + channel;
    if (!map[key]) map[key] = { show, channel, orders: 0, revenue: 0, spend: 0 };
    map[key].orders += 1;
    map[key].revenue += revenue;
  });
  Object.values(map).forEach((r) => {
    if (spendByChannel[r.channel] != null) r.spend = spendByChannel[r.channel];
  });
  return Object.values(map);
}

// =============================================================================
//  DEMO DATEN  (identisch zur Vorschau, damit der erste Eindruck stimmt)
// =============================================================================
const DEMO_ROWS = [
  { show: "Maimarkthalle Mannheim", channel: "Meta Retargeting", spend: 4120, orders: 1980, revenue: 89100 },
  { show: "Maimarkthalle Mannheim", channel: "Meta Lookalike DE", spend: 6850, orders: 2240, revenue: 100800 },
  { show: "Maimarkthalle Mannheim", channel: "Meta Broad DACH", spend: 9300, orders: 1510, revenue: 67950 },
  { show: "Maimarkthalle Mannheim", channel: "Instagram Reels", spend: 3400, orders: 1120, revenue: 50400 },
  { show: "Maimarkthalle Mannheim", channel: "Newsletter", spend: 0, orders: 640, revenue: 28800 },
  { show: "Zenith München", channel: "Meta Retargeting", spend: 2180, orders: 940, revenue: 38540 },
  { show: "Zenith München", channel: "Meta Lookalike DE", spend: 3960, orders: 1010, revenue: 41410 },
  { show: "Zenith München", channel: "Meta Broad DACH", spend: 5200, orders: 720, revenue: 29520 },
  { show: "Zenith München", channel: "Instagram Reels", spend: 1900, orders: 560, revenue: 22960 },
  { show: "Zenith München", channel: "Newsletter", spend: 0, orders: 310, revenue: 12710 },
  { show: "BBC Arena Schaffhausen", channel: "Meta Retargeting", spend: 1640, orders: 610, revenue: 27450 },
  { show: "BBC Arena Schaffhausen", channel: "Meta Lookalike DE", spend: 2480, orders: 540, revenue: 24300 },
  { show: "BBC Arena Schaffhausen", channel: "Meta Broad DACH", spend: 4100, orders: 380, revenue: 17100 },
  { show: "BBC Arena Schaffhausen", channel: "Instagram Reels", spend: 1250, orders: 290, revenue: 13050 },
  { show: "BBC Arena Schaffhausen", channel: "Newsletter", spend: 0, orders: 180, revenue: 8100 },
];

// =============================================================================
//  ROUTEN
// =============================================================================

// Einmaliger Verbindungsstart mit Weeztix
app.get("/connect", (req, res) => {
  if (!CFG.weeztixClientId) return res.status(400).send("WEEZTIX_CLIENT_ID fehlt in den Variablen.");
  const params = new URLSearchParams({
    client_id: CFG.weeztixClientId,
    redirect_uri: `${CFG.publicUrl}/oauth/callback`,
    response_type: "code",
    state: "hss",
  });
  res.redirect(`${WEEZTIX_AUTH}?${params.toString()}`);
});

app.get("/oauth/callback", async (req, res) => {
  try {
    const code = req.query.code;
    const tokRes = await fetch(WEEZTIX_TOKEN, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        client_id: CFG.weeztixClientId,
        client_secret: CFG.weeztixClientSecret,
        redirect_uri: `${CFG.publicUrl}/oauth/callback`,
      }),
    });
    const data = await tokRes.json();
    if (!data.access_token) throw new Error(JSON.stringify(data));
    saveTokens(data);
    res.send("Weeztix verbunden. Du kannst dieses Fenster schliessen und das Dashboard oeffnen.");
  } catch (e) {
    res.status(500).send("Verbindung fehlgeschlagen: " + e.message);
  }
});

// Datenendpunkt fuer das Dashboard
app.get("/api/data", async (req, res) => {
  try {
    if (isLive()) {
      const [orders, spend] = await Promise.all([fetchWeeztixOrders(), fetchMetaSpend()]);
      return res.json({ mode: "live", rows: buildLiveAttribution(orders, spend) });
    }
    return res.json({ mode: "demo", rows: DEMO_ROWS });
  } catch (e) {
    // Bei Live Fehler nicht abstuerzen, sondern Demo zeigen und Hinweis geben.
    res.json({ mode: "demo", error: e.message, rows: DEMO_ROWS });
  }
});

app.get("/api/status", (req, res) => {
  res.json({
    build: BUILD,
    tokenRequestFormat: "form-urlencoded",
    weeztixConnected: weeztixConnected(),
    metaConfigured: !!(CFG.metaToken && CFG.metaAdAccount),
    live: isLive(),
    // Diagnose: nur ob gesetzt und wie lang, niemals der echte Wert.
    checks: {
      clientIdSet: !!CFG.weeztixClientId,
      clientIdLen: CFG.weeztixClientId.length,
      clientSecretSet: !!CFG.weeztixClientSecret,
      clientSecretLen: CFG.weeztixClientSecret.length,
      companyIdSet: !!CFG.weeztixCompanyId,
      publicUrl: CFG.publicUrl,
      expectedRedirect: `${CFG.publicUrl}/oauth/callback`,
    },
  });
});

app.use(express.static(path.join(__dirname, "public")));

app.listen(PORT, () => {
  console.log(`HSS Marketing Attribution laeuft auf Port ${PORT} (${isLive() ? "LIVE" : "DEMO"})`);
});
