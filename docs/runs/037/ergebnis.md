# Starke Richter — Ergebnis

Sechs Richter aus fünf Familien. Ausgeschlossen bleiben DeepSeek (Autor beider
Texte) und Anthropic (meine Familie). Neu gegenüber 036: die Richter sind nach
Stärke ausgewählt statt nach Preis, und jeder muss zuerst eine
**Paarvergleich-Positivkontrolle** bestehen — das Gewebe gegen einen Absatz über
Teekochen, tauschstabil.

**Alle sechs bestehen diese Kontrolle.** Sie können urteilen.

## Berührte Prämissen

| Richter | Familie | Kontrolle | Gewebe | Einzelzelle | Teetext |
| --- | --- | --- | ---: | ---: | ---: |
| `gemini-3.1-pro-preview` | Google | gescheitert (2 instabil) | 0/6 | **6/6** | 0/6 |
| `gpt-6-astra` | OpenAI | gehalten | 2/6 | **6/6** | 0/6 |
| `gpt-5` | OpenAI | gehalten | 3/6 | **6/6** | 0/6 |
| `qwen3.8-max-0902` | Qwen | gehalten | 3/6 | **6/6** | 0/6 |
| `grok-4.6` | xAI | gehalten | 3/6 | **6/6** | 0/6 |
| `mistral-medium-3-5` | Mistral | gehalten | 4/6 | **6/6** | 0/6 |

**Einstimmig: die Einzelzelle berührt alle sechs Prämissen, das Gewebe null bis
vier.** Kein Richter sieht das Gewebe vorn. Fünf von sechs überschreiten die
vorab festgelegte Marke von 2 — zugunsten der Einzelzelle.

## Paarvergleich

| Richter | gegen den kurzen Text | längenangeglichen |
| --- | --- | --- |
| `gemini-3.1-pro-preview` | kein Urteil | **Einzelzelle** |
| `gpt-6-astra` | kein Urteil | **Einzelzelle** |
| `gpt-5` | Gewebe | kein Urteil |
| `qwen3.8-max-0902` | Gewebe | **Gewebe** |
| `grok-4.6` | kein Urteil | kein Urteil |
| `mistral-medium-3-5` | Gewebe | kein Urteil |

Bei angeglichener Länge: **2 Einzelzelle, 1 Gewebe, 3 kein Urteil.**

Zum Vergleich die vier schwächeren Richter aus 036: gegen den kurzen Text **4
von 4** tauschstabil für das Gewebe.

## Kosten

Panel 210 Aufrufe (227.600 prompt / 79.922 completion), Astra 42 Aufrufe,
Gemini-Nachlauf 36 Aufrufe. Insgesamt rund 3,15 $ von 5 $.

## Nachzurechnen

```bash
OPENROUTER_API_KEY=… node tools/outside-judges.mjs
```
