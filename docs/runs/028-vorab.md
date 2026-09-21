# Vorab festgelegt — Lauf 028

Geschrieben **nach** 027 und 029 und **vor** 028.

## Was 027 und 029 gezeigt haben

Beide liefen das volle Budget von 64 Zellen und akzeptierten **nichts** — über
zwei verschiedene Annahmewege. 027 (Zitat-Annahme) endete in sechzehn
PANEL_REVISE, 029 (Verdikt-Annahme) in zwölf Meta-Reviews, **alle zwölf REVISE**.

Die Differenzierungsmarke ist dabei deutlich erfüllt: das erste Panel von 027
zitiert **drei verschiedene** Beobachtungen mit drei verschiedenen Texten, wo
alle neun Fragmente von 012 dieselbe zitierten. Über den ganzen Lauf werden alle
sechs Beobachtungen zitiert, die Stances stehen bei 23 zu 23.

Für das Ausbleiben jeder Annahme gibt es zwei Erklärungen, und 027 und 029
trennen sie nicht:

1. **Kein Stopp-Kriterium.** Ein fähiger Kritiker findet immer etwas, und die
   Architektur kennt kein „gut genug". Unter Zitat-Annahme genügt ein einziges
   `contradicts` für REVISE; unter Verdikt-Annahme sagt der Meta-Reviewer REVISE
   auch dort, wo seine Begründung mit Lob beginnt.
2. **Abschneiden.** Zwölf der dreizehn Vorschläge von 029 sind 1199 bis 1200
   Zeichen lang — sie stoßen an `max_text_chars`. Die Reviewer beurteilen also
   abgeschnittenen Text, und REVISE wäre dann schlicht richtig. Diese Grenze
   stammt aus der Konfiguration von 012 und war für eine 360M-Zelle bemessen;
   dass sie hier bindet, ist mein Versäumnis.

## Die Änderung

`max_text_chars: 3000`, sonst identisch zu 027. **Nur diese eine Größe.** Die
Regel, die einem einzelnen Widerspruch ein Veto gibt, bleibt unangetastet —
beides zugleich zu ändern machte den Lauf unlesbar.

## Marke

| | Marke |
| --- | --- |
| Annahme | **≥ 1** akzeptierter Vorschlag |
| Abschneiden | **kein** Vorschlag erreicht die neue Grenze |

## Was die beiden Erklärungen vorhersagen

Trifft **Abschneiden** zu, sollte mindestens ein Vorschlag durchkommen, sobald
er vollständig ist. Trifft **kein Stopp-Kriterium** zu, bleibt es bei null, und
die Vorschläge sind dann nachweislich vollständig — womit die Erklärung steht
und nicht mehr vermutet ist.

Ich sage keine der beiden voraus. Beide sind plausibel, und 029 zeigt Lob und
REVISE im selben Meta-Review, was für die erste spricht, während die Länge
sämtlicher Vorschläge für die zweite spricht.
