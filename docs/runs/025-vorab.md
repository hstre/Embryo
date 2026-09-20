# Vorab festgelegt — Läufe 025 und 026, großes Modell

Geschrieben und committet **vor** dem ersten Aufruf.

## Die Frage

Alle bisherigen Befunde stammen von 135M, 360M und 1.7B. Offen ist, ob die Wand
eine Eigenschaft dieser Architektur ist oder dieser Modellgrößen. Gemessen wird
dieselbe Aufgabe wie in 023 — sammeln und vernetzen — mit
`deepseek-flash` (DeepSeek-V4.1-Flash) über die OpenAI-Format-API.

## Was sich dabei zwangsläufig mitändert

Drei Dinge, jedes mit Folgen für die Lesbarkeit:

1. **Keine teacher-forced Bewertung.** Die API liefert Log-Wahrscheinlichkeiten
   nur für selbst erzeugte Tokens. Jede Wahl wird deshalb **generiert und gegen
   die geschlossene Menge zurückgelesen** — der Pfad aus 006 und 009, den der
   gescorte Pfad gerade umgehen sollte. Nennt eine Antwort keine oder mehrere
   Relationen, ist das eine Enthaltung, keine Adapterwahl.
2. **Keine Determinismus-Garantie.** Lokal decodiert greedy; identischer Prompt
   heißt identische Bytes. Gehostet gilt das bei keiner Temperatur. Die Streuung
   wird deshalb **vor** jedem Armvergleich gemessen.
3. **Thinking-Modus.** Vorgabe ist an, Effort `high`. Das ist nicht dieselbe
   Zelle wie lokal, also laufen beide Einstellungen und der Modus steht im
   Policy-Namen: 025 ohne Denken, 026 mit.

## Marken

| | Marke |
| --- | --- |
| Streuungskontrolle | dreimal derselbe Prompt liefert **dieselbe Entscheidung** — sonst ist kein Armvergleich lesbar |
| Sammeln, 025 und 026 | **4 von 4** |
| Vernetzen, Stabilität | Relation übersteht die Permutation der Optionsnamen in **≥ 5 von 6** Paaren |
| Vernetzen, Positivkontrolle | die Verneinung liest `contradicts` **und** der Wasserkessel liest `unrelated` |

Die letzte Marke ist die einzige Korrektheitsaussage, die ich treffen kann, ohne
selbst der Richter zu sein: „X" gegen „nicht X" ist per Konstruktion ein
Widerspruch, und ein Satz über einen Wasserkessel ist per Konstruktion
unverbunden. Über die sechs echten Paare urteile ich weiterhin nicht.

## Vorhersage

Sammeln 4/4 auf beiden Armen. Positivkontrolle bestanden. Stabilität ≥ 5/6.
Anders gesagt: **ich erwarte, dass die Wand bei dieser Größe fällt**, und dass
der Befund dieses Berichts damit auf „diese Modellgrößen" eingeschränkt wird und
nicht auf die Architektur.

Fällt sie nicht, ist das das stärkere Ergebnis.
