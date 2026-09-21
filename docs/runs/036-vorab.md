# Vorab festgelegt — das Fremdurteil

Geschrieben und committet **vor** dem ersten Aufruf.

## Was jetzt möglich ist

Mit einem OpenRouter-Schlüssel sind Modelle aus mehreren Familien erreichbar.
Damit lässt sich die Lücke aus Abschnitt 24 schließen: ein Urteil von außerhalb
der Familie, die beide Texte geschrieben hat.

## Wer urteilt, und wer nicht

Ausgeschlossen: **DeepSeek** — hat beide Texte geschrieben. Und **Anthropic** —
das ist meine eigene Familie, und ich habe den Aufbau gebaut, der hier zur
Debatte steht.

Vier Richter aus vier Familien:

| Familie | Modell |
| --- | --- |
| Google | `google/gemini-2.5-flash` |
| OpenAI | `openai/gpt-5-mini` |
| Mistral | `mistralai/mistral-medium-3.1` |
| Qwen | `qwen/qwen3-235b-a22b-2507` |

Vier unabhängige Familien sind zugleich die eigene Prämisse dieses Berichts,
angewandt auf seine letzte Messung: Übereinstimmung zwischen Armen, die
einander nicht beeinflussen konnten, zählt anders als Übereinstimmung zwischen
drei prompt-differenzierten Läufen eines Modells.

## Der Längen-Confound, und wie er behandelt wird

Der Gewebe-Text hat 6520 Zeichen, der gespeicherte Text der Einzelzelle 2936 —
Faktor 2,2. **Dass ein Richter den längeren Text bevorzugt, ist ein bekanntes
Artefakt**, und die neun Vergleiche aus Abschnitt 24 haben es nicht kontrolliert.

Deshalb läuft der Paarvergleich zweimal: einmal gegen den kurzen Text und
einmal gegen eine **längenangeglichene** Ziehung derselben Einzelzelle mit
demselben Prompt — 5301 Zeichen, Abstand damit Faktor 1,23. Sie ist als
`docs/runs/034/einzelzelle-lang.md` abgelegt.

## Kontrollen, die scheitern können

1. Ein Text über Teekochen muss **null** der sechs Prämissen berühren.
2. Jede Prämissenfrage wird unter beiden Optionsbenennungen gestellt; eine
   reihenfolgeabhängige Antwort wird ausgeschlossen, nicht gezählt.
3. Der Paarvergleich läuft in beiden Reihenfolgen und gilt nur tauschstabil.

## Marken

| | Marke |
| --- | --- |
| Abdeckung | ein Unterschied zählt ab **≥ 2 von 6**, je Richter |
| Paarvergleich | gilt je Richter nur tauschstabil |
| Längenkontrolle | ein Urteil zählt nur, wenn es **bei beiden Längen** gleich ausfällt |

## Vorhersage

**Abdeckung: kein Unterschied.** DeepSeek las 6/6 gegen 6/6; ich erwarte, dass
die vier Fremdrichter das bestätigen.

**Paarvergleich: ich weiß es nicht.** DeepSeek bevorzugte neunmal von neun das
Gewebe, aber DeepSeek hat beide Texte geschrieben und der Längenunterschied war
unkontrolliert. Trifft die Präferenz auch bei angeglichener Länge und aus vier
fremden Familien zu, ist das der erste belastbare Hinweis auf einen
Kollektivvorteil, den dieses Projekt hat. Kippt sie, war die Präferenz aus
Abschnitt 24 ein Artefakt, und das steht dann so da.

## Was auch das nicht entscheidet

Ob die Philosophie gut ist. Vier Modelle, die denselben Text vorziehen, sind
vier Präferenzen und kein Wahrheitswert — die zweite Seed-Prämisse gilt auch
für Richter.
