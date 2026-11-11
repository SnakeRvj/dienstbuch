// FF Christdorf Dienstbuch – Lehrgänge: Planung, Katalog, Stundenberechnung, Voraussetzungen, Lehrgangs-Formular
// (klassische Skriptdatei: alle Funktionen sind global und werden von den anderen Dateien genutzt)

    // Lehrgangs-Filter (Dropdowns): Lehrgangsnamen und Kameraden nur aus tatsächlich eingetragenen Lehrgängen
    function lehrgangFilterAktualisieren() {
      const plan = appData.lehrgangPlan || [];
      const fuelle = (id, alleText, eintraege) => {
        const el = document.getElementById(id);
        if (!el) return;
        const alt = el.value;
        el.innerHTML = `<option value="">${alleText}</option>` + eintraege.map(([wert, text]) => `<option value="${wert}">${text}</option>`).join('');
        el.value = eintraege.some(([wert]) => wert === alt) ? alt : '';
      };
      const jahre = [...new Set(plan.map(l => (l.startDatum || '').slice(0, 4)).filter(j => /^\d{4}$/.test(j)))].sort();
      fuelle('lehrgangFilterJahr', 'Alle Jahre', jahre.map(j => [j, j]));

      // Nur Lehrgänge, die bereits stattgefunden haben oder zu denen jemand angemeldet ist
      const namen = [...new Set(plan.filter(l => ['Angemeldet', 'Bestanden', 'Nicht bestanden'].includes(l.status)).map(l => l.titel).filter(Boolean))]
        .sort((a, b) => a.localeCompare(b, 'de'));
      fuelle('lehrgangFilterName', 'Alle Lehrgänge', namen.map(n => [n.replace(/"/g, '&quot;'), n]));

      const idsMitLehrgang = new Set(plan.map(l => l.memberId));
      const kameraden = appData.members.filter(m => idsMitLehrgang.has(m.id))
        .sort((a, b) => (a.nachname || '').localeCompare(b.nachname || '', 'de') || (a.vorname || '').localeCompare(b.vorname || '', 'de'));
      fuelle('lehrgangFilterKamerad', 'Alle Kameraden', kameraden.map(m => [m.id, `${m.nachname}, ${m.vorname}`]));
    }

    function matchesLehrgangSuche(l) {
      const val = (id) => { const el = document.getElementById(id); return el ? el.value : ''; };
      const status = val('lehrgangFilterStatus');
      const jahr = val('lehrgangFilterJahr');
      const name = val('lehrgangFilterName');
      const kamerad = val('lehrgangFilterKamerad');
      const start = l.startDatum || '';

      if (status && l.status !== status) return false;
      if (jahr && start.slice(0, 4) !== jahr) return false;
      if (name && l.titel !== name) return false;
      if (kamerad && l.memberId !== kamerad) return false;
      return true;
    }

    function resetLehrgangSuche() {
      ['lehrgangFilterStatus', 'lehrgangFilterJahr', 'lehrgangFilterName', 'lehrgangFilterKamerad'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
      renderApp();
    }

    // ===== LEHRGANGSSTUNDEN: werden automatisch berechnet =====
    // Feste Stundenzahlen je Lehrgang (Brandenburg, FTZ Kyritz): Samstage à 8 Stunden
    const FESTE_LEHRGANGSSTUNDEN = {
      'Truppführer Brandbekämpfung': 24,          // 3 Samstage à 8 h
      'Truppführer Technische Hilfe': 24,         // 3 Samstage à 8 h
      'Sprechfunker': 16,                         // 2 Ausbildungstage à 8 h (Theorie online + Praxis vor Ort), eingetragen über 3 Samstage
      'Atemschutzgeräteträger (AGT)': 24,         // 3 Samstage à 8 h
      'Maschinist für Löschfahrzeuge': 24         // 3 Samstage à 8 h
    };
    const KYRITZ_STUNDEN_PRO_TAG = 8; // 8:00 bis 16:00 Uhr

    // Lehrgänge ohne feste Stundenzahl und ohne Berechnungsregel: Stunden werden von Hand eingetragen
    const LEHRGANG_MANUELLE_STUNDEN = ['Gruppenführer online (e-F III)'];

    function istKyritz(ort) { return ort === 'FTZ Kyritz' || ort === 'Kreisebene OPR'; }
    function istLste(ort) { return typeof ort === 'string' && ort.startsWith('LSTE'); }
    function istWittstock(ort) { return ort === 'Stadt Wittstock/Dosse'; }

    // Lehrgänge in der Stadt Wittstock (zum Beispiel ABC): 8:00 bis 16:00 Uhr, also 8 Stunden je Tag (Mittagspause wird nicht abgezogen).
    // Gezählt werden die Tage von Montag bis Freitag im Zeitraum; liegt kein Werktag darin (zum Beispiel ein Samstag), zählen alle Tage.
    const WITTSTOCK_STUNDEN_PRO_TAG = 8;
    function wittstockTage(startIso, endeIso) {
      const a = kalIsoToDate(startIso);
      if (!a) return 0;
      let b = kalIsoToDate(endeIso) || a;
      if (b < a) b = a;
      let werktage = 0, alle = 0;
      for (let d = new Date(a); d <= b && alle < 400; d.setDate(d.getDate() + 1)) {
        alle++;
        if (d.getDay() !== 0 && d.getDay() !== 6) werktage++;
      }
      return werktage > 0 ? werktage : alle;
    }

    // Landesschule (LSTE): Montag bis Freitag, kein Wochenende.
    // Erster Tag: Beginn 9:30 Uhr. Freitag und letzter Tag: Ende 13:00 Uhr. Sonst (Annahme): 8:00 bis 16:00 Uhr.
    const LSTE_ZEITEN = { beginnErsterTag: 9.5, tagBeginn: 8, tagEnde: 16, freitagEnde: 13, letzterTagEnde: 13 };
    function lsteStunden(startIso, endeIso) {
      const a = kalIsoToDate(startIso);
      if (!a) return 0;
      let b = kalIsoToDate(endeIso) || a;
      if (b < a) b = a;
      const tage = [];
      for (let d = new Date(a); d <= b && tage.length < 400; d.setDate(d.getDate() + 1)) {
        if (d.getDay() !== 0 && d.getDay() !== 6) tage.push(new Date(d));
      }
      const z = LSTE_ZEITEN;
      let summe = 0;
      tage.forEach((d, i) => {
        const beginn = (i === 0) ? z.beginnErsterTag : z.tagBeginn;
        let ende = (d.getDay() === 5) ? z.freitagEnde : z.tagEnde;
        if (i === tage.length - 1) ende = Math.min(ende, z.letzterTagEnde);
        summe += Math.max(0, ende - beginn);
      });
      return summe;
    }

    // Ausbildungstage in Kyritz: nur die Samstage im Zeitraum (ohne Samstag alle Tage, einzelner Tag zählt als ein Tag)
    function kyritzTage(startIso, endeIso) {
      const a = kalIsoToDate(startIso);
      if (!a) return 0;
      let b = kalIsoToDate(endeIso) || a;
      if (b < a) b = a;
      let samstage = 0, alle = 0;
      for (let d = new Date(a); d <= b && alle < 400; d.setDate(d.getDate() + 1)) {
        alle++;
        if (d.getDay() === 6) samstage++;
      }
      return (b > a && samstage > 0) ? samstage : alle;
    }

    // Stunden eines Lehrgangs: 1. feste Vorgabe, 2. Kyritz = 8 h je Samstag, 3. LSTE = nach Uhrzeiten (Mo-Fr), 4. Wittstock = 8 h je Werktag, 5. sonst gespeicherte Stundenzahl
    function lehrgangStunden(l) {
      if (LEHRGANG_MANUELLE_STUNDEN.includes(l.titel)) return parseFloat(l.stunden) || 0;
      if (FESTE_LEHRGANGSSTUNDEN[l.titel]) return FESTE_LEHRGANGSSTUNDEN[l.titel];
      if (istKyritz(l.ort) && l.startDatum) return KYRITZ_STUNDEN_PRO_TAG * kyritzTage(l.startDatum, l.endeDatum || l.startDatum);
      if (istLste(l.ort) && l.startDatum) return lsteStunden(l.startDatum, l.endeDatum || l.startDatum);
      if (istWittstock(l.ort) && l.startDatum) return WITTSTOCK_STUNDEN_PRO_TAG * wittstockTage(l.startDatum, l.endeDatum || l.startDatum);
      return parseFloat(l.stunden) || 0;
    }

    // Das Stundenfeld wird nur gebraucht, wenn sich die Stunden nicht berechnen lassen (freier Lehrgang außerhalb von Kyritz)
    function lehrgangStundenFeldAktualisieren() {
      const gruppe = document.getElementById('lehrgangStundenGroup');
      if (!gruppe) return;
      const status = document.getElementById('lehrgangStatus').value;
      const titel = document.getElementById('lehrgangSelect').value;
      const ort = document.getElementById('lehrgangOrt').value;
      const berechenbar = FESTE_LEHRGANGSSTUNDEN[titel] || (!LEHRGANG_MANUELLE_STUNDEN.includes(titel) && (istKyritz(ort) || istLste(ort) || istWittstock(ort)));
      const zeigen = !berechenbar && status !== 'Beworben';
      gruppe.style.display = zeigen ? '' : 'none';
      document.getElementById('lehrgangStunden').required = zeigen;
    }

    function handleLehrgangSelectChange() {
      const sel = document.getElementById('lehrgangSelect');
      const customBox = document.getElementById('lehrgangCustomBox');
      const customInput = document.getElementById('lehrgangTitelCustom');
      const ortSelect = document.getElementById('lehrgangOrt');
      const stundenInput = document.getElementById('lehrgangStunden');

      const opt = sel.options[sel.selectedIndex];
      if (sel.value === 'Sonstiges') {
        customBox.style.display = 'block';
        customInput.required = true;
      } else {
        customBox.style.display = 'none';
        customInput.required = false;
        if (opt && opt.dataset.ort) ortSelect.value = opt.dataset.ort;
        stundenInput.value = (opt && opt.dataset.hours) ? opt.dataset.hours : '';
      }
      lehrgangKameradenAktualisieren();
      lehrgangStundenFeldAktualisieren();
    }

    // Lehrgänge, die noch nicht zu Ende sind, können nicht "Bestanden" / "Nicht bestanden" sein
    function lehrgangZukunftRegel(hinweis) {
      const statusEl = document.getElementById('lehrgangStatus');
      const start = document.getElementById('lehrgangStartDatum').value;
      const ende = document.getElementById('lehrgangEndeDatum').value || start;
      if (!ende) return;
      if (ende > kalKey(new Date()) && (statusEl.value === 'Bestanden' || statusEl.value === 'Nicht bestanden')) {
        statusEl.value = 'Angemeldet';
        if (hinweis) alert('Der Lehrgang liegt (zumindest teilweise) in der Zukunft. Der Status bleibt "Angemeldet", bis er stattgefunden hat.');
      }
    }

    function lehrgangStatusGeaendert() {
      toggleLehrgangFields();
      lehrgangZukunftRegel(true);
    }

    function toggleLehrgangFields() {
      const status = document.getElementById('lehrgangStatus').value;
      const section = document.getElementById('lehrgangDateHoursSection');
      const startInp = document.getElementById('lehrgangStartDatum');
      const endeInp = document.getElementById('lehrgangEndeDatum');
      const hInp = document.getElementById('lehrgangStunden');

      if (status === 'Beworben') {
        section.style.display = 'none';
        startInp.required = false;
        endeInp.required = false;
        hInp.required = false;
      } else {
        section.style.display = 'block';
        startInp.required = true;
        endeInp.required = true;
      }
      lehrgangStundenFeldAktualisieren();
    }

    // ===== VORAUSSETZUNGEN: im Lehrgangsformular nur Kameraden anzeigen, die den vorherigen Lehrgang abgeschlossen haben =====
    const LG_VORAUSSETZUNG_TEXT = {
      TM1: 'Truppmann Teil 1', TM2: 'Truppmann Teil 2', TF: 'Truppführer (Brand + TH)', GF: 'Gruppenführer', ZF: 'Zugführer',
      MA: 'Maschinist', AUSB: 'Ausbilder in der Feuerwehr (100)', AGW: 'Atemschutzgerätewart (130)',
      ABC: 'Führen im ABC-Einsatz (716)', OWFL: 'Ortswehrführer (039) oder Leiter einer FF (020)',
      AGAUSB: 'Kreisausbilder AGT (104), Fachlehrgang Ausbilder AGT (064) oder Atemschutzgerätewart (130)'
    };
    const LG_VORAUSSETZUNG = {
      'Truppmann Teil 2': ['TM1'],
      'Truppführer Brandbekämpfung': ['TM2'],
      'Truppführer Technische Hilfe': ['TM2'],
      'Gruppenführer (F III)': ['TF'],
      'Gruppenführer online (e-F III)': ['TF'],
      'Fortbildung Gruppenführer': ['GF'],
      'Zugführer (F IV)': ['GF'],
      'Verbandsführer (F/H VI)': ['ZF'],
      'Leiter einer Freiwilligen Feuerwehr (F V)': ['ZF'],
      'Ortswehrführer in einer Freiwilligen Feuerwehr': ['GF'],
      'Fortbildung Wehrführer / Ortswehrführer': ['OWFL'],
      'Führungshilfspersonal': ['GF'],
      'Vegetationsbrandbekämpfung': ['GF'],
      'Ausbilder in der Feuerwehr': ['GF'],
      'Kreisausbilder Atemschutzgeräteträger': ['GF', 'AGW', 'AUSB'],
      'Kreisausbilder ABC': ['GF', 'AUSB', 'ABC'],
      'Kreisausbilder Technische Hilfeleistung': ['GF', 'AUSB'],
      'Fachlehrgang Ausbilder Maschinisten': ['GF', 'MA', 'AUSB'],
      'Fachlehrgang Ausbilder Atemschutzgeräteträger': ['GF', 'AUSB'],
      'Fachlehrgang Ausbilder Technische Hilfeleistung': ['GF', 'AUSB'],
      'Ausbilder Brandübungshaus': ['AUSB', 'AGAUSB'],
      'Gerätewart': ['TF', 'MA'],
      'Atemschutzgerätewart': ['TF'],
      'Fortbildung Maschinisten – Maschinelle Zugeinrichtungen': ['TM2', 'MA'],
      'Führen im ABC-Einsatz': ['GF'],
      'Sicherheitsbeauftragte der Feuerwehren': ['TM2']
    };

    // Höhere Führungsstufe schließt die niedrigeren ein: VF > ZF > GF > TF > TM 2 > TM 1
    function hatLehrgangQualifikation(m, key) {
      const q = m.lehrgaenge || [];
      const hatVF = q.includes('VF');
      const hatZF = q.includes('ZF') || hatVF;
      const hatGF = q.includes('GF') || hatZF;
      const hatTF = (q.includes('TF Brand') && q.includes('TF TH')) || hatGF;
      const hatTM2 = q.includes('TM 2') || q.includes('TF Brand') || q.includes('TF TH') || hatTF;
      const hatTM1 = q.includes('TM 1') || hatTM2;
      switch (key) {
        case 'TM1': return hatTM1;
        case 'TM2': return hatTM2;
        case 'TF': return hatTF;
        case 'GF': return hatGF;
        case 'ZF': return hatZF;
        case 'MA': return q.includes('Maschinist');
        case 'AUSB': return q.includes('Ausbilder in der Feuerwehr');
        case 'AGW': return q.includes('Atemschutzgerätewart');
        case 'ABC': return q.includes('Führen im ABC-Einsatz');
        case 'OWFL': return q.includes('Ortswehrführer in einer Freiwilligen Feuerwehr') || q.includes('Leiter einer Freiwilligen Feuerwehr (F V)');
        case 'AGAUSB': return q.includes('Kreisausbilder Atemschutzgeräteträger') || q.includes('Fachlehrgang Ausbilder Atemschutzgeräteträger') || q.includes('Atemschutzgerätewart');
        default: return true;
      }
    }

    let lehrgangBearbeiteterKamerad = '';
    function lehrgangKameradenAktualisieren() {
      const sel = document.getElementById('lehrgangMemberSelect');
      const titel = document.getElementById('lehrgangSelect').value;
      const alt = sel.value;
      const regelnLehrgang = LG_VORAUSSETZUNG[titel] || [];
      const regeln = alt ? [] : regelnLehrgang; // ist bereits ein Kamerad gewählt, steht die volle Liste zur Verfügung
      // Bei der Auswahl für einen bestehenden Eintrag bleibt dessen Kamerad immer erhalten
      const erlaubt = appData.members.filter(m => m.id === lehrgangBearbeiteterKamerad || regeln.every(k => hatLehrgangQualifikation(m, k)));
      sel.innerHTML = '<option value="">-- Kamerad auswählen --</option>' + erlaubt.map(m => `<option value="${m.id}">${m.nachname}, ${m.vorname} (${dienstgradAnzeige(m)})</option>`).join('');
      sel.value = erlaubt.some(m => m.id === alt) ? alt : '';
      const hinweis = document.getElementById('lehrgangVoraussetzungHinweis');
      if (hinweis) {
        if (!regelnLehrgang.length) { hinweis.style.display = 'none'; hinweis.innerText = ''; }
        else {
          hinweis.style.display = '';
          const ohne = !appData.members.some(m => regelnLehrgang.every(k => hatLehrgangQualifikation(m, k)));
          hinweis.innerText = 'Voraussetzung: ' + regelnLehrgang.map(k => LG_VORAUSSETZUNG_TEXT[k]).join(' + ') + (ohne && !alt ? ' – kein Kamerad erfüllt das bisher. Fehlende Qualifikationen trägst du im Kamerad-Formular nach.' : '');
        }
      }
    }

    // Lehrgangsliste nach Kamerad filtern: nur Lehrgänge, die der gewählte Kamerad machen kann
    let lehrgangKatalogVorlage = null;
    let lehrgangBearbeiteterTitel = '';
    function lehrgangListeAktualisieren() {
      const sel = document.getElementById('lehrgangSelect');
      if (!lehrgangKatalogVorlage) lehrgangKatalogVorlage = sel.cloneNode(true);
      const memberId = document.getElementById('lehrgangMemberSelect').value;
      const m = appData.members.find(x => x.id === memberId);
      const alt = sel.value;
      const vorlage = lehrgangKatalogVorlage;

      sel.innerHTML = '';
      sel.appendChild(vorlage.querySelector(':scope > option[value=""]').cloneNode(true));
      vorlage.querySelectorAll(':scope > optgroup').forEach(g => {
        const ng = g.cloneNode(false);
        g.querySelectorAll('option').forEach(op => {
          const regeln = LG_VORAUSSETZUNG[op.value] || [];
          if (!m || op.value === lehrgangBearbeiteterTitel || regeln.every(k => hatLehrgangQualifikation(m, k))) ng.appendChild(op.cloneNode(true));
        });
        if (ng.children.length) sel.appendChild(ng);
      });
      sel.appendChild(vorlage.querySelector(':scope > option[value="Sonstiges"]').cloneNode(true));
      sel.value = Array.from(sel.options).some(o => o.value === alt) ? alt : '';

      const hinweis = document.getElementById('lehrgangListenHinweis');
      if (hinweis) {
        hinweis.style.display = m ? '' : 'none';
        hinweis.innerText = m ? `Zur Auswahl stehen nur Lehrgänge, die ${m.vorname} ${m.nachname} machen kann.` : '';
      }
    }

    function lehrgangKameradGewaehlt() {
      const vorher = document.getElementById('lehrgangSelect').value;
      lehrgangListeAktualisieren();
      if (document.getElementById('lehrgangSelect').value !== vorher) handleLehrgangSelectChange();
      else { lehrgangKameradenAktualisieren(); lehrgangStundenFeldAktualisieren(); }
    }

    function openLehrgangModal(lehrgangId = null) {
      document.getElementById('lehrgangForm').reset();
      const mSelect = document.getElementById('lehrgangMemberSelect');
      lehrgangBearbeiteterKamerad = '';
      lehrgangBearbeiteterTitel = '';
      lehrgangKameradenAktualisieren();
      lehrgangListeAktualisieren();

      const sel = document.getElementById('lehrgangSelect');
      const customBox = document.getElementById('lehrgangCustomBox');
      const customInput = document.getElementById('lehrgangTitelCustom');

      if (lehrgangId) {
        const l = (appData.lehrgangPlan || []).find(x => x.id === lehrgangId);
        if (l) {
          document.getElementById('lehrgangId').value = l.id;
          lehrgangBearbeiteterKamerad = l.memberId;
          lehrgangBearbeiteterTitel = l.titel;
          lehrgangKameradenAktualisieren();
          document.getElementById('lehrgangMemberSelect').value = l.memberId;
          lehrgangListeAktualisieren();
          
          let foundOption = false;
          for (let i = 0; i < sel.options.length; i++) {
            if (sel.options[i].value === l.titel) {
              sel.selectedIndex = i;
              foundOption = true;
              break;
            }
          }

          if (!foundOption) {
            sel.value = 'Sonstiges';
            customBox.style.display = 'block';
            customInput.value = l.titel;
          } else {
            customBox.style.display = 'none';
            customInput.value = '';
          }

          document.getElementById('lehrgangOrt').value = (l.ort === 'Kreisebene OPR' ? 'FTZ Kyritz' : l.ort) || 'FTZ Kyritz';
          document.getElementById('lehrgangStatus').value = l.status || 'Beworben';
          document.getElementById('lehrgangStartDatum').value = l.startDatum || '';
          document.getElementById('lehrgangEndeDatum').value = l.endeDatum || '';
          document.getElementById('lehrgangStunden').value = l.stunden || '';
          document.getElementById('lehrgangModalTitle').innerText = '✏️ Lehrgang bearbeiten';
        }
      } else {
        document.getElementById('lehrgangId').value = '';
        sel.selectedIndex = 0;
        customBox.style.display = 'none';
        customInput.value = '';
        document.getElementById('lehrgangStatus').value = 'Beworben';
        document.getElementById('lehrgangStartDatum').value = '';
        document.getElementById('lehrgangEndeDatum').value = '';
        document.getElementById('lehrgangStunden').value = '';
        document.getElementById('lehrgangModalTitle').innerText = '+ Lehrgang / Bewerbung erfassen';
      }
      
      lehrgangKameradenAktualisieren();
      toggleLehrgangFields();
      lehrgangStundenFeldAktualisieren();
      document.getElementById('modalLehrgang').style.display = 'flex';
    }

    // Qualifikation, die ein bestandener Lehrgang vergibt (ohne eigenes Kürzel gilt der Lehrgangsname)
    function lehrgangQualCode(titel) {
      let opt = null;
      if (lehrgangKatalogVorlage) opt = Array.from(lehrgangKatalogVorlage.querySelectorAll('option')).find(o => o.value === titel) || null;
      return mapLehrgangToQualificationCode(titel || '', opt) || titel;
    }

    // Wird ein bestandener Lehrgang auf "Nicht bestanden" (oder "Angemeldet"/"Beworben") zurückgestellt, entfällt die Qualifikation wieder –
    // außer ein anderer bestandener Lehrgang desselben Kameraden vergibt dieselbe Qualifikation.
    function lehrgangQualifikationEntfernen(l) {
      const m = appData.members.find(x => x.id === l.memberId);
      if (!m || !m.lehrgaenge) return;
      const code = lehrgangQualCode(l.titel);
      const anderer = (appData.lehrgangPlan || []).some(x => x.id !== l.id && x.memberId === l.memberId && x.status === 'Bestanden' && lehrgangQualCode(x.titel) === code);
      if (!anderer) m.lehrgaenge = m.lehrgaenge.filter(q => q !== code);
    }

    function mapLehrgangToQualificationCode(lehrgangTitle, optElement) {
      if (optElement && optElement.dataset && optElement.dataset.code) {
        return optElement.dataset.code === '-' ? null : optElement.dataset.code;
      }
      const t = lehrgangTitle.toLowerCase();
      if (t.includes('tf brand') || t.includes('truppführer brand')) return 'TF Brand';
      if (t.includes('tf th') || t.includes('truppführer th') || t.includes('truppführer technische hilfe')) return 'TF TH';
      if (t.includes('funk') || t.includes('sprechfunk')) return 'Funk';
      if (t.includes('atemschutz') || t.includes('agt')) return 'AGT';
      if (t.includes('maschinist')) return 'Maschinist';
      if (t.includes('truppmann 1') || t.includes('tm 1') || t.includes('tm1')) return 'TM 1';
      if (t.includes('truppmann 2') || t.includes('tm 2') || t.includes('tm2')) return 'TM 2';
      if (t.includes('gruppenführer') || t.includes('gf')) return 'GF';
      if (t.includes('zugführer') || t.includes('zf')) return 'ZF';
      if (t.includes('kettensäge') || t.includes('motorkettensäge')) return 'Motorkettensäge';
      if (t.includes('csa')) return 'CSA';
      return null;
    }

    function saveLehrgang(e) {
      e.preventDefault();
      const id = document.getElementById('lehrgangId').value || 'lg-' + Date.now();
      const memberId = document.getElementById('lehrgangMemberSelect').value;
      
      const sel = document.getElementById('lehrgangSelect');
      const opt = sel.options[sel.selectedIndex];
      let titel = sel.value;
      if (titel === 'Sonstiges') {
        titel = document.getElementById('lehrgangTitelCustom').value.trim();
      }

      const ort = document.getElementById('lehrgangOrt').value;
      let status = document.getElementById('lehrgangStatus').value;
      
      let startDatum = '';
      let endeDatum = '';
      let stunden = 0;

      if (status !== 'Beworben') {
        startDatum = document.getElementById('lehrgangStartDatum').value;
        endeDatum = document.getElementById('lehrgangEndeDatum').value;
        const feldSichtbar = document.getElementById('lehrgangStundenGroup').style.display !== 'none';
        const katalogStunden = (opt && opt.dataset.hours) ? parseFloat(opt.dataset.hours) : 0;
        stunden = lehrgangStunden({ titel, ort, startDatum, endeDatum, stunden: feldSichtbar ? (parseFloat(document.getElementById('lehrgangStunden').value) || 0) : katalogStunden });
      }

      if (!appData.lehrgangPlan) appData.lehrgangPlan = [];

      // Noch nicht beendete Lehrgänge bleiben "Angemeldet"
      if ((status === 'Bestanden' || status === 'Nicht bestanden') && (endeDatum || startDatum) > kalKey(new Date())) status = 'Angemeldet';

      const lObj = { id, memberId, titel, ort, startDatum, endeDatum, stunden, status };
      const idx = appData.lehrgangPlan.findIndex(x => x.id === id);
      const vorher = idx !== -1 ? Object.assign({}, appData.lehrgangPlan[idx]) : null;

      if (idx !== -1) {
        appData.lehrgangPlan[idx] = lObj;
      } else {
        appData.lehrgangPlan.push(lObj);
      }

      // War der Lehrgang bestanden und wird jetzt anders eingetragen: Qualifikation wieder entfernen
      if (vorher && vorher.status === 'Bestanden' && status !== 'Bestanden') lehrgangQualifikationEntfernen(vorher);

      if (status === 'Bestanden') {
        const m = appData.members.find(x => x.id === memberId);
        if (m) {
          if (!m.lehrgaenge) m.lehrgaenge = [];
          
          const qualCode = mapLehrgangToQualificationCode(titel, opt);
          if (qualCode) {
            if (!m.lehrgaenge.includes(qualCode)) {
              m.lehrgaenge.push(qualCode);
            }
          }
          if (!m.lehrgaenge.includes(titel) && !qualCode) {
            m.lehrgaenge.push(titel);
          }
        }
      }

      saveData();
      populateYearFilter();
      closeModal('modalLehrgang');
      alert(`Lehrgang gespeichert! ${status === 'Bestanden' ? 'Die Qualifikation wurde automatisch in der Mannschaftsverwaltung aktiviert.' : ''}`);
    }

    function deleteLehrgang(id) {
      if (!istSuperAdmin()) { alert('Lehrgänge darf nur der Super-Admin löschen.'); return; }
      if (confirm('Lehrgangseintrag wirklich löschen?')) {
        appData.lehrgangPlan = (appData.lehrgangPlan || []).filter(x => x.id !== id);
        saveData();
      }
    }    // Lehrgangsplanung: Tabelle mit Filter
    function lehrgaengeRendern() {
        const lBody = document.getElementById('lehrgangTableBody');
        if (lBody) {
          lBody.innerHTML = '';
          lehrgangFilterAktualisieren();
          const sortedLehrgaenge = [...(appData.lehrgangPlan || [])].sort((a,b) => {
            const dA = a.startDatum ? new Date(a.startDatum) : new Date('2099-01-01');
            const dB = b.startDatum ? new Date(b.startDatum) : new Date('2099-01-01');
            return dB - dA;
          }).filter(matchesLehrgangSuche);

          const lTrefferEl = document.getElementById('lehrgangSuchTreffer');
          if (lTrefferEl) lTrefferEl.innerText = `${sortedLehrgaenge.length} von ${(appData.lehrgangPlan || []).length} Einträgen`;
          let lFilterAktiv = false;
          ['lehrgangFilterStatus', 'lehrgangFilterJahr', 'lehrgangFilterName', 'lehrgangFilterKamerad'].forEach(id => {
            const el = document.getElementById(id);
            if (el) { el.classList.toggle('aktiv', !!el.value); if (el.value) lFilterAktiv = true; }
          });
          const lResetBtn = document.getElementById('lehrgangFilterReset');
          if (lResetBtn) lResetBtn.style.display = lFilterAktiv ? '' : 'none';
          if (sortedLehrgaenge.length === 0) {
            lBody.innerHTML = `<tr><td colspan="7" style="text-align:center; color:var(--text-muted); padding:1.5rem;">Keine Einträge gefunden.</td></tr>`;
          }

          sortedLehrgaenge.forEach(l => {
            const mem = appData.members.find(m => m.id === l.memberId);
            let sBadge = 'badge-tag';
            if (l.status === 'Bestanden') sBadge = 'badge-success';
            else if (l.status === 'Angemeldet') sBadge = 'badge-warning';
            else if (l.status === 'Beworben') sBadge = 'badge-info';
            else if (l.status === 'Nicht bestanden') sBadge = 'badge-danger';

            let dateDisplay = '- (Vorgemerkt)';
            if (l.startDatum && l.endeDatum) {
              dateDisplay = `${new Date(l.startDatum).toLocaleDateString('de-DE')} - ${new Date(l.endeDatum).toLocaleDateString('de-DE')}`;
            }

            const stundenDisplay = lehrgangStunden(l) ? `${lehrgangStunden(l).toFixed(1)} h` : '-';

            lBody.innerHTML += `
              <tr>
                <td><strong>${mem ? mem.nachname + ', ' + mem.vorname : 'Unbekannt'}</strong></td>
                <td><strong>${l.titel}</strong></td>
                <td>${l.ort}</td>
                <td>${dateDisplay}</td>
                <td><strong style="color:#a78bfa;">${stundenDisplay}</strong></td>
                <td><span class="badge ${sBadge}">${l.status}</span></td>
                <td>
                  <button class="btn btn-secondary btn-sm" onclick="openLehrgangModal('${l.id}')">✏️ Bearbeiten</button>
                  <button class="btn btn-danger btn-sm" data-nur-super onclick="deleteLehrgang('${l.id}')">🗑️</button>
                </td>
              </tr>
            `;
          });
        }

    }
