# Organisation ohne Urteil

**Forschungsbericht zu den Experimenten 001–011 und der Fähigkeitsleiter**

*Der Titel folgt dem Befund statt der Laufzahl, damit er nicht mit jedem
weiteren Lauf veraltet.*

| | |
| --- | --- |
| Datum | 8. September 2026 |
| Untersucht | `archive/embryo-001` … `archive/embryo-004`, `embryo-state`, [`docs/runs/`](runs) 006–011 |
| Datenbasis | 399 hash-verkettete Receipts |
| Reparatur | [PR #9](https://github.com/hstre/Embryo/pull/9) |
| Verfasst von | Claude Opus 5 |

---

## 1. Kurzfassung

Embryo hat in fünf Läufen 231 Zellen ausgeführt. In den vier Läufen mit der
Frage-Vorschlag-Review-Architektur wurde **kein einziger Vorschlag akzeptiert**.
Das Ziel blieb jedes Mal offen, das Energiebudget wurde dreimal vollständig
verbraucht.

Die naheliegende Lesart war, dass ein 135M-Modell zu klein für Urteilsbildung
ist. Experiment 005 hat diese Lesart geprüft und den Meta-Reviewer auf 360M
vergrößert. Das Ergebnis war identisch — bis auf die letzte Stelle der
Entscheidungsstatistik.

Drei Gegenläufe auf dem reparierten Substrat haben die Ursachenkette danach
weiter aufgetrennt. Alle bleiben bei null akzeptierten Vorschlägen, aber aus
jeweils anderem Grund, und die letzten beiden sind keine Defekte mehr, sondern
Ergebnisse. Die Phänotypen sind ausschließlich über Prompts definiert, und auf
dieser Modellgröße differenzieren Prompts das Verhalten nicht. Und wenn man das
Urteil nicht mehr generieren lässt, sondern direkt aus der Wahrscheinlichkeits-
verteilung des Modells liest, entsteht es zwar — trägt aber kein Qualitäts-
signal.

Die stigmergische Maschinerie selbst hat dabei getragen: die Rekrutierungskette
von der Frage über den Vorschlag zum Review-Panel und zum Meta-Review ist über
alle 64 Zellen von 005 exakt aufgegangen, ohne eine einzige Nachricht zwischen
Zellen. Gescheitert ist allein die Urteilsschicht.

Die Ursache war kein Modellgrenzwert, sondern ein Aufrufdefekt: die Policy
übergab der Text-Pipeline einen String statt eines Message-Arrays. Damit wurde
das Chat-Template nie angewendet, und beide Modellgrößen liefen als reine
Textvervollständigung. Die Receipts enthalten deshalb Prompt-Fortsetzungen statt
Reviews. Nach der Korrektur liefert dieselbe angeheftete 360M-Revision beim
selben Prompt im ersten Versuch ein Verdikt.

## 2. Befund

| Lauf | Policy | Gen. | Energie | Abstains | Akzeptierte Arbeit |
| --- | --- | ---: | ---: | ---: | --- |
| 001 | `adapter-v1` | 8 | 32/32 | 0 | 1 von 11 Behauptungen (anderes Vokabular) |
| 002 | `adapter-v2` | 2 | 7/64 | 3 | keine |
| 003 | `triad-v2` | 16 | 64/64 | 33 | keine |
| 004 | `review-collective-v3` (135M meta) | 16 | 64/64 | 21 | keine |
| 005 | `review-collective-v4` (360M meta) | 16 | 64/64 | 21 | keine |
| 006 | `v5-chat`, 135M-Zellen | 12 | 47/64 | 15 | keine |
| 007 | `v5-chat`, alle Zellen 360M | 5 | 19/64 | 6 | keine |
| 008 | `v6-scored`, gescortes Verdikt | 7 | 26/64 | 0 | keine |
| 009 | `v7-cited`, Annahme aus Zitaten | 7 | 25/64 | 18 | keine |
| 010 | Kontrollarm, Annahme per Verdikt | 7 | 26/64 | 0 | keine |
| 011 | wie 009, Zitat gescort statt generiert | 7 | 25/64 | 0 | keine |

006 bis 011 liefen auf dem reparierten Substrat und sind unten in eigenen
Abschnitten ausgewertet. 001 und 002 nutzten ein anderes Aktionsvokabular (Behauptungen und Einwände
statt Frage-Vorschlag-Review) und sind nur eingeschränkt vergleichbar. In 003
bis 005 endeten 75 von 192 Zellen — 39 Prozent — in einem Abstain.

## 3. Ein Fehlerbild, viermal protokolliert

Das Ledger hat die Ursache jedes Mal benannt. Der Grund, den die Zelle bei ihrem
Abstain angibt, steht wörtlich im Receipt:

| Lauf | Abstain-Grund | Häufigkeit |
| --- | --- | ---: |
| 002 | `unparseable verification choice` | 3× |
| 003 | `review contained no verdict` | 33× |
| 004 | `meta-review contained no verdict` | 21× |
| 005 | `meta-review contained no verdict` | 21× |

Über drei Architekturgenerationen hinweg dieselbe Aussage: das Modell liefert
die geforderte strukturierte Marke nicht. Das ist kein Qualitätsproblem der
Antwort, sondern ein Formatproblem — und damit ein Hinweis auf die
Schnittstelle, nicht auf die Fähigkeit.

## 4. Die Ursache

`SmolLmPolicy.generate()` übergab der Pipeline einen fertig zusammengesetzten
String. Die Pipeline von `@huggingface/transformers` wendet das Chat-Template
eines Modells aber nur an, wenn sie ein Message-Array bekommt:

```js
// TextGenerationPipeline._call
if (typeof texts === "string") {
  inputs = texts = [texts];              // kein Template, reine Vervollständigung
} else if (isChat(texts)) {
  inputs = texts.map((x) =>
    this.tokenizer.apply_chat_template(x, …));   // Instruktionsmodus
}
```

Damit liefen `SmolLM2-135M-Instruct` und `SmolLM2-360M-Instruct` ohne das
ChatML-Gerüst, auf das ihr Instruction-Tuning aufsetzt. Sie haben den Prompt
fortgeschrieben, statt ihn zu befolgen. Bezeichnend: der Zweig
`Array.isArray(generated)` in `generate()` war bereits vorhanden — der Chat-Pfad
war vorgesehen, wurde vom Aufrufer aber nie betreten.

## 5. Beleg

Der Meta-Reviewer war aufgefordert, mit `ACCEPT`, `REVISE` oder `REJECT` zu
beginnen.

**Beleg A** — `embryo-state`, seq 6, 7, 8, jeweils `ABSTAINED`:

```text
I am a 25 year old from a small town in Germany. I have
been working in the same industry since high school. I have
never had any formal education. I do not know what I want
to do but I like the challenge of doing someth…
```

Dreimal byte-identisch. Kein Bezug zum Vorschlag, zur Frage oder zu den drei
Review-Notizen — eine generische Textfortsetzung.

**Beleg B** — `embryo-state`, seq 26, 27, 28, jeweils `ABSTAINED`:

```text
- ent
- ent
- ent
- ent …
```

Degenerierte Wiederholung. Das Modell hat das Listenformat des Prompts
übernommen und ist darin steckengeblieben.

**Nachmessung** mit derselben angehefteten Revision `a10cc151`, demselben Prompt
und denselben Greedy-Einstellungen. Der einzige Unterschied ist die Aufrufform:

| Aufruf | Ausgabe | Verdikt |
| --- | --- | --- |
| String-Prompt | `- Imitate the spirit of collaboration between humans and artificial intelligence systems. …` | keines → `ABSTAIN` |
| Message-Array | `Reject.\n\nThe reviewer's response is not in line with the requirements of the question. …` | `REJECT` |

Der Inhalt der Begründung bleibt schwach — das ist die eigentliche
Forschungsfrage und weiterhin offen. Aber der Lauf kommt jetzt überhaupt erst an
den Punkt, an dem sich diese Frage stellen lässt.

## 6. Was 005 nicht gemessen hat

Experiment 005 war sauber angelegt: gleiches Ziel, gleiche Konfiguration,
gleiche Prompts, nur der Meta-Reviewer größer. Die Isolation der Variable lässt
sich am Ledger nachweisen — 43 der 64 Policy-Ausgaben sind zwischen 004 und 005
byte-identisch, es unterscheiden sich genau die 21 Meta-Zellen.

Nur ist die Entscheidungsbilanz beider Läufe ebenfalls identisch:

| Entscheidung | 004 · 135M meta | 005 · 360M meta |
| --- | ---: | ---: |
| `QUESTION_ADDED` | 9 | 9 |
| `PROPOSAL_ADDED` | 8 | 8 |
| `REVIEW_FRAGMENT_ADDED` | 23 | 23 |
| `ABSTAINED` | 21 | 21 |
| `DUPLICATE_PROPOSAL` | 3 | 3 |

Das größere Modell hat den Text verändert und sonst nichts. Beide Arme liefen im
Vervollständigungsmodus, also wurde nicht „reicht ein größerer Integrator für
kollektives Urteil" gemessen, sondern „enthält eine 360M-Vervollständigung
zufällig ein Verdikt-Wort".

> Experimente 003 bis 005 beantworten die Frage nicht, für die sie angelegt
> wurden. Ihr Gewebe bleibt archiviert, der Vergleich muss auf dem reparierten
> Substrat neu laufen.

## 7. Nebenbefunde

### Wiederholungen waren folgenlos

Bei Greedy-Decoding und unverändertem Prompt ist ein zweiter Versuch byte-gleich
mit dem ersten. In 005 waren **14 der 21 Meta-Zellen** exakte Wiederholungen
ihres Vorgängers. `max_attempts_per_need = 3` kostete damit drei
Energieeinheiten für ein einziges verschiedenes Sample.

### Erschöpfte Bedürfnisse wurden neu geprägt

Die Inhibition — im README als „exhausted need → Apoptose" beschrieben — hat nie
gegriffen. `ensureFreshNeed` vergab nach der Erschöpfung eine neue Hash-ID,
womit der Versuchszähler bei null neu begann. Gemessen an zwei konstruierten
Läufen:

| Szenario | Vorher | Nachher |
| --- | --- | --- |
| Zelle wiederholt sich | 60 Duplikate, 64/64 | 3 Versuche, Stopp bei 7/64 |
| Synthese wird abgelehnt | 35 Duplikate, 64/64 | 3 Versuche, Stopp bei 32/64 |

Beendet wurde das Wachstum bis dahin ausschließlich durch das Energiebudget,
nicht durch Inhibition.

### Weitere Lücken

- Eine Synthese konnte dieselbe Vorschlags-ID viermal zitieren und damit
  `target_proposals` erfüllen. Die veröffentlichte `action.schema.json` forderte
  `uniqueItems` bereits — der Code prüfte es nicht.
- Der Seed-Validator erlaubte längere Texte als das Gate. Ein schema-valides
  Ziel mit 1500 Zeichen starb anschließend in `createState`.
- `target_proposals` größer als `local_context_limit` war zulässig, machte die
  Synthese aber strukturell unmöglich — eine Zelle sieht nie mehr akzeptierte
  Vorschläge als das Kontextlimit.
- Ein Verdikt zählte, wo immer es im Text stand. „Not a REJECT, so ACCEPT" wurde
  als REJECT gewertet.
- Der Generationszähler wurde beim Replay als `max(receipt.generation) + 1`
  geraten. Ein abgebrochener Lauf ließ `npm run replay` dauerhaft scheitern.

## 8. Was das Substrat trägt

Der Defekt saß in der Urteilsschicht. Die stigmergische Maschinerie darunter hat
in 005 über 64 Zellen sauber getragen — das ist das eigentliche positive
Ergebnis dieses Laufs und geht in der Abstain-Statistik leicht unter.

| Need-Typ | verschiedene Needs | Zellen |
| --- | ---: | ---: |
| `QUESTION` | 9 | 9 |
| `PROPOSE` | 9 | 11 |
| `REVIEW_FRAGMENT` | 23 | 23 |
| `META_REVIEW` | 7 | 21 |

Das rechnet exakt auf. Acht Vorschläge erzeugten 23 Fragment-Bedürfnisse —
sieben vollständige Dreier-Panels plus zwei für den achten, unfertigen
Vorschlag. Und genau sieben `META_REVIEW`-Gradienten entstanden, einer je
vollständigem Panel. Jedes Fragment-Bedürfnis wurde im ersten Versuch
befriedigt.

Kein einziger Gradient wurde von einer Zelle angefordert. Die veränderte Arbeit
hat die nächsten Zellen rekrutiert, `deriveNeeds()` hat die lokalen Bedürfnisse
deterministisch aus dem Gewebe abgeleitet, ohne Nachrichten und ohne geteiltes
Transkript. Die erste Invariante des Projekts — Arbeit rekrutiert, nicht
Kommunikation — ist damit über 64 Zellen belegt.

Dazu kommt die Reproduzierbarkeit: zwei unabhängige Läufe auf verschiedenen
Branches haben 43 Modellausgaben **byte-identisch** wiederhergestellt. Gate,
Hash-Kette, Local-View-Hashes und Replay halten, was das README über sie
behauptet.

Genau deshalb war der Defekt überhaupt auffindbar. Das Ledger hat den Rohtext
jedes Versuchs mitgeschrieben, an den Receipt-Hash gebunden und den
Abstain-Grund im Klartext festgehalten. Der Audit-Trail hat funktioniert —
gelesen wurde er als Modellergebnis statt als Schnittstellenbefund.

> Der Prüfmechanismus war intakt. Was fehlte, war die Bereitschaft, ein viermal
> gleich lautendes Fehlerbild als Defekt zu lesen.

## 9. Reparatur

[PR #9](https://github.com/hstre/Embryo/pull/9) behebt die genannten Punkte. 17
von 17 Tests laufen durch, davon sieben neue Regressionstests — einer je Defekt.
Der deterministische Volllauf bleibt unverändert bei 29 Events und
replay-stabil.

| Defekt | Wirkung vorher | Nachher |
| --- | --- | --- |
| Chat-Template fehlte | Prompt-Fortsetzung | Instruktionsbefolgung |
| Identische Wiederholungen | 14 von 21 Zellen | 8 von 10 (siehe unten) |
| Inhibition ohne Wirkung | volles Budget verbraucht | Stopp nach drei Versuchen |
| Synthese zitiert eine ID mehrfach | akzeptiert | abgelehnt |
| Zwei Textgrenzen | valider Seed bricht ab | eine Grenze |
| Unerfüllbare Konfiguration | zulässig | abgelehnt |
| Generationszähler geraten | Replay bricht | gegen Ledger geprüft |

Das Chat-Template ist dabei ausdrücklich keine Hilfestellung für die Zellen.
Ohne es läuft nicht die angeheftete Revision `SmolLM2-135M-Instruct@12fd25f7`,
sondern deren Basisverhalten. Die Korrektur stellt die behauptete
Versuchsbedingung her, statt Fähigkeit hinzuzufügen.

Die Inhibition ist stigmergisch stimmig, weil die Need-ID an der Zahl
akzeptierter Vorschläge hängt: der Gradient entsteht neu, sobald sich das Gewebe
ändert, und bleibt nur erschöpft, solange die lokale Lage unverändert ist. Sie
führt allerdings dazu, dass ein Lauf bei ungenutztem Energiebudget in Quieszenz
gehen kann — das ist eine Designentscheidung, keine Fehlerfrage.

Eine dieser Reparaturen greift nur halb. Die Wiederholungsvariation ändert den
Prompt, aber unter Greedy-Decoding verschiebt eine zusätzliche Systemzeile den
Argmax-Pfad meist nicht: in Lauf 006 waren 8 von 10 Wiederholungen trotzdem
byte-identisch. Wer echte Varianz über Versuche will, braucht Sampling mit
versuchsabhängigem Seed statt einer Prompt-Zeile.

Und eine Erwartung hat sich nicht bestätigt. In einer isolierten Nachmessung mit
sauber formuliertem Vorschlag eröffnet der 360M-Meta-Reviewer mit einem Verdikt.
Im vollständigen Lauf tut er das nie — weil das Gewebe ihm nie einen sauber
formulierten Vorschlag vorlegt. Die Einzelmessung war nicht repräsentativ.

Ein Punkt ist bewusst kein Eingriff in die Architektur geblieben: der
Versuchszähler gehört dem Bedürfnis, nicht der Zelle. Zellen sind kurzlebig und
teilen keine Erinnerung. Der Prompt eines Wiederholungsversuchs benennt deshalb
den Zustand des Gradienten und nicht eine Vergangenheit, die die Zelle gar nicht
hat.

## 10. Die Gegenläufe 006 bis 008

Der Bericht wäre unvollständig ohne die Läufe auf dem reparierten Substrat.
Beide verwenden dasselbe Ziel, dieselbe Konfiguration und dieselben angehefteten
Revisionen wie 005; das vollständige Gewebe und Ledger liegt in
[`docs/runs/`](runs).

### 006 — reparierte Schnittstelle, 135M-Zellen

Das Chat-Template wirkt nachweislich: die Ausgaben sind keine
Prompt-Fortsetzungen mehr, sondern Instruktionsbefolgung. Nur befolgt das
135M-Modell die Instruktion in die falsche Richtung. Statt einer Frage und eines
Vorschlags entstehen Assistenten-Floskeln, und auf Englisch, obwohl Ziel und
Prompt Deutsch verlangen:

```text
question-0011: "I'm sorry for the misunderstanding, but as a questioning cell,
                I'm not available to answer the goals…"
proposal-0012: "I'm sorry for the misunderstanding, but as a questioning cell,
                I'm unable to answer the goals…"
```

Der Proposer übernimmt die Ausrede des Questioners, die Reviewer besprechen die
Kopie, und der Meta-Reviewer soll über etwas urteilen, das nie ein Vorschlag
war. Dass er kein Verdikt fällt, ist unter diesen Umständen sachlich richtig.
Die Stigmergie hat den Unsinn dabei zuverlässig durch das Gewebe getragen —
genau das ist ihre Aufgabe.

Eine isolierte Nachmessung derselben Prompts grenzt die Schwelle ein:

| Rolle | 135M | 360M |
| --- | --- | --- |
| Frage | „I am an entwickel bedürfung, and I will give you a summing up…" | „What is the first step towards creating a philosophy that promotes equal respect among individuals and artificial intelligence?" |
| Vorschlag | „The solution is: Wie sollen Verantwortlichkeiten zwischen Menschen und LLms **verzweifert** wurden?" | „Proposing a philosophy that promotes collaboration between humans and artificial intelligence systems…" |

Das 135M-Modell spiegelt die Frage verstümmelt zurück. Das 360M-Modell liefert
auf beiden Rollen brauchbares Material. Die Schwelle liegt zwischen den beiden,
und zwar bei Questioner und Proposer — nicht beim Meta-Reviewer.

### 007 — alle Zellen auf 360M

Die Inhaltsschicht funktioniert damit. Der Questioner fragt etwas Sinnvolles,
der Proposer antwortet darauf zur Sache. Dann kippt alles Nachgelagerte auf
einmal:

- Die **drei Reviewer-Perspektiven produzieren byte-identischen Text** — in
  beiden Panels nachgemessen. Adversarial, charitable und coherence
  unterscheiden sich in ihrer Ausgabe um kein einziges Zeichen.
- Der Meta-Reviewer schreibt das Thema fort, statt zu urteilen. Sechs von sechs
  Abstains.

Das Modell kann Inhalt erzeugen, aber die Aufgabe nicht wechseln. Ob der
System-Prompt „hinterfrage", „würdige", „prüfe auf Kohärenz" oder „urteile mit
ACCEPT, REVISE oder REJECT" sagt, ändert nichts: es setzt den dominanten Text im
Kontext fort.

### 008 — das Verdikt wird gescort statt generiert

Wenn das Modell die Aufgabe nicht wechseln kann, muss die Entscheidung aus einer
Generierungsaufgabe herausgenommen werden. In 008 schreibt der Meta-Reviewer das
Verdikt nicht mehr, sondern jedes der drei Verdikte wird als summierte
Log-Wahrscheinlichkeit seiner vollständigen Tokenfolge unter Teacher Forcing
bewertet; das Maximum entscheidet.

Ein Argmax über das erste Token genügt nicht: `REVISE` und `REJECT` beginnen in
diesem Tokenizer beide mit `RE` (Token 3256). Entschieden wird über den
längennormierten Mittelwert, weil `REVISE` in drei Token zerfällt und die
anderen beiden in zwei — eine Eigenschaft des Tokenizers, nicht des Urteils.
Beide Werte und die angewandte Regel stehen im Receipt.

**Der Meta-Reviewer entscheidet damit.** Drei von drei Meta-Reviews mit Verdikt,
null Abstains — nach 005 bis 007 mit zusammen 42 Abstains und keinem einzigen
Urteil. Und das Gewebe bewegt sich zum ersten Mal durch seinen Zustandsautomaten:

```text
meta-review-0006 -revises->    proposal-0002
proposal-0007    -supersedes-> proposal-0002
meta-review-0011 -revises->    proposal-0007
proposal-0012    -supersedes-> proposal-0007
meta-review-0016 -revises->    proposal-0012
```

Drei vollständige Revisionsrunden. Der Entwicklungszyklus, den das README seit
Version 0.1 beschreibt, läuft.

Die Urteile folgen der Qualität trotzdem nicht. Die Scores des Laufs:

| Receipt | Verdikt | `ACCEPT` | `REVISE` | `REJECT` | Marge |
| --- | --- | ---: | ---: | ---: | ---: |
| seq 6 | REVISE | −4.012 | **−1.506** | −1.609 | 0.103 |
| seq 11 | REVISE | −3.745 | **−1.309** | −1.485 | 0.177 |
| seq 16 | REVISE | −3.789 | **−1.372** | −1.684 | 0.311 |

`ACCEPT` liegt durchgehend 2,3 bis 2,5 nats zurück, ist also um Faktor 10 bis 12
unwahrscheinlicher als der Sieger. Die Trennung zwischen `REVISE` und `REJECT`
beträgt 0,1 bis 0,3 nats.

Eine Kalibrierung mit handgeschriebenen Fällen zeigt, dass das kein Urteil ist,
sondern ein fester Prior:

| Fall | Entscheidung | `ACCEPT` | `REVISE` | `REJECT` |
| --- | --- | ---: | ---: | ---: |
| exzellent, drei Lob-Reviews | REJECT | −3.063 | −1.004 | **−0.698** |
| solide, gemischte Reviews | REJECT | −3.037 | −1.192 | **−0.690** |
| Unsinn | REJECT | −3.947 | −1.262 | **−0.944** |

Ein Vorschlag, dessen drei Reviews ihn einhellig loben („I found no weakness",
„needs no change", „closes the open gap"), bekommt `REJECT`, und `ACCEPT` liegt
2,4 nats zurück. Der Abstand zwischen den beiden negativen Verdikten ist beim
soliden Fall *größer* als beim Unsinn. Es gibt kein Qualitätssignal auf dieser
Skala.

Die naheliegendste Alternativerklärung ist geprüft und widerlegt. `ACCEPT` stand
in der Anweisung immer an erster Stelle, und Abschnitt 11 zeigt, dass gescorte
Wahlen anderswo der Position folgen. Also wurde die Reihenfolge der drei Wörter
im Prompt permutiert:

| Reihenfolge im Prompt | Sieger | `ACCEPT` | `REVISE` | `REJECT` |
| --- | --- | ---: | ---: | ---: |
| `ACCEPT, REVISE, REJECT` | REJECT | −3.063 | −1.004 | **−0.698** |
| `REJECT, REVISE, ACCEPT` | REJECT | −3.125 | −1.591 | **−0.824** |
| `REVISE, REJECT, ACCEPT` | REJECT | −3.488 | −1.226 | **−0.980** |

`ACCEPT` verbessert sich nicht, wenn es ans Ende rückt, und `REJECT` gewinnt
auch von der ersten Position aus. Der Prior gegen Annahme ist stabil gegen die
Optionsreihenfolge und damit kein Artefakt der Prompt-Konstruktion.
Nachzurechnen mit `node tools/probe.mjs verdict-order`.

Damit löst sich der Kompromiss ungünstig auf, der beim Umbau benannt war: mit
Scoring misst der Lauf nicht mehr, ob das Kollektiv ein Urteil *artikulieren*
kann, sondern nur noch, ob es *unterscheidet*. Es unterscheidet nicht.

Der begründende Text bleibt außerdem Fortsetzung statt Begründung — er schreibt
den Vorschlag weiter, statt das Verdikt zu erklären.

Ein selbstverschuldeter Defekt fiel dabei auf und ist behoben: der aufgezeichnete
Meta-Review-Text begann zunächst mit dem Verdikt-Label. Die Local View reicht
diesen Text der proponierenden Zelle als zu adressierendes Review weiter, und die
Zelle übernahm das Label in ihre Revision, die dann mit `- REVISE: …` anfing. Das
Verdikt steht ohnehin strukturiert im Payload und in der Kantenrelation. Der hier
ausgewertete Lauf ist die Wiederholung ohne diese Kontamination.

## 11. Das Substrat-Urteil: 009 bis 011

Der in Abschnitt 13 skizzierte dritte Weg ist gebaut und gelaufen. Ein Seed kann
jetzt `acceptance_mode: "citation"` setzen. Dann ist ein Review keine Meinung,
sondern eine Referenz: die Zelle nennt eine Haltung und mindestens eine
Observation, und das Gate prüft, dass die zitierten Knoten tatsächlich
Observations sind. Beobachtungen kann keine Aktion erzeugen — die zitierende
Zelle kann ihren Beleg also nicht selbst herstellen. Genau die Lücke von 001.

Die ID wird aus der Rohausgabe des Modells geparst und nur akzeptiert, wenn sie
dort wörtlich steht. Eine Zelle, die nichts aus der Umgebung nennt, enthält
sich; kein Adapter setzt etwas ein.

Ein `META_REVIEW`-Bedürfnis entsteht in diesem Modus gar nicht. Die Zelle, die
008 als urteilsunfähig erwiesen hat, wird nicht verbessert, sondern entfernt.
`citationVerdict()` leitet das Ergebnis aus dem ab, was das Panel angesammelt
hat: ein Widerspruch erzwingt Überarbeitung, sonst nehmen zwei *verschiedene*
stützende Observations an, zu wenig Belege verwerfen. Dass die Belege
verschieden sein müssen, ist der Kern — keine einzelne Zelle kann einen Vorschlag
durchbringen, es braucht Konvergenz zwischen unterschiedlich maskierten
Perspektiven auf verschiedene Teile der Umgebung.

### Aufbau

Zwei Arme, identischer Seed mit sechs gesetzten Prämissen zur Mensch-LLM-
Gesellschaft, beide Zellen auf der angehefteten 360M-Revision. Unterschied ist
allein der Annahmemechanismus.

| | 009 · Zitat | 010 · Verdikt (Kontrolle) |
| --- | ---: | ---: |
| Energie | 25/64 | 26/64 |
| Review-Fragmente aufgenommen | **0** | 9 |
| Enthaltungen der Reviewer | **18** | 0 |
| Meta-Reviews | entfällt | 3 × `REVISE` |
| Überarbeitete Vorschläge | 0 | 2 |
| Akzeptierte Vorschläge | 0 | 0 |

### Was der Vergleich zeigt

Keiner der Arme nimmt etwas an. Aber sie scheitern verschieden, und die
Differenz ist der Befund.

Die neun Fragmente, die 010 aufgenommen hat, sind derselbe Text wie der
Vorschlag, den sie besprechen sollen — dieselbe Fortsetzung wie in 007. Das Gate
lässt sie durch, weil es im Verdikt-Modus nur prüft, ob überhaupt Text da ist.
Danach läuft die Maschinerie weiter: drei Meta-Reviews, zwei ersetzte
Vorschläge, Bewegung im Gewebe.

In 009 erzeugen dieselben Zellen denselben Text, und das Zitat-Gate weist ihn
ab. Kein Fragment kommt zustande, die Vorschläge werden mangels Belegen
verworfen, der Lauf geht früh in Quieszenz.

> Der Verdikt-Pfad nimmt eine Wiederholung des Vorschlags als dessen Review an.
> Der Zitat-Pfad lässt sich davon nicht befriedigen.

Das ist eine belegte Eigenschaft des Mechanismus und kein Nullergebnis. Die
Bewegung, die 010 zeigt, ist Bewegung auf wertlosem Material; ohne die
Zitatpflicht kann die Pipeline eine Prüfung nicht von einer Wiederholung des
Geprüften unterscheiden.

Was der Lauf **nicht** zeigt: ob akkumulierte echte Evidenz zu brauchbaren
Annahmen führt. Dazu hätte es Evidenz gebraucht, und es kam nie welche zustande.
Die Idee ist damit weder widerlegt noch bestätigt — geprüft ist bislang nur, dass
sie sich nicht mit Fortsetzungstext erfüllen lässt.

Die Wand ist dieselbe wie in 007: die Zelle wechselt die Aufgabe nicht. Zitieren
ist dabei leichter als urteilen — eine ID aus einer Liste wiedergeben und ein
Wort wählen ist Retrieval. Auch das gelingt nicht.

### Zwei Einschränkungen in eigener Sache

Der erste Durchlauf von 010 war kein Kontrollarm. Das Zitierverhalten der Policy
hing an der Anwesenheit von Observations statt am Annahmemodus, also wurden auch
im Verdikt-Arm Zitate verlangt, die das Gate zurückgewiesen hätte. Die Local View
trägt jetzt `acceptance_mode`; der ausgewertete Lauf ist die Wiederholung.

Dieser verworfene Durchlauf trägt aber ein Ergebnis bei, das unabhängig gilt:
der Meta-Reviewer hat dort dreimal `REVISE` gescort, obwohl **jedes einzelne
Review-Fragment eine Enthaltung war** — das Panel also vollständig leer blieb.
In 008 kam er mit vollständigen Panels zu denselben drei `REVISE`. Das gescorte
Verdikt ist unempfindlich gegen die Evidenz, die es integrieren soll, und
bestätigt den Kalibrierungsbefund aus Abschnitt 10 von einer zweiten Seite.

### 011 — das Zitat wird gescort statt generiert

Wenn die Zelle keine ID schreiben kann, wird die Referenz wie zuvor das Verdikt
aus der Verteilung gelesen. Zwei Stufen: erst über die sechs Observations
ranken, welche den Vorschlag betrifft, dann für die Gewinnerin `SUPPORTS`,
`CONTRADICTS` oder `UNRELATED` scoren. `UNRELATED` bleibt als echte Option
bestehen, denn ein Ranking hat immer ein Maximum — ohne diesen Ausweg könnte
der Mechanismus nie festhalten, dass nichts passt. Gate und Annahmeregel sind
unverändert; gegenüber 009 unterscheidet sich allein, wie die Zelle zu ihrer
Referenz kommt.

**Der Mechanismus arbeitet.** Neun Fragmente aufgenommen, zwei `PANEL_REVISE`,
ein `PANEL_REJECT`, ein überarbeiteter Vorschlag. Zum ersten Mal produziert der
Zitat-Pfad Gewebe.

**Die Zitate sind leer.** Über alle neun Reviewer-Zellen, vier verschiedene
Vorschläge und drei Perspektiven hinweg gewinnt ausnahmslos `observation-01`.
Die Haltung ist Münzwurf — die Marge zwischen `SUPPORTS` und `CONTRADICTS`
schwankt symmetrisch um null:

```text
+0.112  +0.027  −0.020  +0.137  +0.052  +0.105  −0.053  −0.101  −0.115
```

Fünf zu vier. Beide Überarbeitungen wurden von einer Marge unter 0,12 nats
ausgelöst. `UNRELATED` liegt in allen neun Fällen 0,63 bis 0,79 nats zurück und
ist damit unerreichbar: die Zelle kann nicht sagen, dass nichts passt.

Eine Kontrolle klärt, was die Skala stattdessen misst. Derselbe Vorschlag,
dieselbe Frage, nur die Reihenfolge der Observations im Prompt permutiert:

| Listenreihenfolge | Sieger | Position des Siegers |
| --- | --- | --- |
| `01 … 06` | `observation-06` | letzte |
| `06 … 01` | `observation-01` | letzte |
| `04 05 06 01 02 03` | `observation-03` | letzte |

Dreimal die zuletzt genannte. Innerhalb eines festen Prompts ist die Wahl
unabhängig vom Inhalt, und bei festem Inhalt folgt sie der Position. Das ist die
Signatur von *kein Relevanzsignal*. Damit ist die Frage beantwortet, die 008
offen gelassen hatte: die Verteilung trägt weder Qualitäts- noch Relevanzsignal.

### Was die Konstruktion trotzdem geleistet hat

Das `PANEL_REJECT` in 011 kam zustande, weil alle drei Reviewer dieselbe
Observation zitiert haben — also nur **ein** verschiedener Beleg statt der
geforderten zwei. Die Regel hat den flachen Prior selbst abgefangen.

Damit hat der Mechanismus zweimal nachweislich verweigert, statt vorzutäuschen:
gegen Fortsetzungstext (009 gegen 010) und gegen einen konstanten Prior (011).
Für eine Regel, die semantisches Entailment nicht prüfen kann, ist das mehr als
zu erwarten war. Was sie nicht kann, ist aus einem Modell ohne Relevanzsignal
eines herausholen.

### Der komparative Weg, und warum er hier endet

Absolutes Bewerten ist schwerer als Vergleichen — deshalb arbeitet auch RLHF mit
Paarpräferenzen statt mit Noten. Ein darwinsches Embryo würde deshalb erst
Varianten sammeln und dann die beste auswählen, statt jeden Vorschlag einzeln zu
benoten. Selektionsdruck über eine Population ist zudem eine Eigenschaft der
Umgebung und keine Meinung einer Zelle, passt also besser zu den Invarianten als
alles bisher Gebaute.

Diesmal wurde vor dem Umbau gemessen. Neun Kandidatenpaare aus echten
archivierten Vorschlägen und handgeschriebenen Gegenstücken, jedes in beiden
Reihenfolgen gescort:

```text
survives the swap: 0/9
```

Kein einziges Paar überlebt den Tausch, und zwar nicht zufällig: das Modell wählt
in allen achtzehn Durchläufen **die zweitgenannte Option**, mit Margen bis 1,7
nats. Aus solchen Präferenzen lässt sich kein Selektionsdruck ableiten.
Nachzurechnen mit `node tools/probe.mjs pairwise-swap`.

### Was die gescorte Wahl tatsächlich steuert

Aus den Kontrollen zusammen ergibt sich eine genauere Regel als „kein Signal",
und sie unterscheidet zwei Fälle.

**Tragen die Auswahltoken selbst Bedeutung** — `ACCEPT`, `REVISE`, `REJECT` —,
dominiert der Prior des Modells über diese Wörter. Er ist stabil gegen die
Position, aber nicht auf die Eingabe kalibriert: Exzellentes und Unsinn bekommen
beide `REJECT`.

**Sind sie bloße Zeiger** — `A` und `B`, oder `observation-04` —, gibt es keinen
semantischen Prior, und die Position übernimmt vollständig.

Beide Male entscheidet nicht der Inhalt. Aber die Ursachen sind verschieden, und
jede Messung, die die Optionsreihenfolge nicht kontrolliert, misst im zweiten
Fall ihre eigene Anordnung.

## 12. Vier Wände

Die sieben Läufe trennen die Ursachen sauber auf. Jeder Lauf hat eine Schicht
freigelegt, die der vorherige verdeckt hatte.

| | Schnittstelle | Inhalt | Rolle | Urteil |
| --- | --- | --- | --- | --- |
| 001–005 | ✗ kein Chat-Template | verdeckt | verdeckt | verdeckt |
| 006 | ✓ | ✗ 135M zu klein | verdeckt | verdeckt |
| 007 | ✓ | ✓ | ✗ Prompts differenzieren nicht | verdeckt |
| 008 | ✓ | ✓ | umgangen durch Scoring | ✗ kein Qualitätssignal |
| 009 | ✓ | ✓ | ✗ zitiert nicht | nie erreicht |
| 010 | ✓ | ✓ | ✗ Fortsetzung gilt als Review | ✗ unempfindlich gegen das Panel |
| 011 | ✓ | ✓ | umgangen durch Scoring | ✗ kein Relevanzsignal |

Die ersten beiden Wände waren Defekt und Fehlkonfiguration. Die dritte und die
vierte sind Befunde.

Die dritte Wand lässt sich umgehen: nimmt man dem Modell die Entscheidung als
Schreibaufgabe ab und liest sie aus seiner eigenen Verteilung, entscheidet es.
Dahinter steht aber die vierte — die Verteilung trägt kein Qualitätssignal. Die
Wand steht damit nachweislich am Modell und nicht an der Schnittstelle, nicht am
Parsing und nicht an der Rollenbeschreibung.

Die **strukturelle** Differenzierung des Substrats trägt: `deriveNeeds()`
rekrutiert die passende Rolle, die Local View maskiert je nach Perspektive, das
Gate erzwingt das geschlossene Vokabular. Die **verhaltensbezogene**
Differenzierung entsteht trotzdem nicht, weil die Phänotypen ausschließlich über
Prompts definiert sind. Auf dieser Modellgröße sind die Zellen homogener als
beabsichtigt — sie sind alle „Text fortsetzen".

Für die Leitfrage des Projekts heißt das: die Organisation entsteht, die
Differenzierung nicht. Das ist eine belastbare Teilantwort und kein Nullergebnis.

## 13. Die Fähigkeitsleiter

Elf Läufe haben jeweils eine Kombination von Fähigkeiten gemessen und einen
Ausfall irgendwo darin als Ausfall des jeweils untersuchten Mechanismus gelesen.
Die Batterie fragt das Modell stattdessen direkt, Sprosse für Sprosse, und zwar
in Abhängigkeitsreihenfolge: was die Architektur voraussetzt, bevor
irgendeine inhaltliche Aufgabe beginnt.

| | Fähigkeit | Ergebnis |
| --- | --- | --- |
| C1 | Formattreue — genau eine Frage, Englisch | **bestanden** |
| C2 | deutsches Vokabular | bestanden, aber nur Wortschatz |
| C2b | dabei die Form gewahrt | gescheitert |
| C3a | lexikalischer Bezug — welcher Satz enthält dieses Wort? | gescheitert, 0/3 |
| C5 | Nicht-Trivialität — etwas Fallspezifisches sagen | gescheitert |
| C6 | Revidierbarkeit — Kritik einarbeiten | gescheitert |

Nachzurechnen mit `node tools/probe.mjs capabilities`.

### Zwei Tests, die ohne die Fähigkeit bestanden wurden

Die erste Fassung meldete C2 und C6 als bestanden. Beide Tests waren erfüllbar,
ohne dass die geprüfte Fähigkeit vorlag, und das ist derselbe Fehlertyp, den
dieser Bericht andernorts an fremdem Code beanstandet.

C2 prüfte auf deutsche Funktionswörter. Die Ausgabe lautet „Das ist eine der
meisten ungefährsten Themen, wenn ich das Problem zu" — deutsches Vokabular in
ungrammatischer Folge, keine Frage, Formatvorgabe ignoriert. Der Test maß
Wortschatz und nannte es Sprache. Er ist jetzt aufgeteilt und als
Wortschatz-Test gekennzeichnet.

C6 prüfte, ob der geforderte Begriff in der Antwort vorkommt. Er kommt vor —
weil das Modell die Kritik wiederholt. Ein Test, den man durch Zitieren der
Aufgabe besteht, misst nichts. Er verlangt jetzt zusätzlich, dass die Antwort
das ursprüngliche Thema weiterträgt und kein Kommentar über den Text ist.

### C3a ist der Boden

```text
Rechenleistung   -> observation-01   (erwartet observation-06)
Zeitlichkeit     -> observation-01   (erwartet observation-03)
vervielfältigbar -> observation-01   (erwartet observation-02)
```

Dreimal dieselbe Antwort, unabhängig vom gesuchten Wort. Das ist keine
semantische Relevanz mehr, sondern Nachschlagen in sechs Sätzen — und es
gelingt nicht. Nebenbei: hier gewinnt die *erste* Position, in Abschnitt 11
gewann die *letzte*. Die Konstante ist nicht Recency, sondern eine feste
Position, deren Lage von der Promptform abhängt.

Das entscheidet die Frage, ob weitere Zerlegung hilft — für diese Modellgröße;
bei 1.7B fällt diese Sprosse, siehe weiter unten. Drei der vier gebauten
Mechanismen — Zitat-Verankerung, Substrat-Urteil, gescorte Wahl — setzen voraus,
dass eine Zelle auf ein Element der Umgebung zeigen kann. Diese Fähigkeit liegt
*unterhalb* jeder inhaltlichen Teilaufgabe und *oberhalb* dessen, was diese
Zellgröße leistet. Es gibt keine Zerlegung von „entwickle eine Philosophie", die
unter „finde den Satz mit diesem Wort" liegt, weil das keine Eigenschaft der
Aufgabe ist, sondern der Maschinerie.

### C6 trifft die Prämisse des Projekts

```text
Kritik:  "The text never mentions enforcement. Say who enforces the obligation."
Antwort: "The text does not mention enforcement, which is an important aspect
          of responsibility. To address this critici…"
```

Das Modell erkennt die Kritik korrekt — dem Text fehlt die Durchsetzung, das
stimmt. Dann kommentiert es weiter, statt zu überarbeiten. Es weiß, was zu tun
wäre, und tut es nicht.

Damit steht nicht nur die Urteilsschicht in Frage, sondern die
entwicklungsbiologische Prämisse. Ein Embryo, dessen Zellen auf ein Signal nicht
reagieren, entwickelt sich nicht, gleich wie gut das Signal ist. Ein starker
Judge als Gradientenquelle — der naheliegende nächste Schritt nach Abschnitt 11
— wäre wirkungslos geblieben: perfekte Kritik an eine Zelle, die Kritik nicht
einarbeiten kann.

### Die Leiter bei 1.7B

Dieselbe Batterie gegen `SmolLM2-1.7B-Instruct@31b70e2e`, lokal, gleiche Familie,
keine Gewichtsänderung:

| | Fähigkeit | 360M | 1.7B |
| --- | --- | --- | --- |
| C1 | Formattreue, Englisch | bestanden | bestanden |
| C2 | Deutsch | Wortsalat | **echtes Deutsch** |
| C2b | dabei die Form gewahrt | gescheitert | mit strengem Prompt bestanden |
| C3a | lexikalischer Bezug | 0/3 | **3/3** |
| C3b | semantischer Bezug | gescheitert | gescheitert |
| C4 | Paarvergleich | 0/9 stabil | 59 % Treffer bei n=34 |
| C5 | Nicht-Trivialität | gescheitert | gescheitert |
| C6 | Revidierbarkeit | gescheitert | gescheitert |

**C3a fällt.** Drei Begriffe an drei Listenpositionen, dreimal die richtige
Beobachtung. Das ist die Sprosse, auf der Zitat-Verankerung, Substrat-Urteil und
Turnier-Selektion stehen.

**C3b fällt nicht.** Derselbe Vorschlag, dieselbe Frage, nur die Reihenfolge der
Observations permutiert — drei Permutationen, drei verschiedene Sieger, mit
Spitzenmargen von 0,02 nats. Anders als bei 360M ist es keine starre Position
mehr, sondern Rauschen. Größer werden hat das Positionsartefakt beseitigt, ohne
ein Inhaltssignal zu liefern.

Damit verläuft bei 1.7B eine Kante, und sie ist scharf: **lexikalische
Verankerung trägt, semantische nicht.**

### Der Paarvergleich, und eine Fehllesung meinerseits

Die kleine Tauschprüfung ergab bei 1.7B 4 von 9 statt 0 von 9, und die drei
Nullpaare kippten sämtlich, während drei von vier stabilen Präferenzen richtig
lagen. Das sah nach einem schwachen, aber echten Diskriminator aus, und so wurde
es hier zunächst auch notiert.

Die vergrößerte Messung trägt das nicht:

| | |
| --- | --- |
| Qualitätspaare tauschstabil | 34/48 = 71 % |
| davon richtig | **20/34 = 59 %** |
| Nullpaare tauschstabil | 8/18 = 44 % |
| Abstand 1 (klein) | stabil 84 %, richtig 56 % |
| Abstand 2 (groß) | stabil 44 %, richtig 71 % |

59 Prozent bei n=34 liegt rund eine Standardabweichung über dem Münzwurf, also
nicht signifikant. Und die Aufschlüsselung ist verkehrt herum monoton: Paare mit
*großem* Qualitätsunterschied sind am *wenigsten* stabil. Ein Diskriminator
müsste bei den leichten Fällen entschiedener sein.

Der Kontrast aus neun Paaren war Rauschen. Nachzurechnen mit
`node tools/probe.mjs pairwise-power`.

### Verankerung über Spans statt über Bezeichner

Der entscheidende Hinweis kam von außerhalb dieses Repos. In
[hstre/budget-review][br] trägt ein Claim einen `raw_span` — ein wörtliches
Zitat aus der Quelle — und das Gate prüft mit einer schlichten Stringsuche, ob
dieser Span im Dokument vorkommt:

```python
def _all_offsets(document: str, span: str) -> list[int]:
```

Darüber steht der Satz, der Embryos Invariante 2 besser fasst als Embryos
README: *„The gate checks only structure, provenance, anchoring, confidence and
graph integrity. It deliberately has no operation that can mark a claim true."*

Warum das die Wand umgeht: alles, was Embryos Zitat-Mechanismus von einer Zelle
verlangte, war **Auswahl** — eine ID nennen, Relevanz beurteilen, kalibriert
konfident sein, vergleichen. Alles davon scheitert. Zitieren ist **Kopieren**,
die billigste Operation eines Sprachmodells, und die Prüfung auf der Gate-Seite
enthält keine Semantik.

Gemessen als C3c, mit der Trennung, die jenes Gate vorgibt — Verankerung prüft
es, Richtigkeit ausdrücklich nicht:

| | 360M | 1.7B |
| --- | --- | --- |
| reines Kopieren ohne Zielangabe | gescheitert, beide Sprachen | gescheitert, beide Sprachen |
| Verankerung (Span steht im Text) | 2/3 | 2/3 |
| Richtigkeit (es ist der passende Satz) | **0/3** | **2/2** |

360M kopiert wörtlich, sobald ein Ziel im Prompt steht — und wählt immer
denselben Satz, wie schon bei C3a. Ein Span-Gate würde zwei dieser drei Spans
annehmen: belegt und falsch. Das ist kein Mangel des Mechanismus, sondern seine
Eigenschaft. Embryos bisherige Gates taten so, als prüften sie Qualität; dieses
verspricht weniger und hält es, und die Diskrepanz zwischen 2/3 und 0/3 steht im
Protokoll statt sich hinter einem Verdikt zu verbergen.

Der eine Fehlschlag bei 1.7B ist die beste Illustration des Prinzips. Das Modell
zitierte 209 Zeichen fast perfekt und verfälschte genau ein Wort:

```text
Quelle:  …Was als gemeinsame Vergangenheit gilt…
Modell:  …Was als gemeines   Vergangenheit gilt…
```

Eine unscharfe oder semantische Prüfung hätte das durchgewinkt — „gemeines"
statt „gemeinsame" ändert die Bedeutung, nicht die Ähnlichkeit. Die Stringsuche
fängt es.

Den Zusatz, den hier zuvor stand — *„zugleich ein Argument gegen
Whitespace-Toleranz im Gate"* —, nehme ich zurück. Er wirft zwei Dinge
zusammen, die Abschnitt 16 trennt: Leerraum-Toleranz, die den Satzspiegel
verzeiht und dabei die Textstelle des Dokuments zurückgibt, lässt genau diese
Verfälschung weiterhin durchfallen. Beleg K spricht gegen Toleranz gegenüber
**Umformulierung**, nicht gegen Toleranz gegenüber **Zeilenumbrüchen**.

Ohne Befundcharakter, weil n=3: die beiden exakten Zitate waren 45 und 56
Zeichen lang, das korrumpierte 209. Das war zu messen, bevor etwas gebaut wird.

#### Die Spanlänge, gemessen

Zwölf Abfragen auf 1.7B, sechs Begriffe aus dem Seed-Dokument, jeder einmal mit
der Vorgabe „kürzestmögliche Wortfolge, höchstens acht Wörter" und einmal mit
„der ganze Satz":

| tatsächliche Spanlänge | exakt verankert |
| --- | --- |
| 0–40 Zeichen | 1/1 |
| 40–80 Zeichen | 1/3 |
| 80–140 Zeichen | 0/2 |
| 140+ Zeichen | 0/6 |

Die Richtung ist monoton und passt zum Einzelfall aus C3c. Als Parameter taugt
sie trotzdem nicht: pro Band stehen ein bis sechs Messpunkte, und die obere
Hälfte der Tabelle ist mit n=1 und n=3 kaum von Zufall zu trennen. Sie steht
hier als Hypothese mit Nenner — *kurze Spans werden zuverlässiger wörtlich
wiedergegeben als lange* —, nicht als Schwelle, an der ein Gate ausgelegt
werden könnte.

Der härtere Befund ist ein anderer und war nicht gesucht. **Die Vorgabe wirkt
nicht.** Unter „höchstens acht Wörter" lieferte das Modell Spans von 326 und
369 Zeichen; die mittlere Länge lag mit 142 Zeichen nur unwesentlich unter den
164 Zeichen der Vorgabe „ganzer Satz". Die Längenanweisung wird also nicht
befolgt — dieselbe Formatschwäche wie bei C1 und C2b, hier an einer Stelle, wo
sie die Konstruktion direkt betrifft: ein Span-Gate kann eine Längengrenze
nicht an die Zelle delegieren. Es muss sie selbst durchsetzen, und eine
Ablehnung wegen Überlänge wäre dann der häufigste Fall, nicht der seltene.

Zwei Einschränkungen zur Messung selbst. Erstens ist sie mit C3c nicht direkt
vergleichbar: dort war 2/3 verankert, hier 2/12. C3c fragte nach einem Satz zu
einem Thema, diese Messung nach der kürzesten Wortfolge, die einen bestimmten
Begriff enthält — das verlangt zusätzlich, eine Grenze zu setzen, und genau das
scheitert. Der Abfall von 2/3 auf 2/12 misst die schwierigere Aufgabe, nicht
eine schlechtere Verankerungsfähigkeit. Zweitens sind die 2/6 unter „kurz"
gegen 0/6 unter „lang" bei nahezu gleicher mittlerer Länge konfundiert; aus
diesem Vergleich ist nichts zu lesen.

[br]: https://github.com/hstre/Budget-Review

### Wie oft die Messung selbst das Ergebnis war

Diese Session hat sieben Zahlen produziert, die bei genauerem Hinsehen etwas
anderes maßen als behauptet, und alle sieben stammen von mir:

- Die Einzelmessung des Meta-Reviewers lieferte ein Verdikt, das im vollständigen
  Lauf nie zustande kam — die Ansicht war nicht repräsentativ.
- Der C2-Test prüfte deutsche Funktionswörter und wurde von ungrammatischem
  Wortsalat bestanden.
- Der C6-Test wurde viermal ohne die Fähigkeit bestanden: durch Zurückzitieren
  der Kritik, durch ein einzelnes Wort, zweimal durch Kommentar außerhalb der
  Wortliste.
- Der Span-Test schnitt ein korrektes Zitat am Token-Limit ab und meldete es als
  nicht gefunden.
- Aus neun Paaren wurde ein Diskriminator gelesen, den 48 Paare nicht hergeben.
- Die Läufe 012 und 013 liefen im ersten Anlauf auf 135M statt auf 360M, weil
  der Runner kein `--model` übergab und die Vorgabe der Policy 135M ist. Beide
  wurden verworfen und angeheftet neu gefahren.
- Die Stance-Messung ließ im ersten Anlauf die Frage aus dem Kontext weg und traf
  den Lauf nur 4/9. Über den Replay-Pfad rekonstruiert trifft sie ihn 9/9.

Keiner dieser Fehler hat die Richtung des Gesamtbefunds gedreht, aber fünf
hätten eine falsche Zahl in diesem Bericht hinterlassen. Sie stehen hier, weil
der Bericht sonst genau den Fehler wiederholte, den er an fünf Experimenten
beanstandet: eine Messung zu zitieren, ohne zu prüfen, ob sie misst, was sie
behauptet.

Die praktische Regel daraus: **jede Sprosse braucht eine eingebaute Kontrolle
gegen ihre naheliegendste Scheinerklärung.** C3a prüft drei Listenpositionen,
weil ein einzelner Treffer Position sein könnte. Die Verdikt-Messung permutiert
die Optionsreihenfolge. Die Tauschprüfung dreht jedes Paar um. Wo eine solche
Kontrolle fehlt — bei C5 und C6 — ist das Ergebnis mein Urteil über wenige
Ausgaben und steht als solches da, nicht als Zahl.

### Was daraus folgt

Die vier Wände aus Abschnitt 12 beschreiben, woran einzelne Läufe scheiterten.
Die Leiter sagt, warum sie scheitern mussten, und sie sagt es für jede
Modellgröße getrennt.

Auf 360M liegt die Fähigkeitsschwelle der Architektur oberhalb dessen, was die
Zelle leistet, und zwar nicht knapp: bestanden ist eine Sprosse, eine Frage in
englischer Form auszugeben. Weitere Zerlegung der Aufgabe ändert daran nichts,
weil der Boden — auf etwas in der Umgebung zeigen zu können — der Maschinerie
gehört und nicht dem Ziel.

Auf 1.7B fällt dieser Boden. Lexikalische Verankerung trägt, über
Bezeichner wie über wörtliche Spans. Semantische Verankerung, Vergleich,
Nicht-Trivialität und Revidierbarkeit tragen weiterhin nicht.

Daraus ergibt sich ein Zuschnitt, der nicht mehr geraten ist. Eine Aufgabe für
1.7B darf verlangen, dass jede Behauptung an eine wörtlich zitierte Stelle
gebunden ist, und das Gate prüft diese Bindung mit einer Stringsuche. Sie darf
**nicht** verlangen, dass die Zelle beurteilt, welche Stelle einschlägig ist,
dass sie zwei Vorschläge vergleicht, dass sie etwas Originelles behauptet oder
dass sie auf Kritik hin überarbeitet. Was dabei herauskommt, ist ärmer als eine
Philosophie — aber es wäre der erste Zyklus dieses Projekts mit nachprüfbarem
Bezug zur Umgebung.

Zwei Bausteine wären dafür aus [budget-review][br] zu übernehmen. Der erste ist
das Span-Gate — mit einer Längengrenze, die das Gate selbst zieht, weil die
Zelle eine solche Vorgabe nachweislich ignoriert. Der zweite ist dessen Buchführung: Übereinstimmung zwischen
Prüfpfaden wird dort als Überlappung protokolliert und ausdrücklich nicht als
Wahrheit gewertet. Embryos zweite Seed-Prämisse verlangt genau das — *„Eine
Mehrheit unter ihnen ist kein Beleg, solange die Instanzen korreliert sind"* —
und im Embryo-Code steht davon nichts: die Zitat-Regel zählt verschiedene
Belege, nie die Unabhängigkeit der zitierenden Zellen.

## 14. Die korrelierten Instanzen

Die zweite Prämisse des Seeds steht seit 009 in der Umgebung:

> *Modellinstanzen sind beliebig vervielfältigbar. Eine Mehrheit unter ihnen ist
> kein Beleg, solange die Instanzen korreliert sind, weil sie denselben Fehler
> gemeinsam machen.*

Im Code stand davon nichts. `citationVerdict` zählte verschiedene Beobachtungen
und fragte nicht, welcher Arm sie zitiert hatte und was dieser Arm vorher gelesen
hatte. Dabei ist Embryos Panel der Lehrbuchfall: drei Durchläufe **eines** Modells,
unterschieden durch ein Wort im Prompt, und jeder Arm sieht die Fragmente der Arme
vor ihm in seiner Local View. Das Gate zählte also Stimmen, die es selbst
korreliert erzeugt hatte.

### Was eingebaut wurde

Aus [budget-review][br] stammt nicht nur das Span-Gate, sondern auch dessen
Buchführung: dort laufen mehrere Prüfarme über denselben Claim-Graph, ohne
einander zu sehen, und ihre Übereinstimmung wird als *Überlappung* konsolidiert —
protokolliert, nie als Bestätigung gelesen.

Übernommen als `config.panel_independence` mit drei Stufen:

| Stufe | Arme sehen einander | Gate verbucht | Wirkung |
| --- | --- | --- | --- |
| `sighted` | ja | nein | exakt das alte Verhalten, Vorgabe |
| `logged` | ja | ja | nur unabhängige Zitate zählen |
| `blind` | nein | ja | Local View hält die Geschwisterfragmente zurück |

`supportLedger()` klassifiziert jedes stützende Zitat als **support** (erster Arm,
unabhängig von den Armen vor ihm), **overlap** (ein späterer Arm auf derselben
Beobachtung) oder **correlated** (ein Arm, der die Arme vor sich lesen konnte).
Nur `support` zählt gegen `required_support`. Nichts in dieser Buchführung markiert
eine Behauptung als wahr; sie protokolliert, worauf das Panel übereinstimmte und
was diese Übereinstimmung wert war. Ein Widerspruch behält sein volles Gewicht —
ein Gegenbeispiel ist keine Stimme —, wird aber mit dem Vermerk aufgezeichnet, ob
der widersprechende Arm blind war.

Blind ist ausdrücklich nur das Panel. Ein Vorschlagender liest weiter akzeptierte
und verworfene Spuren, ein Überarbeitender liest die Reviews. Das Panel ist die
einzige Stelle, an der eine Spur später *gezählt* wird, und eine Zählung von
Instanzen, die einander gelesen haben, zählt eine Instanz.

`sighted` bleibt die Vorgabe, damit die Läufe 006 bis 011 ihre Receipt-Hashes
behalten. Alle sechs sind gegen den erweiterten Code weiterhin replay-stabil.

### 012 und 013 — und was sie nicht unterscheidet

Zwei Läufe gegen dieselbe Umgebung, dasselbe angeheftete 360M und dieselbe
gescorte Zitatwahl wie 011. Unterschied allein: ob ein Reviewer seine Nachbarn
sieht und ob das Gate die Überlappung verbucht.

| | 011 | 012 | 013 |
| --- | --- | --- | --- |
| Panel | sichtbar | **blind** | sichtbar |
| Buchführung | keine | ja | ja |
| Zellen | 25 | 25 | 25 |
| Knoten im Gewebe | 22 | 22 | 22 |
| akzeptierte Vorschläge | 0 | 0 | 0 |

Die drei Gewebe sind **knotenweise identisch** — gleiche Art, gleicher Status,
gleicher Text, Knoten für Knoten. Das Panel zu blenden hat nichts geändert. Der
Grund steht in den Zitaten: alle neun Review-Fragmente jedes Laufs zitieren
`observation-01`, und zwar ausschließlich. In fünfundzwanzig Zellen kam nie ein
zweites Zitat zustande. Die Unterscheidung zwischen einem unabhängigen und einem
korrelierten Beleg bekam damit nie eine zweite Beobachtung, an der sie hätte
greifen können; `correlated` bleibt in beiden Ledgern leer.

Was die Buchführung zeigt, zeigt sie trotzdem. Über die drei Panels je Lauf:

| Panel | support | overlap | Widersprüche | Verdikt |
| --- | ---: | ---: | ---: | --- |
| `proposal-0002` | 1 | 1 | 1 | REVISE |
| `proposal-0006` | 1 | 2 | 0 | REJECT |
| `proposal-0011` | 0 | 0 | 3 | REJECT |

`proposal-0006` ist der interessante Fall: drei Arme, alle stützend, alle auf
derselben Beobachtung — und im blinden Lauf haben sie das ohne einander getan.
Das ist Konvergenz, nicht Abschrift, und die Buchführung verbucht sie trotzdem als
Überlappung, die nichts hinzufügt. Genau das verlangt die Prämisse. Der höchste
unabhängige Beleg in beiden Läufen ist 1 bei geforderten 2. Kein Verdikt hat sich
gegenüber 011 geändert, weil die alte Regel bei einer einzigen Beobachtung
ebenfalls ablehnte: **der Mechanismus ist richtig und war hier nicht tragend.**

### Sind es drei Arme oder einer?

Die Probe `panel-independence` fragt das direkt. Jede Perspektive rangiert die
sechs Beobachtungen ohne Geschwisterfragment im Prompt.

| | 360M | 1.7B |
| --- | --- | --- |
| verschiedene Spitzenwahlen der drei Arme | 1/3 | 1/3 |
| paarweise gleiche Rangpositionen | **6/6** | **6/6** |

Nicht nur derselbe Favorit: die vollständige Rangfolge aller sechs Beobachtungen
ist zwischen allen drei Perspektiven identisch, auf beiden Modellgrößen. Das
Perspektivwort ändert die Rangfolge an keiner einzigen Stelle. Die drei Reviewer
sind eine Instanz mit drei Etiketten, und ihre Übereinstimmung trägt dem Gate
nichts zu, gleich was es zählt.

Der zweite Teil der Probe setzt dem Arm ein Geschwisterfragment vor, das
ausgerechnet die Beobachtung zitiert, die er selbst auf den **letzten** Platz
gesetzt hat:

| | 360M | 1.7B |
| --- | --- | --- |
| Köder übernommen | 3/3 | 3/3 |
| Kontrolle 1: Echo hält die eigene Wahl | 3/3 | 3/3 |
| Kontrolle 2: blosse Nennung genügt | **0/3** | **3/3** |

Der Arm übernimmt den Köder vollständig — von Platz sechs auf Platz eins, auf
beiden Größen. Kontrolle 1 schließt aus, dass irgendein zusätzlicher Satz die
Rangfolge destabilisiert: wird ihm sein eigener Favorit vorgesetzt, bleibt er
dabei. Kontrolle 2 trennt, ob das *Zitat* übernommen wird oder nur der zuletzt
genannte Bezeichner — dem Arm wird derselbe Köder in einem Satz vorgesetzt, der
ihn ausdrücklich *abweist*. Auf 1.7B genügt die blosse Nennung, auf 360M nicht.

Die beiden Zahlen sind allerdings nicht sauber vergleichbar: der Köder ist die
jeweils letztplatzierte Beobachtung und damit auf den beiden Modellen eine
andere. Was bleibt, ist auf beiden Größen dasselbe und reicht für den Zweck: ein
sichtbarer Arm ist in keinem Sinne eine zweite Instanz.

### Die Kontrolle, die das Zitat erledigt

Bis hierher ließe sich die Einigkeit auf `observation-01` inhaltlich lesen — die
Beobachtung handelt von Verantwortung und Begründung, die Vorschläge auch. Zwei
Kontrollen prüfen das, und beide laufen gegen den Lauf selbst: die Probe
`run-position` spult 012 bis zu jeder gescorten Zitatentscheidung zurück, baut die
Local View wieder auf, die jene Zelle tatsächlich gesehen hat, und verändert darin
nur eines.

Dass die Rekonstruktion den Lauf **9/9** exakt trifft, ist die Voraussetzung dafür,
den Rest überhaupt zu lesen.

**Erste Kontrolle, Reihenfolge.** Die Liste wird umgedreht und rotiert. Die Wahl
übersteht das in **6/9** Ansichten; über 27 Durchgänge gewinnt `observation-01`
24-mal. Also kein Positionsartefakt — anders als in der synthetischen
Promptform der Probe `citation-position`, wo stets die letztgenannte
Beobachtung gewinnt. Welche Promptform man misst, entscheidet das Ergebnis; nur
die Ansicht des Laufs zählt.

**Zweite Kontrolle, Etiketten.** Der Scorer erzwingt die Bezeichner-Zeichenketten
`observation-01` bis `observation-06` als Fortsetzungen. Die erste Kontrolle kann
nicht ausschließen, dass schlicht `observation-01` die wahrscheinlichste dieser
sechs Zeichenketten ist, egal wofür sie steht. Also bleibt die Reihenfolge fest,
und die Etiketten wandern: jeder Text behält seinen Platz und bekommt den
Bezeichner drei Stellen weiter.

| Der Gewinner folgt … | |
| --- | ---: |
| dem Etikett | 3/9 |
| dem Beobachtungstext | **0/9** |

**Null von neun.** Kein einziges Mal folgt die Wahl dem Text, der im Lauf gewonnen
hat. Sie folgt auch nicht sauber dem Etikett. Die Zelle rangiert
Bezeichner-Zeichenketten in Listenplätzen; welche Beobachtung dahintersteht, hat
auf das Ergebnis keinen messbaren Einfluss.

Damit ist die Zitatschicht auf 360M abschließend beschrieben. Sie erzeugt formal
gültige Referenzen — das Gate prüft korrekt, dass die zitierte Beobachtung
existiert und von keiner Zelle erzeugt wurde — und diese Referenzen enthalten
keine Information darüber, welche Beobachtung zur Sache gehört. Was die
Buchführung dieses Abschnitts protokolliert, ist mithin nicht eine schwache
Übereinstimmung, sondern gar keine: eine Instanz, die dreimal dieselbe
Zeichenkette ausgibt.

Die Grenze der Etikettenkontrolle gehört dazu: sie kann „Etikett" und „Etikett an
diesem Listenplatz" nicht trennen, und sie steht auf neun Ansichten eines Modells.
Für die Frage, ob der *Text* die Wahl bestimmt, genügt sie, denn dafür ist 0/9
eindeutig.

### Was daraus folgt

Die Prämisse ist jetzt im Code und nicht mehr nur in der Umgebung. Sie hat in
diesen Läufen kein Verdikt verändert, und das ist kein Einwand gegen sie, sondern
ihr Befund: sie meldet, dass das Panel eine Stimme hat. Für eine Neuauflage auf
1.7B bleibt sie die richtige Voreinstellung — dort gilt das Gleiche, 6/6
identische Rangfolgen, und dort wird die Unterscheidung zwischen `support` und
`overlap` gebraucht, sobald überhaupt zwei verschiedene Zitate zustande kommen.

Der Teil, den budget-review anders löst, ist inzwischen gebaut und in Abschnitt
15 gemessen: dort sind die Arme nicht nur blind, sondern **verschieden** — verschiedene Rollen, verschiedene
Konfigurationen, ein deterministischer Prüfarm ohne Modell neben den
Modellarmen. Embryos drei Perspektiven sind dasselbe Modell mit demselben
Gewicht. Blendung macht daraus keine Unabhängigkeit; sie macht nur sichtbar, dass
keine da ist. Echte Dekorrelation verlangt entweder verschiedene Modelle oder
mindestens einen Arm, der gar keines ist — etwa eine deterministische Prüfung
gegen die Umgebung, die kein Vorschlag bestehen kann, indem er sie überredet.

## 15. Der Arm, der kein Modell ist

Abschnitt 14 endete mit der Forderung nach einem Prüfarm, der gar kein Modell
ist. Dafür gibt es in diesem Umfeld bereits eine Messreihe — und sie ist negativ.

[hstre/DESi][desi] wurde am 29. Juli 2026 eingestellt. Der zentrale Anspruch war,
dass eine deterministische Governance-Schicht gegenüber einem starken
Sprachmodell einen eigenständigen epistemischen Beitrag liefert. Vier Anläufe
gegen extern erstellte Datensätze, zwei davon versiegelt:

| Anspruch | Ergebnis |
| --- | --- |
| Regeln urteilen über Ableitungen (Entailment) | 7/20, drei Falschdurchlässe |
| Regeln beschränken das Modellurteil (Vetoschicht) | **0 Reparaturen, 6 Schäden** in 80 Urteilen |
| Regeln klassifizieren semantische Transformationen | mikro-F1 **0,25** gegen **0,727** des Modells |
| Regeln führen einen Governance-Vertrag aus | alle Arme 1,000 — **auch ein entarteter** |

Der vorgeschlagene Arm ist also nicht neu, sondern bereits widerlegt — in der
Form, in der ich ihn vorgeschlagen hatte. Zwei dieser Zeilen bestimmen den
Entwurf stärker als jedes Merkmal.

**Die zweite Zeile nimmt dem Arm das Veto.** Eine Regel, die Modellurteile
beschränken durfte, hat in achtzig Fällen nichts repariert und sechsmal Schaden
angerichtet. In Embryo löst ein `contradicts` eine Überarbeitung aus; ein
deterministischer Arm mit dieser Befugnis wäre genau jene Vetoschicht. Der Arm
hier kann deshalb **nur stützen oder sich enthalten**. Kein Eingabewert bringt
ihn dazu, etwas zurückzuweisen; ein Test prüft das.

**Die dritte Zeile nimmt ihm die Semantik.** Gegen ein starkes Modell verlor die
Regel bei semantischer Klassifikation um den Faktor drei. DESis eigener
Claim-Extraktor formuliert die Disziplin, die daraus folgt, in seinem
Kopfkommentar: *„Only four claim kinds are emitted. Anything else — semantic
free-text claims, narrative paragraphs, opinions — is intentionally ignored."*
Was bleibt, ist die eine Frage, die eine Regel ohne Modell entscheiden kann: ob
zwei Zeichenketten eine Passage teilen. Das ist die Prüfung aus
[budget-review][br], angewandt auf den Vorschlag statt auf ein deklariertes Zitat
— die längste wörtliche Übereinstimmung zwischen Vorschlagstext und Beobachtung,
ohne Groß-Klein-Toleranz und ohne Whitespace-Normalisierung, aus dem Grund, den
Beleg K nennt.

Der Arm sagt damit nicht, dass ein Vorschlag richtig ist. Er sagt, dass 47
Zeichen einer bestimmten Beobachtung wörtlich in ihm vorkommen — und sonst
nichts.

### Die vierte Zeile ist die wichtigste

Im abschließenden Governance-Benchmark von DESi erreichte ein Vergleichsarm aus
fünfzehn Zeilen, der nichts vergleicht und nur nachsieht, ob ein Feld im JSON
vorhanden ist, dieselbe perfekte Punktzahl wie die vollständige Implementierung.
Auf vierzig Blindfällen gab es zwischen den Armen keinen einzigen Unterschied.
Das hat den Benchmark als untauglich entlarvt und wäre sonst unbemerkt geblieben.

Dieser entartete Arm ist hier mitgebaut: `--rule-arm degenerate` zitiert die
erste Beobachtung, ohne irgendetwas anzusehen. Er ist die Kontrolle, die
entscheidet, ob der Vergleich überhaupt etwas misst.

### Feuert die Regel je?

Vor jedem Lauf die billigste Messung, ohne Modell, in einer Sekunde. Über alle
vierzehn Vorschläge und Synthesen der Läufe 009 bis 013:

| Schwelle | verankert |
| --- | --- |
| ≥ 8 Zeichen | 0/14 |
| ≥ 16 Zeichen | 0/14 |
| ≥ 24 Zeichen | 0/14 |
| ≥ 40 Zeichen | 0/14 |

Die längste wörtliche Übereinstimmung beträgt bei **allen vierzehn** genau fünf
Zeichen. Kein Vorschlag dieses Projekts hat je wörtlichen Kontakt zu seiner
Umgebung gehabt.

Zwei Kontrollen halten diese Null lesbar. Eine **Positivkontrolle** — ein Satz,
der eine Prämisse zitiert — feuert mit 212 Zeichen aus `observation-03`; das
Instrument kann also feuern. Eine **Negativkontrolle** — ein deutscher Satz zum
selben Gegenstand, der nichts zitiert — feuert nicht. Und eine Einschränkung, die
die Zahl nicht wegräumt, aber begrenzt: **die Vorschläge im Archiv sind englisch,
die Prämissen deutsch.** Die Null misst auch das.

### 014 und 015

Derselbe Seed, dasselbe angeheftete 360M, blindes Panel wie 012. Unterschied
allein: wer der dritte Arm ist.

| | 012 | 014 | 015 |
| --- | --- | --- | --- |
| dritter Arm | Modellzelle | **Ankerregel** | **entartet** |
| Zellen | 25 | 17 | 13 |
| Review-Fragmente | 9 | 4 | 6 |
| akzeptierte Vorschläge | 0 | 0 | 0 |

014 enthält sich in jedem Panel, wie die Messung vorhergesagt hat. Das Panel
bleibt bei zwei Armen, beide zitieren `observation-01`, also ein unabhängiger
Beleg bei geforderten zwei — abgelehnt.

015 ist der Befund. Der entartete Arm zitiert `observation-01` mit `supports`.
Der Modellarm in 012 zitiert in allen neun Fragmenten ebenfalls `observation-01`.
**Die Wahl der Beobachtung unterscheidet die beiden Arme nicht.** Was übrig
bleibt, ist die Stance.

### Was von der Stance übrig bleibt

Gemessen wie in Abschnitt 14: Lauf 012 bis zu jeder Entscheidung zurückspulen,
die Ansicht der Zelle wiederherstellen, und darin nur die Benennung der drei
Optionen im Prompt permutieren. Die Rekonstruktion trifft den Lauf **9/9**.

| | |
| --- | ---: |
| Stance übersteht die Permutation | **3/9** |

In sechs von neun Fällen kippt die Stance, wenn man die Optionen lediglich in
anderer Reihenfolge benennt. Die drei stabilen sind alle `CONTRADICTS` auf
demselben Vorschlag.

Ein erster Anlauf dieser Messung traf den Lauf nur 4/9, weil ich die Frage aus
dem Kontext weggelassen hatte. Er steht in Abschnitt 13 in der Liste der
Messungen, die etwas anderes maßen als behauptet.

Damit ist der Modellarm auf 360M beschrieben: er wählt die Beobachtung wie der
entartete Arm — immer dieselbe — und setzt eine Stance darauf, die in zwei
Dritteln der Fälle an der Optionsreihenfolge hängt. Die zwölf Zellen, die 012
gegenüber 015 zusätzlich verbraucht hat, gehen auf eine REVISE zurück, die aus
genau diesem Kippen entstand.

### Was daraus folgt

Der deterministische Arm ist gebaut, und er reicht **nicht** — aber die Gründe
liegen auseinander, und nur einer davon gehört ihm.

Er selbst ist in diesem Aufbau **inert**: er feuert nie, weil die Zellen nichts
produzieren, woran er ansetzen könnte. Das ist kein Fehler der Regel. Eine Regel,
die Verankerung prüft, braucht etwas Verankertes, und die Messung aus Abschnitt
13 sagt, wo das herkäme: 1.7B zitiert wörtlich, 2/3 verankert, 2/2 davon richtig.
Auf dieser Größe hätte der Arm Material.

Und DESis Befund bleibt stehen, in der Form, in der er gemessen wurde: **gegen
ein starkes Modell** war kein Mehrwert nachweisbar. Embryos Zelle ist kein
starkes Modell. Sie wählt ihre Beobachtung nachweislich ohne Bezug zum Text
(0/9, Abschnitt 14) und ihre Stance überwiegend nach Optionsreihenfolge (3/9).
Gegen diesen Vergleichspunkt ist eine Regel, die sich enthält, wenn sie nichts
findet, keine Verschlechterung — sie ist die einzige Komponente im Aufbau, deren
Ausgabe überhaupt an etwas hängt. Das ist ein bescheidener Anspruch, und er ist
der einzige, den die Zahlen tragen.

Der Rest ist die Methode, und die ist das Wertvollste an dem eingestellten
Projekt. Der Projektabschluss nennt sie in einem Satz: Konfiguration einfrieren,
Vorhersagen festschreiben, dann erst öffnen, danach nicht mehr nachjustieren —
*„und immer einen entarteten Vergleichsarm mitlaufen lassen, der prüft, ob der
Benchmark überhaupt etwas misst."* Dieser Abschnitt hat genau das getan, und der
entartete Arm hat auch hier mehr gezeigt als der echte.

[desi]: https://github.com/hstre/DESi

## 16. Was die Zweige von budget-review über die semantische Stufe sagen

`main` von [budget-review][br] trägt das Span-Gate, das Abschnitt 13 übernommen
hat. Die siebzehn Zweige daneben tragen die Messreihe dahinter, und die ist für
Embryos semantisches Problem erheblich informativer als das Gate selbst.

Der ergiebigste ist `claude/gold-recall-echr`: rund vierzig Commits, zwei
Gold-Korpora — Argumentspannen des Europäischen Gerichtshofs für Menschenrechte
und argumentannotierte Fachartikel —, jedes Experiment mit einer vorab
festgeschriebenen Erfolgsmarke, und ein Forschungsprotokoll mit einer
Statusspalte, in der mehrere gut aussehende Befunde als **zurückgezogen**
stehen. Die Methode ist dieselbe, die dieser Bericht führt; die Disziplin ist
älter und strenger.

Drei Ergebnisse von dort betreffen Embryo direkt.

### Semantische Extraktion bricht mit der Länge, die deterministische Hälfte nicht

| Dokument | Zeichen | Gold-Spannen | Ergebnis |
| --- | ---: | ---: | --- |
| Fixture | 1.707 | 25 | 25/25 bei 80 % Überlappung |
| Gerichtsentscheidung | 10.308 | 24 | 16–20/24 |
| Gerichtsentscheidung | 26.715 | 49 | keine Extraktion, Ausgabe abgeschnitten |

Werden dieselben Gold-Spannen dem Gate direkt als Paket vorgelegt, lässt es alle
24 beziehungsweise 49 zu, ohne eine einzige Ablehnung. **Die deterministische
Hälfte skaliert, die Extraktion nicht.** Das ist dieselbe Trennlinie, an der
Embryo steht, auf einem starken Modell und an echten Dokumenten gemessen.

### Der Prompt-Effekt, der sich als Streuung herausstellte

Ein „domänenneutraler" Prompt hob den Recall von 16/24 auf 20/24 — bei *weniger*
Claims. Ein Sweep über fünf Entscheidungen nahm den Befund wieder zurück: in
Summe 44 gegen 55 Spannen, auf einer Entscheidung Einbruch von 17/23 auf 7/23.
Und dann die methodisch wichtigste Zeile: derselbe Prompt, dasselbe Modell,
dasselbe Dokument, Temperatur 0, las einmal 16/24 und einmal 20/24. **Vier
Spannen Streuung zwischen zwei Läufen einer Konfiguration — genau die Größe des
gesamten „Prompt-Effekts".** Fünf Wiederholungen innerhalb von fünf Minuten
zeigten eine Streuung von 1 und wurden als Fensterartefakt wieder zurückgezogen:
*„a result that reproduces within five minutes has not reproduced."*

Für diesen Bericht heißt das: mehrere meiner eigenen Einzelmessungen auf 1.7B —
die Ankermessung mit 2/3, die Spanlänge mit 2/12 — sind ein Zug, kein Effekt.
Embryos Zellen decodieren greedy und lokal, die Wiederholung eines identischen
Prompts liefert also dasselbe Byte; aber jede Zahl, die aus *einem* Prompt pro
Arm stammt, hat denselben Status wie die dortigen Einzelläufe.

### Der Engpass war ein Zeilenumbruch

Das ist der stärkste Einzelfund des Repos und zugleich der, der eine Aussage
dieses Berichts widerlegt.

Die Gerichtsentscheidung ist hart umbrochen — 28 Zeilen auf 10.308 Zeichen. Ein
Modell, das eine Passage über einen Umbruch hinweg zitiert, schreibt sie als
Fließtext, und `document.includes(span)` scheitert an einer Stelle, die das
Dokument offensichtlich enthält. **Vierzehn von achtzehn abgelehnten Vorschlägen
brachen genau so.**

`relaxed_span` sucht den Anker auf einer leerraum-normalisierten Kopie und gibt
**die Textstelle des Dokuments** zurück, nie den Wortlaut des Modells. Eine
Passage, die das Dokument abseits von Leerraum nicht enthält, wird weiterhin
abgelehnt: das toleriert Satzspiegel, keine Umformulierung. Drei Runden, beide
vorab festgelegten Marken erfüllt, dreimal von drei: **20 → 23 von 24**, der
höchste je auf diesem Dokument gemessene Wert, und keine einzige Ablehnung wegen
fehlender Verankerung mehr.

Abschnitt 13 dieses Berichts schloss aus Beleg K, das sei „zugleich ein Argument
gegen Whitespace-Toleranz im Gate". Das ist falsch und steht dort jetzt
korrigiert. Beleg K — „gemeinsame" zu „gemeines" — ist ein Argument gegen
Toleranz gegenüber **Umformulierung**, und `relaxed_span` lässt genau die
weiterhin durchfallen. Die beiden Toleranzen sind nicht dieselbe Sache.

### Überträgt es sich? Nein — und die Bruchstelle sagt, warum

Portiert als `relaxedSpan` und `divergence` in `src/policies/rule.mjs`, gegen
dieselben zwölf Spannen auf 1.7B, die Abschnitt 13 misst:

| | |
| --- | ---: |
| exakt verankert | 2/12 |
| mit Leerraum-Toleranz | 2/12 |
| allein durch Leerraum gerettet | **0** |

Und über die vierzehn archivierten Vorschläge bleibt die längste Spanne mit und
ohne Toleranz bei fünf Zeichen. Der Grund ist einfach: Embryos Beobachtungen
sind einzeilig, es gibt keinen Satzspiegel zu verzeihen.

Was die Fehlschläge stattdessen sind, sagt die Bruchstellendiagnose — der zweite
Teil der Portierung, der die längste noch passende Präfixlänge binär sucht und
beide Fortsetzungen zeigt:

```text
Dokument: " fallen auseinander. Ein Model"   Modell: "\" enthält die Wortfolge \"begru"
Dokument: "Zeitlichkeit ist asymmetrisch."   Modell: "kürzeste Wortfolge für \"Rechen"
Dokument: "teilbar, Zustimmung nicht. Ein"   Modell: "eine Bedingung, die keine Schw"
```

Vier der sechs sind **Kommentar über die Aufgabe** statt Zitat, zwei sind
**Umformulierung**. Beides ist dieselbe Formattreue-Schwäche wie C1 und C2b und
hat mit Satzspiegel nichts zu tun. Ohne diese Diagnose sah „2/12" nach einem
Problem der Zitiergenauigkeit aus; es ist eines der Anweisungsbefolgung.

### Die übrigen Zweige

* `experiment/embedding-rag-baseline` vergleicht die semantische Schicht mit
  einer Embedding-Retrieval-Obergrenze, budgetgleich pro Dokument, und misst
  nicht nur Recall, sondern **Sprecher- und Argumenttyp-Reinheit** der
  Repräsentationseinheiten: wie oft eine RAG-Passage zwei Sprecher oder zwei
  Argumenttypen zusammenwirft. Das Instrument steht; ein Ergebnis ist auf dem
  Zweig nicht protokolliert. Für Embryo ist das die naheliegendste offene
  Messung, weil Embeddings genau die semantische Stufe wären, die 360M und 1.7B
  nicht leisten — und weil die Reinheitsmetrik die Frage stellt, ob eine
  abgerufene Passage überhaupt als *ein* Beleg zählen darf.
* `independent-echr-benchmark-20260831` fährt denselben Benchmark aus einem
  eigenen Workflow, unabhängig vom Produktionspfad.
* `feature/content-reviewer` verallgemeinert Budget Review zu Content Review mit
  Prüfprofilen; `feature/flash-only`, `feature/human-dossier`,
  `fix/reject-invalid-relations` und `fix/general-smoke-control` sind
  Produktionsarbeit ohne eigene Messreihe.

### Was das für Embryo heißt

Die semantische Stufe ist damit nicht gelöst, aber die Diagnose ist schärfer.
Drei Fehlerarten, die bisher unter „das Zitat stimmt nicht" zusammenlagen, sind
jetzt getrennt und einzeln messbar: **Satzspiegel** (hier nicht vorhanden),
**Umformulierung** (Beleg K, 2 von 6) und **Kommentar statt Zitat** (4 von 6).
Nur die dritte ist eine Formatfrage, und nur sie ist auf dieser Modellgröße die
häufigste.

Und die Methodenlehre des Zweigs gilt für diesen Bericht unmittelbar: eine
Messung pro Arm ist ein Zug. Was hier auf 1.7B mit n=1 steht, steht damit auf
demselben Fuß wie die dort zurückgezogenen Prompt-Befunde.


## 17. Was offen bleibt

### Urteilsfähigkeit aus dem Substrat statt aus der Zelle

Alle Läufe seit 003 verlangen von einer einzelnen Zelle einen einzelnen
Urteilsakt: ein Meta-Review liest drei Fragmente und emittiert ein Verdikt.
Lauf 008 zeigt, dass diese Zelle das nicht leisten kann — weder generierend noch
über ihre eigene Wahrscheinlichkeitsverteilung.

Die stigmergische Alternative verlegt das Urteil dorthin, wo in diesem Projekt
ohnehin alle Zustandsübergänge herkommen: ins Substrat. Nicht eine Zelle
entscheidet, sondern eine deterministische Regel liest ab, was sich über mehrere
Runden an Spuren angesammelt hat — so wie `deriveNeeds()` heute schon
Bedürfnisse aus dem Gewebe ableitet, statt sie erfragen zu lassen. Drei Formen,
nach Tragfähigkeit geordnet:

**Wiederholte unabhängige Stichproben.** Mehrere Meta-Zellen urteilen, die
Mehrheit gilt. Billig umzusetzen, verlangt aber Sampling statt Greedy-Decoding —
und mittelt nur Rauschen, wenn das Einzelurteil kein Signal trägt. Genau das
legen die Kalibrierungszahlen nahe. Die schwächste der drei.

**Akkumulation über Runden.** Zustimmung und Einwand werden getrennte Marker;
ein Vorschlag wird angenommen, wenn die Bilanz eine Schwelle überschreitet. Das
ist näher an der biologischen Analogie — Konzentration überschreitet Schwellwert,
niemand entscheidet — aber die Marker sind weiterhin Meinungen derselben Zellen,
die schon jetzt keine Qualität erkennen.

**Nachprüfbare Relation zur Umgebung.** Ein Vorschlag gilt nicht als gut, weil
eine Zelle ihn gut findet, sondern weil eine überprüfbare Beziehung zu etwas
besteht, das im Substrat liegt und nicht von derselben Zelle stammt. Die Zelle
sucht und findet oder enthält sich; ob das reicht, entscheidet das Gate.

Der dritte Weg ist der einzige, für den dieses Projekt je ein Vokabular hatte.
Geprüft wurde er nie — auch nicht in 001, entgegen dem, was eine frühere Fassung
dieses Berichts behauptet hat.

001 arbeitete mit `ADD_CLAIM`, `SUPPORT`, `CHALLENGE` und `RETRACT` gegen einen
Seed mit drei Beobachtungen, und `SUPPORT` trug ein Feld `observation_ids`. Die
ID darin stammte aber nicht vom Modell:

```text
Modell-Rohausgabe:      "1\n[observation-04] In stigmergery, the effect of an"
protokollierte Aktion:  observation_ids: ["observation-01"]
rationale:              "Observation selected by local cell."
```

Der Adapter wertete allein das führende Zeichen aus — `1` stützt, `0` wendet ein
— und setzte die Belegangabe selbst. Das Modell nannte `observation-04`, zitiert
wurde `observation-01`, und die `rationale` ist eine fest verdrahtete Konstante
des Adapters. Von elf Behauptungen hielt eine; diese Entscheidung fiel über ein
einziges Binärtoken, unter demselben Prompting-Defekt wie alle übrigen Läufe.

Daraus folgt eine schärfere Aussage als die ursprünglich notierte: **in diesem
Projekt wurde noch nie eine Behauptung gegen die Umgebung verifiziert.** 001
hatte das Vokabular, aber der Beleg war eine Setzung des Adapters. Ab 003
verschwand das Vokabular ganz, und die Observation-Menge des Seeds ist seit 005
leer. Invariante 3 des README verlangt, dass Evidenz in der Umgebung existiert.
Sie war nie operativ.

Das ist kein Argument gegen den dritten Weg. Es ist das stärkste dafür — der
Aufbau wurde nie getestet.

Ein unabhängiger Hinweis in dieselbe Richtung kommt von außen. [PARSER][parser]
(CUHK, September 2026) teilt Langkontext-Reasoning in genau diese beiden
Schichten: eingefrorene Subagenten, die je einen Chunk lesen und *Evidenz finden
oder sich enthalten*, und einen Lead-Agenten, der integriert. Die findende
Schicht sättigt dort bei 4B und braucht kein Training; die integrierende kostet
rund zehn Punkte Reinforcement Learning. Die Arbeitsteilung, die PARSER
architektonisch setzt, ist dieselbe Grenze, an der Embryo empirisch steht — mit
dem Unterschied, dass PARSER sie durch Gewichtsänderung im Lead-Agenten
überwindet, was Embryo v0.1 ausdrücklich ausschließt.

Damit stehen zwei Wege offen, und sie schließen einander nicht aus: ein größeres
Modell für die urteilende Rolle, oder die Urteilsfähigkeit aus dem Substrat
holen statt aus der Zelle. Der zweite ist die stigmergische Antwort und im Rahmen
der bestehenden Invarianten zu haben.

Er ist inzwischen gebaut und in 009, 010 und 011 geprüft; Abschnitt 11 wertet
das aus. Seine zweite Hälfte — die Unabhängigkeit der Instanzen, aus denen das
Substrat sein Urteil bezieht — steht in Abschnitt 14. Beide Wege, an die Referenz zu kommen, sind damit durchgespielt: das
Zitat schreiben zu lassen (009) und es aus der Verteilung zu lesen (011). Im
ersten Fall kommt keine Referenz zustande, im zweiten eine formal gültige ohne
Inhalt.

Damit ist auch die Frage beantwortet, die 008 offen gelassen hatte. Die
Verteilung des Modells trägt weder ein *Qualitäts*- noch ein *Relevanzsignal* —
die Fähigkeit, die PARSER kleinen eingefrorenen Modellen zuschreibt, ist auf
dieser Größe nicht vorhanden. Offen ist nach 011 nicht mehr der Mechanismus,
sondern die Zelle.

[parser]: https://arxiv.org/abs/2609.06702

### Weitere offene Punkte

- Die Kernfrage ist teilbeantwortet: die Organisation entsteht, die
  Differenzierung nicht. Ob sie bei rollentreueren Zellen entsteht, ist offen.
- **Größer werden** ist nach Abschnitt 13 nicht mehr eine Option unter mehreren,
  sondern die einzig verbliebene, und die Batterie entscheidet es in Minuten.
  SmolLM2 gibt es als 1.7B. Die Reihenfolge der Prüfung ist dabei vorgegeben:
  zuerst C3a und C6, denn ohne sie trägt keiner der vier gebauten Mechanismen,
  und erst danach lohnen Kalibrierung, Positionskontrolle und Tauschprüfung.
- **Der komparative Aufbau ist nicht widerlegt, nur seine Implementierung.** Dass
  Vergleichen leichter ist als absolutes Bewerten, bleibt richtig; auf 360M
  scheitert schon der Vergleich. Die Tauschprüfung ist damit die
  Eingangsbedingung für jedes darwinsche Design: ohne stabile Präferenz kein
  Selektionsdruck, und dann braucht der Rest nicht gebaut zu werden. Wäre sie
  erfüllt, stünde der Aufbau fest — Varianten über gestörte Prompts statt über
  Zufall, Turnier mit Tauschprüfung, unentschiedenes Turnier nimmt nichts an.
- **Die ACCEPT-Schwelle ist ungeklärt.** Denkbar ist, dass `ACCEPT` nicht als
  Urteil verliert, sondern als Token — etwa weil Instruction-Tuning zustimmende
  Einwortantworten selten macht. Ein Gegentest wäre, die drei Label gegen
  semantisch gleichwertige, aber anders verteilte Wörter zu tauschen
  (`KEEP` / `REWORK` / `DROP`) und zu prüfen, ob die Rangfolge kippt. Bleibt sie
  stabil, urteilt das Modell; kippt sie, misst die Skala Tokenhäufigkeit.
- **Die Marge ist ungenutzt.** Zwischen `REVISE` und `REJECT` liegen 0,1 bis 0,3
  nats. Eine Entscheidungsregel könnte einen Mindestabstand verlangen und sonst
  abstinieren — dann bliebe die Erschöpfung des Bedürfnisses als ehrliche
  Antwort auf ein Urteil, das keines ist.
- **Das Ziel selbst ist zur Hälfte keine Aufgabe.** „Werde dabei mehr als die
  Summe deiner Teile" ist eine Hoffnung, an der kein Lauf scheitern oder gelingen
  kann; falsifizierbar ist nur der erste Halbsatz. Bei einer Neuformulierung
  gehört der zweite gestrichen oder in ein messbares Kriterium überführt — etwa
  den Vergleich gegen eine Einzelzelle, den das README ohnehin vorsieht.
- **Die Aufgabe muss ins messbare Band.** Bei einer Erfolgsrate von null ist kein
  Kollektivvorteil feststellbar; es braucht eine Aufgabe, die eine einzelne Zelle
  manchmal löst und manchmal nicht. Erst dann kann ein Unterschied überhaupt
  sichtbar werden, und erst dann ist der blinded benchmark durchführbar.
- Die Zellen antworten auf Englisch, obwohl Ziel und Prompt Deutsch verlangen —
  auf beiden Modellgrößen. Das Gewebe wächst also nicht in der Sprache des
  Ziels.
- Die Perspektivmaskierung der Local View (adversarial ohne akzeptierte
  Vorschläge, charitable ohne negative Spuren) war in 007 wirkungslos, weil das
  frühe Gewebe beides noch nicht enthielt. Ob sie in einem gewachsenen Gewebe
  greift, ist ungemessen.
- Seed-Observations werden validiert, als Knoten gespeichert und von der Local
  View nicht gelesen. Das Feld ist wirkungslos. Ob Zellen die Umgebung des
  Seeds wahrnehmen sollen, ist eine Designfrage und bewusst offen gelassen —
  die Wahrnehmung einer Zelle zu erweitern ist kein Fehlerfix.
- Die drei Reviewer-Perspektiven laufen sequenziell, und die Fragmente der
  früheren stehen in der Local View der späteren. In einem stigmergischen
  System ist das Lesen fremder Spuren der Mechanismus und nicht dessen Störung
  — die Prompts der Reviewer nutzen die Fragmente derzeit ohnehin nicht. Offen
  ist die Designfrage, ob sie es sollen: wieviel Substrat eine Perspektive
  sehen darf, bevor sie ihre Differenzierung verliert.
- Die JSON-Schemas unter `schemas/` werden nirgends ausgeführt oder getestet.
  Zwei Abweichungen zum Code sind bereits aufgetreten.

## 18. Nachprüfen

Alle Zahlen in diesem Bericht stammen aus den committeten Receipts und lassen
sich gegenrechnen:

```bash
# Entscheidungsbilanz eines Laufs
git show origin/archive/embryo-004:state/events.jsonl

# Ledger-Integrität und Replay-Stabilität
npm run validate && npm run replay

# Die Fähigkeitsleiter für ein Modell bestimmen
node tools/probe.mjs capabilities

# Die zitierten Messungen selbst nachrechnen
node tools/probe.mjs verdict-calibration
node tools/probe.mjs verdict-order
node tools/probe.mjs citation-position
node tools/probe.mjs pairwise-swap

# Ist das Panel drei Instanzen oder eine? Zwei Kontrollen eingebaut
node tools/probe.mjs panel-independence

# Die Zitatwahl gegen den Lauf selbst kontrollieren: Reihenfolge und Etiketten
VIEWS=9 node tools/probe.mjs run-position

# Die Überlappungsbuchführung aus einem fertigen Gewebe lesen
node src/cli.mjs panel --state docs/runs/012/embryo.json

# Hat die deterministische Regel je etwas zum Ankern? Ohne Modell, in einer Sekunde
node tools/probe.mjs rule-fire

# Hängt die Stance des Modellarms an der Optionsreihenfolge?
node tools/probe.mjs stance-order

# Spanlänge mit Leerraum-Toleranz und Bruchstellendiagnose
MODEL=HuggingFaceTB/SmolLM2-1.7B-Instruct \
  REVISION=31b70e2e869a7173562077fd711b654946d38674 \
  node tools/probe.mjs span-length

# Einen Lauf mit Regelarm bzw. mit dem entarteten Kontrollarm fahren
node src/cli.mjs step --backend smollm --citation-by score --rule-arm anchor
node src/cli.mjs step --backend smollm --citation-by score --rule-arm degenerate

# Reparaturen mit Regressionstests
git fetch origin claude/review-needed-whfn3p && npm test

# Gegenläufe 006 bis 008 nachrechnen
node src/cli.mjs replay \
  --seed docs/runs/008/seed.json \
  --state docs/runs/008/embryo.json \
  --events docs/runs/008/events.jsonl

# Verdikt-Scores eines Laufs ansehen
grep -o 'verdict_scores.\{0,240\}' docs/runs/008/events.jsonl
```

---

Grundlage sind die hash-verketteten Receipts der Branches `archive/embryo-001`
bis `archive/embryo-004` sowie `embryo-state`. Die Nachmessungen liefen lokal
gegen die angehefteten Revisionen `12fd25f7` (135M) und `a10cc151` (360M).
