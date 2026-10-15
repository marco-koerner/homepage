/* Phrasenmäher, Browserfassung.
   Zählt Merkmale, die einen Text glatt wirken lassen. Der Text verlässt den Browser nicht.
   Quelle der Merkmale: merkmale.js, erzeugt aus merkmale.md im Repo marco-koerner/phrasenmaeher.
   Kein Urteil über die Herkunft; jedes Merkmal kommt auch in menschlichen Texten vor. */

(function () {
  "use strict";

  const L = "\\p{L}\\p{N}_";
  const WORTGRENZE = `(?:(?<![${L}])(?=[${L}])|(?<=[${L}])(?![${L}]))`;

  function regexAusPython(quelle) {
    // Python-Schreibweisen in JavaScript übersetzen: \U0001F300 → \u{1F300}, \b → Unicode-Wortgrenze
    return quelle
      .replace(/\\U([0-9A-Fa-f]{8})/g, (_, h) => `\\u{${h.replace(/^0+/, "")}}`)
      .replace(/\\b/g, WORTGRENZE);
  }

  function escapeRegex(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  function saetze(text) {
    const roh = text.replace(/\s+/g, " ").trim().split(/(?<=[.!?])\s+(?=[A-ZÄÖÜ„»(\d])/);
    return roh.filter((s) => s.split(/\s+/).length >= 2);
  }

  function silben(wort) {
    const w = wort.toLowerCase().replace(/[^a-zäöüß]/g, "");
    if (!w) return 0;
    const g = w.match(/[aeiouäöüy]+/g);
    return Math.max(g ? g.length : 0, 1);
  }

  function mittel(xs) {
    return xs.reduce((a, b) => a + b, 0) / xs.length;
  }

  function streuung(xs) {
    const m = mittel(xs);
    return Math.sqrt(mittel(xs.map((x) => (x - m) * (x - m))));
  }

  const LISTE = /^\s*(?:[-•*–]|\d+[.)])\s/;
  const LABEL = /^(?:Stand|Quelle|Hinweis|Beispiel|Foto|Autor|Autorin|Kontakt|Datum|Titel|Tel|Telefon|E-Mail|Mail|Web|Adresse|Betreff|Thema|Name)(?![\p{L}])/u;
  const STRICH = /(?<=\S)[ \t][–—][ \t]|—/g;
  const UEBERGANG = new Set(["doch", "dabei", "gleichzeitig", "dennoch", "zugleich", "allerdings"]);

  /** Analysiert den Text. Liefert { funde, kennzahlen, dichte, stufe }.
   *  funde: { zeile (1-basiert, 0 = ganzer Text), kategorie, fund, start, ende, kontext } */
  function analysiere(text, merkmale) {
    const zeilen = text.split("\n");
    const woerter = text.split(/\s+/).filter(Boolean);
    const nW = Math.max(woerter.length, 1);
    const funde = [];
    const fund = (zeile, kategorie, was, start, ende, kontext) =>
      funde.push({ zeile, kategorie, fund: was, start, ende, kontext: (kontext || "").trim() });

    // Wortsuche
    for (const [kat, name] of [["Floskeln", "Floskel"], ["Wendungen", "Wendung"]]) {
      for (const eintrag of merkmale[kat] || []) {
        const re = new RegExp(`(?<![${L}])${escapeRegex(eintrag)}(?![${L}])`, "giu");
        zeilen.forEach((z, i) => {
          for (const m of z.matchAll(re)) fund(i + 1, name, eintrag, m.index, m.index + m[0].length, z);
        });
      }
    }
    for (const [quelle, erkl] of merkmale.Muster || []) {
      let re;
      try { re = new RegExp(regexAusPython(quelle), "iu"); } catch (e) { continue; }
      zeilen.forEach((z, i) => {
        const m = re.exec(z);
        if (m) fund(i + 1, "Muster", erkl, m.index, m.index + Math.max(m[0].length, 1), z);
      });
    }

    // Vorsatz mit Doppelpunkt
    zeilen.forEach((z, i) => {
      const t = z.trim();
      const m = t.match(/^((?:\S+\s){0,3}\S+):(\s*$|\s+\S)/);
      if (!m || LISTE.test(t) || t.startsWith("#")) return;
      const folgende = zeilen.slice(i + 1).find((x) => x.trim()) || "";
      if (m[2].trim() === "" && (LISTE.test(folgende) || !folgende)) return;
      if (LABEL.test(m[1])) return;
      const start = z.indexOf(m[1]);
      fund(i + 1, "Muster", "Vorsatz mit Doppelpunkt (streichbar?)", start, start + m[1].length + 1, z);
    });

    // Typografie
    zeilen.forEach((z, i) => {
      for (const m of z.matchAll(/'/g)) fund(i + 1, "Typografie", "gerader Apostroph (')", m.index, m.index + 1, z);
      for (const m of z.matchAll(/"/g)) fund(i + 1, "Typografie", "gerade Anführungszeichen (\")", m.index, m.index + 1, z);
      for (const m of z.matchAll(/”|(?:^|(?<=[\s(]))“(?=[\p{L}])/gu)) fund(i + 1, "Typografie", "englische Anführungszeichen (“ ”)", m.index, m.index + 1, z);
    });
    const striche = (text.match(STRICH) || []).length;
    const stricheJe1000 = (striche * 1000) / nW;
    zeilen.forEach((z, i) => {
      const treffer = [...z.matchAll(STRICH)];
      if (stricheJe1000 >= 5) {
        for (const m of treffer) fund(i + 1, "Typografie", "Gedankenstrich (gehäuft, siehe Kennzahlen)", m.index, m.index + m[0].length, z);
      }
      if (treffer.length >= 2 && z.split(/\s+/).length < 45) {
        fund(i + 1, "Typografie", "zwei Gedankenstriche im selben Satz", treffer[0].index, treffer[1].index + treffer[1][0].length, z);
      }
    });

    // Absatzbau
    const absaetze = text.split(/\n\s*\n/).map((a) => a.trim()).filter(Boolean);
    const einSatz = absaetze.filter((a) => saetze(a).length <= 1 && a.split(/\s+/).length <= 25 && !/^(?:[-•*–]|\d+[.)]|#)/.test(a));
    if (absaetze.length >= 5 && einSatz.length / absaetze.length >= 0.6) {
      fund(0, "Absatzbau", `Einsatz-Absätze: ${einSatz.length} von ${absaetze.length}`, 0, 0, "");
    }
    if (absaetze.length >= 4 && absaetze[0].split(/\s+/).length <= 10 && /[.!?]$/.test(absaetze[0]) && !absaetze[0].startsWith("#")) {
      fund(1, "Absatzbau", "Hook-Zeile (kurze erste Zeile, dann Leerzeile)", 0, zeilen[0].length, absaetze[0]);
    }
    const letzter = absaetze[absaetze.length - 1] || "";
    if (/\?$/.test(letzter) && absaetze.length >= 3) {
      fund(zeilen.length, "Absatzbau", "Schlussfrage an die Leserschaft", 0, zeilen[zeilen.length - 1].length, letzter);
    }

    // Rhythmus
    const alle = saetze(text);
    const laengen = alle.map((s) => s.split(/\s+/).length);
    for (let k = 0; k + 2 < alle.length; k++) {
      if (laengen.slice(k, k + 3).every((l) => l <= 7)) {
        fund(0, "Rhythmus", "Dreier-Stakkato (drei kurze Sätze)", 0, 0, alle.slice(k, k + 3).join(" "));
        break;
      }
    }
    const anfaenge = alle.map((s) => s.split(/\s+/)[0].toLowerCase().replace(/^[„»(]+/, ""));
    for (let k = 0; k + 2 < alle.length; k++) {
      const e = anfaenge.slice(k, k + 3);
      if (new Set(e).size === 1 && !["die", "der", "das", "es", "ich"].includes(e[0])) {
        fund(0, "Rhythmus", `Anapher („${alle[k].split(/\s+/)[0]} …“ dreimal)`, 0, 0, alle.slice(k, k + 3).join(" "));
        break;
      }
    }
    for (let k = 0; k + 4 < anfaenge.length; k++) {
      if (anfaenge.slice(k, k + 5).filter((w) => UEBERGANG.has(w)).length >= 3) {
        fund(0, "Rhythmus", "Übergangswörter in Serie (Doch, Dabei, Gleichzeitig …)", 0, 0, alle.slice(k, k + 5).join(" "));
        break;
      }
    }
    const cv = laengen.length >= 8 ? streuung(laengen) / mittel(laengen) : null;
    if (cv !== null && cv < 0.35) {
      fund(0, "Rhythmus", `gleichmäßige Satzlängen (Streuung/Mittel = ${cv.toFixed(2)})`, 0, 0, "");
    }

    // Kennzahlen
    const wortlich = woerter.filter((w) => /[A-Za-zÄÖÜäöüß]/.test(w));
    const flesch = wortlich.length && alle.length
      ? 180 - wortlich.length / alle.length - 58.5 * mittel(wortlich.map(silben))
      : null;
    const gewichtet = funde.reduce((a, f) => a + (f.kategorie === "Typografie" ? 0.5 : 1), 0);
    const dichte = (gewichtet * 100) / nW;
    const stufe = dichte < 2 ? "gering" : dichte < 6 ? "mittel" : "hoch";

    funde.sort((a, b) => (a.zeile === 0) - (b.zeile === 0) || a.zeile - b.zeile || a.start - b.start);
    return {
      funde,
      kennzahlen: {
        woerter: nW, saetze: alle.length, absaetze: absaetze.length,
        satzMittel: laengen.length ? mittel(laengen) : 0,
        satzMin: laengen.length ? Math.min(...laengen) : 0,
        satzMax: laengen.length ? Math.max(...laengen) : 0,
        cv, striche, stricheJe1000, einSatz: einSatz.length, flesch,
      },
      gewichtet, dichte, stufe,
    };
  }

  function fleschStufe(f) {
    return f < 30 ? "sehr schwer" : f < 50 ? "schwer" : f < 60 ? "mittel" : f < 70 ? "leicht" : "sehr leicht";
  }

  /** Markierter Text als HTML (Zeilen mit <mark>), ohne überlappende Markierungen. */
  function markiere(text, funde) {
    const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const zeilen = text.split("\n");
    return zeilen.map((z, i) => {
      const treffer = funde.filter((f) => f.zeile === i + 1 && f.ende > f.start).sort((a, b) => a.start - b.start || a.ende - b.ende);
      let aus = "", pos = 0;
      for (const t of treffer) {
        if (t.start < pos) continue;
        aus += esc(z.slice(pos, t.start));
        aus += `<mark class="k-${t.kategorie.toLowerCase()}" title="${esc(t.fund)}">${esc(z.slice(t.start, t.ende))}</mark>`;
        pos = t.ende;
      }
      aus += esc(z.slice(pos));
      return aus || "&nbsp;";
    }).join("\n");
  }

  window.Phrasenmaeher = { analysiere, markiere, fleschStufe };
})();
