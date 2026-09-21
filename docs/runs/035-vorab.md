# Vorab festgelegt — der unabhängige Richter

Geschrieben und committet **vor** dem ersten Aufruf.

## Die Lücke

Abschnitt 24 misst den Kollektivvorteil zur Hälfte. Was fehlt, ist ein Urteil
von außerhalb der Modellfamilie, die beide Texte geschrieben hat.

## Was erreichbar ist, und was nicht

In dieser Umgebung liegt kein Schlüssel für OpenAI, Gemini, Mistral oder andere
Anbieter. Erreichbar sind genau zwei Familien: **DeepSeek** — die Partei — und
**SmolLM2** lokal.

Also SmolLM2-1.7B, angeheftet. Was dafür spricht: andere Familie, an keinem der
beiden Texte beteiligt, greedy decodiert und damit ohne Streuung, was der
gehostete Richter nicht zusichern konnte.

Was dagegen spricht, und es wiegt schwer: **dieser Bericht hat sein Urteil
viermal gemessen, und viermal hing es an der Reihenfolge der Optionen** —
Verdikt 4/9 stabil, Stance 3/9, Relation 0/6, Paarvergleich 59 % bei n=34.

Ein Null von einem schwachen Richter ist kein unabhängiges Urteil. Es ist die
Feststellung, dass dieser Richter nichts sagen kann.

## Der Aufbau

Zwei Kontrollen, beide können scheitern:

1. Ein Text über Teekochen muss **null** der sechs Prämissen berühren.
2. Jede Antwort wird mit beiden Optionsreihenfolgen erhoben. Eine Antwort, die
   davon abhängt, zählt als instabil und geht in keine Summe ein.

Der Paarvergleich läuft in beiden Reihenfolgen und gilt nur, wenn er den Tausch
übersteht.

## Marken

| | Marke |
| --- | --- |
| Kontrolle | Teetext 0/6 **und** null reihenfolgeabhängige Antworten |
| Abdeckung | ein Unterschied zählt ab **≥ 2 von 6** |
| Paarvergleich | gilt nur tauschstabil |

## Vorhersage

**Die Kontrollen scheitern.** Nach vier Messungen an genau diesem Modell erwarte
ich reihenfolgeabhängige Antworten und einen nicht tauschstabilen
Paarvergleich. Halten sie wider Erwarten, ist das der interessantere Ausgang —
und dann steht zum ersten Mal ein Urteil von außerhalb der schreibenden Familie
im Bericht.

## Was danach immer noch fehlt

Ein **starkes** Modell außerhalb der DeepSeek-Familie. Der praktikable Weg
dorthin kostet nichts: die beiden Texte und die Frage in eine freie Weboberfläche
eines anderen Anbieters einfügen, beide Reihenfolgen, und das Ergebnis
nachtragen. Solange das nicht geschieht, bleibt Abschnitt 24 halb beantwortet,
unabhängig davon, wie dieser Lauf ausgeht.
