// FF Christdorf Dienstbuch – Dienstbuch: Tabelle und Filter, Dienst-Formular, Teilnehmer-Kacheln, Jahresplan-Import, Einsatzart
// (klassische Skriptdatei: alle Funktionen sind global und werden von den anderen Dateien genutzt)

    // Dienstbuch-Filter (Dropdowns)
    function dienstFilterJahreAktualisieren() {
      const selJ = document.getElementById('dienstFilterJahr');
      const selK = document.getElementById('dienstFilterKategorie');
      if (!selJ) return;
      const jahre = [...new Set((appData.dienste || []).map(d => (d.datumVon || d.datum || '').slice(0, 4)).filter(j => /^\d{4}$/.test(j)))].sort();
      const aktuell = selJ.value;
      selJ.innerHTML = '<option value="">Alle Jahre</option>' + jahre.map(j => `<option value="${j}">${j}</option>`).join('');
      selJ.value = jahre.includes(aktuell) ? aktuell : '';
      // Alte Einträge mit entfernter Kategorie (Lehrgangs-Dienst) bleiben filterbar
      if (selK) {
        [['Lehrgang', 'Lehrgangs-Dienst (alt)'], ['CSA', 'CSA-Übungslauf (alt)']].forEach(([typ, text]) => {
          if ((appData.dienste || []).some(d => d.typ === typ) && !Array.from(selK.options).some(o => o.value === typ)) {
            selK.insertAdjacentHTML('beforeend', `<option value="${typ}">${text}</option>`);
          }
        });
      }
    }

    function matchesDienstSuche(d) {
      const val = (id) => { const el = document.getElementById(id); return el ? el.value : ''; };
      const status = val('dienstFilterStatus');
      const jahr = val('dienstFilterJahr');
      const monat = val('dienstFilterMonat');
      const kategorie = val('dienstFilterKategorie');
      const dStart = d.datumVon || d.datum || '';

      if (status && (d.status || 'Durchgeführt') !== status) return false;
      if (jahr && dStart.slice(0, 4) !== jahr) return false;
      if (monat && dStart.slice(5, 7) !== monat) return false;
      if (kategorie && d.typ !== kategorie) return false;
      return true;
    }

    function resetDienstSuche() {
      ['dienstFilterStatus', 'dienstFilterJahr', 'dienstFilterMonat', 'dienstFilterKategorie'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
      renderApp();
    }

    // ===== JAHRESPLAN 2027 (einmaliger Import aus dem Fortbildungsplan) =====
    const JAHRESPLAN_2027 = [
      {"datum": "2027-01-04", "von": "19:00", "bis": "21:00", "dauer": 2.0, "thema": "Jährliche Unterweisung nach DGUV Vorschrift 1 und DGUV Vorschrift 49 (Feuerwehren)", "typ": "UVV", "wer": "Sicherheitsbeauftragter"},
      {"datum": "2027-01-18", "von": "19:00", "bis": "21:00", "dauer": 2.0, "thema": "Eisrettung – Gefahren, Rettungsgeräte und Eigensicherung", "typ": "Ausbildung", "wer": "Einheitsführer"},
      {"datum": "2027-02-01", "von": "19:00", "bis": "21:00", "dauer": 2.0, "thema": "Stationsausbildung: FwDV 1 Grundtätigkeiten, Knoten und Stiche, tragbare Leitern", "typ": "Ausbildung", "wer": "Einheitsführer"},
      {"datum": "2027-02-15", "von": "19:00", "bis": "21:00", "dauer": 2.0, "thema": "Fahrzeugkunde allgemein: Feuerwehrfahrzeuge im Überblick und Normung (TSF, LF, TLF, DLK, RW)", "typ": "Ausbildung", "wer": "Einheitsführer"},
      {"datum": "2027-03-01", "von": "19:00", "bis": "21:00", "dauer": 2.0, "thema": "Vegetations- und Waldbrandbekämpfung (Taktik und Eigenschutz)", "typ": "Ausbildung", "wer": "Einheitsführer"},
      {"datum": "2027-03-15", "von": "19:00", "bis": "21:00", "dauer": 2.0, "thema": "Sprechfunkbetrieb und Lagemeldung", "typ": "Ausbildung", "wer": "Einheitsführer"},
      {"datum": "2027-03-25", "von": "", "bis": "", "dauer": 0, "thema": "Osterfeuer", "typ": "Veranstaltung", "wer": ""},
      {"datum": "2027-03-29", "von": "19:00", "bis": "21:00", "dauer": 2.0, "thema": "FwDV 3 Einheiten im Lösch- und Hilfeleistungseinsatz", "typ": "Ausbildung", "wer": "Einheitsführer"},
      {"datum": "2027-04-12", "von": "19:00", "bis": "21:00", "dauer": 2.0, "thema": "Abpumpen der Flachspiegelbrunnen (Frühjahr) Wasserentnahme in der Ortslage", "typ": "Ausbildung", "wer": "Einheitsführer"},
      {"datum": "2027-04-26", "von": "19:00", "bis": "21:00", "dauer": 2.0, "thema": "Löschangriff nach FwDV 3 – Praxis", "typ": "Ausbildung", "wer": "Einheitsführer"},
      {"datum": "2027-05-10", "von": "19:00", "bis": "21:00", "dauer": 2.0, "thema": "AGT-Unterstützung: Atemschutzüberwachung und Sicherheitstrupp", "typ": "Ausbildung", "wer": "Einheitsführer"},
      {"datum": "2027-05-24", "von": "19:00", "bis": "21:00", "dauer": 2.0, "thema": "Absperren und Absichern einer Unfallstelle", "typ": "Ausbildung", "wer": "Einheitsführer"},
      {"datum": "2027-05-29", "von": "", "bis": "", "dauer": 0, "thema": "Leistungsnachweis TH Neuruppin", "typ": "Veranstaltung", "wer": ""},
      {"datum": "2027-06-07", "von": "19:00", "bis": "21:00", "dauer": 2.0, "thema": "Brände von E-Fahrzeugen und Akkus (Gefahren und Löschtaktik)", "typ": "Ausbildung", "wer": "Einheitsführer"},
      {"datum": "2027-06-21", "von": "19:00", "bis": "21:00", "dauer": 2.0, "thema": "Ersteintreffende Einheit – Erkunden, Lagemeldung, Einweisen", "typ": "Ausbildung", "wer": "Einheitsführer"},
      {"datum": "2027-07-05", "von": "19:00", "bis": "21:00", "dauer": 2.0, "thema": "Wasserentnahme aus offenen Gewässern", "typ": "Ausbildung", "wer": "Einheitsführer"},
      {"datum": "2027-07-19", "von": "19:00", "bis": "21:00", "dauer": 2.0, "thema": "Unwetter und Sturmschäden / Kettensägenkunde", "typ": "Ausbildung", "wer": "Einheitsführer"},
      {"datum": "2027-08-02", "von": "19:00", "bis": "21:00", "dauer": 2.0, "thema": "Lange Wegstrecke und Wasserförderung", "typ": "Ausbildung", "wer": "Einheitsführer"},
      {"datum": "2027-08-16", "von": "19:00", "bis": "21:00", "dauer": 2.0, "thema": "Reinigung und Sichtung der Unterflurhydranten", "typ": "Ausbildung", "wer": "Einheitsführer"},
      {"datum": "2027-08-30", "von": "19:00", "bis": "21:00", "dauer": 2.0, "thema": "Begehung Sonderobjekt Fretzdorf (BMA)", "typ": "Ausbildung", "wer": "Einheitsführer"},
      {"datum": "2027-09-13", "von": "19:00", "bis": "21:00", "dauer": 2.0, "thema": "Abpumpen der Flachspiegelbrunnen (Herbst)", "typ": "Ausbildung", "wer": "Einheitsführer"},
      {"datum": "2027-09-27", "von": "19:00", "bis": "21:00", "dauer": 2.0, "thema": "Kleinlöschgeräte in der Praxis (Feuerlöscher, Kübelspritze, Löschdecke)", "typ": "Ausbildung", "wer": "Einheitsführer"},
      {"datum": "2027-10-02", "von": "", "bis": "", "dauer": 0, "thema": "Fackelumzug", "typ": "Veranstaltung", "wer": ""},
      {"datum": "2027-10-11", "von": "19:00", "bis": "21:00", "dauer": 2.0, "thema": "Gebäudebrand mit Photovoltaikanlage – Gefahren durch Strom", "typ": "Ausbildung", "wer": "Einheitsführer"},
      {"datum": "2027-10-25", "von": "19:00", "bis": "21:00", "dauer": 2.0, "thema": "Beleuchtungsgeräte und Verkehrssicherung bei Dunkelheit", "typ": "Ausbildung", "wer": "Einheitsführer"},
      {"datum": "2027-11-08", "von": "19:00", "bis": "21:00", "dauer": 2.0, "thema": "Erste Hilfe (Termin wird noch abgestimmt)", "typ": "Ausbildung", "wer": "Sanitäterin"},
      {"datum": "2027-11-22", "von": "19:00", "bis": "21:00", "dauer": 2.0, "thema": "Gefahren an der Einsatzstelle (Gefahrenmatrix) und Einsatzstellenhygiene", "typ": "Ausbildung", "wer": "Einheitsführer"},
      {"datum": "2027-12-06", "von": "19:00", "bis": "21:00", "dauer": 2.0, "thema": "Planspiel „Einsatz in Christdorf“ und Rückblick Einsätze 2027", "typ": "Ausbildung", "wer": "Einheitsführer"},
      {"datum": "2027-12-20", "von": "19:00", "bis": "21:00", "dauer": 2.0, "thema": "Jahresausklang", "typ": "Ausbildung", "wer": "Einheitsführer"},
      {"datum": "2028-01-03", "von": "19:00", "bis": "21:00", "dauer": 2.0, "thema": "Jährliche Unterweisung nach DGUV Vorschrift 1 und DGUV Vorschrift 49 (Feuerwehren)", "typ": "UVV", "wer": "Sicherheitsbeauftragter"}
    ];

    function jahresplanOffen() {
      return JAHRESPLAN_2027.filter(e => !appData.dienste.some(d =>
        d.id === 'plan2027-' + e.datum || ((d.datumVon || d.datum) === e.datum && d.thema === e.thema)));
    }

    // Anzeige im Bereich Verwaltung: Knopf nur, solange noch Termine fehlen
    function jahresplanButtonAktualisieren() {
      const b = document.getElementById('btnJahresplanImport');
      if (!b) return;
      const gesamt = JAHRESPLAN_2027.length;
      const n = jahresplanOffen().length;
      b.style.display = n ? '' : 'none';
      b.innerText = `📥 Jahresplan 2027 importieren (${n})`;
      const st = document.getElementById('jahresplanStatus');
      if (st) st.innerText = n
        ? `${n} von ${gesamt} Terminen des Jahresplans 2027 sind noch nicht eingetragen. Sie werden als „Geplant“ angelegt.`
        : `✓ Alle ${gesamt} Termine des Jahresplans 2027 sind bereits eingetragen.`;
    }

    function findeEinheitsfuehrer() {
      const kand = appData.members.filter(m => ['jürgens', 'juergens'].includes((m.nachname || '').trim().toLowerCase()));
      return kand.find(m => (m.vorname || '').toLowerCase().startsWith('mat')) || kand[0] || null;
    }

    function importJahresplan2027() {
      if (!istSuperAdmin()) { alert('Den Jahresplan darf nur der Super-Admin importieren.'); return; }
      const offen = jahresplanOffen();
      if (!offen.length) { alert('Alle Termine des Jahresplans sind bereits eingetragen.'); return; }
      const ef = findeEinheitsfuehrer();
      const nVer = offen.filter(e => e.typ === 'Veranstaltung').length;
      let text = `Jahresplan importieren?\n\n${offen.length} Termine werden als "Geplant" angelegt (${offen.length - nVer} Ausbildung/Unterweisung, ${nVer} Veranstaltungen).\n\n`;
      text += ef
        ? `Ausbilder und einziger eingetragener Kamerad bei den Ausbildungsterminen: ${ef.vorname} ${ef.nachname}.`
        : 'ACHTUNG: Ein Kamerad mit dem Nachnamen "Jürgens" wurde in der Mannschaftsliste nicht gefunden. Die Termine werden ohne Ausbilder angelegt.';
      if (!confirm(text)) return;

      offen.forEach(e => {
        const veranstaltung = e.typ === 'Veranstaltung';
        appData.dienste.push({
          id: 'plan2027-' + e.datum, typ: e.typ, status: 'Geplant',
          datumVon: e.datum, zeitVon: e.von, datumBis: e.datum, zeitBis: e.bis, dauer: e.dauer,
          einheitsfuehrer: '', maschinist: '',
          ausbilder: (!veranstaltung && ef) ? ef.id : '',
          thema: e.thema,
          teilnehmer: (!veranstaltung && ef) ? [ef.id] : []
        });
      });
      saveData();
      populateYearFilter();
      renderApp();
      alert(`${offen.length} Termine wurden eingetragen. Du findest sie im Kalender (Jahr 2027) und im Dienstbuch.`);
    }

    // ===== JAHRESBERICHT (für die Jahreshauptversammlung) =====
    function einsatzArt(stichwort) {
      const t = String(stichwort || '').trim().toUpperCase();
      if (/^(TH|H)(?![A-ZÄÖÜ])/.test(t) || /^(TECHNISCHE|HILFELEISTUNG)/.test(t)) return 'TH';
      if (/^B(?![A-ZÄÖÜ])/.test(t) || /^BRAND/.test(t)) return 'B';
      return '?';
    }

    // Anzeigetitel: Einsätze erscheinen als "B: Stichwort" bzw. "H: Stichwort"
    function dienstTitel(d) {
      const t = d.thema || '';
      if (d.typ === 'Einsatz' && (d.einsatzArt === 'B' || d.einsatzArt === 'H')) return `${d.einsatzArt}: ${t}`;
      return t;
    }

    // Einsatzart eines Einsatzes: gespeicherte Auswahl, sonst aus dem Stichwort abgeleitet
    function einsatzArtVon(d) {
      if (d.einsatzArt === 'B') return 'B';
      if (d.einsatzArt === 'H') return 'TH';
      if (d.einsatzArt === 'S') return '?';
      return einsatzArt(d.thema);
    }

    function aktualisiereEinsatzAuswahl() {
      const einsatz = document.getElementById('dienstTyp').value === 'Einsatz';
      const datum = document.getElementById('dienstDatumVon').value;
      const neu = !document.getElementById('dienstId').value;

      document.querySelectorAll('#attendanceCheckboxes .attendance-row').forEach(row => {
        const cb = row.querySelector('input[name="attendance"]');
        if (!cb) return;
        const m = appData.members.find(x => x.id === cb.value);
        // Bereits gespeicherte Teilnehmer eines bestehenden Eintrags bleiben unverändert
        const grund = (einsatz && m && cb.dataset.vorhanden !== '1') ? einsatzGesperrtGrund(m, datum) : '';
        let badge = row.querySelector('.einsatz-sperre');
        if (grund) {
          cb.checked = false;
          cb.disabled = true;
          row.style.opacity = '0.55';
          if (!badge) {
            badge = document.createElement('span');
            badge.className = 'badge badge-danger einsatz-sperre';
            (row.querySelector('.tn-inhalt') || row).appendChild(badge);
          }
          badge.textContent = '⛔ ' + grund;
        } else {
          cb.disabled = false;
          row.style.opacity = '';
          if (badge) badge.remove();
        }
      });

      aktualisiereTeilnehmerZaehler();

      // Einheitsführer & Maschinist: gesperrte Kameraden nicht wählbar
      ['dienstEinheitsfuehrer', 'dienstMaschinist'].forEach(id => {
        const sel = document.getElementById(id);
        if (!sel) return;
        Array.from(sel.options).forEach(opt => {
          if (!opt.value) return;
          const m = appData.members.find(x => x.id === opt.value);
          const gesperrt = einsatz && m && !!einsatzGesperrtGrund(m, datum);
          opt.disabled = !!gesperrt;
          if (gesperrt && neu && sel.value === opt.value) sel.value = '';
        });
      });
    }

    function handleDatumVonChange() {
      const dVon = document.getElementById('dienstDatumVon').value;
      const dBisInput = document.getElementById('dienstDatumBis');
      const typ = document.getElementById('dienstTyp').value;

      if (typ !== 'Lehrgang' || !dBisInput.value || dBisInput.value < dVon) {
        dBisInput.value = dVon;
      }
      autoCalculateHours();
      dienstZukunftRegel();
      aktualisiereEinsatzAuswahl();
    }

    // Neue Dienste in der Zukunft: automatisch "Geplant" (Kameraden werden grundsätzlich manuell angewählt)
    let dienstAutoGeplant = false;
    function dienstZukunftRegel() {
      if (document.getElementById('dienstId').value) return; // nur beim Neuanlegen
      if (document.getElementById('dienstTyp').value === 'Einsatz') return; // Einsätze sind immer durchgeführt
      const von = document.getElementById('dienstDatumVon').value;
      if (!von) return;
      const statusEl = document.getElementById('dienstStatus');
      if (von > kalKey(new Date())) {
        if (statusEl.value === 'Durchgeführt') {
          statusEl.value = 'Geplant';
          dienstAutoGeplant = true;
        }
      } else if (dienstAutoGeplant) {
        statusEl.value = 'Durchgeführt';
        dienstAutoGeplant = false;
      }
    }

    // Ausbilder, Einheitsführer und Maschinist werden automatisch als Kamerad angehakt
    let rollenAuswahl = {};      // Rolle -> zuletzt gewählter Kamerad
    let rollenAutoGesetzt = new Set(); // Kameraden, die nur wegen einer Rolle angehakt wurden
    function rolleGewaehlt(selId) {
      const rollen = ['dienstAusbilderSelect', 'dienstEinheitsfuehrer', 'dienstMaschinist'];
      const cbFuer = id => id ? document.querySelector(`#attendanceCheckboxes input[name="attendance"][value="${id}"]`) : null;
      const neu = document.getElementById(selId).value;
      const alt = rollenAuswahl[selId];
      if (alt === neu || (!alt && !neu)) return;

      rollenAuswahl[selId] = neu;

      // Bisherigen Kameraden wieder abwählen, wenn er nur wegen einer Rolle angehakt war und keine andere Rolle ihn hält
      if (alt) {
        const gehalten = rollen.some(r => r !== selId && rollenAuswahl[r] === alt);
        const cbAlt = cbFuer(alt);
        if (cbAlt && !gehalten && rollenAutoGesetzt.has(alt)) {
          cbAlt.checked = false;
          rollenAutoGesetzt.delete(alt);
        }
      }
      aktualisiereTeilnehmerZaehler();
      // Neuen Kameraden automatisch anhaken
      if (neu) {
        const cb = cbFuer(neu);
        if (cb && !cb.disabled && !cb.checked) {
          cb.checked = true;
          rollenAutoGesetzt.add(neu);
        }
      }
      aktualisiereTeilnehmerZaehler();
    }

    function autoCalculateHours() {
      const typ = document.getElementById('dienstTyp').value;
      const dVon = document.getElementById('dienstDatumVon').value;
      let dBis = document.getElementById('dienstDatumBis').value;
      const zVon = document.getElementById('dienstZeitVon').value;
      const zBis = document.getElementById('dienstZeitBis').value;
      const hint = document.getElementById('calcHint');
      const dauerInput = document.getElementById('dienstDauer');

      if (typ !== 'Lehrgang' || !dBis) {
        dBis = dVon;
        document.getElementById('dienstDatumBis').value = dVon;
      }

      if (!dVon || !zVon || !zBis) {
        hint.innerText = "Datum und Zeiten von/bis eingeben";
        return;
      }

      const start = new Date(`${dVon}T${zVon}:00`);
      let end = new Date(`${dBis}T${zBis}:00`);

      // Falls ein eintägiger Dienst (z. B. Einsatz) über Mitternacht geht
      if (typ !== 'Lehrgang' && end < start) {
        end.setDate(end.getDate() + 1);
      }

      if (end < start) {
        hint.innerText = "⚠️ Ende liegt vor Beginn!";
        return;
      }

      const diffMs = end - start;
      const totalMinutes = Math.round(diffMs / 60000);
      const hours = totalMinutes / 60;

      dauerInput.value = (Math.round(hours * 100) / 100).toFixed(2);
      
      const daysDiff = Math.floor(totalMinutes / (24 * 60));
      let dayText = daysDiff > 0 ? ` (${daysDiff} Tag(e))` : '';
      hint.innerText = `Berechnet: ${totalMinutes} Minuten (${(Math.round(hours * 100) / 100).toFixed(2)} h)${dayText}`;
    }

    function handleDienstTypChange() {
      const typ = document.getElementById('dienstTyp').value;
      const uvvBox = document.getElementById('uvvHintBox');
      const owfBox = document.getElementById('owfHintBox');
      const themaInput = document.getElementById('dienstThema');
      const groupDatumBis = document.getElementById('groupDatumBis');
      const labelDatumVon = document.getElementById('labelDatumVon');
      const zeitraumHeaderTitle = document.getElementById('zeitraumHeaderTitle');
      const dVon = document.getElementById('dienstDatumVon').value;
      const dBisInput = document.getElementById('dienstDatumBis');

      uvvBox.style.display = (typ === 'UVV') ? 'block' : 'none';

      // Einsatz: Einsatzart wählen, Gesamtdauer wird automatisch berechnet und nicht angezeigt
      const istEinsatz = (typ === 'Einsatz');
      document.getElementById('einsatzArtBox').style.display = istEinsatz ? 'block' : 'none';
      // Einsätze sind immer durchgeführt: Status wird nicht abgefragt
      document.getElementById('dienstStatusGroup').style.display = istEinsatz ? 'none' : '';
      if (istEinsatz) { document.getElementById('dienstStatus').value = 'Durchgeführt'; dienstAutoGeplant = false; }
      document.getElementById('dienstEinsatzArt').required = istEinsatz;
      const themaLabel = document.getElementById('dienstThemaLabel');
      if (!themaInput.dataset.platzhalter) themaInput.dataset.platzhalter = themaInput.placeholder;
      themaLabel.innerText = istEinsatz ? 'Einsatzstichwort (z. B. B2 Wohnungsbrand, TH 1 Baum auf Straße)' : 'Thema / Ausbildungsziel / Einsatzstichwort';
      themaInput.placeholder = istEinsatz ? 'z. B. B2 Wohnungsbrand' : themaInput.dataset.platzhalter;
      owfBox.style.display = (typ === 'OWF-Versammlung') ? 'block' : 'none';

      // Ausbilder wird bei Einsätzen und Veranstaltungen nicht benötigt
      const ohneAusbilder = (typ === 'Einsatz' || typ === 'Veranstaltung');
      const ausbilderBox = document.getElementById('ausbilderBox');
      if (ausbilderBox) ausbilderBox.style.display = ohneAusbilder ? 'none' : 'block';

      // Einheitsführer & Maschinist werden nur bei Einsätzen benötigt
      const rollenBox = document.getElementById('einsatzRollenBox');
      if (rollenBox) rollenBox.style.display = (typ === 'Einsatz') ? 'block' : 'none';

      // Nicht mehr sichtbare Rollen zurücksetzen (inkl. automatisch gesetztem Häkchen)
      if (ohneAusbilder) {
        document.getElementById('dienstAusbilderSelect').value = '';
        document.getElementById('dienstAusbilderCustom').value = '';
        rolleGewaehlt('dienstAusbilderSelect');
      }
      if (typ !== 'Einsatz') {
        ['dienstEinheitsfuehrer', 'dienstMaschinist'].forEach(id => {
          document.getElementById(id).value = '';
          rolleGewaehlt(id);
        });
      }

      // Nur bei Lehrgängen ein Bis-Datum einblenden, alle anderen finden an einem Tag statt
      if (typ === 'Lehrgang') {
        groupDatumBis.style.display = 'block';
        labelDatumVon.innerText = 'Datum Von';
        zeitraumHeaderTitle.innerText = '⏱️ Zeitraum (auch mehrtägig):';
      } else {
        groupDatumBis.style.display = 'none';
        labelDatumVon.innerText = 'Datum';
        zeitraumHeaderTitle.innerText = '⏱️ Datum & Uhrzeit:';
        if (dVon) dBisInput.value = dVon;
      }

      if (typ === 'UVV' && !themaInput.value) {
        const curYear = new Date().getFullYear();
        themaInput.value = `Jährliche Sicherheitsbelehrung / UVV ${curYear}`;
      } else if (typ === 'OWF-Versammlung' && !themaInput.value) {
        themaInput.value = `Dienstberatung Ortswehrführer (Stadt Wittstock/Dosse)`;
      }
      autoCalculateHours();
      aktualisiereEinsatzAuswahl();
    }

    function syncAusbilderChoice(source) {
      if (source === 'select') {
        const val = document.getElementById('dienstAusbilderSelect').value;
        if (val) document.getElementById('dienstAusbilderCustom').value = '';
      } else if (source === 'custom') {
        const text = document.getElementById('dienstAusbilderCustom').value;
        if (text) document.getElementById('dienstAusbilderSelect').value = '';
      }
    }

    function openDienstModal(dienstId = null) {
      document.getElementById('dienstForm').reset();
      document.querySelectorAll('#dienstTyp option[data-alt]').forEach(o => o.remove());
      const container = document.getElementById('attendanceCheckboxes');
      container.innerHTML = '';

      const abSelect = document.getElementById('dienstAusbilderSelect');
      const efSelect = document.getElementById('dienstEinheitsfuehrer');
      const maSelect = document.getElementById('dienstMaschinist');
      
      abSelect.innerHTML = '<option value="">-- Kamerad wählen --</option>';
      dienstAutoGeplant = false;
      rollenAuswahl = {};
      rollenAutoGesetzt = new Set();
      efSelect.innerHTML = '<option value="">-- offen --</option>';
      maSelect.innerHTML = '<option value="">-- offen --</option>';

      appData.members.forEach(m => {
        abSelect.innerHTML += `<option value="${m.id}">${m.nachname}, ${m.vorname} (${dienstgradAnzeige(m)})</option>`;
        efSelect.innerHTML += `<option value="${m.id}">${m.nachname}, ${m.vorname} (${dienstgradAnzeige(m)})</option>`;
        maSelect.innerHTML += `<option value="${m.id}">${m.nachname}, ${m.vorname} (${dienstgradAnzeige(m)})</option>`;
      });

      if (dienstId) {
        const d = appData.dienste.find(x => x.id === dienstId);
        if (d) {
          document.getElementById('dienstId').value = d.id;
          // Alte Einträge mit einer entfernten Kategorie (z. B. Lehrgangs-Dienst) bleiben bearbeitbar
          const typSelect = document.getElementById('dienstTyp');
          if (!Array.from(typSelect.options).some(o => o.value === d.typ)) {
            const alt = document.createElement('option');
            alt.value = d.typ;
            alt.textContent = (d.typ === 'Lehrgang' ? '🎓 Lehrgangs-Dienst' : d.typ) + ' (bisheriger Eintrag)';
            alt.setAttribute('data-alt', '1');
            typSelect.appendChild(alt);
          }
          typSelect.value = d.typ;
          // Einsatzart: gespeicherten Wert nehmen, bei älteren Einsätzen aus dem Stichwort ableiten
          const geraten = einsatzArt(d.thema);
          document.getElementById('dienstEinsatzArt').value = d.einsatzArt || (geraten === 'B' ? 'B' : (geraten === 'TH' ? 'H' : ''));
          document.getElementById('dienstStatus').value = d.status || 'Durchgeführt';
          document.getElementById('dienstDatumVon').value = d.datumVon || d.datum;
          document.getElementById('dienstZeitVon').value = d.zeitVon || d.von || '19:00';
          document.getElementById('dienstDatumBis').value = d.datumBis || d.datumVon || d.datum;
          document.getElementById('dienstZeitBis').value = d.zeitBis || d.bis || '21:00';
          document.getElementById('dienstThema').value = d.thema;
          document.getElementById('dienstEinheitsfuehrer').value = d.einheitsfuehrer || '';
          document.getElementById('dienstMaschinist').value = d.maschinist || '';

          const isMemberId = appData.members.some(m => m.id === d.ausbilder);
          if (isMemberId) {
            document.getElementById('dienstAusbilderSelect').value = d.ausbilder;
            document.getElementById('dienstAusbilderCustom').value = '';
          } else {
            document.getElementById('dienstAusbilderSelect').value = '';
            document.getElementById('dienstAusbilderCustom').value = d.ausbilder || '';
          }

          document.getElementById('dienstModalTitle').innerText = '✏️ Dienst / Termin bearbeiten';
          document.getElementById('dienstSubmitBtn').innerText = 'Änderungen speichern';
          handleDienstTypChange();
          document.getElementById('dienstDauer').value = d.dauer;

          [...appData.members].sort((a, b) => (a.nachname || '').localeCompare(b.nachname || '', 'de') || (a.vorname || '').localeCompare(b.vorname || '', 'de')).forEach(m => {
            const isChecked = d.teilnehmer && d.teilnehmer.includes(m.id);
            container.innerHTML += teilnehmerKachel(m, isChecked);
          });
        }
      } else {
        const today = new Date().toISOString().split('T')[0];
        document.getElementById('dienstId').value = '';
        document.getElementById('dienstStatus').value = 'Durchgeführt';
        document.getElementById('dienstDatumVon').value = today;
        document.getElementById('dienstDatumBis').value = today;
        document.getElementById('dienstZeitVon').value = '19:00';
        document.getElementById('dienstZeitBis').value = '21:00';
        document.getElementById('dienstAusbilderCustom').value = '';
        document.getElementById('dienstModalTitle').innerText = '+ Neuer Dienst / Termin erfassen';
        document.getElementById('dienstSubmitBtn').innerText = 'Dienst speichern';
        handleDienstTypChange();

        [...appData.members].sort((a, b) => (a.nachname || '').localeCompare(b.nachname || '', 'de') || (a.vorname || '').localeCompare(b.vorname || '', 'de')).forEach(m => {
          container.innerHTML += teilnehmerKachel(m, false);
        });
      }

      aktualisiereEinsatzAuswahl();
      document.getElementById('modalDienst').style.display = 'flex';
    }

    // Teilnehmer-Kachel: kompakter Name (Nachname + Anfangsbuchstabe(n) des Vornamens), Tippen = anwesend
    function teilnehmerKachel(m, angehakt) {
      const kurz = kurzname(m);
      const punkt = kurz.indexOf('. ');
      const name = punkt > -1 ? `${m.nachname} ${kurz.slice(0, punkt + 1)}` : (m.nachname || '');
      const fuehrung = (m.funktion === 'Ortswehrführer' || m.funktion === 'Stellv. Ortswehrführer');
      const agt = m.lehrgaenge && m.lehrgaenge.includes('AGT');
      const tags = (fuehrung || agt) ? `<span class="tn-tags">${fuehrung ? '<span class="tn-tag">Führung</span>' : ''}${agt ? '<span class="tn-tag">AGT</span>' : ''}</span>` : '';
      const titel = `${m.nachname}, ${m.vorname} (${dienstgradAnzeige(m)})`.replace(/"/g, '&quot;');
      return `<label class="attendance-row tn-kachel" title="${titel}"><input type="checkbox" name="attendance" value="${m.id}" ${angehakt ? 'checked data-vorhanden="1"' : ''}><span class="tn-inhalt"><span class="tn-name">${name}</span>${tags}</span></label>`;
    }

    function aktualisiereTeilnehmerZaehler() {
      const el = document.getElementById('teilnehmerZaehler');
      if (!el) return;
      const alle = document.querySelectorAll('#attendanceCheckboxes input[name="attendance"]');
      const an = document.querySelectorAll('#attendanceCheckboxes input[name="attendance"]:checked');
      el.innerText = `${an.length} von ${alle.length} anwesend`;
    }

    function selectAllAttendance(check) {
      document.querySelectorAll('#attendanceCheckboxes input').forEach(c => { if (!c.disabled) c.checked = check; });
      aktualisiereTeilnehmerZaehler();
    }

    function selectAgtAttendance() {
      const agtIds = appData.members.filter(m => m.lehrgaenge && m.lehrgaenge.includes('AGT')).map(m => m.id);
      document.querySelectorAll('#attendanceCheckboxes input').forEach(c => {
        if (!c.disabled) c.checked = agtIds.includes(c.value);
      });
      aktualisiereTeilnehmerZaehler();
    }

    function selectWehrfuehrungAttendance() {
      const fuehrungIds = appData.members.filter(m => m.funktion === 'Ortswehrführer' || m.funktion === 'Stellv. Ortswehrführer').map(m => m.id);
      document.querySelectorAll('#attendanceCheckboxes input').forEach(c => {
        if (!c.disabled) c.checked = fuehrungIds.includes(c.value);
      });
      aktualisiereTeilnehmerZaehler();
    }

    function saveDienst(e) {
      e.preventDefault();
      const id = document.getElementById('dienstId').value || 'd-' + Date.now();
      const typ = document.getElementById('dienstTyp').value;
      let status = document.getElementById('dienstStatus').value;
      const datumVon = document.getElementById('dienstDatumVon').value;
      const zeitVon = document.getElementById('dienstZeitVon').value;
      const datumBis = (typ === 'Lehrgang' && document.getElementById('dienstDatumBis').value) ? document.getElementById('dienstDatumBis').value : datumVon;
      const zeitBis = document.getElementById('dienstZeitBis').value;
      // Gesamtdauer wird automatisch berechnet (bei Einsätzen ist das Feld ausgeblendet)
      if (!(parseFloat(document.getElementById('dienstDauer').value) > 0)) autoCalculateHours();
      const dauer = parseFloat(document.getElementById('dienstDauer').value) || 0;
      const einsatzArt = (typ === 'Einsatz') ? document.getElementById('dienstEinsatzArt').value : '';
      // Rollen nur bei Einsätzen speichern
      const einheitsfuehrer = (typ === 'Einsatz') ? document.getElementById('dienstEinheitsfuehrer').value : '';
      const maschinist = (typ === 'Einsatz') ? document.getElementById('dienstMaschinist').value : '';
      
      // Ausbilder nur bei Diensten speichern (nicht bei Einsätzen und Veranstaltungen)
      const ohneAusbilder = (typ === 'Einsatz' || typ === 'Veranstaltung');
      const selAusbilder = ohneAusbilder ? '' : document.getElementById('dienstAusbilderSelect').value;
      const custAusbilder = ohneAusbilder ? '' : document.getElementById('dienstAusbilderCustom').value.trim();
      const ausbilder = custAusbilder ? custAusbilder : selAusbilder;

      const thema = document.getElementById('dienstThema').value.trim();
      const teilnehmer = Array.from(document.querySelectorAll('#attendanceCheckboxes input:checked')).map(c => c.value);

      // Termine in der Zukunft können noch nicht durchgeführt sein
      if (typ === 'Einsatz') status = 'Durchgeführt';
      else if (status === 'Durchgeführt' && datumVon > kalKey(new Date())) status = 'Geplant';

      // Bei geplanten Terminen werden Rollen nicht automatisch als Teilnehmer eingetragen
      if (status !== 'Geplant') {
        if (einheitsfuehrer && !teilnehmer.includes(einheitsfuehrer)) teilnehmer.push(einheitsfuehrer);
        if (maschinist && !teilnehmer.includes(maschinist)) teilnehmer.push(maschinist);
        if (selAusbilder && !teilnehmer.includes(selAusbilder)) teilnehmer.push(selAusbilder);
      }

      const dObj = { id, typ, status, datumVon, zeitVon, datumBis, zeitBis, dauer, einheitsfuehrer, maschinist, ausbilder, thema, teilnehmer };
      if (einsatzArt) dObj.einsatzArt = einsatzArt;

      const existingIdx = appData.dienste.findIndex(x => x.id === id);
      if (existingIdx !== -1) {
        appData.dienste[existingIdx] = dObj;
      } else {
        appData.dienste.push(dObj);
      }

      if (status === 'Durchgeführt') {
        teilnehmer.forEach(mId => {
          const m = appData.members.find(x => x.id === mId);
          if (m) {
            if (typ === 'Strecke') m.streckeDatum = datumVon;
            if (typ === 'CSA') m.csaDatum = datumVon;
          }
        });
      }

      saveData();
      populateYearFilter();
      closeModal('modalDienst');

      const isUvvService = (typ === 'UVV') || (thema && (thema.toLowerCase().includes('uvv') || thema.toLowerCase().includes('sicherheitsbelehrung') || thema.toLowerCase().includes('sicherheitsunterweisung')));
      if (isUvvService && status === 'Durchgeführt') {
        const dYear = new Date(datumVon).getFullYear();
        alert(`Dienst erfolgreich als durchgeführt gespeichert! Für alle ${teilnehmer.length} anwesenden Kameraden ist die UVV für ${dYear} nun als gültig hinterlegt.`);
      }
    }

    function deleteDienst(id) {
      if (confirm('Dienst wirklich löschen?')) {
        appData.dienste = appData.dienste.filter(d => d.id !== id);
        saveData();
      }
    }    // Dienstbuch: Tabelle mit Filter
    function dienstbuchRendern() {
        const dBody = document.getElementById('diensteTableBody');
        if (dBody) {
          dBody.innerHTML = '';
          dienstFilterJahreAktualisieren();
          // Tabellenkopf passt sich der gewählten Kategorie an
          const kategorieFilter = (document.getElementById('dienstFilterKategorie') || {}).value || '';
          const thThema = document.getElementById('thDienstThema');
          const thRollen = document.getElementById('thDienstRollen');
          if (thThema && thRollen) {
            if (kategorieFilter === 'Einsatz') { thThema.innerText = 'Einsatzstichwort'; thRollen.innerText = 'Rollen'; }
            else if (kategorieFilter) { thThema.innerText = 'Thema'; thRollen.innerText = 'Ausbilder'; }
            else { thThema.innerText = 'Thema / Einsatzstichwort'; thRollen.innerText = 'Rollen / Ausbilder'; }
          }
          const sortedDienste = [...appData.dienste].sort((a, b) => new Date(b.datumVon || b.datum) - new Date(a.datumVon || a.datum)).filter(matchesDienstSuche);
          const trefferEl = document.getElementById('dienstSuchTreffer');
          if (trefferEl) trefferEl.innerText = `${sortedDienste.length} von ${appData.dienste.length} Einträgen`;
          // Aktive Filter dezent hervorheben, "zurücksetzen" nur bei Bedarf zeigen
          const filterIds = ['dienstFilterStatus', 'dienstFilterJahr', 'dienstFilterMonat', 'dienstFilterKategorie'];
          let filterAktiv = false;
          filterIds.forEach(id => { const el = document.getElementById(id); if (el) { el.classList.toggle('aktiv', !!el.value); if (el.value) filterAktiv = true; } });
          const resetBtn = document.getElementById('dienstFilterReset');
          if (resetBtn) resetBtn.style.display = filterAktiv ? '' : 'none';
          if (sortedDienste.length === 0) {
            dBody.innerHTML = `<tr><td colspan="8" style="text-align:center; color:var(--text-muted); padding:1.5rem;">Keine Einträge gefunden.</td></tr>`;
          }
          sortedDienste.forEach(d => {
            const dStatus = d.status || 'Durchgeführt';
            let statusBadge = `<span class="badge badge-success">✓ Durchgeführt</span>`;
            if (dStatus === 'Geplant') statusBadge = `<span class="badge badge-warning">⏳ Geplant</span>`;
            else if (dStatus === 'Ausgefallen') statusBadge = `<span class="badge badge-danger">✕ Ausgefallen</span>`;

            const tnCount = d.teilnehmer ? d.teilnehmer.length : 0;
            const dStart = d.datumVon || d.datum;
            const dEnde = d.datumBis || d.datumVon || d.datum;
            let timeStr = `${new Date(dStart).toLocaleDateString('de-DE')} ${d.zeitVon || d.von || ''} - ${new Date(dEnde).toLocaleDateString('de-DE')} ${d.zeitBis || d.bis || ''} Uhr`;
            if (dStart === dEnde || d.typ !== 'Lehrgang') {
              timeStr = `${new Date(dStart).toLocaleDateString('de-DE')}` + ((d.zeitVon || d.von) ? ` (${d.zeitVon || d.von} - ${d.zeitBis || d.bis || ''} Uhr)` : '');
            }

            let rollenBadges = [];
            if (d.typ === 'OWF-Versammlung') {
              rollenBadges.push(`<span class="badge badge-owf">🏛️ OWF-Dienstberatung</span>`);
            }
            if (d.ausbilder) {
              const ab = appData.members.find(m => m.id === d.ausbilder);
              rollenBadges.push(`<span class="badge badge-ausb">🎓 Ausb: ${ab ? kurzname(ab) : d.ausbilder}</span>`);
            }
            if (d.einheitsfuehrer) {
              const ef = appData.members.find(m => m.id === d.einheitsfuehrer);
              rollenBadges.push(`<span class="badge badge-gf">EF: ${ef ? kurzname(ef) : 'Unbekannt'}</span>`);
            }
            if (d.maschinist) {
              const ma = appData.members.find(m => m.id === d.maschinist);
              rollenBadges.push(`<span class="badge badge-masch">Ma: ${ma ? kurzname(ma) : 'Unbekannt'}</span>`);
            }

            dBody.innerHTML += `
              <tr style="${dStatus === 'Geplant' ? 'opacity: 0.9; background: rgba(234, 179, 8, 0.04);' : ''}">
                <td>${statusBadge}</td>
                <td><strong>${timeStr}</strong></td>
                <td><span class="badge badge-tag">${d.typ}</span></td>
                <td><strong>${dienstTitel(d)}</strong></td>
                <td>${rollenBadges.length ? rollenBadges.join(' ') : '<span style="color:var(--text-muted);">-</span>'}</td>
                <td><strong style="color:${dStatus === 'Geplant' ? 'var(--text-muted)' : '#60a5fa'};">${d.dauer.toFixed(2)} h ${dStatus === 'Geplant' ? '<small>(ausstehend)</small>' : ''}</strong></td>
                <td>${tnCount} Kameraden</td>
                <td>
                  <button class="btn btn-secondary btn-sm" onclick="openDienstModal('${d.id}')" title="Bearbeiten">✏️ Bearbeiten</button>
                  <button class="btn btn-danger btn-sm" onclick="deleteDienst('${d.id}')" title="Löschen">🗑️</button>
                </td>
              </tr>
            `;
          });
        }

    }
