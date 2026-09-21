# Vorab festgelegt — Läufe 016 und 017

Geschrieben und committet **vor** dem ersten Lauf, nach der Methode, die der
Projektabschluss von DESi und der Zweig `claude/gold-recall-echr` von
budget-review beide nennen: Marke fixieren, dann messen, danach nicht
nachjustieren.

## Der neue Auftrag

Das bisherige Ziel — eine Philosophie entwickeln — verlangt Auswahl,
Vergleich, Originalität und Revision. Alle vier sind auf beiden Modellgrößen
gemessen gescheitert (Abschnitte 13 und 14). Der neue Auftrag ist die Bedingung
darunter und verlangt nur die eine Fähigkeit, die messbar trägt:

> Lege ein Register an: vier verschiedene Stellen, die wörtlich in den
> gelieferten Beobachtungen vorkommen.

Kein Urteil einer Zelle steht im Weg. `deriveNeeds` leitet je ein
PROPOSE-Bedürfnis pro noch nicht zitierter Beobachtung ab, die Zelle bekommt
genau diese Beobachtung zu sehen und soll einen Satz daraus kopieren, und das
Gate entscheidet per Stringsuche. Kein Review-Panel, kein Meta-Review, keine
Frage, keine Synthese.

## Marken

| | Marke | Begründung |
| --- | --- | --- |
| 016, 360M | **≥ 2 von 4** Registereinträgen | C3c1 misst 2/3 verankert bei gegebenem Ziel, drei Versuche je Bedürfnis, sechs Beobachtungen verfügbar |
| 017, 1.7B | **≥ 3 von 4** | dort zusätzlich 2/2 inhaltlich richtig |

## Vorhergesagte Fehlerart

Nach Abschnitt 16 ist die häufigste Bruchstelle auf 1.7B **Kommentar über die
Aufgabe statt Zitat** (4 von 6), nicht Umformulierung (2 von 6) und nicht
Satzspiegel (0 von 6). Vorhergesagt: unter den abgelehnten Vorschlägen dieser
Läufe überwiegt `NOT_ANCHORED` mit Kommentartext, nicht `SPAN_TOO_SHORT`.

## Kontrolle, dass die Aufgabe lösbar ist

Ein Test fährt dieselbe Aufgabe mit einem perfekten Zitierer und erreicht 4 von
4. Schlösse ein Lauf nicht, läge das also an den Zellen und nicht am Aufbau.
