# Organisation ohne Urteil

**Forschungsbericht zu den Experimenten 001–011**

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

006 bis 010 liefen auf dem reparierten Substrat und sind unten in eigenen
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

## 10. Die Gegenläufe 006 bis 010

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

## 11. Der kontrollierte Test des Substrat-Urteils

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

## 13. Was offen bleibt

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
das aus. Beide Wege, an die Referenz zu kommen, sind damit durchgespielt: das
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
- **Größer werden** ist nach 011 nicht mehr eine Option unter mehreren, sondern
  die verbleibende. SmolLM2 gibt es als 1.7B; das bliebe lokal und klein. Zwei
  Tests stehen bereit: die Kalibrierungsfälle aus Abschnitt 10 — erkennt ein
  größeres Modell den einhellig gelobten Vorschlag als `ACCEPT`? — und die
  Positionskontrolle aus Abschnitt 11: folgt seine Wahl dem Inhalt statt der
  Listenposition? Fällt beides negativ aus, liegt es nicht an der Größe.
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

## 14. Nachprüfen

Alle Zahlen in diesem Bericht stammen aus den committeten Receipts und lassen
sich gegenrechnen:

```bash
# Entscheidungsbilanz eines Laufs
git show origin/archive/embryo-004:state/events.jsonl

# Ledger-Integrität und Replay-Stabilität
npm run validate && npm run replay

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
