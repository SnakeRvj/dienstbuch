// FF Christdorf Dienstbuch – Jahresbericht für die Jahreshauptversammlung (Druck / PDF)
// (klassische Skriptdatei: alle Funktionen sind global und werden von den anderen Dateien genutzt)

    function jahresberichtSchliessen() {
      document.getElementById('berichtOverlay').classList.remove('offen');
    }

    function jahresberichtOeffnen() {
      if (!istSuperAdmin()) { alert('Den Jahresbericht darf nur der Super-Admin erstellen.'); return; }
      const jahr = kalenderJahr;
      const zahl = (n, stellen = 1) => n.toFixed(stellen).replace('.', ',');
      const prozent = (a, b) => b ? Math.round((a / b) * 100) + ' %' : '–';
      const esc = (t) => String(t == null ? '' : t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

      const aktive = appData.members.filter(m => m.status === 'Aktiv' || m.status === 'Nicht einsatzfähig');
      const aktivIds = new Set(aktive.map(m => m.id));
      const nAgt = aktive.filter(m => (m.lehrgaenge || []).includes('AGT')).length;

      const imJahr = d => (d.status || 'Durchgeführt') === 'Durchgeführt' && new Date(d.datumVon || d.datum).getFullYear() === jahr;
      const teilnahmen = d => (d.teilnehmer || []).filter(id => aktivIds.has(id)).length;

      // Ausbildung
      const typenAusb = { 'Ausbildung': 'Ausbildung / Übung', 'UVV': 'UVV-Unterweisung', 'Strecke': 'AGT-Übungsstrecke', 'CSA': 'CSA-Übungslauf' };
      const ausb = appData.dienste.filter(d => imJahr(d) && typenAusb[d.typ]);
      const ausbTeil = ausb.reduce((s, d) => s + teilnahmen(d), 0);
      const ausbStunden = ausb.reduce((s, d) => s + (parseFloat(d.dauer) || 0), 0);
      const ausbSchnitt = ausb.length ? ausbTeil / ausb.length : 0;
      const ausbAufteilung = Object.keys(typenAusb)
        .map(t => ({ t, n: ausb.filter(d => d.typ === t).length })).filter(x => x.n > 0);

      // Einsätze
      const einsaetze = appData.dienste.filter(d => imJahr(d) && d.typ === 'Einsatz')
        .sort((a, b) => (a.datumVon || a.datum).localeCompare(b.datumVon || b.datum));
      const arten = { B: [], TH: [], '?': [] };
      einsaetze.forEach(d => arten[einsatzArtVon(d)].push(d));
      const einsTeil = d => teilnahmen(d);
      const einsSchnitt = (liste) => liste.length ? liste.reduce((s, d) => s + einsTeil(d), 0) / liste.length : 0;
      const einsZeile = (label, liste) => liste.length
        ? `<div class="b-zeile b-einger"><span>Ø Beteiligung ${label}</span><strong>${zahl(einsSchnitt(liste))} Kameraden (${prozent(einsSchnitt(liste), aktive.length)})</strong></div>` : '';

      const zeile = (l, w, einger) => `<div class="b-zeile${einger ? ' b-einger' : ''}"><span>${l}</span><strong>${w}</strong></div>`;

      let h = '';
      h += `<h1>Jahresbericht ${jahr}</h1><div class="b-unter">Freiwillige Feuerwehr Christdorf · erstellt am ${new Date().toLocaleDateString('de-DE')}</div>`;

      h += '<h2>Mannschaft</h2>';
      h += zeile('Aktive Kameraden', aktive.length);
      h += zeile('Atemschutzgeräteträger (AGT)', nAgt);

      h += `<h2>Ausbildung ${jahr}</h2>`;
      h += zeile('Ausbildungstage', ausb.length);
      ausbAufteilung.forEach(x => { h += zeile(typenAusb[x.t], x.n, true); });
      h += zeile('Dienststunden Ausbildung', zahl(ausbStunden) + ' h');
      h += zeile('Ø Beteiligung pro Ausbildungstag', ausb.length ? `${zahl(ausbSchnitt)} von ${aktive.length} Kameraden` : '–');
      h += zeile('Beteiligung an den Ausbildungstagen', ausb.length ? prozent(ausbTeil, ausb.length * aktive.length) : '–');

      h += `<h2>Einsätze ${jahr}</h2>`;
      h += zeile('Einsätze gesamt', einsaetze.length);
      h += zeile('davon Brand (Stichwort B)', arten.B.length, true);
      h += zeile('davon Hilfeleistung (Stichwort H / TH)', arten.TH.length, true);
      if (arten['?'].length) h += zeile('davon Sonstiges (z. B. Fehlalarm)', arten['?'].length, true);
      h += zeile('Ø Beteiligung pro Einsatz', einsaetze.length ? `${zahl(einsSchnitt(einsaetze))} von ${aktive.length} Kameraden (${prozent(einsSchnitt(einsaetze), aktive.length)})` : '–');
      h += einsZeile('Brand', arten.B);
      h += einsZeile('Hilfeleistung', arten.TH);

      if (einsaetze.length) {
        h += '<div style="margin-top:0.9rem;"><div class="b-liste-kopf"><span>Datum</span><span>Stichwort</span><span>Art</span><span>Kameraden</span></div>';
        einsaetze.forEach(d => {
          const art = einsatzArtVon(d);
          h += `<div class="b-liste-zeile"><span>${new Date(d.datumVon || d.datum).toLocaleDateString('de-DE')}</span><span>${esc(d.thema)}</span><span>${art === 'B' ? 'Brand' : (art === 'TH' ? 'Hilfeleistung' : 'Sonstiges')}</span><span>${einsTeil(d)}</span></div>`;
        });
        h += '</div>';
      }
      if (arten['?'].length) h += '<div class="b-hinweis">„Sonstiges“: Einsätze, die weder als Brand (B) noch als Hilfeleistung (H) gekennzeichnet sind.</div>';

      // Lehrgänge des Jahres (nach Startdatum), gleiche Lehrgänge mit gleichem Ergebnis werden zusammengefasst
      const lgJahr = (appData.lehrgangPlan || [])
        .filter(l => l.startDatum && new Date(l.startDatum).getFullYear() === jahr)
        .sort((a, b) => a.startDatum.localeCompare(b.startDatum) || (a.titel || '').localeCompare(b.titel || '', 'de'));
      const nBest = lgJahr.filter(l => l.status === 'Bestanden').length;
      const nNicht = lgJahr.filter(l => l.status === 'Nicht bestanden').length;
      const nOffen = lgJahr.length - nBest - nNicht;
      const fmtDat = iso => new Date(iso).toLocaleDateString('de-DE');
      h += `<h2>Lehrgänge ${jahr}</h2>`;
      if (!lgJahr.length) {
        h += '<div class="b-zeile"><span>Im Jahr ' + jahr + ' sind keine Lehrgänge eingetragen.</span></div>';
      } else {
        h += zeile('Lehrgangsteilnahmen gesamt', lgJahr.length);
        h += zeile('davon bestanden', nBest, true);
        h += zeile('davon nicht bestanden', nNicht, true);
        if (nOffen) h += zeile('davon noch offen (angemeldet)', nOffen, true);

        const gruppen = [];
        lgJahr.forEach(l => {
          const schluessel = [l.titel, l.ort, l.startDatum, l.endeDatum || l.startDatum, l.status].join('|');
          let g = gruppen.find(x => x.k === schluessel);
          if (!g) { g = { k: schluessel, l, ids: [] }; gruppen.push(g); }
          g.ids.push(l.memberId);
        });
        h += '<div style="margin-top:0.9rem;">';
        gruppen.forEach(g => {
          const l = g.l;
          const namen = g.ids.map(id => appData.members.find(m => m.id === id)).filter(Boolean)
            .sort((a, b) => (a.nachname || '').localeCompare(b.nachname || '', 'de'))
            .map(m => `${m.vorname || ''} ${m.nachname || ''}`.trim());
          const zeitraum = (l.endeDatum && l.endeDatum !== l.startDatum) ? `${fmtDat(l.startDatum)} – ${fmtDat(l.endeDatum)}` : fmtDat(l.startDatum);
          let ergebnis = 'noch offen', farbe = '#6b7280';
          if (l.status === 'Bestanden') { ergebnis = 'Bestanden ✓'; farbe = '#166534'; }
          else if (l.status === 'Nicht bestanden') { ergebnis = 'Nicht bestanden ✗'; farbe = '#991b1b'; }
          h += `<div class="b-zeile"><span><strong>${esc(l.titel)}</strong> – ${esc(namen.join(', ') || 'Unbekannt')}<br><span style="font-size:0.8rem; color:#4b5563;">${zeitraum}${l.ort ? ' · ' + esc(l.ort) : ''}</span></span><strong style="color:${farbe};">${ergebnis}</strong></div>`;
        });
        h += '</div>';
      }

      h += `<div class="b-hinweis">Grundlage: durchgeführte Dienste des Jahres ${jahr}; Lehrgänge nach Startdatum. Beteiligung = Anwesenheit der aktiven Kameraden (Status „Aktiv“ und „Nicht einsatzfähig“) im Verhältnis zur Zahl der aktiven Kameraden heute.</div>`;

      document.getElementById('berichtInhalt').innerHTML = h;
      document.getElementById('berichtOverlay').classList.add('offen');
      document.getElementById('berichtOverlay').scrollTop = 0;
    }
