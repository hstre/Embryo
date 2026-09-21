# Vorab festgelegt — Lauf 032

Geschrieben **nach** 031 und **vor** 032.

## Was 031 erreicht hat

**Das ursprüngliche Ziel ist erreicht** — zum ersten Mal in diesem Projekt.
Vier akzeptierte Vorschläge, eine akzeptierte Synthese, in 32 von 64 Zellen und
acht Generationen.

Und die Vorhersage aus der Buchführung von 030 trifft genau zu:

| Panelform | Vorhersage | 031 |
| --- | --- | --- |
| 2 stützende Arme, 1 Einwand | annehmen | 5 von 5 angenommen |
| 1 stützender Arm, 2 Einwände | zurückweisen | 2 von 2 zurückgewiesen |

## Der verbleibende Mangel, und er ist meiner

Die akzeptierte Synthese ist **genau 3000 Zeichen lang** — sie stößt an
`max_text_chars` und bricht mitten im Satz ab. Die Vorschläge liegen mit 945 bis
1600 Zeichen deutlich darunter; nur die Synthese, die vier Vorschläge
zusammenführen soll, trifft die Grenze.

Das Ziel ist damit formal erreicht: das Gate hat die Synthese nach seinen Regeln
angenommen. Das Erzeugnis ist trotzdem unvollständig, und eine abgeschnittene
Philosophie ist keine Philosophie.

## Die Änderung

`max_text_chars: 9000`, sonst identisch zu 031. Das prüft **nichts an der
Annahmeregel** — es ist eine Konfigurationsgröße, die ich zu klein gewählt habe,
und die Marke ist entsprechend bescheiden.

## Marken

| | Marke |
| --- | --- |
| Ziel | eine Synthese wird akzeptiert |
| Vollständigkeit | die Synthese erreicht die Grenze **nicht** |

## Vorhersage

Beide erfüllt. Falls das Ziel diesmal *nicht* erreicht wird, obwohl sich nur
diese Zahl geändert hat, wäre das der interessantere Ausgang: es hieße, dass das
Ergebnis von 031 an der Textlänge hing und nicht an der Regel.
