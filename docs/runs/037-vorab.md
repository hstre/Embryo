# Vorab festgelegt — das Fremdurteil, mit starken Richtern

Geschrieben **nach** 036 und **vor** 037.

## Der Fehler in 036

Ich habe die Richter nach Preis ausgewählt. Bei einem Budget von fünf Dollar,
von dem der Lauf zwei Cent verbraucht hat. Das ist kein Abwägen, sondern eine
Optimierung gegen eine Schranke, die nie gebunden hat.

Die Folge ist keine Kleinigkeit. **Ein Richter, der schwächer ist als das
Modell, dessen Arbeit er beurteilt, kann nicht als urteilsfähig unterstellt
werden** — und dieser Bericht misst auf zwanzig Seiten, was schwache Richter
produzieren.

Damit ist die Kernaussage von Abschnitt 25 unterbestimmt. Dass drei von vier
Richtern bei angeglichener Länge kippen, hat zwei Lesarten:

1. Die Präferenz war ein Längenartefakt.
2. Die Richter sind für diesen Vergleich zu schwach; gegen den kurzen Text gab
   ihnen die Länge einen leichten Anhaltspunkt, ohne ihn rauschen sie.

Abschnitt 25 behauptet (1). Die Daten tragen beide.

## Die fehlende Kontrolle

Für die Abdeckung gibt es den Teetext als Negativkontrolle. Für den
**Paarvergleich gibt es keine** — ich habe nie geprüft, ob ein Richter einen
offensichtlichen Fall überhaupt richtig entscheidet.

Neu: jeder Richter vergleicht zuerst das Gewebe gegen den Teetext, in beiden
Reihenfolgen. Wer das nicht tauschstabil richtig entscheidet, dessen
Paarvergleiche werden nicht gelesen.

## Die Richter

Spitze der jeweiligen Familie, soweit mit Reasoning kalkulierbar. `gpt-5.5-pro`
ist es mit 180 $/M Completion nicht.

| Familie | Modell |
| --- | --- |
| Google | `gemini-3.1-pro-preview` |
| OpenAI | `gpt-5` |
| Mistral | `mistral-medium-3-5` |
| Qwen | `qwen3.8-max-0902` |
| xAI | `grok-4.6` |

Weiterhin ausgeschlossen: DeepSeek (Autor beider Texte) und Anthropic (meine
Familie).

## Marken

Unverändert zu 036, plus die neue Kontrolle:

| | Marke |
| --- | --- |
| Paarvergleich-Positivkontrolle | Gewebe gegen Teetext, tauschstabil richtig |
| Abdeckung | Unterschied zählt ab **≥ 2 von 6**, Teetext 0/6, keine reihenfolgeabhängige Antwort |
| Paarvergleich | gilt nur, wenn er **bei beiden Längen** gleich ausfällt |

## Vorhersage

**Die Positivkontrolle halten alle fünf.** Diese Modelle sollten Philosophie von
Teekochen unterscheiden können; täte es einer nicht, wäre das der Befund.

**Zum Ausgang sage ich nichts.** Genau diese Unterbestimmtheit ist der Grund für
den Lauf. Halten die starken Richter bei angeglichener Länge ein Urteil, war
Lesart 2 richtig und Abschnitt 25 zu schnell. Kippen sie ebenso, steht Lesart 1
deutlich besser da als jetzt.
