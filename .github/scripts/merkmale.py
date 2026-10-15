#!/usr/bin/env python3
"""Erzeugt phrasenmaeher/merkmale.js aus merkmale.md des Repos marco-koerner/phrasenmaeher.

  python3 .github/scripts/merkmale.py merkmale.md

Gleiche Leselogik wie das Skript im Phrasenmäher-Repo: Abschnitte „Floskeln“ und
„Wendungen“ wörtlich, „Muster“ als Regex in Backticks. Nur Standardbibliothek.
"""
import json
import re
import sys
from datetime import date
from pathlib import Path


def lies(pfad):
    m = {"Floskeln": [], "Wendungen": [], "Muster": []}
    stand = ""
    teil = None
    for zeile in open(pfad, encoding="utf-8"):
        if not stand:
            t = re.match(r"Stand:\s*(\d{1,2}\.\d{1,2}\.\d{4}|[^.,\n]+)", zeile)
            if t:
                stand = t.group(1).strip()
        if zeile.startswith("## "):
            name = zeile[3:].strip()
            teil = name if name in m else None
            continue
        if teil is None or not zeile.startswith("- "):
            continue
        e = zeile[2:].strip()
        if teil == "Muster":
            t = re.match(r"`(.+?)`\s*(?:–\s*(.*))?$", e)
            if t:
                m["Muster"].append([t.group(1), (t.group(2) or "Muster").strip()])
        else:
            w = re.split(r"\s+–\s+", e)[0].strip()
            if w:
                m[teil].append(w)
    return m, stand


def main():
    quelle = sys.argv[1]
    m, stand = lies(quelle)
    ziel = Path(__file__).resolve().parent.parent.parent / "phrasenmaeher" / "merkmale.js"
    inhalt = ("// Automatisch erzeugt aus merkmale.md (marco-koerner/phrasenmaeher), nicht von Hand ändern.\n"
              f"window.MERKMALE = {json.dumps(m, ensure_ascii=False, indent=1)};\n"
              f"window.MERKMALE_STAND = {json.dumps(stand or date.today().isoformat(), ensure_ascii=False)};\n")
    alt = ziel.read_text(encoding="utf-8") if ziel.exists() else ""
    if inhalt != alt:
        ziel.write_text(inhalt, encoding="utf-8")
        print(f"geschrieben: {len(m['Floskeln'])} Floskeln, {len(m['Wendungen'])} Wendungen, {len(m['Muster'])} Muster")
    else:
        print("unverändert")


if __name__ == "__main__":
    main()
