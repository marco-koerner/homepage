# homepage

Onepager unter marcokoerner.com, ausgeliefert über GitHub Pages.

- `index.html`: die Seite.
- `phrasenmaeher/`: Browserfassung des Phrasenmähers (`index.html`, `phrasenmaeher.js`). Die Merkmalsliste `merkmale.js` wird nicht von Hand gepflegt: Die Action „Merkmale aktualisieren“ holt täglich `merkmale.md` aus `marco-koerner/phrasenmaeher` und erzeugt sie neu (`.github/scripts/merkmale.py`); von Hand anstoßen über „Run workflow“.
