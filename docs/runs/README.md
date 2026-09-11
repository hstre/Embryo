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

Jeder Ordner enthält den Seed, das Endgewebe und das hash-verkettete Ledger.
Beide sind gegen den Code dieses Branches replay-stabil:

```bash
node src/cli.mjs replay \
  --seed docs/runs/006/seed.json \
  --state docs/runs/006/embryo.json \
  --events docs/runs/006/events.jsonl
```

Die Auswertung steht in [`../befund-experimente.md`](../befund-experimente.md).
