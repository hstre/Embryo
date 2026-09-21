# Vorab festgelegt — Lauf 033

Geschrieben **nach** 032 und **vor** 033.

## Was 032 gezeigt hat, und was es nicht gezeigt hat

Das Ziel ist wieder erreicht: vier akzeptierte Vorschläge, eine akzeptierte
Synthese, 40 von 64 Zellen. Die Marke „die Synthese erreicht die Gate-Grenze
nicht" ist erfüllt — 3324 von 9000 Zeichen.

**Und die Synthese bricht trotzdem mitten im Satz ab.** Diesmal an meinem
API-Token-Budget, nicht an der Gate-Grenze. Es ist die dritte Abschneidung
meinerseits in dieser Reihe, und die einzige, die keine Marke gefangen hat:
Die Policy meldete Abschneiden nur, wenn die Antwort **leer** zurückkam. Eine
Antwort, die abgeschnitten aber nicht leer ist, ging still durch.

Das ist ein Messfehler, kein Modellbefund. Eine an der Budgetgrenze
abgeschnittene Antwort ist keine Antwort, und sie als solche zu protokollieren
hieße, ein Abbrechen später als ein Aufhören zu lesen.

## Die Änderungen

1. `finish_reason` steht in **jedem** Receipt. Abschneiden ist damit im Ledger
   sichtbar und nicht mehr nur an der Zeichenzahl zu erraten.
2. Das Token-Budget für Vorschlag und Synthese steigt auf 2048 beziehungsweise
   6144. Das prüft nichts an der Annahmeregel.

Sonst identisch zu 032.

## Marken

| | Marke |
| --- | --- |
| Ziel | eine Synthese wird akzeptiert |
| Vollständigkeit | **kein** Receipt trägt `finish_reason: "length"` |

Die zweite Marke ist die eigentliche: sie prüft nicht mehr die Zeichenzahl,
sondern was das Modell selbst über sein Aufhören sagt.

## Vorhersage

Beide erfüllt.
