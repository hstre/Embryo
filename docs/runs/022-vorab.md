# Vorab festgelegt — Prompt-Messung der Zitierzelle

Geschrieben und committet **vor** dem ersten Aufruf.

## Die Frage

Nach 020 und 021 sind die verbleibenden Fehlerarten alle Anweisungsbefolgung:
Übersetzung ins Englische statt Kopie, Kommentar über die Passage, ein
verändertes Wort. Die einzige Stellschraube, die dieses Projekt je dafür hatte,
ist der Prompt. Der Zweig `claude/gold-recall-echr` von budget-review hat einen
Prompt-Effekt dieser Größe als nicht von der Laufstreuung trennbar entlarvt —
hier ist er es, weil greedy und lokal decodiert wird.

## Die Kontrolle zuerst

Das ist eine Behauptung, keine Annahme. Der erste Arm ist eine **Wiederholung
des Basisprompts**. Ist sie nicht byteidentisch, ist kein Armvergleich lesbar
und die Messung bricht ab, ohne Zahlen zu drucken.

## Die Arme

| Arm | gegen welche Fehlerart |
| --- | --- |
| `basis` | der Prompt aus 016–021, unverändert |
| `wiederholung` | Kontrolle |
| `deutsch` | Übersetzung — die Anweisung spricht die Sprache der Passage |
| `kein-kommentar` | Kommentar — ausdrücklich untersagt |
| `erster-satz` | die Auswahl selbst — nicht „ein Satz", sondern der erste |
| `fortsetzung` | Anweisungsbefolgung insgesamt — der Assistententurn beginnt bereits mit 24 Zeichen der Passage, Kopieren ist dann Fortsetzung |

Gewertet wird wie im Gate: Rahmung abgestreift, Leerraum toleriert, mindestens
40 Zeichen, gegen die Beobachtung, die die Zelle gesehen hat.

## Marke

Basis erreicht in Lauf 021 **3 von 6** Beobachtungen (1.7B) und in 020 **2 von
6** (360M).

Ein Arm zeigt einen Effekt, wenn er **≥ 5 von 6** erreicht. 4 von 6 zählt als
unentschieden und geht nicht in den Bericht als Effekt. Fällt ein Arm unter die
Basis, wird das ebenso berichtet.

## Vorhersage

`fortsetzung` schlägt alle anderen, weil es die Anweisungsbefolgung umgeht statt
sie zu adressieren. Unter den sprachlichen Armen erwarte ich `erster-satz` vorn,
weil es zusätzlich die Auswahl entfernt. Trifft `deutsch` allein, wäre die
Übersetzung eine Prompt-Sprachfrage; trifft es nicht, ist sie es nicht.
