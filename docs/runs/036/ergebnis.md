# Fremdurteil — Ergebnis

Vier Familien, keine davon Autor eines der Texte, keine davon meine eigene.
Gewebe 6520 Zeichen · Einzelzelle kurz 2936 · Einzelzelle längenangeglichen 5206.

| Richter | Kontrolle | Gewebe | Einzelzelle | Paar, kurz | Paar, längenangeglichen |
| --- | --- | ---: | ---: | --- | --- |
| `google/gemini-2.5-flash` | **gescheitert** (2 reihenfolgeabhängig) | 1/6 | 6/6 | Gewebe | **kein Urteil** |
| `openai/gpt-5-mini` | gehalten | 5/6 | 6/6 | Gewebe | **Gewebe** |
| `mistralai/mistral-medium-3.1` | gehalten | 4/6 | 6/6 | Gewebe | **kein Urteil** |
| `qwen/qwen3-235b-a22b-2507` | gehalten | 6/6 | 6/6 | Gewebe | **kein Urteil** |

Der Teetext berührt bei allen vier Richtern 0 von 6 Prämissen: die Frage trennt.

## Gegen die vorab festgelegten Marken

- **Abdeckung** (Unterschied zählt ab 2 von 6): Mistral liest 4 zu 6 —
  Unterschied 2, **zugunsten der Einzelzelle**. Kein Richter sieht das Gewebe
  vorn.
- **Paarvergleich** (gilt nur, wenn er bei beiden Längen gleich ausfällt):
  gegen den kurzen Text 4 von 4 tauschstabil für das Gewebe, gegen den
  längenangeglichenen **1 von 4**. Drei Richter kippen.

## Der lokale Richter

`SmolLM2-1.7B` als fünfte, familienfremde Instanz, wie in `035-vorab.md`
vorhergesagt: der Teetext berührt bei ihm **5 von 6** Prämissen und 5 von 18
Antworten hängen an der Optionsreihenfolge. Die Kontrolle scheitert, das Modell
kann hier nicht urteilen.

## Nachzurechnen

```bash
OPENROUTER_API_KEY=… node tools/outside-judges.mjs
node tools/independent-judge.mjs
```
