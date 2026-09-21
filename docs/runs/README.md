# Lokale Läufe

Vollständige Gewebe und Ledger der Läufe, die nicht über den GitHub-Workflow
entstanden sind, sondern lokal auf dem reparierten Substrat. Die Läufe 001 bis
005 liegen weiterhin auf den Branches `archive/embryo-00N` beziehungsweise
`embryo-state`.

| Lauf | Konfiguration | Zellen | Energie | Akzeptiert |
| --- | --- | ---: | ---: | ---: |
| `006` | 135M-Zellen, 360M-Meta-Reviewer | 47 | 47/64 | 0 |
| `007` | alle Zellen auf 360M | 19 | 19/64 | 0 |
| `008` | wie 007, Verdikt gescort statt generiert | 26 | 26/64 | 0 |
| `009` | Annahme aus zitierten Belegen, Seed mit sechs Observations | 25 | 25/64 | 0 |
| `010` | Kontrollarm zu 009: identischer Seed, Annahme per Verdikt | 26 | 26/64 | 0 |
| `011` | wie 009, Zitat aus der Verteilung gelesen statt geschrieben | 25 | 25/64 | 0 |
| `012` | wie 011, Panel blind: kein Arm sieht die Fragmente der anderen | 25 | 25/64 | 0 |
| `013` | wie 011, Panel sichtbar, Überlappung protokolliert | 25 | 25/64 | 0 |
| `014` | wie 012, dritter Panelarm ist eine deterministische Ankerregel | 17 | 17/64 | 0 |
| `015` | wie 014, Regel durch den entarteten Kontrollarm ersetzt | 13 | 13/64 | 0 |
| `016` | **neuer Auftrag:** Register wörtlicher Stellen, 360M | 17 | 17/64 | 1 |
| `017` | wie 016 auf 1.7B | 16 | 16/64 | 1 |
| `018` | wie 016, Register vor der Zelle verborgen | 17 | 17/64 | 1 |
| `019` | wie 018 auf 1.7B | 14 | 14/64 | 2 |
| `020` | wie 018, Gate toleriert die Rahmung der Antwort | 16 | 16/64 | **2** |
| `021` | wie 020 auf 1.7B | 12 | 12/64 | **3** |
| `023` | **neuer Auftrag:** sammeln *und* vernetzen, 1.7B | 19 | 19/96 | **4 + 6 Kanten** |
| `024` | wie 023 auf 360M | 20 | 20/96 | 2, Vernetzen nie erreicht |
| `025` | wie 023, Zellen auf `deepseek-flash`, ohne Denkmodus | 10 | 10/96 | **4 + 6 Kanten, Ziel erreicht** |
| `026` | wie 025, Denkmodus an, Effort `high` | 10 | 10/96 | **4 + 6 Kanten, Ziel erreicht** |
| `027` | **zurück zum ursprünglichen Ziel**, Konfiguration wie 012, `deepseek-flash` | 64 | 64/64 | 0, 16× PANEL_REVISE |
| `028` | wie 027, `max_text_chars` 3000 | 64 | 64/64 | 0, Abschneiden widerlegt |
| `029` | Kontrollarm, Annahme per Verdikt (wie 010) | 64 | 64/64 | 0, 12 Meta-Reviews, alle REVISE |
| `030` | wie 028, Einwand an derselben Beweislast wie Zustimmung | 64 | 64/64 | 0, 13× PANEL_REJECT |
| `031` | wie 030, Zustimmung an blinden Armen gezählt | 32 | 32/64 | **4 + Synthese, Ziel erreicht** |
| `032` | wie 031, Textgrenze 9000 | 40 | 40/64 | **4 + Synthese**, Synthese am Token-Budget abgeschnitten |
| `033` | wie 032, Abschneiden im Receipt sichtbar, Budgets erhöht | 28 | 28/64 | **4 + Synthese, vollständig** |

006 bis 008 verwenden dasselbe Ziel und dieselbe Konfiguration wie Experiment
005. 009 und 010 laufen gegen `examples/seed-grounded.json`, das dem Ziel sechs
gesetzte Prämissen als Umgebung beigibt, und bilden ein Paar: identischer Seed,
identisches Modell, Unterschied allein im Annahmemechanismus. Alle Läufe
verwenden die angehefteten Revisionen `12fd25f7` (135M) und `a10cc151` (360M).
Zwischen 006 und 007 unterscheidet sich ausschließlich das Modell der
Nicht-Meta-Zellen, zwischen 007 und 008 ausschließlich die Art, wie der
Meta-Reviewer zu seinem Verdikt kommt. 008 ist der erste Lauf des Projekts mit
Verdikten statt Abstains und mit einem tatsächlich durchlaufenen
Revisionszyklus — akzeptiert wurde trotzdem nichts.

012 und 013 bilden mit 011 ein Tripel gegen dieselbe Umgebung und dasselbe
Modell; unterschiedlich ist allein, was ein Reviewer von seinen Nachbarn sieht
und wie das Gate die Übereinstimmung verbucht. Die drei Gewebe sind knotenweise
identisch — 22 Knoten, gleiche Art, gleicher Status, gleicher Text. Die
Buchführung lässt sich mit

```bash
node src/cli.mjs panel --state docs/runs/012/embryo.json
```

aus jedem Gewebe auslesen; sie steht zusätzlich in den Receipts der Läufe mit
`panel_independence` jenseits von `sighted`.

014 und 015 ersetzen den dritten Panelarm durch eine Regel ohne Modell. In 014
zitiert sie nur, was sie wörtlich in der Umgebung wiederfindet, und enthält sich
sonst; in 015 zitiert sie die erste Beobachtung, ohne irgendetwas zu vergleichen.
Der zweite ist der entartete Kontrollarm, den der Projektabschluss von
[hstre/DESi](https://github.com/hstre/DESi) verlangt: wenn er so gut abschneidet
wie der echte Arm, misst der Vergleich nichts.

```bash
node src/cli.mjs step --backend smollm --citation-by score --rule-arm anchor
```

Ab 016 gilt ein anderer Auftrag. Statt einer Philosophie soll das Gewebe ein
Register vier verschiedener Stellen anlegen, die **wörtlich** in den gelieferten
Beobachtungen vorkommen. `acceptance_mode: "anchor"` nimmt jede urteilende Rolle
aus der Schleife: `deriveNeeds` leitet je ein Bedürfnis pro noch nicht zitierter
Beobachtung ab, die Zelle sieht genau diese Beobachtung, und das Gate entscheidet
per Stringsuche gegen sie. Kein Review-Panel, kein Meta-Review, keine Frage,
keine Synthese. Die sechs Läufe bilden drei Paare (360M und 1.7B) mit je einer
Änderung, und die Marke stand vor jedem Paar fest — siehe `016-vorab.md`,
`018-vorab.md` und `020-vorab.md`.

Ab 023 gilt wieder ein anderer Auftrag: Wissen darüber sammeln, wie man
herausarbeitet was in einem Text steht — und die gesammelten Stücke vernetzen.
Zwei Stufen in der Reihenfolge, die das Gate von budget-review nennt: erst
verankerte Einträge, dann Relationen zwischen zugelassenen Endpunkten. Das
Substrat leitet je ein Bedürfnis pro unentschiedenem Paar ab; die Zelle wählt
keinen Eintrag aus, sondern entscheidet zwischen vier geschlossenen Relationen,
darunter `unrelated` als protokollierte Absage. Das Gate prüft Endpunkte,
Relationsart, Paarzugehörigkeit und Graph-Integrität — und nichts darüber, ob
die Relation zutrifft. 023 ist der erste Lauf des Projekts, der sein Ziel
erreicht hat.

025 und 026 fahren dieselbe Aufgabe wie 023 gegen ein großes gehostetes Modell
und beantworten die Frage, die alle bisherigen Läufe offen ließen: ob die Wand
der Architektur gehört oder der Modellgröße. Sie gehört der Größe. Beide
erreichen das Ziel in zehn Zellen ohne eine einzige Ablehnung. Ein erster
Versuch von 026 wurde verworfen: `max_tokens` zählt bei DeepSeek den
Denk-Verlauf mit, und sechs Relationen kamen deshalb leer zurück.

```bash
DEEPSEEK_API_KEY=… node src/cli.mjs step --backend deepseek --thinking \
  --seed docs/runs/026/seed.json --state docs/runs/026/embryo.json \
  --events docs/runs/026/events.jsonl
```

027 bis 030 kehren zum ursprünglichen Ziel zurück — Konfiguration identisch zu
012, getauscht ist allein die Zelle. Die Rollen differenzieren dort zum ersten
Mal (der adversariale Arm widerspricht in 11 von 13 Fragmenten, der wohlwollende
stimmt in 13 von 13 zu), und drei aufeinanderfolgende Blockaden werden sichtbar:
das Veto eines einzelnen Einwands, das Abschneiden der Vorschläge — widerlegt —
und zuletzt die Forderung nach zwei *verschiedenen* stützenden Beobachtungen,
an der ein Panel scheitert, das sich über die einschlägige Prämisse einig ist.

031 bis 033 lösen die letzte Blockade auf. Zustimmung wird an verschiedenen
**blinden Armen** gemessen statt an verschiedenen Beobachtungen — der Prämisse
treu, weil Unabhängigkeit hier heißt, einander nicht lesen zu können, und das
Schema lässt die Regel nur bei blindem Panel zu. **031 ist der erste Lauf
dieses Projekts, der das ursprüngliche Ziel erreicht.** 033 ist derselbe Lauf
ohne jede Abschneidung: `docs/runs/033/synthese.md` enthält das vollständige
Erzeugnis, und kein Receipt trägt `finish_reason: "length"`.

Jeder Ordner enthält den Seed, das Endgewebe und das hash-verkettete Ledger.
Beide sind gegen den Code dieses Branches replay-stabil:

```bash
node src/cli.mjs replay \
  --seed docs/runs/006/seed.json \
  --state docs/runs/006/embryo.json \
  --events docs/runs/006/events.jsonl
```

Die Auswertung steht in [`../befund-experimente.md`](../befund-experimente.md).
