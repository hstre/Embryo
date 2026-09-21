# Einzelzelle gegen Gewebe — Ergebnis

`deepseek-flash`, Denkmodus aus. Gewebe: die akzeptierte Synthese aus Lauf 033,
6520 Zeichen, 28 Zellen. Einzelzelle: dasselbe Ziel, dieselben sechs Prämissen,
ein Aufruf.

```
wörtlich verankert (Kontrolle):  Gewebe 0/6 · Einzelzelle 0/6

Berührte Prämissen, je Prämisse einzeln gefragt
  Prämisse 1..6   Gewebe ja   Einzelzelle ja   Kontrolltext nein
  Summe:          Gewebe 6/6 · Einzelzelle 6/6 · Kontrolltext 0/6

Paarvergleich, 5 Runden zu je beiden Reihenfolgen
  tauschstabil in 5/5 Runden, davon 5 für das Gewebe

Vier Ziehungen der Einzelzelle gegen dasselbe Gewebe
  gespeichert  2936 zeichen  Prämissen 6/6  |  tauschstabil, Gewebe
  Ziehung 2    4026 zeichen  Prämissen 6/6  |  tauschstabil, Gewebe
  Ziehung 3    4057 zeichen  Prämissen 6/6  |  tauschstabil, Gewebe
  Ziehung 4    5077 zeichen  Prämissen 6/6  |  tauschstabil, Gewebe
  tauschstabil 4/4, davon 4 für das Gewebe
```

Der Text der Einzelzelle, gegen den fünf der Runden liefen, liegt als
[`einzelzelle.md`](einzelzelle.md) daneben. Die Marken stehen in
[`../034-vorab.md`](../034-vorab.md).

Nachzurechnen mit:

```bash
DEEPSEEK_API_KEY=… DRAWS=3 node tools/single-cell.mjs
```
