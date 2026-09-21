# Vorab festgelegt — Läufe 018 und 019

Geschrieben **nach** 016 und 017 und **vor** 018. Das ist ein neues Experiment,
kein Nachjustieren der alten Marken: 016 und 017 haben ihre verfehlt, und das
steht so im Bericht.

## Was 016 und 017 gezeigt haben

Beide erreichten **1 von 4**. Das Muster ist auf beiden Modellgrößen dasselbe:
Sobald ein Eintrag im Register steht, geben die folgenden Zellen **diesen
Eintrag** aus statt die Beobachtung zu zitieren, die ihr Bedürfnis ihnen zeigt.
In 017 sind das zwölf von zwölf Zellen für die Beobachtungen 03 bis 06.

Die Local View zeigt dem Zitierer das Register unter der Überschrift „Already in
the register; copy a different sentence". Das ist derselbe Übernahmeeffekt, den
Abschnitt 14 gemessen hat — ein Köder im Prompt wird 3/3 übernommen, auch wenn
der Satz ihn ausdrücklich abweist.

## Die Änderung

`config.show_register: false` hält dem Zitierer das Register vor. Er sieht nur
die Beobachtung, die er zitieren soll. Sonst ändert sich nichts: gleicher Seed,
gleiche Modelle, gleiches Gate.

## Marken

| | Marke |
| --- | --- |
| 018, 360M | **≥ 3 von 4** Registereinträgen |
| 019, 1.7B | **≥ 3 von 4** |

Drei, nicht zwei: aktuell wird auf beiden Größen genau **eine** Beobachtung
abgedeckt. Erreicht ein Lauf drei, war das Register die bindende Ursache.
Bleibt er bei ein bis zwei, war es das nicht.

## Die konkurrierende Erklärung

Mit leerem Register scheiterte 1.7B dreimal an `observation-01`, jedes Mal mit
*einem* falschen Wort („fall" statt „fallen"). Trifft diese Erklärung zu, bleibt
der Lauf trotz entferntem Register bei ein bis zwei Einträgen, und unter den
Ablehnungen überwiegen Ein-Wort-Abweichungen — messbar daran, dass die
Bruchstelle nahe am Ende der Spanne liegt und nicht bei Präfix 0.
