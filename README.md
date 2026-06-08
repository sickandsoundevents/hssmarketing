[README.md](https://github.com/user-attachments/files/28723502/README.md)
# HSS Marketing Attribution

Ein Dashboard, das eure Weeztix Bestellungen mit den Meta Werbeausgaben verbindet
und daraus ROAS, Kosten je Ticket und Auslastung je Show berechnet.

Die App laeuft sofort im Demomodus mit Beispieldaten. Sobald du die Zugaenge
einträgst, schaltet sie automatisch auf echte Zahlen um. Du musst also nichts
programmieren, nur deployen und Schlüssel eintragen.

---

## Teil 1: In drei Minuten online stellen (Demomodus)

1. Lege dir ein kostenloses Konto auf railway.app an.
2. Lade diesen Ordner auf GitHub hoch (neues Repository, Dateien per Drag and
   Drop in den Browser ziehen, dann "Commit"). Wenn du kein GitHub Konto hast,
   lege auch das kurz an, es ist gratis.
3. In Railway: "New Project" -> "Deploy from GitHub repo" -> dieses Repository
   auswählen. Railway erkennt die Node App selbst und startet sie.
4. Unter "Settings" -> "Networking" -> "Generate Domain" bekommst du eine URL.
   Öffne sie. Du siehst das Dashboard mit Beispieldaten und dem Hinweis "Demo".

Damit läuft die App. Ab hier geht es nur noch darum, echte Daten anzuschließen.

---

## Teil 2: Die Zugangsdaten beschaffen

Alle Werte trägst du in Railway unter "Variables" ein. Die Vorlage steht in
der Datei .env.example.

### Weeztix
1. Im Weeztix Dashboard den Entwickler oder API Bereich öffnen und einen neuen
   OAuth Client anlegen. Falls du den Bereich nicht findest, schreib eine kurze
   Mail an apiteam@weeztix.com, die schalten das frei.
2. Als Redirect URL trägst du dort DEINE_RAILWAY_URL/oauth/callback ein.
3. Du bekommst eine Client ID und ein Client Secret. Beide nach Railway:
   WEEZTIX_CLIENT_ID und WEEZTIX_CLIENT_SECRET.
4. Die Company ID ist die Kennung eurer Firma in Weeztix (in der URL des
   Dashboards sichtbar oder beim API Team erfragen): WEEZTIX_COMPANY_ID.

### Meta (Werbeausgaben)
1. Auf developers.facebook.com eine App vom Typ "Business" anlegen und das
   Produkt "Marketing API" hinzufügen.
2. Ein Access Token mit der Berechtigung ads_read erzeugen: META_ACCESS_TOKEN.
3. Die Werbekonto Kennung kopieren (Format act_1234567890): META_AD_ACCOUNT_ID.

### Verbindung herstellen
1. Trage in Railway zusätzlich PUBLIC_URL mit deiner Railway Domain ein
   (z.B. https://hss-marketing.up.railway.app).
2. Lege in Railway ein Volume an und hänge es unter /data ein. Das sorgt dafür,
   dass die Weeztix Verbindung einen Neustart übersteht.
3. Öffne einmalig DEINE_RAILWAY_URL/connect im Browser und bestätige den Zugriff.
   Danach zeigt das Dashboard das Abzeichen "Live" und die echten Zahlen.

---

## Was du eventuell anpassen musst

Zwei Stellen im Code hängen davon ab, wie eure Daten benannt sind. Beide sind
in server.js klar markiert und in zwei Minuten geändert:

- extractOrderFields: liest aus einer Bestellung den Show Namen, den Umsatz und
  den Kanal aus dem Tracking Link. Wenn die echte Weeztix Antwort die Felder
  anders nennt, passt du hier die Feldnamen an.
- fetchMetaSpend: ordnet jede Meta Kampagne einem Kanal zu. Wenn eure Kampagnen
  z.B. "MNH_Retargeting" heißen, kannst du hier eine Übersetzung ergänzen, damit
  Ausgaben und Bestellungen zum selben Kanal zusammenfinden.

Wenn du mir je ein Beispiel einer echten Weeztix Order Antwort und eure
Kampagnen Namenslogik gibst, baue ich dir diese beiden Stellen passgenau ein.

---

## Was die App NICHT tut

Sie verändert nichts in Weeztix oder Meta, sie liest nur. Sie speichert keine
Zahlungsdaten. Die einzigen gespeicherten Daten sind die Weeztix Tokens in der
Datei unter /data, damit die Verbindung bestehen bleibt.
