/* Politik – Kurzarbeit Mi 25.11.2026 (Themenliste der Lehrkraft). Stand der Fakten: 20.11.2026.
   plan:   [{ id, iso, tag, fokus, aufgaben: [[id, Text]], themen: [Thema-IDs für „Karten“-Knöpfe] }]
   themen: [{ id, name, untertitel, sektionen: [{ h, punkte: [] }], karten: [[Frage, Antwort]] }]
   Karten-IDs ergeben sich aus Thema-ID + Position (grund-1, grund-2 …) – bestehende Karten nie umsortieren, nur hinten anhängen. */
window.WIR_POLITIK = {
  fach: 'Politik', anlass: 'Kurzarbeit', datumKurz: 'Mi 25.11.', pruefung: '2026-11-25',
  stand: 'Stand der Fakten: 20.11.2026. Amtsinhaber bitte kurz vor der Arbeit noch einmal gegenchecken, falls etwas passiert ist.',
  hinweis: 'Fünf Tage, jeden Tag ein Thema, am Ende ein Gesamtdurchlauf. Aufgabe antippen = erledigt.',
  plan: [
    { id: 'd1', iso: '2026-11-20', tag: 'Fr 20.11.', fokus: 'Grundwissen: Wer ist wer?', themen: ['grund'], aufgaben: [
      ['d1a', 'Übersicht „Grundwissen“ lesen (Bundespräsident, Kanzler, Regierung, Ministerpräsident Bayern, Demokratie)'],
      ['d1b', 'Karteikarten „Grundwissen“ einmal komplett durch'],
      ['d1c', 'Alle „Schlecht“-Karten nochmal'] ] },
    { id: 'd2', iso: '2026-11-21', tag: 'Sa 21.11.', fokus: 'Rechtsstaat, Demokratie, Gewaltenteilung (Arbeitsblatt)', themen: ['rechtsstaat'], aufgaben: [
      ['d2a', 'Übersicht „Rechtsstaat und Demokratie“ lesen'],
      ['d2b', 'Arbeitsblatt dazu noch einmal durchgehen'],
      ['d2c', 'Karteikarten „Rechtsstaat und Demokratie“ durch'],
      ['d2d', 'Gestern „Grundwissen“ kurz wiederholen'] ] },
    { id: 'd3', iso: '2026-11-22', tag: 'So 22.11.', fokus: 'Horizontale und vertikale Gewaltenteilung (Präsentation)', themen: ['gewalten'], aufgaben: [
      ['d3a', 'Übersicht „Gewaltenteilung“ lesen'],
      ['d3b', 'Präsentation dazu durchgehen'],
      ['d3c', 'Skizze zeichnen: Bund · Länder · Kommunen und Legislative · Exekutive · Judikative'],
      ['d3d', 'Karteikarten „Gewaltenteilung“ durch'] ] },
    { id: 'd4', iso: '2026-11-23', tag: 'Mo 23.11.', fokus: 'Grundgesetz (Art. 1, 20, 79 Abs. 3) und Grundrechte im Konflikt (Arbeitsblatt)', themen: ['gg', 'konflikt'], aufgaben: [
      ['d4a', 'Übersicht „Grundgesetz“ lesen, Art. 1, 20 und 79 (3) sicher können'],
      ['d4b', 'Arbeitsblatt Grundgesetz durchgehen'],
      ['d4c', 'Übersicht „Grundrechte im Konflikt“ lesen (Art. 1–5, 8, 14)'],
      ['d4d', 'Karteikarten „Grundgesetz“ und „Grundrechte im Konflikt“ durch'] ] },
    { id: 'd5', iso: '2026-11-24', tag: 'Di 24.11.', fokus: 'Karikaturanalyse und alles wiederholen', themen: ['karikatur'], aufgaben: [
      ['d5a', 'Übersicht „Karikaturanalyse“ lesen, die drei Schritte auswendig'],
      ['d5b', 'Eine Karikatur aus dem Unterricht laut analysieren (Beschreibung, Deutung, Beurteilung)'],
      ['d5c', 'Karteikarten „Alle“, nur Schlecht und Okay'],
      ['d5d', 'Früh ins Bett'] ] },
    { id: 'd6', iso: '2026-11-25', tag: 'Mi 25.11.', fokus: 'Kurzarbeit', themen: ['grund'], aufgaben: [
      ['d6a', 'Morgens 10 Minuten: Grundwissen-Karten (Namen und Ämter)'],
      ['d6b', 'Art. 1, 20, 79 (3) in eigenen Worten im Kopf durchgehen'],
      ['d6c', 'Kurzarbeit schreiben'] ] }
  ],
  themen: [
    { id: 'grund', name: 'Grundwissen', untertitel: 'Ämter, Staatsaufbau, Demokratie', sektionen: [
      { h: 'Wer ist wer (Stand 20.11.2026)', punkte: [
        'Bundespräsident: Frank-Walter Steinmeier. Zweite Amtszeit, endet am 18.03.2027. Eine dritte Amtszeit gibt es nicht.',
        'Nachfolge: Die Bundesversammlung wählt den neuen Bundespräsidenten, geplant für Samstag, 30.01.2027. Wer es wird, ist noch offen.',
        'Bundeskanzler: Friedrich Merz (CDU), seit Mai 2025, im zweiten Wahlgang gewählt.',
        'Regierung: Koalition aus CDU/CSU und SPD. Vizekanzler und Finanzminister: Lars Klingbeil (SPD).',
        'Bundestagspräsidentin: Julia Klöckner (CDU), seit März 2025.',
        'Ministerpräsident von Bayern: Markus Söder (CSU). Bayern regiert eine Koalition aus CSU und Freien Wählern.' ] },
      { h: 'Staatsaufbau', punkte: [
        'Deutschland ist laut Art. 20 (1) GG ein demokratischer und sozialer Bundesstaat. Es ist eine parlamentarische Demokratie.',
        'Das Grundgesetz gilt seit dem 23.05.1949. Hauptstadt: Berlin. 16 Bundesländer.',
        'Bundestag: wird für 4 Jahre gewählt. Bundesrat: die Länder wirken bei der Gesetzgebung mit.',
        'Der Bundespräsident ist Staatsoberhaupt und repräsentiert. Die Macht liegt bei Parlament und Regierung. Der Bundeskanzler bestimmt die Richtlinien der Politik.' ] },
      { h: 'Demokratie', punkte: [
        'Demokratie kommt aus dem Griechischen: demos = Volk, kratos = Herrschaft. Also Herrschaft des Volkes.',
        'Art. 20 (2) GG: Alle Staatsgewalt geht vom Volke aus. Das Volk übt sie in Wahlen und Abstimmungen aus und durch besondere Organe der Gesetzgebung, der vollziehenden Gewalt und der Rechtsprechung.',
        'Deutschland ist eine repräsentative Demokratie: Das Volk wählt Abgeordnete, die für es entscheiden. Direkte Beteiligung (Volksentscheid) gibt es vor allem auf Landesebene.' ] }
    ], karten: [
      ['Wer ist aktuell Bundespräsident? Wann endet seine Amtszeit?', 'Frank-Walter Steinmeier. Seine zweite und letzte Amtszeit endet am 18.03.2027. Die Bundesversammlung wählt den Nachfolger, geplant für den 30.01.2027.'],
      ['Wer ist aktuell Bundeskanzler?', 'Friedrich Merz (CDU), seit Mai 2025.'],
      ['Welche Parteien sind aktuell an der Bundesregierung beteiligt?', 'CDU/CSU und SPD (schwarz-rote Koalition). Vizekanzler ist Lars Klingbeil (SPD).'],
      ['Wer ist Ministerpräsident von Bayern?', 'Markus Söder (CSU). Koalition in Bayern: CSU und Freie Wähler.'],
      ['Wer ist Bundestagspräsidentin?', 'Julia Klöckner (CDU).'],
      ['Was bedeutet Demokratie?', 'Herrschaft des Volkes (griechisch demos = Volk, kratos = Herrschaft). Art. 20 (2) GG: Alle Staatsgewalt geht vom Volke aus.'],
      ['Was ist der Unterschied zwischen direkter und repräsentativer Demokratie?', 'Direkt: Das Volk entscheidet selbst (Volksentscheid). Repräsentativ: Das Volk wählt Abgeordnete, die für es entscheiden. Auf Bundesebene gilt die repräsentative.'],
      ['Wie ist Deutschland nach Art. 20 (1) GG verfasst?', 'Als demokratischer und sozialer Bundesstaat.'],
      ['Wer wählt den Bundespräsidenten und für wie lange?', 'Die Bundesversammlung (Bundestagsabgeordnete plus gleich viele von den Landesparlamenten bestimmte Mitglieder). Amtszeit 5 Jahre, einmalige Wiederwahl.'],
      ['Wann ist das Grundgesetz in Kraft getreten?', 'Am 23.05.1949.'],
      ['Wofür ist der Bundesrat da?', 'Er vertritt die Länder und wirkt bei der Gesetzgebung des Bundes mit.']
    ] },
    { id: 'rechtsstaat', name: 'Rechtsstaat und Demokratie', untertitel: 'Merkmale (Arbeitsblatt)', sektionen: [
      { h: 'Merkmale des Rechtsstaats', punkte: [
        'Bindung an Recht und Gesetz (Art. 20 (3) GG): Gesetzgebung an die Verfassung, Regierung und Rechtsprechung an Gesetz und Recht.',
        'Gewaltenteilung: Gesetzgebung, Regierung und Rechtsprechung sind getrennt und kontrollieren sich.',
        'Grundrechte schützen die Bürger vor dem Staat und binden alle staatliche Gewalt (Art. 1 (3) GG).',
        'Unabhängige Gerichte (Art. 97 GG): Richter sind nur dem Gesetz unterworfen.',
        'Rechtsweggarantie (Art. 19 (4) GG): Wer vom Staat in seinen Rechten verletzt wird, kann vor Gericht gehen.',
        'Rechtssicherheit: keine Strafe ohne Gesetz, keine rückwirkende Strafbarkeit (Art. 103 (2) GG).',
        'Verhältnismäßigkeit: Staatliche Eingriffe müssen geeignet, erforderlich und angemessen sein.' ] },
      { h: 'Merkmale der Demokratie', punkte: [
        'Volkssouveränität: Die Macht geht vom Volk aus.',
        'Freie, gleiche, geheime, allgemeine und unmittelbare Wahlen (Art. 38 GG).',
        'Mehrparteiensystem und Opposition. Die Opposition kontrolliert die Regierung.',
        'Mehrheitsprinzip, aber mit Minderheitenschutz.',
        'Meinungs-, Presse- und Versammlungsfreiheit.',
        'Wahl auf Zeit: Regierende können abgewählt werden.' ] },
      { h: 'Zusammenhang', punkte: [
        'Rechtsstaat sorgt dafür, dass der Staat sich an Regeln hält. Demokratie sorgt dafür, dass das Volk bestimmt, wer regiert. Beides zusammen: freiheitlich-demokratische Grundordnung.',
        'Eine Mehrheit darf nicht alles: Grundrechte und die Ewigkeitsklausel (Art. 79 (3)) setzen Grenzen.' ] }
    ], karten: [
      ['Nenne vier Merkmale eines Rechtsstaats.', 'Bindung an Recht und Gesetz, Gewaltenteilung, Grundrechte, unabhängige Gerichte. Dazu: Rechtsweggarantie, Rechtssicherheit, Verhältnismäßigkeit.'],
      ['Was sagt Art. 20 (3) GG?', 'Die Gesetzgebung ist an die verfassungsmäßige Ordnung gebunden. Die vollziehende Gewalt und die Rechtsprechung sind an Gesetz und Recht gebunden.'],
      ['Was bedeutet die Rechtsweggarantie (Art. 19 (4) GG)?', 'Wer durch die öffentliche Gewalt in seinen Rechten verletzt wird, dem steht der Rechtsweg offen. Er kann also vor Gericht klagen.'],
      ['Was bedeutet Verhältnismäßigkeit?', 'Ein Eingriff des Staates muss geeignet (hilft dem Ziel), erforderlich (kein milderes Mittel) und angemessen (Nutzen und Schaden stehen im Verhältnis) sein.'],
      ['Nenne die Wahlgrundsätze nach Art. 38 GG.', 'Allgemein, unmittelbar, frei, gleich, geheim.'],
      ['Was ist der Unterschied zwischen Rechtsstaat und Demokratie?', 'Rechtsstaat: Der Staat ist an Recht und Gesetz gebunden. Demokratie: Das Volk bestimmt, wer regiert. Beides gehört zur freiheitlich-demokratischen Grundordnung.'],
      ['Warum ist Opposition wichtig?', 'Sie kontrolliert die Regierung, zeigt Alternativen auf und sorgt dafür, dass Macht abgegeben werden kann (Machtwechsel).'],
      ['Was heißt Mehrheitsprinzip mit Minderheitenschutz?', 'Die Mehrheit entscheidet, darf aber Grundrechte und die Rechte der Minderheit nicht aufheben.'],
      ['Was bedeutet „nulla poena sine lege“ (Art. 103 (2) GG)?', 'Keine Strafe ohne Gesetz. Eine Tat ist nur strafbar, wenn das vor der Tat gesetzlich bestimmt war (Rückwirkungsverbot).'],
      ['Was bedeutet die Unabhängigkeit der Richter (Art. 97 GG)?', 'Richter sind nur dem Gesetz unterworfen. Weder Regierung noch Parlament dürfen ihnen Urteile vorschreiben.']
    ] },
    { id: 'gewalten', name: 'Gewaltenteilung', untertitel: 'Horizontal und vertikal (Präsentation)', sektionen: [
      { h: 'Idee', punkte: [
        'Montesquieu („Vom Geist der Gesetze“, 1748): Wenn eine Hand alle Macht hat, wird sie missbraucht. Deshalb wird die Macht aufgeteilt und gegenseitig kontrolliert (checks and balances).' ] },
      { h: 'Horizontale Gewaltenteilung (nebeneinander)', punkte: [
        'Legislative (Gesetzgebung): Bundestag, mit Mitwirkung des Bundesrats.',
        'Exekutive (vollziehende Gewalt): Bundesregierung und Verwaltung.',
        'Judikative (Rechtsprechung): Gerichte, an der Spitze das Bundesverfassungsgericht.',
        'In Deutschland sind die Gewalten verschränkt: Der Kanzler wird vom Bundestag gewählt, die Regierung stützt sich auf die Mehrheit im Parlament. Kontrolliert wird durch Opposition, Untersuchungsausschüsse und das Bundesverfassungsgericht.',
        'Die Medien gelten als „vierte Gewalt“. Das ist aber keine Gewalt im Sinne des Grundgesetzes.' ] },
      { h: 'Vertikale Gewaltenteilung (übereinander)', punkte: [
        'Ebenen: Bund, Länder, Kommunen. Das ist der Föderalismus.',
        'Art. 30 und 70 GG: Staatliche Aufgaben sind Sache der Länder, soweit das Grundgesetz nichts anderes sagt.',
        'Bundesrat: Die Länder wirken an Gesetzen des Bundes mit (Zustimmungs- und Einspruchsgesetze).',
        'Art. 28 (2) GG: Gemeinden haben das Recht der kommunalen Selbstverwaltung.',
        'Vorteile: Macht ist verteilt, Entscheidungen sind näher an den Menschen, Länder können eigene Wege gehen. Nachteil: Abstimmung dauert länger.' ] }
    ], karten: [
      ['Wer hat die Gewaltenteilung beschrieben?', 'Montesquieu, „Vom Geist der Gesetze“ (1748).'],
      ['Nenne die drei Gewalten und je ein Organ in Deutschland.', 'Legislative: Bundestag. Exekutive: Bundesregierung. Judikative: Gerichte (z. B. Bundesverfassungsgericht).'],
      ['Was ist horizontale Gewaltenteilung?', 'Die Aufteilung der Staatsgewalt nebeneinander: Gesetzgebung, vollziehende Gewalt und Rechtsprechung.'],
      ['Was ist vertikale Gewaltenteilung?', 'Die Aufteilung der Macht auf mehrere Ebenen: Bund, Länder und Kommunen (Föderalismus).'],
      ['Warum gibt es Gewaltenteilung?', 'Um Machtmissbrauch zu verhindern. Die Gewalten kontrollieren und begrenzen sich gegenseitig (checks and balances).'],
      ['Wie sind die Gewalten in Deutschland verschränkt?', 'Der Bundestag wählt den Kanzler, die Regierung stützt sich auf die Parlamentsmehrheit. Die Kontrolle übernehmen Opposition, Untersuchungsausschüsse und das Bundesverfassungsgericht.'],
      ['Welche Rolle hat der Bundesrat bei der vertikalen Gewaltenteilung?', 'Er vertritt die Länder und wirkt bei Bundesgesetzen mit (Zustimmungs- und Einspruchsgesetze).'],
      ['Was regelt Art. 28 (2) GG?', 'Die kommunale Selbstverwaltung: Gemeinden regeln die Angelegenheiten vor Ort in eigener Verantwortung.'],
      ['Wer ist im Zweifel für staatliche Aufgaben zuständig, Bund oder Länder? (Art. 30, 70 GG)', 'Die Länder, soweit das Grundgesetz dem Bund nichts zuweist.'],
      ['Warum werden die Medien „vierte Gewalt“ genannt?', 'Sie kontrollieren Politik durch Berichterstattung. Es ist aber keine Gewalt im Sinne des Grundgesetzes.']
    ] },
    { id: 'gg', name: 'Grundgesetz', untertitel: 'Art. 1, Art. 20, Art. 79 (3)', sektionen: [
      { h: 'Art. 1 – Menschenwürde', punkte: [
        '(1) Die Würde des Menschen ist unantastbar. Sie zu achten und zu schützen ist Verpflichtung aller staatlichen Gewalt.',
        '(2) Das deutsche Volk bekennt sich zu unverletzlichen und unveräußerlichen Menschenrechten.',
        '(3) Die Grundrechte binden Gesetzgebung, vollziehende Gewalt und Rechtsprechung als unmittelbar geltendes Recht.',
        'Entstehung: Antwort auf die Verbrechen des Nationalsozialismus.' ] },
      { h: 'Art. 20 – Staatsstrukturprinzipien', punkte: [
        '(1) Die Bundesrepublik Deutschland ist ein demokratischer und sozialer Bundesstaat. (Demokratie, Sozialstaat, Bundesstaat. Dazu: Republik und Rechtsstaat.)',
        '(2) Alle Staatsgewalt geht vom Volke aus. Sie wird vom Volke in Wahlen und Abstimmungen und durch besondere Organe der Gesetzgebung, der vollziehenden Gewalt und der Rechtsprechung ausgeübt.',
        '(3) Die Gesetzgebung ist an die verfassungsmäßige Ordnung gebunden, die vollziehende Gewalt und die Rechtsprechung an Gesetz und Recht.',
        '(4) Widerstandsrecht: Gegen jeden, der es unternimmt, diese Ordnung zu beseitigen, haben alle Deutschen das Recht zum Widerstand, wenn andere Abhilfe nicht möglich ist.' ] },
      { h: 'Art. 79 – Änderung des Grundgesetzes', punkte: [
        '(2) Eine Änderung braucht eine Zweidrittelmehrheit im Bundestag und im Bundesrat.',
        '(3) Ewigkeitsklausel: Unzulässig ist eine Änderung, die die Gliederung des Bundes in Länder, die grundsätzliche Mitwirkung der Länder bei der Gesetzgebung oder die in Art. 1 und Art. 20 niedergelegten Grundsätze berührt.',
        'Sinn: Die Demokratie soll sich nicht mit demokratischen Mitteln selbst abschaffen können. Hintergrund ist das Ende der Weimarer Republik.' ] }
    ], karten: [
      ['Was sagt Art. 1 (1) GG?', 'Die Würde des Menschen ist unantastbar. Sie zu achten und zu schützen ist Verpflichtung aller staatlichen Gewalt.'],
      ['Was regelt Art. 1 (3) GG?', 'Die Grundrechte binden Gesetzgebung, vollziehende Gewalt und Rechtsprechung als unmittelbar geltendes Recht.'],
      ['Was regelt Art. 1 (2) GG?', 'Das Bekenntnis zu unverletzlichen und unveräußerlichen Menschenrechten als Grundlage jeder Gemeinschaft, des Friedens und der Gerechtigkeit.'],
      ['Was steht in Art. 20 (1) GG?', 'Die Bundesrepublik Deutschland ist ein demokratischer und sozialer Bundesstaat.'],
      ['Was steht in Art. 20 (2) GG?', 'Alle Staatsgewalt geht vom Volke aus. Sie wird in Wahlen und Abstimmungen und durch besondere Organe der Gesetzgebung, der vollziehenden Gewalt und der Rechtsprechung ausgeübt.'],
      ['Was steht in Art. 20 (3) GG?', 'Bindung der Gesetzgebung an die verfassungsmäßige Ordnung, der vollziehenden Gewalt und der Rechtsprechung an Gesetz und Recht.'],
      ['Was regelt Art. 20 (4) GG?', 'Das Widerstandsrecht: Alle Deutschen dürfen Widerstand leisten gegen jeden, der die Ordnung beseitigen will, wenn keine andere Abhilfe möglich ist.'],
      ['Was ist die Ewigkeitsklausel? Wo steht sie?', 'Art. 79 (3) GG. Änderungen, die die Gliederung in Länder, die Mitwirkung der Länder bei der Gesetzgebung oder die Grundsätze aus Art. 1 und 20 berühren, sind unzulässig.'],
      ['Welche Mehrheit braucht man, um das Grundgesetz zu ändern?', 'Zweidrittelmehrheit im Bundestag und im Bundesrat (Art. 79 (2) GG).'],
      ['Wozu dient die Ewigkeitsklausel?', 'Sie schützt die Grundordnung, damit die Demokratie nicht mit demokratischen Mitteln abgeschafft werden kann (Lehre aus dem Ende der Weimarer Republik).'],
      ['Welche Staatsstrukturprinzipien stecken in Art. 20?', 'Demokratie, Sozialstaat, Bundesstaat, Republik und Rechtsstaat.']
    ] },
    { id: 'konflikt', name: 'Grundrechte im Konflikt', untertitel: 'Art. 1–5, 8 und 14', sektionen: [
      { h: 'Die Grundrechte im Überblick', punkte: [
        'Art. 1: Menschenwürde. Unantastbar, wird nicht gegen andere Rechte abgewogen.',
        'Art. 2: Freie Entfaltung der Persönlichkeit, Recht auf Leben und körperliche Unversehrtheit, Freiheit der Person.',
        'Art. 3: Gleichheit vor dem Gesetz. Männer und Frauen sind gleichberechtigt. Niemand darf wegen Geschlecht, Abstammung, Rasse, Sprache, Heimat und Herkunft, Glauben, religiöser oder politischer Anschauungen oder wegen einer Behinderung benachteiligt oder bevorzugt werden.',
        'Art. 4: Glaubens-, Gewissens- und Bekenntnisfreiheit, ungestörte Religionsausübung, Recht auf Kriegsdienstverweigerung.',
        'Art. 5: Meinungs-, Informations-, Presse- und Rundfunkfreiheit, Kunst- und Wissenschaftsfreiheit. Eine Zensur findet nicht statt. Schranken: allgemeine Gesetze, Jugendschutz, Recht der persönlichen Ehre.',
        'Art. 8: Versammlungsfreiheit. Alle Deutschen dürfen sich friedlich und ohne Waffen versammeln. Bei Versammlungen unter freiem Himmel kann das durch Gesetz beschränkt werden.',
        'Art. 14: Eigentum und Erbrecht werden gewährleistet. Eigentum verpflichtet, sein Gebrauch soll zugleich dem Wohle der Allgemeinheit dienen. Enteignung nur zum Wohle der Allgemeinheit, durch Gesetz und gegen Entschädigung.' ] },
      { h: 'Wenn Grundrechte kollidieren', punkte: [
        'Grundrechte sind nicht grenzenlos. Wo die Freiheit des einen die Rechte anderer berührt, muss abgewogen werden.',
        'Lösung: praktische Konkordanz. Beide Grundrechte sollen möglichst weitgehend erhalten bleiben, keines wird einfach „weggewischt“.',
        'Prüfung der Verhältnismäßigkeit: geeignet, erforderlich, angemessen.',
        'Schranken: Viele Grundrechte stehen unter Gesetzesvorbehalt (der Gesetzgeber darf sie einschränken). Der Wesensgehalt darf nie angetastet werden (Art. 19 (2) GG).',
        'Die Menschenwürde (Art. 1) ist absolut geschützt.',
        'Im Streitfall entscheiden die Gerichte, am Ende das Bundesverfassungsgericht.' ] },
      { h: 'Typische Konflikte', punkte: [
        'Meinungsfreiheit (Art. 5) gegen Persönlichkeitsrecht/Ehre (Art. 1, 2): Kritik ja, Beleidigung und Hetze nein.',
        'Versammlungsfreiheit (Art. 8) gegen Rechte Dritter, z. B. Eigentum (Art. 14) oder Bewegungsfreiheit (Art. 2): Demos dürfen eingeschränkt werden, wenn Gefahr droht.',
        'Kunstfreiheit (Art. 5) gegen Persönlichkeitsrecht (Art. 1, 2): Satire darf viel, aber nicht die Würde verletzen.',
        'Glaubensfreiheit (Art. 4) gegen Gleichberechtigung (Art. 3): z. B. bei religiösen Kleidungsvorschriften oder Ausnahmen vom Unterricht.',
        'Eigentum (Art. 14) gegen Sozialbindung: z. B. bei Mietpreisbremse oder Enteignung für Straßenbau.' ] }
    ], karten: [
      ['Was schützt Art. 1 GG und was ist daran besonders?', 'Die Menschenwürde. Sie ist unantastbar und wird nicht gegen andere Rechte abgewogen.'],
      ['Was schützt Art. 2 GG?', 'Freie Entfaltung der Persönlichkeit, Leben, körperliche Unversehrtheit und Freiheit der Person.'],
      ['Was schützt Art. 3 GG?', 'Gleichheit vor dem Gesetz, Gleichberechtigung von Männern und Frauen, Verbot der Benachteiligung z. B. wegen Geschlecht, Herkunft, Glauben, politischer Anschauung oder Behinderung.'],
      ['Was schützt Art. 4 GG?', 'Glaubens-, Gewissens- und Bekenntnisfreiheit, ungestörte Religionsausübung und das Recht, den Kriegsdienst mit der Waffe zu verweigern.'],
      ['Was schützt Art. 5 GG?', 'Meinungs-, Informations-, Presse- und Rundfunkfreiheit sowie Kunst und Wissenschaft. Zensur findet nicht statt.'],
      ['Wo sind die Schranken der Meinungsfreiheit (Art. 5 (2))?', 'In den allgemeinen Gesetzen, den Vorschriften zum Jugendschutz und im Recht der persönlichen Ehre.'],
      ['Was schützt Art. 8 GG?', 'Die Versammlungsfreiheit: Alle Deutschen dürfen sich friedlich und ohne Waffen versammeln.'],
      ['Wie kann die Versammlungsfreiheit eingeschränkt werden?', 'Bei Versammlungen unter freiem Himmel durch Gesetz oder aufgrund eines Gesetzes, z. B. bei Gefahr für Dritte.'],
      ['Was regelt Art. 14 GG?', 'Eigentum und Erbrecht sind gewährleistet. Eigentum verpflichtet. Enteignung nur zum Wohle der Allgemeinheit, durch Gesetz und gegen Entschädigung.'],
      ['Wie löst man einen Konflikt zwischen zwei Grundrechten?', 'Durch Abwägung (praktische Konkordanz): Beide Rechte sollen möglichst weit erhalten bleiben. Geprüft wird die Verhältnismäßigkeit.'],
      ['Was darf bei einer Einschränkung eines Grundrechts nie angetastet werden?', 'Der Wesensgehalt des Grundrechts (Art. 19 (2) GG).'],
      ['Welches Grundrecht wird nicht gegen andere abgewogen?', 'Die Menschenwürde (Art. 1 (1) GG). Sie ist unantastbar.'],
      ['Nenne ein Beispiel für einen Konflikt Meinungsfreiheit gegen Persönlichkeitsrecht.', 'Kritik an einer Person ist erlaubt. Beleidigung oder Hetze verletzen deren Ehre und sind nicht durch Art. 5 gedeckt.'],
      ['Wer entscheidet am Ende über Grundrechtskonflikte?', 'Die Gerichte, in letzter Instanz das Bundesverfassungsgericht (Verfassungsbeschwerde).']
    ] },
    { id: 'karikatur', name: 'Karikaturanalyse', untertitel: 'Beschreiben, deuten, beurteilen', sektionen: [
      { h: 'Was ist eine politische Karikatur?', punkte: [
        'Eine Zeichnung, die ein politisches Thema oder Personen überspitzt darstellt, um Kritik zu üben. Sie zeigt immer eine Meinung des Zeichners, keine neutrale Abbildung.' ] },
      { h: 'Schritt 0 – Einleitung', punkte: [
        'Titel, Zeichner, Quelle (Zeitung), Datum, Thema in einem Satz. Beispiel: „Die Karikatur von … aus der … vom … thematisiert …“' ] },
      { h: 'Schritt 1 – Beschreiben (neutral, nur Sichtbares)', punkte: [
        'Was ist zu sehen? Personen, Gegenstände, Orte, Beschriftungen, Sprechblasen.',
        'Wer ist dargestellt? Woran erkennt man die Person oder Gruppe?',
        'Wie ist das Bild aufgebaut (Vordergrund, Hintergrund, Größenverhältnisse)?',
        'Noch keine Wertung und keine Deutung.' ] },
      { h: 'Schritt 2 – Deuten (analysieren)', punkte: [
        'Politischer Hintergrund: Auf welches Ereignis oder Problem bezieht sich die Karikatur?',
        'Was bedeuten die Symbole (z. B. Waage, Adler, Tonne, Schiff)? Wofür stehen die Personen?',
        'Stilmittel: Übertreibung, Verfremdung, Vergleich/Metapher, Personifikation, Symbolik, Ironie.',
        'Was sagt der Text (Titel, Beschriftung)?',
        'Was ist die Aussage? Was will der Zeichner kritisieren?' ] },
      { h: 'Schritt 3 – Beurteilen (Stellung nehmen)', punkte: [
        'Welche Position vertritt der Zeichner? Wie wirkt die Karikatur (Wirkung auf die Betrachter)?',
        'Ist die Darstellung angemessen oder zu einseitig und überspitzt?',
        'Eigene Meinung begründet: Stimme ich zu? Warum (nicht)? Mit Argumenten und politischem Wissen.' ] }
    ], karten: [
      ['Was ist eine politische Karikatur?', 'Eine überspitzte Zeichnung zu einem politischen Thema oder Personen, die Kritik üben will und eine Meinung des Zeichners zeigt.'],
      ['Welche Schritte hat eine Karikaturanalyse?', 'Einleitung (Titel, Zeichner, Quelle, Datum, Thema), 1. Beschreiben, 2. Deuten, 3. Beurteilen.'],
      ['Was gehört in die Einleitung?', 'Titel, Zeichner, Quelle, Datum und das Thema in einem Satz.'],
      ['Was gehört in die Beschreibung?', 'Nur das Sichtbare: Personen, Gegenstände, Beschriftungen, Aufbau. Keine Deutung und keine Wertung.'],
      ['Was gehört in die Deutung?', 'Politischer Hintergrund, Bedeutung der Symbole und Personen, Stilmittel, Aussage und Kritik des Zeichners.'],
      ['Was gehört in die Beurteilung?', 'Position des Zeichners, Wirkung, Angemessenheit und die eigene begründete Meinung.'],
      ['Nenne vier Stilmittel von Karikaturen.', 'Übertreibung, Symbolik, Verfremdung, Personifikation (auch Vergleich/Metapher, Ironie).'],
      ['Warum ist eine Karikatur nicht neutral?', 'Sie will Kritik üben und zeigt die Meinung des Zeichners. Deshalb gehört zur Analyse auch die Frage, wie einseitig sie ist.'],
      ['Mit welchen Satzanfängen kann man deuten?', '„Der Zeichner stellt … als … dar, um zu zeigen, dass …“ · „… steht symbolisch für …“ · „Die Übertreibung verdeutlicht …“.']
    ] }
  ]
};
