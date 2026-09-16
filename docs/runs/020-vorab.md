# Vorab festgelegt — Läufe 020 und 021

Geschrieben **nach** 018 und 019 und **vor** 020. Drittes Experiment der Reihe;
018 und 019 haben ihre Marken verfehlt und das steht so im Bericht.

## Was 018 und 019 gezeigt haben

Das Register wegzunehmen hat gewirkt: die Fehlerart „kopiere den vorhandenen
Eintrag" kommt in beiden Läufen **kein einziges Mal** mehr vor, wo sie in 017
zwölf von zwölf Zellen betraf. Erreicht wurden trotzdem nur 1 von 4 (018, 360M)
und 2 von 4 (019, 1.7B), gegen eine Marke von 3.

Darunter lag eine dritte Ursache, die in keiner der beiden Vorregistrierungen
stand: **die Zelle rahmt ihre Antwort in Anführungszeichen.** Das Gate vergleicht
den Rohtext und lehnt deshalb Passagen ab, die die Beobachtung wörtlich enthält.

Gegenrechnung, direkt auf den Receipts der vier Läufe, ohne neuen Lauf:

| Lauf | angenommen | allein an Randzeichen gescheitert | wäre |
| --- | ---: | ---: | ---: |
| 016 | 1/4 | 0 | 1/4 |
| 017 | 1/4 | 0 | 1/4 |
| 018 | 1/4 | 1 Ablehnung auf 1 Beobachtung | **2/4** |
| 019 | 2/4 | 3 Ablehnungen auf 1 Beobachtung | **3/4** |

## Die Änderung

`config.tolerate_wrapping: true` streift Anführungszeichen und einen
Listenstrich **außen** ab, bevor die Stringsuche läuft. Innen wird nichts
angefasst: ein verändertes Wort fällt weiter durch, und was ins Gewebe geht, ist
weiterhin die Textstelle der Beobachtung, nie der Wortlaut der Zelle. Das ist
dieselbe Art Toleranz wie beim Leerraum — sie betrifft die Darstellung der
Antwort, nicht ihren Inhalt.

## Marken

| | Marke |
| --- | --- |
| 020, 360M | **≥ 2 von 4** |
| 021, 1.7B | **≥ 3 von 4** |

Das sind genau die Werte der Gegenrechnung. Die Marke lautet damit: die
Rechnung wird im Lauf mindestens erreicht. Weniger hieße, dass das Gewebe sich
anders entwickelt als die Rechnung unterstellt.

## Was danach noch übrig bliebe

Die verbleibenden Ablehnungen sind nach 019 zu je einem Drittel Übersetzung ins
Englische, Kommentar über die Passage und Ein-Wort-Abweichung. Keine davon ist
eine Darstellungsfrage, und keine wird von diesem Lauf berührt.
