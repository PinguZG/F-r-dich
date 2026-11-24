/* Politik – Kurzarbeit Mi 25.11.2026 (Themenliste der Lehrkraft). Quellen: Arbeitsblätter, Infoblatt „Grundrechte im Konflikt“, Schaubilder Gewaltenteilung/Staatsorgane, Musterlösung Grundgesetz, eigene Notizen (PDF „Pug“). Stand der Fakten: 24.11.2026.
   plan:   [{ id, iso, tag, fokus, aufgaben: [[id, Text]], themen: [Thema-IDs für „Karten“-Knöpfe] }]
   themen: [{ id, name, untertitel, sektionen: [{ h, punkte: [] }], karten: [[Frage, Antwort]] }]
   Karten-IDs ergeben sich aus Thema-ID + Position (basis-1, basis-2 …) – bestehende Karten nie umsortieren, nur hinten anhängen. */
window.WIR_POLITIK = {
  fach: 'Politik', anlass: 'Kurzarbeit', datumKurz: 'Mi 25.11.', pruefung: '2026-11-25',
  stand: 'Alles, was laut Lehrkraft gefragt wird: Grundwissen, Rechtsstaat/Demokratie/Gewaltenteilung, Grundgesetz (Art. 1, 20, 79), Grundrechte im Konflikt (Art. 1–5, 8, 14), Karikaturanalyse. Stand der Fakten: 24.11.2026.',
  hinweis: 'Zwei Tage, drei Themen pro Tag. Aufgabe antippen = erledigt. Die Übersichten reichen auf Prüfungsniveau, mit den Karten fragst du dich ab.',
  plan: [
    { id: 'n1', iso: '2026-11-24', tag: 'Di 24.11.', fokus: 'Heute: Grundwissen, Rechtsstaat/Demokratie, Gewaltenteilung',
      themen: ['basis', 'rsdem', 'gewalt'],
      aufgaben: [
        ['n1a', 'Übersicht „Grundwissen“ lesen, dann die Karten dazu'],
        ['n1b', 'Übersicht „Rechtsstaat, Demokratie, Gewaltenteilung“ lesen, dann die Karten'],
        ['n1c', 'Übersicht „Gewaltenteilung“ (horizontal und vertikal, Schaubild) lesen, dann die Karten'],
        ['n1d', 'Alle „Schlecht“-Karten des Tages nochmal']
      ] },
    { id: 'n2', iso: '2026-11-25', tag: 'Mi 25.11.', fokus: 'Prüfungstag: Grundgesetz, Grundrechte im Konflikt, Karikatur',
      themen: ['ggart', 'konfl', 'kari'],
      aufgaben: [
        ['n2a', 'Übersicht „Grundgesetz und Grundrechte“ (Art. 1, 20, 79) lesen, Karten dazu'],
        ['n2b', 'Übersicht „Grundrechte im Konflikt“ (Art. 1–5, 8, 14, Prüfraster) lesen, Karten dazu'],
        ['n2c', 'Übersicht „Karikaturanalyse“ lesen, Karten dazu'],
        ['n2d', 'Alle Themen mit „Alle“ einmal durchgehen, „Schlecht“-Karten zuletzt']
      ] }
  ],
  themen: [
    {
      id: 'basis', name: 'Grundwissen', untertitel: 'Ämter und was Demokratie bedeutet',
      sektionen: [
        { h: 'Wer ist wer', punkte: [
          'Bundespräsident: Frank-Walter Steinmeier (SPD).',
          'Bundeskanzler: Friedrich Merz (CDU/CSU).',
          'Aktuelle Regierung: Koalition aus CDU/CSU und SPD.',
          'Ministerpräsident von Bayern: Markus Söder (CSU).'] },
        { h: 'Was bedeutet Demokratie?', punkte: [
          'Griechisch: „demos“ = Volk, „kratos“ = Herrschaft, also Herrschaft des Volkes.',
          'Art. 20 Abs. 1 GG: Die Bundesrepublik Deutschland ist ein demokratischer und sozialer Bundesstaat.',
          'Art. 20 Abs. 2 GG: Alle Staatsgewalt geht vom Volke aus. Sie wird vom Volke in Wahlen und Abstimmungen und durch besondere Organe der Gesetzgebung, der vollziehenden Gewalt und der Rechtsprechung ausgeübt.'] }
      ],
      karten: [
        ['Wer ist aktuell Bundespräsident?', 'Frank-Walter Steinmeier (SPD).'],
        ['Wer ist aktuell Bundeskanzler?', 'Friedrich Merz (CDU/CSU).'],
        ['Welche Parteien regieren aktuell in Deutschland?', 'Eine Koalition aus CDU/CSU und SPD.'],
        ['Wer ist Ministerpräsident von Bayern?', 'Markus Söder (CSU).'],
        ['Was bedeutet Demokratie?', 'Herrschaft des Volkes (griech. demos = Volk, kratos = Herrschaft).'],
        ['Was sagt Art. 20 Abs. 1 GG?', 'Die Bundesrepublik Deutschland ist ein demokratischer und sozialer Bundesstaat.'],
        ['Was sagt Art. 20 Abs. 2 GG?', 'Alle Staatsgewalt geht vom Volke aus. Sie wird in Wahlen und Abstimmungen und durch besondere Organe der Gesetzgebung, der vollziehenden Gewalt und der Rechtsprechung ausgeübt.']
      ]
    },
    {
      id: 'rsdem', name: 'Rechtsstaat, Demokratie, Gewaltenteilung', untertitel: 'Warum staatliche Macht begrenzt werden muss',
      sektionen: [
        { h: 'Leitfrage: Warum muss staatliche Macht in einer Demokratie begrenzt werden?', punkte: [
          'Ohne Kontrolle könnte eine Regierung willkürlich handeln: eigene Gerichte einsetzen, die Presse zensieren, Kritik verbieten. Bürgerinnen und Bürger und Minderheiten wären schutzlos.',
          'Eine Mehrheit darf nicht alles. Sie ist an Grundrechte, Menschenwürde und Rechtsstaat gebunden.',
          'Deshalb braucht es Demokratie, Rechtsstaat und Gewaltenteilung zusammen.'] },
        { h: 'Die drei Begriffe', punkte: [
          'Demokratie: Bürgerinnen und Bürger wirken an politischen Entscheidungen mit (direkt oder über gewählte Vertreter). Grundrechte müssen geachtet werden.',
          'Rechtsstaat: Staatliches Handeln ist an Recht und Gesetz gebunden. Die Macht des Staates ist durch Verfassung und Gesetze begrenzt, Bürger sind vor Willkür geschützt (unabhängige Gerichte, faire Verfahren).',
          'Gewaltenteilung: Staatliche Macht wird auf verschiedene Bereiche verteilt und kontrolliert, damit nicht eine Person oder Gruppe alles allein entscheidet.'] },
        { h: 'Rechtsstaat: Art. 20 Abs. 3 GG', punkte: [
          'Die Gesetzgebung ist an die verfassungsmäßige Ordnung gebunden, die vollziehende Gewalt und die Rechtsprechung an Gesetz und Recht.',
          'Legislative (Parlamente): müssen sich beim Erlass von Gesetzen an das Grundgesetz und die übrige verfassungsmäßige Ordnung halten (z. B. in Bayern die Bayerische Verfassung).',
          'Exekutive (Regierung und Verwaltung): darf nur auf Grundlage bestehender Gesetze handeln und keine willkürlichen Maßnahmen treffen.',
          'Judikative (Gerichte): sind an geschriebene Gesetze und übergeordnete Rechtsgrundsätze (Gerechtigkeit, Verhältnismäßigkeit) gebunden.'] },
        { h: 'Merkmale einer Demokratie', punkte: [
          'Volkssouveränität: Die Macht geht vom Volk aus (Wahlen, Mitbestimmung, Volksentscheide). Regierung und Parlament entscheiden, weil das Volk ihnen durch Wahlen diese Macht gibt.',
          'Freie, gleiche, geheime, allgemeine und unmittelbare Wahlen; regelmäßig, die Macht ist zeitlich begrenzt.',
          'Mehrparteiensystem und Pluralismus: verschiedene Parteien und Interessen existieren, Opposition ist normal und wichtig.',
          'Gewaltenteilung (Kontrolle statt Machtmissbrauch).',
          'Rechtsstaatlichkeit: Der Staat handelt nur auf Grundlage von Gesetzen, Schutz vor Willkür.',
          'Grundrechte und Menschenwürde: schützen jeden Einzelnen und Minderheiten.',
          'Öffentlichkeit und freie Medien: Politik muss kritisierbar sein, Kontrolle durch Presse und Öffentlichkeit.',
          'Merksatz: Mehrheit entscheidet, aber Rechtsstaat und Grundrechte begrenzen die Mehrheit.'] },
        { h: 'Direkte und repräsentative Demokratie', punkte: [
          'Direkte Demokratie: Bürger entscheiden selbst, z. B. über Gesetze (Volksentscheid, Volksabstimmung, Bürgerentscheid). Funktioniert gut auf überschaubarer, regionaler Ebene. Beispiele: Schweiz, Bayern (z. B. Volksbegehren).',
          'Repräsentative Demokratie: Bürger wählen Abgeordnete, die für sie im Parlament entscheiden und Gesetze beschließen. Wahlen stehen im Zentrum, die Bürger kontrollieren über Wahlen, Öffentlichkeit, Medien und Gerichte. Beispiel: Deutschland.'] }
      ],
      karten: [
        ['Warum muss staatliche Macht in einer Demokratie begrenzt werden?', 'Sonst kann eine Regierung willkürlich handeln (Gerichte, Presse, Kritik kontrollieren) und Bürger und Minderheiten wären schutzlos. Mehrheit ist an Grundrechte und Rechtsstaat gebunden.'],
        ['Definition Demokratie (Arbeitsblatt)?', 'Bürgerinnen und Bürger wirken an politischen Entscheidungen mit, Grundrechte müssen geachtet werden.'],
        ['Definition Rechtsstaat (Arbeitsblatt)?', 'Staatliches Handeln ist an Recht und Gesetz gebunden.'],
        ['Definition Gewaltenteilung (Arbeitsblatt)?', 'Staatliche Macht wird auf verschiedene Bereiche verteilt und kontrolliert.'],
        ['Was regelt Art. 20 Abs. 3 GG?', 'Gesetzgebung ist an die verfassungsmäßige Ordnung gebunden, vollziehende Gewalt und Rechtsprechung an Gesetz und Recht (Rechtsstaat).'],
        ['Woran sind die drei Gewalten nach Art. 20 Abs. 3 gebunden?', 'Legislative: an das Grundgesetz/die verfassungsmäßige Ordnung. Exekutive: nur auf Grundlage von Gesetzen, keine Willkür. Judikative: an Gesetze und Rechtsgrundsätze wie Gerechtigkeit und Verhältnismäßigkeit.'],
        ['Welche Wahlgrundsätze gelten in einer Demokratie?', 'Frei, gleich, geheim, allgemein und unmittelbar.'],
        ['Was bedeutet Volkssouveränität?', 'Die Macht geht vom Volk aus, Regierung und Parlament entscheiden, weil das Volk ihnen die Macht durch Wahlen gibt.'],
        ['Was heißt Mehrparteiensystem und Pluralismus?', 'Verschiedene Parteien und Interessen existieren, Opposition ist normal und wichtig.'],
        ['Warum sind freie Medien in einer Demokratie wichtig?', 'Politik muss kritisierbar sein, Presse und Öffentlichkeit kontrollieren die Macht.'],
        ['Wo liegt die Grenze der Mehrheitsentscheidung?', 'Die Mehrheit entscheidet, ist aber an Grundrechte, Menschenwürde und Rechtsstaat gebunden.'],
        ['Was ist direkte Demokratie? Beispiel?', 'Bürger entscheiden direkt (Volksentscheid, Volksabstimmung). Beispiele: Schweiz, Bayern.'],
        ['Was ist repräsentative Demokratie? Beispiel?', 'Bürger wählen Abgeordnete, die im Parlament entscheiden und Gesetze machen. Beispiel: Deutschland.'],
        ['Wie kontrollieren Bürger in der repräsentativen Demokratie?', 'Über Wahlen, Öffentlichkeit, Medien und Gerichte.']
      ]
    },
    {
      id: 'gewalt', name: 'Gewaltenteilung', untertitel: 'Horizontal und vertikal, wer wählt wen',
      sektionen: [
        { h: 'Horizontale Gewaltenteilung (Schaubild „Gewaltenteilung in der BRD“)', punkte: [
          'Legislative = gesetzgebende Gewalt: Bundestag und Bundesrat.',
          'Exekutive = ausführende/vollziehende Gewalt: Regierung, Verwaltung, Militär, Polizei.',
          'Judikative = rechtsprechende Gewalt: Gerichte (Fachgerichte) und Bundesverfassungsgericht, unabhängig.',
          'Beispiel: Ein Gesetz sagt „Man braucht einen Ausweis“, dann sorgt die Verwaltung dafür, dass man ihn beantragen kann, und die Polizei achtet auf die Einhaltung. Bei Streit entscheiden Gerichte.',
          'Das Bundesverfassungsgericht prüft, ob Gesetze zum Grundgesetz passen.',
          'Gerichte prüfen auch, ob Staat und Behörden sich an die Gesetze halten.'] },
        { h: 'Vertikale Gewaltenteilung = Föderalismus', punkte: [
          'Die Macht ist zwischen Bund und Ländern aufgeteilt (Bundesstaat).',
          'Auf Landesebene gibt es die gleichen Bereiche: Landesregierung, Landtag (Landesparlament), Landesverfassungsgerichte und Landesgerichte.',
          'Das Volk ist die Grundlage von allem (im Schaubild unten).'] },
        { h: 'Staatsorgane und Wahlen (Schaubild)', punkte: [
          'Volk wählt den Bundestag (alle 4 Jahre) und die Landtage (alle 4 oder 5 Jahre, in Bayern 5).',
          'Bundestag wählt den Bundeskanzler (Bundesregierung).',
          'Bundesversammlung wählt den Bundespräsidenten (alle 5 Jahre). Sie besteht aus Mitgliedern des Bundestags und gleich vielen von den Ländern entsandten Mitgliedern.',
          'Bundesrat: Vertretung der Länder, besteht aus Mitgliedern der Landesregierungen.',
          'Bundesverfassungsgericht: Die Richter werden von Bundestag und Bundesrat gewählt.',
          'Landtag wählt den Ministerpräsidenten, der die Landesregierung führt.'] }
      ],
      karten: [
        ['Welche drei Gewalten gibt es?', 'Legislative (gesetzgebend), Exekutive (ausführend), Judikative (rechtsprechend).'],
        ['Wer gehört zur Legislative im Bund?', 'Bundestag und Bundesrat.'],
        ['Wer gehört zur Exekutive?', 'Regierung, Verwaltung, Militär, Polizei.'],
        ['Wer gehört zur Judikative?', 'Gerichte (Fachgerichte) und das Bundesverfassungsgericht, unabhängig.'],
        ['Was ist horizontale Gewaltenteilung?', 'Aufteilung der Staatsgewalt auf Legislative, Exekutive und Judikative.'],
        ['Was ist vertikale Gewaltenteilung?', 'Aufteilung der Macht zwischen Bund und Ländern (Föderalismus).'],
        ['Was prüft das Bundesverfassungsgericht?', 'Ob Gesetze zum Grundgesetz passen.'],
        ['Welche Organe gibt es auf Landesebene?', 'Landesregierung, Landtag und Landesverfassungsgericht.'],
        ['Wer wählt den Bundeskanzler?', 'Der Bundestag.'],
        ['Wer wählt den Bundespräsidenten und wie lange?', 'Die Bundesversammlung, alle 5 Jahre.'],
        ['Wie oft wird der Bundestag gewählt?', 'Alle 4 Jahre, vom Volk.'],
        ['Wer wählt den Ministerpräsidenten?', 'Der Landtag.'],
        ['Was ist der Bundesrat?', 'Die Vertretung der Länder auf Bundesebene (Mitglieder der Landesregierungen), wirkt an der Gesetzgebung mit.'],
        ['Warum gibt es Gewaltenteilung?', 'Damit nicht eine Person oder Gruppe alles allein entscheidet: Machtmissbrauch verhindern, gegenseitige Kontrolle.']
      ]
    },
    {
      id: 'ggart', name: 'Grundgesetz und Grundrechte', untertitel: 'Art. 1, Art. 20, Art. 79 Abs. 3',
      sektionen: [
        { h: 'Grundrechte', punkte: [
          'Grundrechte sind Rechte, die das Grundgesetz dem Einzelnen gegenüber dem Staat garantiert: Freiheitsrechte, Gleichheitsrechte, Unverletzlichkeitsrechte.',
          'Art. 1: Die Menschenwürde ist unantastbar. Der Staat muss sie achten und schützen.',
          'Art. 2: Recht auf Leben und körperliche Unversehrtheit.',
          'Art. 3: Alle Menschen sind vor dem Gesetz gleich.',
          'Warum wichtig? Sie begrenzen die Macht des Staates und schützen vor Willkür. Sie wirken auch im Alltag, z. B. muss ein privater Arbeitgeber Frauen und Männer gleich behandeln.',
          'Der Grundrechtskatalog steht in Art. 1 bis 19 GG. Wird ein Grundrecht eingeschränkt, muss sein Kern (Wesensgehalt) erhalten bleiben (Art. 19 Abs. 2).',
          'Wer seine Grundrechte durch den Staat verletzt sieht, kann Verfassungsbeschwerde beim Bundesverfassungsgericht erheben.'] },
        { h: 'Menschenrechte und Bürgerrechte', punkte: [
          'Menschenrechte stehen allen Menschen zu, z. B. das Recht auf Leben (Art. 2).',
          'Bürgerrechte stehen nach dem GG nur Deutschen zu, z. B. die Versammlungsfreiheit (Art. 8).',
          'Grundrechtsähnliche Artikel stehen außerhalb des Katalogs: z. B. Bundestagswahlrecht (Art. 38) und rechtliches Gehör (Art. 103 Abs. 1).'] },
        { h: 'Die wichtigsten Artikel', punkte: [
          'Art. 1 Abs. 1: „Die Würde des Menschen ist unantastbar. Sie zu achten und zu schützen ist Verpflichtung aller staatlichen Gewalt.“ Sie steht an der Spitze der Verfassungswerte und ist nicht abwägungsfähig.',
          'Art. 1 Abs. 3: Die Grundrechte binden Gesetzgebung, vollziehende Gewalt und Rechtsprechung als unmittelbar geltendes Recht. Alle Staatsgewalten müssen sich an die Grundrechte halten.',
          'Art. 20: legt die Prinzipien Demokratie, Republik, Bundesstaat, Sozialstaat und Rechtsstaat fest.',
          'Art. 79 Abs. 3 („Ewigkeitsklausel“): Eine Änderung des GG, die die Gliederung des Bundes in Länder, die grundsätzliche Mitwirkung der Länder bei der Gesetzgebung oder die Grundsätze der Art. 1 und 20 berührt, ist unzulässig. Auch eine Zweidrittelmehrheit kann sie nicht abschaffen.',
          'Art. 79 Abs. 2: Jede Änderung des GG braucht zwei Drittel der Bundestagsmitglieder und zwei Drittel der Bundesratsstimmen.'] }
      ],
      karten: [
        ['Was sind Grundrechte?', 'Rechte, die das Grundgesetz dem Einzelnen gegenüber dem Staat garantiert (Freiheits-, Gleichheits-, Unverletzlichkeitsrechte).'],
        ['Was steht in Art. 1 Abs. 1 GG?', 'Die Würde des Menschen ist unantastbar. Sie zu achten und zu schützen ist Verpflichtung aller staatlichen Gewalt.'],
        ['Was steht in Art. 2 GG (Kern)?', 'Recht auf Leben und körperliche Unversehrtheit (und freie Entfaltung der Persönlichkeit).'],
        ['Was steht in Art. 3 Abs. 1 GG?', 'Alle Menschen sind vor dem Gesetz gleich.'],
        ['Was sagt Art. 1 Abs. 3 GG?', 'Die Grundrechte binden Gesetzgebung, vollziehende Gewalt und Rechtsprechung als unmittelbar geltendes Recht.'],
        ['Warum sind Grundrechte wichtig?', 'Sie begrenzen die Macht des Staates und schützen vor Willkür.'],
        ['Wo steht der Grundrechtskatalog?', 'In Art. 1 bis 19 GG.'],
        ['Was ist der Unterschied zwischen Menschenrechten und Bürgerrechten?', 'Menschenrechte stehen allen Menschen zu (z. B. Art. 2), Bürgerrechte nur Deutschen (z. B. Versammlungsfreiheit Art. 8).'],
        ['Was legt Art. 20 GG fest?', 'Demokratie, Republik, Bundesstaat, Sozialstaat, Rechtsstaat.'],
        ['Was regelt Art. 79 Abs. 3 GG?', 'Die Ewigkeitsklausel: Die Grundsätze der Art. 1 und 20, die Gliederung in Länder und deren Mitwirkung bei der Gesetzgebung dürfen nicht geändert werden.'],
        ['Welche Mehrheit braucht eine Änderung des GG?', 'Zwei Drittel der Bundestagsmitglieder und zwei Drittel der Bundesratsstimmen.'],
        ['Warum sind Art. 20 und Art. 79 so wichtig?', 'Art. 20 legt die Grundprinzipien fest, Art. 79 Abs. 3 schützt sie dauerhaft, auch eine Zweidrittelmehrheit kann sie nicht abschaffen.'],
        ['Was passiert bei einer Einschränkung eines Grundrechts?', 'Der Wesensgehalt muss erhalten bleiben (Art. 19 Abs. 2).'],
        ['Was kann man tun, wenn der Staat Grundrechte verletzt?', 'Verfassungsbeschwerde beim Bundesverfassungsgericht erheben.']
      ]
    },
    {
      id: 'konfl', name: 'Grundrechte im Konflikt', untertitel: 'Art. 1–5, 8, 14 und das Prüfraster',
      sektionen: [
        { h: 'Die Artikel im Kern', punkte: [
          'Art. 1: Menschenwürde. Sie ist absolut und kann nicht gegen andere Rechte oder durch Verhältnismäßigkeit gerechtfertigt werden.',
          'Art. 2: freie Entfaltung der Persönlichkeit (Abs. 1), Leben und körperliche Unversehrtheit (Abs. 2). Daraus (mit Art. 1) folgt das Recht auf informationelle Selbstbestimmung (Bundesverfassungsgericht, Volkszählungsurteil).',
          'Art. 3: Gleichheit vor dem Gesetz; Männer und Frauen sind gleichberechtigt; niemand darf wegen Geschlecht, Herkunft, Sprache, Glauben, politischer Anschauung oder Behinderung benachteiligt werden.',
          'Art. 4: Glaubens-, Gewissens- und Bekenntnisfreiheit, ungestörte Religionsausübung.',
          'Art. 5: Meinungs-, Informations-, Presse- und Kunstfreiheit. Schranken (Abs. 2): allgemeine Gesetze, Jugendschutz, Recht der persönlichen Ehre. Kunst und Meinung sind nicht dasselbe, Kunstfreiheit ist ein eigenes Grundrecht.',
          'Art. 8: Versammlungsfreiheit. Alle Deutschen dürfen sich friedlich und ohne Waffen versammeln, auch ohne Anmeldung oder Erlaubnis. Für Versammlungen unter freiem Himmel kann ein Gesetz sie einschränken.',
          'Art. 14: Eigentum und Erbrecht werden gewährleistet. Eigentum verpflichtet, sein Gebrauch soll zugleich dem Wohle der Allgemeinheit dienen. Eigentum ist nicht schrankenlos.'] },
        { h: 'Konflikte lösen: Prüfraster in vier Schritten', punkte: [
          '1. Beteiligte und staatliche Maßnahme: Wer handelt, gegen wen, mit welcher Maßnahme?',
          '2. Schutzbereich: Welches Grundrecht ist betroffen (Artikel und Absatz)?',
          '3. Eingriff und Rechtsgrundlage: Liegt ein Eingriff vor? Gibt es eine gesetzliche Grundlage?',
          '4. Verhältnismäßigkeit: legitimer Zweck, Geeignetheit, Erforderlichkeit (kein gleich wirksames milderes Mittel), Angemessenheit.',
          'Wichtig: Die Menschenwürde steht voran als absolute Grenze. Eine festgestellte Verletzung kann nicht durch Verhältnismäßigkeit gerechtfertigt werden.',
          'Eingriffe brauchen immer eine gesetzliche Grundlage, der Staat darf nicht beliebig handeln.'] },
        { h: 'Beispiele für Konflikte', punkte: [
          'Meinungsfreiheit (Art. 5) gegen Ehre/Persönlichkeitsrecht (Art. 2 und 1): Die Meinungsfreiheit endet bei Beleidigung, Jugendschutz und allgemeinen Gesetzen.',
          'Versammlungsfreiheit (Art. 8): Versammlungen sind grundsätzlich erlaubnisfrei, eine Anmeldung ist nicht dasselbe wie eine Erlaubnis. Drohungen von Gegendemonstrierenden sind eine Sicherheitsfrage und staatliche Schutzaufgabe, kein automatischer Verbotsgrund.',
          'Eigentum (Art. 14) gegen Gemeinwohl: Eigentum steht unter einem Gemeinwohlvorbehalt.',
          'Glaubensfreiheit (Art. 4) gegen andere Rechte: Abwägung nach dem Prüfraster.'] }
      ],
      karten: [
        ['Was ist das Besondere an Art. 1 (Menschenwürde) im Konfliktfall?', 'Sie ist absolut und kann nicht gegen andere Rechte oder durch Verhältnismäßigkeit gerechtfertigt werden.'],
        ['Was schützt Art. 2 GG?', 'Freie Entfaltung der Persönlichkeit, Leben und körperliche Unversehrtheit, auch informationelle Selbstbestimmung (mit Art. 1).'],
        ['Was verbietet Art. 3 GG?', 'Benachteiligung wegen Geschlecht, Herkunft, Sprache, Glauben, politischer Anschauung oder Behinderung. Alle sind vor dem Gesetz gleich.'],
        ['Was schützt Art. 4 GG?', 'Glaubens-, Gewissens- und Bekenntnisfreiheit sowie ungestörte Religionsausübung.'],
        ['Was schützt Art. 5 GG?', 'Meinungsfreiheit, Informationsfreiheit, Pressefreiheit und Kunstfreiheit.'],
        ['Welche Schranken hat die Meinungsfreiheit?', 'Allgemeine Gesetze, Jugendschutz und das Recht der persönlichen Ehre (Art. 5 Abs. 2).'],
        ['Sind Kunst und Meinung dasselbe?', 'Nein, die Kunstfreiheit (Art. 5 Abs. 3) ist ein eigenes Grundrecht.'],
        ['Was schützt Art. 8 GG?', 'Die Versammlungsfreiheit: sich friedlich und ohne Waffen zu versammeln, ohne Anmeldung oder Erlaubnis.'],
        ['Braucht man für eine Versammlung eine Erlaubnis?', 'Nein, Versammlungen sind grundsätzlich erlaubnisfrei. Eine Anmeldung ist nicht dasselbe wie eine Erlaubnis.'],
        ['Sind Drohungen von Gegendemonstranten ein Verbotsgrund?', 'Nicht automatisch: Das ist eine Sicherheitsfrage und staatliche Schutzaufgabe.'],
        ['Was schützt Art. 14 GG?', 'Eigentum und Erbrecht. Eigentum verpflichtet und steht unter einem Gemeinwohlvorbehalt.'],
        ['Nenne die vier Schritte des Prüfrasters.', '1. Beteiligte und Maßnahme, 2. Schutzbereich, 3. Eingriff und Rechtsgrundlage, 4. Verhältnismäßigkeit.'],
        ['Was prüft man bei der Verhältnismäßigkeit?', 'Legitimer Zweck, Geeignetheit, Erforderlichkeit (kein milderes gleich wirksames Mittel), Angemessenheit.'],
        ['Was braucht der Staat für einen Eingriff in ein Grundrecht?', 'Eine gesetzliche Grundlage, und er muss verhältnismäßig vorgehen.'],
        ['Was ist eine Schutzpflicht des Staates?', 'Der Staat muss Grundrechte auch gegen Gefahren von Dritten schützen.']
      ]
    },
    {
      id: 'kari', name: 'Karikaturanalyse', untertitel: 'In vier Schritten zur Deutung',
      sektionen: [
        { h: 'Was ist eine Karikatur?', punkte: [
          'Eine Zeichnung, die Personen oder Politik bewusst übertrieben darstellt, um Kritik auszudrücken, oft mit Humor.',
          'Sie zeigt die Meinung des Zeichners, nicht eine neutrale Abbildung.'] },
        { h: 'Vier Schritte (so aufschreiben)', punkte: [
          '1. Formales und Thema: Titel, Zeichner, Quelle, Datum, Thema der Karikatur.',
          '2. Beschreibung: Was ist zu sehen (Personen, Gegenstände, Beschriftung, Sprechblasen)? Ohne zu deuten.',
          '3. Analyse: Welche Mittel nutzt sie? Übertreibung, Symbole, Personifikation, Vergleiche, Ironie, Beschriftungen. Wer oder was steht für wen?',
          '4. Deutung und Bewertung: Was will der Zeichner sagen (Kritik, Forderung)? Wie wirkt es? Meine Meinung, Bezug zu Demokratie, Gewaltenteilung oder Grundrechten.'] },
        { h: 'Satzanfänge für die Prüfung', punkte: [
          'Die Karikatur mit dem Titel … von … erschien … zum Thema …',
          'Im Vordergrund ist … zu sehen, der/die … Im Hintergrund …',
          '… steht symbolisch für … Die Übertreibung von … zeigt, dass …',
          'Der Zeichner kritisiert, dass … / Er will deutlich machen, dass …',
          'Ich stimme der Aussage zu / nicht zu, weil …'] }
      ],
      karten: [
        ['Was ist eine Karikatur?', 'Eine übertrieben gezeichnete Darstellung von Personen oder Politik, die Kritik oder Meinung des Zeichners zeigt, oft mit Humor.'],
        ['Nenne die vier Schritte der Karikaturanalyse.', '1. Formales/Thema, 2. Beschreibung, 3. Analyse (Mittel), 4. Deutung und Bewertung.'],
        ['Was gehört in die Beschreibung?', 'Was zu sehen ist (Personen, Gegenstände, Beschriftung), ohne Deutung.'],
        ['Welche Mittel nutzen Karikaturen?', 'Übertreibung, Symbole, Personifikation, Vergleiche, Ironie, Beschriftungen.'],
        ['Was gehört in die Deutung?', 'Die Aussage des Zeichners (Kritik, Forderung), Wirkung und die eigene Bewertung.'],
        ['Was gehört zu den formalen Angaben?', 'Titel, Zeichner, Quelle, Datum und das Thema.'],
        ['Warum ist eine Karikatur keine neutrale Darstellung?', 'Sie zeigt bewusst übertrieben die Meinung des Zeichners.']
      ]
    }
  ]
};
