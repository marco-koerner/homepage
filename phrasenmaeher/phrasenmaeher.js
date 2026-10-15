/* Phrasenmäher, Browserfassung.
   Zählt Merkmale, die einen Text glatt wirken lassen. Der Text verlässt den Browser nicht.
   Quelle der Merkmale: merkmale.js, erzeugt aus merkmale.md im Repo marco-koerner/phrasenmaeher.
   Das Ergebnis sagt nichts über die Herkunft; jedes Merkmal kommt auch in menschlichen Texten vor. */

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

  const SATZGRENZE = /(?<=[.!?])\s+(?=[A-ZÄÖÜ„»(\d])/g;

  function saetze(text) {
    const roh = text.replace(/\s+/g, " ").trim().split(SATZGRENZE);
    return roh.filter((s) => s.split(/\s+/).length >= 2);
  }

  /** Sätze einer Zeile mit Position: [{start, ende, satz}], nur Sätze mit mindestens zwei Wörtern. */
  function satzSpannen(zeile) {
    const spannen = [];
    let start = 0;
    for (const m of zeile.matchAll(SATZGRENZE)) {
      spannen.push([start, m.index]);
      start = m.index + m[0].length;
    }
    spannen.push([start, zeile.length]);
    return spannen.map(([a, b]) => ({ start: a, ende: b, satz: zeile.slice(a, b) }))
      .filter((s) => s.satz.split(/\s+/).filter(Boolean).length >= 2);
  }

  /** Wahr, wenn ein Satzteil aus mindestens drei kurzen, durch Komma getrennten Gliedern besteht. */
  function istReihung(teil) {
    teil = teil.trim().replace(/[.!?;]+\s*$/, "");
    let glieder = teil.split(/,\s*/).map((g) => g.trim()).filter(Boolean);
    if (glieder.length) {
      const l = glieder[glieder.length - 1];
      const m = l.match(/\s(?:und|oder|sowie)\s/);
      const letzte = m ? [l.slice(0, m.index), l.slice(m.index + m[0].length)] : [l];
      glieder = glieder.slice(0, -1).concat(letzte.map((g) => g.trim()).filter(Boolean));
    }
    if (glieder.length < 3) return false;
    const kurz = glieder.filter((g) => g.split(/\s+/).length <= 4).length;
    return kurz / glieder.length >= 0.75;
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

  // Satzbau: Formen, die ein Sprachmodell auch dann trifft, wenn es die Wortliste kennt
  const SCHLAGWORT_START = /^[„»(]?(?:Kein|Keine|Keinen|Nur|Ohne|Alles|Nichts|Mehr|Weniger|Statt|Endlich|Einfach)(?![\p{L}])/u;
  const VERB = /(?<![\p{L}])(?:ist|sind|war|waren|hat|haben|hatte|hatten|wird|werden|wurde|wurden|gibt|geht|kommt|bleibt|kann|können|muss|müssen|soll|sollen|will|wollen|darf|dürfen|mag|lässt|macht|zählt|fehlt|steht|liegt|braucht|hilft|reicht|genügt|gilt|heißt|bedeutet|zeigt|folgt|passt|stimmt|funktioniert|dazu|hier|unten|oben|später|siehe)(?![\p{L}])/iu;
  const DEFINITION = /^[„»(]?([A-ZÄÖÜ][\p{L}\p{N}_-]+)\s(ist|sind)\s(?:der|die|das|ein|eine|kein|keine|nicht|oft|immer|nie|meist|selten|mehr|weniger)(?![\p{L}])/u;
  const KEINE_DEFINITION = new Set(["es", "er", "sie", "das", "dies", "dieser", "diese", "dieses", "wer", "was", "hier", "dort", "so", "dann", "damit", "dabei", "darum", "deshalb", "ziel", "zweck", "voraussetzung", "grundlage", "ergebnis", "gegenstand", "ausnahme", "beispiel", "folge", "anlass", "stand", "quelle", "thema", "termin", "ort", "zeit", "kontakt", "veranstalter", "herausgeber", "ansprechpartner", "ansprechpartnerin", "maßgeblich", "wichtig", "entscheidend", "neu", "offen", "unklar", "klar"]);
  const AUFTAKT = /(?:^|[,;:]\s*)(\p{L}{2,})\s[^,;:.!?]*,\s*\1\s[^,;:.!?]*,\s*\1\s/iu;

  function satzbau(zeilen, fund) {
    zeilen.forEach((z, i) => {
      if (LISTE.test(z) || z.trimStart().startsWith("#")) return;
      for (const { start: a, ende: b, satz: s } of satzSpannen(z)) {
        const n = s.split(/\s+/).filter(Boolean).length;
        const m = s.match(/^(.{0,80}?):\s+(\S.*)$/);
        if (m && m[1].split(/\s+/).filter(Boolean).length <= 12 && !LABEL.test(m[1].trim()) && istReihung(m[2])) {
          fund(i + 1, "Satzbau", "Doppelpunkt-Aufzählung (Reihung statt Satz)", a + m[1].length, b, s);
        }
        const t = s.match(AUFTAKT);
        if (t) {
          const w = t[1];
          fund(i + 1, "Satzbau", `Dreierreihe mit gleichem Auftakt („${w} …, ${w.toLowerCase()} …, ${w.toLowerCase()} …“)`, a + t.index + t[0].indexOf(w), b, s);
        }
        if (n >= 2 && n <= 6 && SCHLAGWORT_START.test(s) && !VERB.test(s)) {
          fund(i + 1, "Satzbau", "Schlagwortsatz ohne Verb", a, b, s);
        }
        const d = s.match(DEFINITION);
        if (d && !KEINE_DEFINITION.has(d[1].toLowerCase())) {
          fund(i + 1, "Satzbau", `Definitionssatz („${d[1]} ${d[2]} …“), Beleg?`, a, b, s);
        }
      }
    });
  }

  function pointen(text, zeilen, fund) {
    let zeilennr = 0;
    for (const absatz of text.split(/(\n\s*\n)/)) {
      const nZeilen = (absatz.match(/\n/g) || []).length;
      if (!absatz.trim() || LISTE.test(absatz) || absatz.trimStart().startsWith("#")) { zeilennr += nZeilen; continue; }
      const letzteZeile = zeilennr + (absatz.replace(/\n+$/, "").match(/\n/g) || []).length + 1;
      const alle = saetze(absatz);
      const letzter = alle[alle.length - 1] || "";
      if (alle.length >= 2 && letzter.split(/\s+/).length <= 6 && /[.!]$/.test(letzter.trimEnd())
          && alle.slice(0, -1).some((s) => s.split(/\s+/).length >= 12)) {
        const z = zeilen[letzteZeile - 1];
        const sp = satzSpannen(z);
        const s = sp.length ? sp[sp.length - 1] : { start: 0, ende: z.length };
        fund(letzteZeile, "Satzbau", "Pointe am Absatzende (kurzer Schlusssatz nach langem)", s.start, s.ende, letzter);
      }
      zeilennr += nZeilen;
    }
  }

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
      const sp = satzSpannen(t);
      const ersterSatz = sp.length ? sp[0].satz : t;
      if (istReihung(ersterSatz.slice(m[1].length + 1))) return; // zählt als Doppelpunkt-Aufzählung (Satzbau)
      const start = z.indexOf(m[1]);
      fund(i + 1, "Muster", "Vorsatz mit Doppelpunkt (streichbar?)", start, start + m[1].length + 1, z);
    });

    // Satzbau
    satzbau(zeilen, fund);
    pointen(text, zeilen, fund);

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
    // Typografie wie im Skript einmal je Zeile und Merkmal zählen, auch wenn jede Stelle markiert wird
    const gesehen = new Set();
    const gewichtet = funde.reduce((a, f) => {
      if (f.kategorie !== "Typografie") return a + 1;
      const k = f.zeile + "|" + f.fund;
      if (gesehen.has(k)) return a;
      gesehen.add(k);
      return a + 0.5;
    }, 0);
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
