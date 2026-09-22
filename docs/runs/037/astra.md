# `openai/gpt-6-astra` — der bislang stärkste Richter

Nachgereicht auf Nachfrage: 036 hatte die Richter nach Preis statt nach Stärke
ausgewählt. Astra ist die Spitze der OpenAI-Familie, die mit Reasoning noch
kalkulierbar ist (10 $/M Prompt, 50 $/M Completion).

## Paarvergleich

```
Positivkontrolle gegen den Teetext: bestanden
Paarvergleich kurz               Gewebe      / Einzelzelle  NICHT tauschstabil
Paarvergleich längenangeglichen  Einzelzelle / Einzelzelle  tauschstabil — Einzelzelle
```

Die Positivkontrolle ist neu und in 037-vorab festgelegt: wer das Gewebe nicht
tauschstabil einem Absatz über Teekochen vorzieht, dessen Paarvergleiche werden
nicht gelesen. Astra besteht sie.

**Gegen den kurzen Text kippt seine Präferenz** — wo alle vier schwachen Richter
aus 036 tauschstabil für das Gewebe waren. **Gegen den längenangeglichenen Text
urteilt er tauschstabil für die Einzelzelle.**

## Berührte Prämissen

```
  Prämisse 1  Gewebe nein   Einzelzelle ja   Teetext nein
  Prämisse 2  Gewebe nein   Einzelzelle ja   Teetext nein
  Prämisse 3  Gewebe nein   Einzelzelle ja   Teetext nein
  Prämisse 4  Gewebe ja     Einzelzelle ja   Teetext nein
  Prämisse 5  Gewebe ja     Einzelzelle ja   Teetext nein
  Prämisse 6  Gewebe nein   Einzelzelle ja   Teetext nein

  Summe: Gewebe 2/6 · Einzelzelle 6/6 · Teetext 0/6
  Kontrolle: gehalten
```

Unterschied **4**, bei einer vorab festgelegten Marke von 2 — zugunsten der
**Einzelzelle**. Keine Antwort hing an der Optionsreihenfolge, der Teetext
berührt nichts.

## Kosten

42 Aufrufe, 43.638 Prompt- und 855 Completion-Tokens, rund 0,48 $.

## Nachzurechnen

```bash
OPENROUTER_API_KEY=… JUDGES=openai/gpt-6-astra node tools/outside-judges.mjs
```
