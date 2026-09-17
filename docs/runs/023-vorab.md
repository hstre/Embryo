# Vorab festgelegt — Läufe 023 und 024, neuer Auftrag

Geschrieben und committet **vor** dem ersten Aufruf.

## Der Auftrag

> Sammle Wissen darüber, wie man herausarbeitet, was in einem Text steht — und
> vernetze die gesammelten Stücke.

Zwei Stufen, in der Reihenfolge, die das Gate von budget-review nennt:
*„Admit anchored claims and then relations between admitted endpoints."*

**Sammeln** ist die Aufgabe aus 016–021, unverändert im Mechanismus: je ein
Bedürfnis pro noch nicht zitierter Beobachtung, Annahme per Stringsuche gegen
genau diese Beobachtung, gespeichert wird die Textstelle der Quelle.

**Vernetzen** ist neu. Sobald das Register voll ist, leitet das Substrat je ein
Bedürfnis pro unentschiedenem Paar ab. Die Zelle **wählt nichts aus** — sie
bekommt beide Einträge und entscheidet nur zwischen vier geschlossenen
Relationen: `requires`, `refines`, `contradicts`, `unrelated`. Die Wahl wird
gescort, nicht generiert. Das Gate prüft Endpunkte, Relationsart, Paarzugehörig-
keit und Graph-Integrität — und nichts darüber, ob die Relation zutrifft.

`unrelated` ist eine protokollierte Absage, keine Ablehnung: das Paar gilt
danach als entschieden. Das ist DESis Disziplin — ein Arm, der immer antwortet,
ist schlechter als einer, der sich enthalten kann.

## Die Umgebung

Acht Beobachtungen, jede eine reale, gemessene Aussage über das Herausarbeiten
von Textinhalt, mit Quelle: sieben aus hstre/Budget-Review und hstre/DESi, keine
von mir erfunden. **Sie sind englisch.** Das ist eine zweite Änderung neben der
Aufgabe: die Fehlerart „Übersetzung statt Kopie" aus 021 ist damit per
Konstruktion weg, und der Vergleich der Sammelstufe mit 021 ist entsprechend
nicht sauber.

## Marken

| | Marke |
| --- | --- |
| Sammeln, 023 (1.7B) | **≥ 3 von 4** Registereinträgen |
| Vernetzen, Kontrolle | Relation übersteht die Permutation der Optionsnamen **≥ 5 von 6** Paaren |

Die zweite Marke entscheidet, ob die Kanten überhaupt etwas bedeuten. Jede
gescorte Wahl, die dieses Projekt gemessen hat, ist an der Optionsreihenfolge
gekippt — das Verdikt 4/9, die Stance 3/9. **Vorhergesagt: instabil, ≤ 3 von 6.**
Trifft das zu, ist der Graph strukturell gültig und semantisch leer, und das
steht dann so im Bericht.

## Was diese Messung ausdrücklich nicht sagt

Ob eine Relation *richtig* ist. Dafür gäbe es hier keine Grundwahrheit, die
nicht von mir käme, und ich bin in der Frage, ob ein Modell semantisch etwas
kann, keine unbeteiligte Instanz. Gemessen wird Stabilität, nicht Korrektheit.
