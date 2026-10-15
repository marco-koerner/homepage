# Arbeitsregeln für Claude in diesem Repo

Onepager unter marcokoerner.com (GitHub Pages, öffentlich). Lies zuerst `README.md`.

## Ablauf

- Änderungen auf eigenem Branch als Pull Request; Marcos Merge ist die Freigabe.
- `phrasenmaeher/merkmale.js` nie von Hand ändern; die Action „Merkmale aktualisieren“ erzeugt sie aus `merkmale.md` im Repo `marco-koerner/phrasenmaeher`.
- Die Seite setzt keine Cookies und lädt nichts von fremden Servern. Keine externen Skripte, Schriften oder Zähler einbauen; die Fußzeile sagt das zu, und es muss stimmen.

## Seitentexte

Jeder Text, der auf der Seite erscheint (auch Meta-Description, Kopfzeile, Hinweise, Fußzeile), geht vor dem Pull Request durch den Phrasenmäher in zwei Schritten, so wie es die Regel „Phrasenmäher“ in `marco-koerner/redaktion` für Posts vorsieht:

1. **Zähler:** Text als Datei ablegen und `python3 <phrasenmaeher>/skills/phrasenmaeher/scripts/phrasenmaeher.py DATEI --merkmale <phrasenmaeher>/merkmale.md` ausführen. Fundstellen beheben, die nicht sachlich nötig sind (zitierte Beispielwörter bleiben), erneut prüfen, höchstens zwei Runden.
2. **Leser:** Mit dem Agent-Werkzeug (Typ general-purpose) einen eigenen Agenten starten, dessen Prompt nur aus dem Abschnitt unter dem Trennstrich in `<phrasenmaeher>/skills/phrasenmaeher/leser.md` und dem Text besteht; keine Vorgeschichte, kein Hinweis auf Zweck oder Verfasser. Sätze mit „fällt durch“ streichen oder belegen, nie einen Beleg erfinden; was sich nicht belegen lässt, wird zur Frage an Marco im Pull Request. Danach noch einmal der Zähler, nicht noch einmal der Leser.

Im Pull Request je Text: verbliebene Zählerfunde mit Grund, die durchgefallenen Sätze des Lesers und was daraus wurde. Fehlt das Phrasenmäher-Repo in der Sitzung, die fünf Fragen von der Seite `phrasenmaeher/index.html` als Auftrag an den Leser verwenden und das im Pull Request vermerken.

Grund: Am 15.10.2026 kam der erste Text der Phrasenmäher-Seite ohne Fundstelle durch den Zähler und war trotzdem glatt, weil das schreibende Modell die Liste kannte. Ein Text wird nicht von dem geprüft, der ihn geschrieben hat.

## Form

- Deutsch. Deutsche Anführungszeichen „ “, nie gerade Anführungszeichen im Fließtext (in HTML-Attributen und Skripten sind sie Code).
- Bei Beteiligten Rolle und Namen nennen.
- Nichts, worin Marcos Arbeitgeber Kritik oder ein Wechselsignal lesen könnte; keine Bezüge zu anderen Identitäten oder Projekten als dem Klarnamen.
