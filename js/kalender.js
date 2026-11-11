// FF Christdorf Dienstbuch – Kalender: Jahreskalender, Termine sammeln, Doppelklick-Menü
// (klassische Skriptdatei: alle Funktionen sind global und werden von den anderen Dateien genutzt)

    // ===== KALENDER =====
    const KAL_KATEGORIEN = {
      einsatz:       { label: 'Einsatz',                          farbe: '#e02424', prio: 1 }, // Signalrot
      strecke:       { label: 'AGT-Übungsstrecke', farbe: '#ff8a00', prio: 2 }, // Leuchtorange
      ausbildung:    { label: 'Ausbildung / Übung',               farbe: '#1f8fff', prio: 4 }, // Azurblau
      arbeitsdienst: { label: 'Arbeitsdienst',                    farbe: '#10a874', prio: 5 }, // Smaragdgrün
      veranstaltung: { label: 'Veranstaltung',                    farbe: '#d6409f', prio: 6 }, // Magenta
      versammlung:   { label: 'Versammlung',                      farbe: '#0e8a8f', prio: 7 }, // Petrol / Türkis
      lehrgang:      { label: 'Lehrgang',                         farbe: '#5b61ad', prio: 3 }  // Mattes Indigo
    };
    let kalenderJahr = new Date().getFullYear();
    let kalenderAuswahl = null;
    let kalenderMonat = new Date().getMonth();

    // Namen ("Vorname Nachname") zu Mitglieds-IDs, alphabetisch nach Nachname
    function kalNamen(ids) {
      return (ids || [])
        .map(id => appData.members.find(m => m.id === id))
        .filter(Boolean)
        .sort((a, b) => (a.nachname || '').localeCompare(b.nachname || '', 'de') || (a.vorname || '').localeCompare(b.vorname || '', 'de'))
        .map(m => `${m.vorname || ''} ${m.nachname || ''}`.trim());
    }

    function kalenderJahrWechsel(delta) { kalenderJahr += delta; kalenderAuswahl = null; renderApp(); }
    function kalenderHeute() { kalenderJahr = new Date().getFullYear(); kalenderMonat = new Date().getMonth(); kalenderAuswahl = kalKey(new Date()); renderApp(); }
    function kalenderMonatWechsel(delta) {
      kalenderMonat += delta;
      if (kalenderMonat < 0) { kalenderMonat = 11; kalenderJahr--; }
      else if (kalenderMonat > 11) { kalenderMonat = 0; kalenderJahr++; }
      kalenderAuswahl = null;
      renderApp();
    }
    // Doppelklick auf einen Kalendertag (nur Rechner mit Maus): kleines Menü zum Eintragen
    function kalenderTagMenueSchliessen() {
      const m = document.getElementById('kalenderMenue');
      if (m) m.remove();
    }

    function kalenderTagMenue(key, ev) {
      if (!istSuperAdmin()) return;
      if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
      kalenderTagMenueSchliessen();
      const menue = document.createElement('div');
      menue.id = 'kalenderMenue';
      menue.innerHTML = `<div class="km-kopf">📅 ${kalDeDatum(key)}</div>
        <button type="button" onclick="kalenderNeuerDienst('${key}')">+ Dienst / Termin eintragen</button>
        <button type="button" onclick="kalenderNeuerLehrgang('${key}')">+ Lehrgang eintragen</button>`;
      document.body.appendChild(menue);
      // Menü an der Mausposition platzieren, aber im sichtbaren Bereich halten
      const b = menue.getBoundingClientRect();
      menue.style.left = Math.max(8, Math.min(ev.clientX, window.innerWidth - b.width - 8)) + 'px';
      menue.style.top = Math.max(8, Math.min(ev.clientY, window.innerHeight - b.height - 8)) + 'px';
    }

    function kalenderNeuerDienst(key) {
      kalenderTagMenueSchliessen();
      openDienstModal();
      document.getElementById('dienstDatumVon').value = key;
      handleDatumVonChange();
    }

    function kalenderNeuerLehrgang(key) {
      kalenderTagMenueSchliessen();
      openLehrgangModal();
      document.getElementById('lehrgangStatus').value = 'Angemeldet';
      document.getElementById('lehrgangStartDatum').value = key;
      document.getElementById('lehrgangEndeDatum').value = key;
      toggleLehrgangFields();
      lehrgangStundenFeldAktualisieren();
    }

    document.addEventListener('click', (e) => { if (!e.target.closest('#kalenderMenue') && !e.target.closest('.cal-day')) kalenderTagMenueSchliessen(); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') kalenderTagMenueSchliessen(); });

    function kalenderTagWaehlen(key) { kalenderAuswahl = (kalenderAuswahl === key) ? null : key; renderKalender(); }

    function kalenderSammleTermine() {
      const tage = {}; // key -> [{kat, titel, info, geplant}]
      const add = (von, bis, eintrag, nurSamstage, ohneWochenende) => {
        const a = kalIsoToDate(von);
        if (!a) return;
        let b = kalIsoToDate(bis) || a;
        if (b < a) b = a;
        // Nur Samstage markieren, sofern der Zeitraum mehrtägig ist und mindestens einen Samstag enthält
        let samstagsModus = false;
        // Landesschule: nur Montag bis Freitag markieren (sofern der Zeitraum einen Werktag enthält)
        let werktagsModus = false;
        if (ohneWochenende) {
          let c = 0;
          for (let d = new Date(a); d <= b && c < 400; d.setDate(d.getDate() + 1), c++) {
            if (d.getDay() !== 0 && d.getDay() !== 6) { werktagsModus = true; break; }
          }
        }
        if (nurSamstage && b > a) {
          let c = 0;
          for (let d = new Date(a); d <= b && c < 400; d.setDate(d.getDate() + 1), c++) {
            if (d.getDay() === 6) { samstagsModus = true; break; }
          }
        }
        let n = 0;
        for (let d = new Date(a); d <= b && n < 400; d.setDate(d.getDate() + 1), n++) {
          if (samstagsModus && d.getDay() !== 6) continue;
          if (werktagsModus && (d.getDay() === 0 || d.getDay() === 6)) continue;
          const k = kalKey(d);
          (tage[k] = tage[k] || []).push(eintrag);
        }
      };

      (appData.dienste || []).forEach(d => {
        const status = d.status || 'Durchgeführt';
        if (status === 'Ausgefallen') return;
        let kat = 'ausbildung';
        if (d.typ === 'Einsatz') kat = 'einsatz';
        else if (d.typ === 'Lehrgang') kat = 'lehrgang';
        else if (d.typ === 'Strecke' || d.typ === 'CSA') kat = 'strecke';
        else if (d.typ === 'Arbeitsdienst') kat = 'arbeitsdienst';
        else if (d.typ === 'Veranstaltung') kat = 'veranstaltung';
        else if (d.typ === 'Versammlung' || d.typ === 'OWF-Versammlung') kat = 'versammlung';
        const zeit = (d.zeitVon || d.von || '') ? `${d.zeitVon || d.von} - ${d.zeitBis || d.bis || ''} Uhr` : '';
        const tn = d.teilnehmer ? d.teilnehmer.length : 0;
        const namen = (kat === 'lehrgang') ? kalNamen(d.teilnehmer || []) : [];
        add(d.datumVon || d.datum, d.datumBis || d.datumVon || d.datum, {
          kat, titel: dienstTitel(d) || d.typ || 'Dienst', namen,
          info: [d.typ, zeit, tn ? tn + (tn === 1 ? ' Kamerad' : ' Kameraden') : ''].filter(Boolean).join(' · '),
          geplant: status === 'Geplant'
        });
      });

      // Gleiche Lehrgänge mehrerer Kameraden (gleiche Bezeichnung, Ort, Zeitraum, Status) werden zusammengefasst
      const gruppen = {};
      (appData.lehrgangPlan || []).forEach(l => {
        if (!l.startDatum) return; // Bewerbungen ohne Termin erscheinen nicht im Kalender
        const schluessel = [l.titel, l.ort, l.startDatum, l.endeDatum || l.startDatum, l.status].join('|');
        (gruppen[schluessel] = gruppen[schluessel] || { l, ids: [] }).ids.push(l.memberId);
      });
      Object.keys(gruppen).forEach(k => {
        const { l, ids } = gruppen[k];
        // FTZ Kyritz: mehrwöchige Lehrgänge finden jeweils nur samstags statt
        const kyritz = (l.ort === 'FTZ Kyritz' || l.ort === 'Kreisebene OPR');
        const namen = kalNamen(ids);
        add(l.startDatum, l.endeDatum || l.startDatum, {
          kat: 'lehrgang', titel: `${l.titel || 'Lehrgang'}`, namen,
          info: [namen.length ? (namen.length > 1 ? 'Kameraden: ' : '') + namen.join(', ') : 'Unbekannt', l.ort, kyritz ? '8:00–16:00 Uhr' : '', l.status].filter(Boolean).join(' · '),
          geplant: l.status === 'Angemeldet'
        }, kyritz, istLste(l.ort) || istWittstock(l.ort));
      });
      return tage;
    }

    function renderKalender() {
      const grid = document.getElementById('kalenderGrid');
      if (!grid) return;
      document.getElementById('kalenderJahrAnzeige').innerText = kalenderJahr;
      const monatsnamen = ['Januar','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember'];
      const monatAnzeige = document.getElementById('kalenderMonatAnzeige');
      if (monatAnzeige) monatAnzeige.innerText = monatsnamen[kalenderMonat] + ' ' + kalenderJahr;

      const tage = kalenderSammleTermine();
      const heuteKey = kalKey(new Date());
      const monate = ['Januar','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember'];
      const zaehler = {};
      Object.keys(KAL_KATEGORIEN).forEach(k => zaehler[k] = 0);

      let html = '';
      for (let m = 0; m < 12; m++) {
        const erster = new Date(kalenderJahr, m, 1);
        const anzahl = new Date(kalenderJahr, m + 1, 0).getDate();
        const offset = (erster.getDay() + 6) % 7; // Woche beginnt am Montag
        const aktuell = (kalenderJahr === new Date().getFullYear() && m === new Date().getMonth());
        html += `<div class="cal-month${aktuell ? ' current' : ''}${m === kalenderMonat ? ' mobil-aktiv' : ''}" id="kal-monat-${m}"><div class="cal-month-title">${monate[m]}</div>`;
        html += '<div class="cal-weekdays"><span>Mo</span><span>Di</span><span>Mi</span><span>Do</span><span>Fr</span><span>Sa</span><span>So</span></div><div class="cal-days">';
        for (let i = 0; i < offset; i++) html += '<div class="cal-day"></div>';
        for (let tag = 1; tag <= anzahl; tag++) {
          const key = kalKey(new Date(kalenderJahr, m, tag));
          const ev = tage[key] || [];
          const klassen = ['cal-day'];
          let style = '';
          let tip = '';
          if (ev.length) {
            klassen.push('has-event');
            const kats = [...new Set(ev.map(e => e.kat))].sort((a, b) => KAL_KATEGORIEN[a].prio - KAL_KATEGORIEN[b].prio);
            kats.forEach(k => zaehler[k]++);
            if (kats.length === 1) {
              style = `background:${KAL_KATEGORIEN[kats[0]].farbe};`;
            } else {
              const teil = 100 / kats.length;
              const stops = kats.map((k, i) => `${KAL_KATEGORIEN[k].farbe} ${(i * teil).toFixed(1)}% ${((i + 1) * teil).toFixed(1)}%`).join(', ');
              style = `background:linear-gradient(135deg, ${stops});`;
            }
            if (ev.every(e => e.geplant)) klassen.push('planned');
            tip = ev.map(e => e.titel + (e.namen && e.namen.length ? ': ' + e.namen.join(', ') : '')).join('\n').replace(/"/g, '&quot;');
          }
          if (key === heuteKey) klassen.push('today');
          if (key === kalenderAuswahl) klassen.push('selected');
          html += `<div class="${klassen.join(' ')}" style="${style}" ondblclick="kalenderTagMenue('${key}', event)" ${ev.length ? `title="${tip}" onclick="kalenderTagWaehlen('${key}')"` : ''}>${tag}</div>`;
        }
        html += '</div></div>';
      }
      grid.innerHTML = html;

      const leg = document.getElementById('kalenderLegende');
      const legMobil = document.getElementById('kalenderLegendeMobil');
      if (leg) {
        const legHtml = Object.keys(KAL_KATEGORIEN).map(k =>
          `<span class="cal-legend-item"><span class="cal-swatch" style="background:${KAL_KATEGORIEN[k].farbe};"></span>${KAL_KATEGORIEN[k].label} (${zaehler[k]} ${zaehler[k] === 1 ? 'Tag' : 'Tage'})</span>`
        ).join('') + '<span class="cal-legend-item"><span class="cal-swatch" style="border:1px dashed #fff; opacity:0.6;"></span>geplant / angemeldet</span>';
        leg.innerHTML = legHtml;
        if (legMobil) legMobil.innerHTML = legHtml;
      }

      const det = document.getElementById('kalenderDetail');
      if (det) {
        const ev = kalenderAuswahl ? (tage[kalenderAuswahl] || []) : [];
        if (kalenderAuswahl && ev.length) {
          det.innerHTML = `<div class="cal-detail-box"><strong>Termine am ${kalDeDatum(kalenderAuswahl)}</strong>` +
            ev.map(e => `<div class="cal-detail-item"><span class="cal-swatch" style="background:${KAL_KATEGORIEN[e.kat].farbe}; margin-top:0.3rem; flex-shrink:0;"></span><div><div><strong>${e.titel}</strong>${e.geplant ? ' <span class="badge badge-warning">geplant</span>' : ''}</div><div style="color:var(--text-muted);">${e.info}</div></div></div>`).join('') +
            '</div>';
        } else {
          det.innerHTML = '<div style="color:var(--text-muted); font-size:0.8rem;">Tippe auf einen farbigen Tag, um die Einzelheiten zu sehen.<span class="nur-desktop" data-nur-super> Doppelklick auf einen Tag: neuen Eintrag anlegen.</span></div>';
        }
      }
    }
