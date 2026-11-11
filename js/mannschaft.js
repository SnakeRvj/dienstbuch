// FF Christdorf Dienstbuch – Mannschaft: Mannschaftsliste (Sortierung, Filter, Qualifikationsübersicht), Kamerad-Formular
// (klassische Skriptdatei: alle Funktionen sind global und werden von den anderen Dateien genutzt)

    function updateGeschlechtLabels() {
      const weiblich = document.getElementById('memberGeschlecht').value === 'w';
      document.querySelectorAll('#memberDienstgrad option').forEach(opt => {
        opt.textContent = weiblich ? (DIENSTGRAD_W[opt.value] || opt.value) : opt.value;
      });
      document.querySelectorAll('#memberFunktion option').forEach(opt => {
        if (!opt.dataset.base) opt.dataset.base = opt.textContent;
        opt.textContent = (weiblich && FUNKTION_W[opt.value]) ? opt.dataset.base.replace(opt.value, FUNKTION_W[opt.value]) : opt.dataset.base;
      });
    }

    // ===== MANNSCHAFTSLISTE: Sortierung, Gruppen, Filter, Qualifikationsübersicht =====
    let mlAnsicht = 'liste';
    function mlAnsichtWechseln(a) { mlAnsicht = a; renderApp(); }

    const ML_STATUS_REIHENFOLGE = ['Aktiv', 'Nicht einsatzfähig', 'Reserve', 'Altersabteilung', 'Inaktiv'];
    const ML_STATUS_TITEL = { 'Aktiv': 'Aktiv (einsatzfähig)', 'Nicht einsatzfähig': 'Nicht einsatzfähig', 'Reserve': 'Reserve', 'Altersabteilung': 'Alters- und Ehrenabteilung', 'Inaktiv': 'Inaktiv' };
    const ML_DIENSTGRADE = ['Feuerwehrmann-Anwärter', 'Feuerwehrmann', 'Oberfeuerwehrmann', 'Hauptfeuerwehrmann', 'Löschmeister', 'Oberlöschmeister', 'Hauptlöschmeister', 'Erster Hauptlöschmeister', 'Brandmeister', 'Oberbrandmeister', 'Hauptbrandmeister'];
    const ML_FACH = [['AGT', 'AGT'], ['Maschinist', 'Maschinist'], ['Funk', 'Funk'], ['Motorkettensäge', 'Kettensäge'], ['CSA', 'CSA']];
    const ML_SANITAETER = ['Rettungssanitäter', 'Rettungsassistent', 'Notfallsanitäter'];
    const ML_STANDARD_FUNKTION = 'Einsatzkraft (ohne Sonderfunktion)';

    function mlHatQual(m, key) {
      const q = m.lehrgaenge || [];
      const sani = ML_SANITAETER.some(s => q.includes(s));
      switch (key) {
        case 'AGT': case 'Maschinist': case 'Funk': case 'Motorkettensäge': case 'CSA': return q.includes(key);
        case 'ERSTHELFER': return q.includes('Erste Hilfe') || sani;
        case 'SANITAETER': return sani;
        case 'TF': return hatLehrgangQualifikation(m, 'TF');
        case 'GF': return hatLehrgangQualifikation(m, 'GF');
        case 'ZF': return hatLehrgangQualifikation(m, 'ZF');
        case 'VF': return q.includes('VF');
        case 'AUSB': return q.includes('Ausbilder in der Feuerwehr');
        case 'GERAETEWART': return q.includes('Gerätewart');
        case 'AGW': return q.includes('Atemschutzgerätewart');
        default: return true;
      }
    }

    function mlRangWert(m) {
      if (mlHatQual(m, 'VF')) return 6;
      if (hatLehrgangQualifikation(m, 'ZF')) return 5;
      if (hatLehrgangQualifikation(m, 'GF')) return 4;
      if (hatLehrgangQualifikation(m, 'TF')) return 3;
      if (hatLehrgangQualifikation(m, 'TM2')) return 2;
      if (hatLehrgangQualifikation(m, 'TM1')) return 1;
      return 0;
    }

    function mlVergleichen(sortierung) {
      const name = (a, b) => (a.nachname || '').localeCompare(b.nachname || '', 'de') || (a.vorname || '').localeCompare(b.vorname || '', 'de');
      const funktionsWert = m => m.funktion === 'Ortswehrführer' ? 0 : (m.funktion === 'Stellv. Ortswehrführer' ? 1 : 2);
      if (sortierung === 'az') return name;
      if (sortierung === 'nummer') return (a, b) => ((parseInt(a.personalnummer) || 9999) - (parseInt(b.personalnummer) || 9999)) || name(a, b);
      if (sortierung === 'dienstgrad') return (a, b) => (ML_DIENSTGRADE.indexOf(b.dienstgrad) - ML_DIENSTGRADE.indexOf(a.dienstgrad)) || name(a, b);
      return (a, b) => (funktionsWert(a) - funktionsWert(b)) || name(a, b); // Führung zuerst
    }

    function mlAlter(iso) {
      const t = String(iso).split('-');
      const g = new Date(parseInt(t[0]), parseInt(t[1]) - 1, parseInt(t[2]));
      const h = new Date();
      let a = h.getFullYear() - g.getFullYear();
      if (h.getMonth() < g.getMonth() || (h.getMonth() === g.getMonth() && h.getDate() < g.getDate())) a--;
      return a;
    }

    function mlTageBisGeburtstag(iso) {
      const t = String(iso).split('-');
      const h = new Date(); h.setHours(0, 0, 0, 0);
      let n = new Date(h.getFullYear(), parseInt(t[1]) - 1, parseInt(t[2]));
      if (n < h) n = new Date(h.getFullYear() + 1, parseInt(t[1]) - 1, parseInt(t[2]));
      return Math.round((n - h) / 86400000);
    }

    // Qualifikationen eines Kameraden, aufgeteilt in Rang, Fachqualifikationen, Medizin und weitere Lehrgänge
    function mlQualifikationen(m) {
      const q = m.lehrgaenge || [];
      const hasVf = q.includes('VF'), hasZf = q.includes('ZF') || hasVf, hasGf = q.includes('GF') || hasZf;
      const hasTfBrand = q.includes('TF Brand'), hasTfTh = q.includes('TF TH');
      const rang = [], fach = [], med = [], sonst = [];
      const rangCodes = ['TM 1', 'TM 2', 'TF Brand', 'TF TH', 'GF', 'ZF', 'VF'];

      if (hasVf) rang.push('<span class="badge badge-success" title="Verbandsführer">⭐ VF</span>');
      else if (hasZf) rang.push('<span class="badge badge-success" title="Zugführer">⭐ ZF</span>');
      else if (hasGf) rang.push('<span class="badge badge-success" title="Gruppenführer">⭐ GF</span>');
      else if (hasTfBrand && hasTfTh) rang.push('<span class="badge badge-success" title="Truppführer vollständig (Brand + TH)">⭐ TF komplett</span>');
      else {
        if (q.includes('TM 2')) rang.push('<span class="badge badge-success" title="Truppmann Teil 2">⭐ TM 2</span>');
        else if (q.includes('TM 1')) rang.push('<span class="badge badge-success" title="Truppmann Teil 1">⭐ TM 1</span>');
        if (hasTfBrand) rang.push('<span class="badge badge-danger" title="Truppführer Brandbekämpfung">🔥 TF Brand</span>');
        if (hasTfTh) rang.push('<span class="badge badge-info" title="Truppführer Technische Hilfe">🚗 TF TH</span>');
      }

      ML_FACH.forEach(([code, label]) => { if (q.includes(code)) fach.push(`<span class="badge badge-tag">${label}</span>`); });
      // Medizinische Qualifikationen werden vorerst nicht angezeigt (bleiben aber gespeichert)
      q.forEach(l => {
        if (rangCodes.includes(l) || ML_FACH.some(f => f[0] === l) || l === 'Erste Hilfe' || ML_SANITAETER.includes(l)) return;
        sonst.push(`<span class="badge badge-tag">${l}</span>`);
      });
      return { rang, fach, med, sonst };
    }

    // Qualifikationen, die als Filter und in der Qualifikationsübersicht angeboten werden (nur solche, die es in der Wehr gibt)
    const ML_QUAL_AUSWAHL = [
      ['AGT', 'Atemschutzgeräteträger (AGT)'], ['Maschinist', 'Maschinist'], ['Funk', 'Sprechfunker'], ['Motorkettensäge', 'Motorkettensäge'], ['CSA', 'CSA-Träger'],
      ['TF', 'Truppführer komplett'], ['GF', 'Gruppenführer (oder höher)'], ['ZF', 'Zugführer (oder höher)'], ['VF', 'Verbandsführer'],
      ['AUSB', 'Ausbilder in der Feuerwehr'], ['GERAETEWART', 'Gerätewart'], ['AGW', 'Atemschutzgerätewart']
    ];
    const ML_MATRIX_SPALTEN = [['AGT', 'AGT'], ['Maschinist', 'Maschinist'], ['Funk', 'Funk'], ['Motorkettensäge', 'Kettensäge'], ['CSA', 'CSA'], ['AUSB', 'Ausbilder'], ['GERAETEWART', 'Gerätewart'], ['AGW', 'Atemschutzgerätewart']];

    function mlFilterZuruecksetzen() {
      const el = document.getElementById('mlFilterQual');
      if (el) el.value = '';
      renderApp();
    }

    function mannschaftslisteRendern() {
      const memBody = document.getElementById('membersTableBody');
      const matrixBody = document.getElementById('mlMatrixBody');
      if (!memBody || !matrixBody) return;

      // Qualifikations-Auswahl: nur Qualifikationen, die es in der Wehr tatsächlich gibt
      const selQ = document.getElementById('mlFilterQual');
      const altQ = selQ.value;
      const vorhanden = ML_QUAL_AUSWAHL.filter(([k]) => appData.members.some(m => mlHatQual(m, k)));
      selQ.innerHTML = '<option value="">Alle Qualifikationen</option>' + vorhanden.map(([k, l]) => `<option value="${k}">${l}</option>`).join('');
      selQ.value = vorhanden.some(([k]) => k === altQ) ? altQ : '';

      const fQual = selQ.value;
      const sortierung = document.getElementById('mlSortierung').value;

      const gefiltert = appData.members.filter(m => !fQual || mlHatQual(m, fQual));

      selQ.classList.toggle('aktiv', !!fQual);
      document.getElementById('mlFilterReset').style.display = fQual ? '' : 'none';
      document.getElementById('mlTreffer').innerText = `${gefiltert.length} von ${appData.members.length} Kameraden`;

      // Ansicht umschalten
      document.getElementById('mlTabelleListe').style.display = mlAnsicht === 'liste' ? '' : 'none';
      document.getElementById('mlTabelleMatrix').style.display = mlAnsicht === 'matrix' ? '' : 'none';
      document.getElementById('mlBtnListe').classList.toggle('aktiv', mlAnsicht === 'liste');
      document.getElementById('mlBtnMatrix').classList.toggle('aktiv', mlAnsicht === 'matrix');

      // Gruppen nach Status
      const statusListe = [...ML_STATUS_REIHENFOLGE, ...new Set(gefiltert.map(m => m.status || 'Aktiv').filter(s => !ML_STATUS_REIHENFOLGE.includes(s)))];
      const vergleich = mlVergleichen(sortierung);
      const gruppen = statusListe.map(st => ({ st, liste: gefiltert.filter(m => (m.status || 'Aktiv') === st).sort(vergleich) })).filter(g => g.liste.length);

      const nameZelle = m => `<td><strong>${m.nachname || ''}</strong><br>${m.vorname || ''}</td>`;
      let html = '', matrixHtml = '';

      if (!gruppen.length) {
        html = '<tr><td colspan="7" style="text-align:center; color:var(--text-muted); padding:1.5rem;">Keine Kameraden gefunden.</td></tr>';
        matrixHtml = '<tr><td colspan="8" style="text-align:center; color:var(--text-muted); padding:1.5rem;">Keine Kameraden gefunden.</td></tr>';
      }

      // Qualifikationsübersicht: nur Spalten für Qualifikationen, die es in der Wehr gibt
      const matrixSpalten = ML_MATRIX_SPALTEN.filter(([k]) => appData.members.some(m => mlHatQual(m, k)));
      const spaltenAnzahl = 2 + matrixSpalten.length;
      document.getElementById('mlMatrixKopf').innerHTML = '<tr><th>Name</th><th>Rang</th>' + matrixSpalten.map(([, l]) => `<th>${l}</th>`).join('') + '</tr>';
      if (gruppen.length) {
        matrixHtml += `<tr class="matrix-summe"><td>Anzahl</td><td></td>${matrixSpalten.map(([k]) => `<td>${gefiltert.filter(m => mlHatQual(m, k)).length}</td>`).join('')}</tr>`;
      }

      gruppen.forEach(g => {
        const kopf = `<tr class="gruppen-kopf"><td colspan="COLS">${ML_STATUS_TITEL[g.st] || g.st}<span class="gruppen-zahl">${g.liste.length}</span></td></tr>`;
        html += kopf.replace('COLS', 7);
        matrixHtml += kopf.replace('COLS', spaltenAnzahl);

        g.liste.forEach(m => {
          const qs = mlQualifikationen(m);

          let geb = '';
          if (m.geburtsdatum && /^\d{4}-\d{2}-\d{2}$/.test(m.geburtsdatum)) {
            const [gy, gm, gd] = m.geburtsdatum.split('-');
            const tage = mlTageBisGeburtstag(m.geburtsdatum);
            const marke = tage === 0 ? ' <span title="Heute Geburtstag">🎂 heute</span>' : (tage <= 7 ? ` <span title="Geburtstag in ${tage} Tagen">🎂 in ${tage} T.</span>` : '');
            geb = `${gd}.${gm}.${gy} <small>(${mlAlter(m.geburtsdatum)})</small>${marke}`;
          }

          const funktion = (m.funktion && m.funktion !== ML_STANDARD_FUNKTION && m.funktion !== 'Einsatzkraft') ? funktionAnzeige(m) : '';
          const qualis = [...qs.fach, ...qs.med, ...qs.sonst].join(' ');

          html += `
            <tr>
              ${nameZelle(m)}
              <td>${dienstgradAnzeige(m)}</td>
              <td>${funktion}</td>
              <td class="ml-geb">${geb}</td>
              <td>${qs.rang.join(' ')}</td>
              <td>${qualis}</td>
              <td style="white-space:nowrap;">
                <button class="btn btn-secondary btn-sm ml-icon" title="Bearbeiten" onclick="openMemberModal('${m.id}')">✏️</button>
                <button class="btn btn-danger btn-sm ml-icon" title="Löschen" onclick="deleteMember('${m.id}')">🗑️</button>
              </td>
            </tr>`;

          const haken = k => mlHatQual(m, k) ? '<span class="ml-haken">✓</span>' : '';
          matrixHtml += `
            <tr>
              ${nameZelle(m)}
              <td>${qs.rang.join(' ')}</td>
              ${matrixSpalten.map(([k]) => `<td>${haken(k)}</td>`).join('')}
            </tr>`;
        });
      });

      memBody.innerHTML = html;
      matrixBody.innerHTML = matrixHtml;
    }

    function openMemberModal(memberId = null) {
      document.getElementById('memberForm').reset();
      updateGeschlechtLabels();
      document.querySelectorAll('#lehrgangGrid input').forEach(c => c.checked = false);
      document.getElementById('weitereQuals').innerHTML = '';
      memberVerborgeneQuals = [];
      memberTabWechseln('person');

      if (memberId) {
        const m = appData.members.find(x => x.id === memberId);
        if (m) {
          document.getElementById('memberId').value = m.id;
          document.getElementById('memberPersonalnummer').value = m.personalnummer !== undefined ? m.personalnummer : '';
          document.getElementById('memberStatus').value = m.status || 'Aktiv';
          document.getElementById('memberVorname').value = m.vorname || '';
          document.getElementById('memberNachname').value = m.nachname || '';
          document.getElementById('memberGeburtsdatum').value = m.geburtsdatum || '';
          document.getElementById('memberGeschlecht').value = m.geschlecht === 'w' ? 'w' : 'm';
          updateGeschlechtLabels();
          document.getElementById('memberDienstgrad').value = m.dienstgrad;
          document.getElementById('memberFunktion').value = m.funktion;
          document.getElementById('memberG26').value = m.g26Ablauf || '';
          document.getElementById('memberStrecke').value = m.streckeDatum || '';
          document.getElementById('memberCsa').value = m.csaDatum || '';

          const q = m.lehrgaenge || [];
          document.getElementById('memberRang').value = memberRangAusQuals(q);
          q.forEach(lg => {
            if (MF_RANG_KETTE.includes(lg)) return;
            if (MF_VERBORGEN.includes(lg)) { memberVerborgeneQuals.push(lg); return; }
            const cb = Array.from(document.querySelectorAll('#lehrgangGrid input[name="lg"]')).find(c => c.value === lg);
            if (cb) cb.checked = true;
            else document.getElementById('weitereQuals').appendChild(memberWeitereMarke(lg));
          });
          document.getElementById('memberModalTitle').innerText = 'Kamerad bearbeiten';
        }
      } else {
        document.getElementById('memberId').value = '';
        
        let maxNr = 0;
        appData.members.forEach(m => {
          const nr = parseInt(m.personalnummer) || 0;
          if (nr > maxNr) maxNr = nr;
        });
        document.getElementById('memberPersonalnummer').value = '';
        document.getElementById('memberStatus').value = 'Aktiv';
        document.getElementById('memberModalTitle').innerText = 'Neuen Kameraden aufnehmen';
      }
      memberFachAktualisieren();
      memberFristenAktualisieren();
      memberWeitereHinweis();
      document.getElementById('modalMember').style.display = 'flex';
    }

    // ===== KAMERAD-FORMULAR: Reiter, Rang-Auswahl, Fristen =====
    const MF_RANG_KETTE = ['TM 1', 'TM 2', 'TF Brand', 'TF TH', 'GF', 'ZF', 'VF'];
    const MF_FACH_CODES = ['AGT', 'Maschinist', 'Funk', 'Motorkettensäge', 'CSA'];
    const MF_VERBORGEN = ['Erste Hilfe', 'Rettungssanitäter', 'Rettungsassistent', 'Notfallsanitäter']; // Medizin: vorerst nicht im Formular, bleibt aber gespeichert
    let memberVerborgeneQuals = [];

    function memberRangAusQuals(q) {
      if (q.includes('VF')) return 'VF';
      if (q.includes('ZF')) return 'ZF';
      if (q.includes('GF')) return 'GF';
      if (q.includes('TF Brand') && q.includes('TF TH')) return 'TF komplett';
      if (q.includes('TF Brand')) return 'TF Brand';
      if (q.includes('TF TH')) return 'TF TH';
      if (q.includes('TM 2')) return 'TM 2';
      if (q.includes('TM 1')) return 'TM 1';
      return '';
    }

    // Ein höherer Rang schließt die niedrigeren ein
    function memberRangFlags(rang) {
      switch (rang) {
        case 'TM 1': return ['TM 1'];
        case 'TM 2': return ['TM 1', 'TM 2'];
        case 'TF Brand': return ['TM 1', 'TM 2', 'TF Brand'];
        case 'TF TH': return ['TM 1', 'TM 2', 'TF TH'];
        case 'TF komplett': return ['TM 1', 'TM 2', 'TF Brand', 'TF TH'];
        case 'GF': return ['TM 1', 'TM 2', 'TF Brand', 'TF TH', 'GF'];
        case 'ZF': return ['TM 1', 'TM 2', 'TF Brand', 'TF TH', 'GF', 'ZF'];
        case 'VF': return ['TM 1', 'TM 2', 'TF Brand', 'TF TH', 'GF', 'ZF', 'VF'];
        default: return [];
      }
    }

    // Welche Fachgebiete sind nach dem gewählten Rang möglich? (FwDV 2: Sprechfunker, AGT nach Truppmann Teil 1; Maschinist nach Truppmann Teil 1 + 2; CSA setzt AGT voraus)
    function memberFachAktualisieren() {
      const flags = memberRangFlags(document.getElementById('memberRang').value);
      const hatTM1 = flags.includes('TM 1'), hatTM2 = flags.includes('TM 2');
      const boxen = Array.from(document.querySelectorAll('#lehrgangGrid input[name="lg"]'));
      const agt = boxen.some(c => c.value === 'AGT' && c.checked);
      const erlaubt = { Funk: hatTM1, AGT: hatTM1, 'Motorkettensäge': hatTM1, Maschinist: hatTM2, CSA: agt };
      let sichtbar = 0;
      boxen.forEach(c => {
        const zeigen = !!erlaubt[c.value] || c.checked; // bereits gesetzte Qualifikationen bleiben sichtbar
        c.closest('label').style.display = zeigen ? '' : 'none';
        if (zeigen) sichtbar++;
      });
      document.getElementById('fachHinweis').style.display = sichtbar ? 'none' : '';
      document.getElementById('lehrgangGrid').style.display = sichtbar ? '' : 'none';
    }

    function memberTabWechseln(tab) {
      document.querySelectorAll('.mf-tab').forEach(b => b.classList.toggle('aktiv', b.dataset.tab === tab));
      ['person', 'dienst', 'quali'].forEach(t => { const el = document.getElementById('mfPanel-' + t); if (el) el.style.display = (t === tab) ? '' : 'none'; });
    }

    // Fristen nur zeigen, wenn die Qualifikation vorhanden ist
    function memberFristenAktualisieren() {
      const an = v => { const cb = Array.from(document.querySelectorAll('#lehrgangGrid input[name="lg"]')).find(c => c.value === v); return !!(cb && cb.checked); };
      document.getElementById('mfFristAgt').style.display = an('AGT') ? '' : 'none';
      document.getElementById('mfFristCsa').style.display = an('CSA') ? '' : 'none';
    }

    // Pflichtfelder prüfen; fehlt etwas, springt das Formular zum passenden Reiter
    function memberFormPruefen() {
      const felder = Array.from(document.querySelectorAll('#memberForm [required]'));
      for (const f of felder) {
        if (!String(f.value).trim()) {
          const panel = f.closest('.mf-panel');
          if (panel) memberTabWechseln(panel.id.replace('mfPanel-', ''));
          f.focus();
          if (f.reportValidity) f.reportValidity();
          return false;
        }
      }
      return true;
    }

    function memberWeitereMarke(q) {
      const chip = document.createElement('span');
      chip.className = 'qual-chip';
      chip.dataset.q = q;
      chip.appendChild(document.createTextNode(q));
      const x = document.createElement('button');
      x.type = 'button'; x.title = 'Entfernen'; x.textContent = '✕';
      x.onclick = () => { chip.remove(); memberWeitereHinweis(); };
      chip.appendChild(x);
      return chip;
    }
    function memberWeitereHinweis() {
      const box = document.getElementById('weitereQuals');
      const hinweis = box.querySelector('.leer-hinweis');
      const hatChips = !!box.querySelector('.qual-chip');
      if (!hatChips && !hinweis) { const s = document.createElement('span'); s.className = 'leer-hinweis'; s.style.cssText = 'color:var(--text-muted); font-size:0.8rem;'; s.textContent = 'Keine weiteren Lehrgänge.'; box.appendChild(s); }
      if (hatChips && hinweis) hinweis.remove();
    }

    function saveMember(e) {
      e.preventDefault();
      if (!memberFormPruefen()) return;
      const id = document.getElementById('memberId').value || 'mem-' + Date.now();
      // Die Nummer wird automatisch vergeben: neue Kameraden erhalten die kleinste freie Nummer (frei gewordene Nummern werden wieder verwendet)
      const pnrAlt = parseInt(document.getElementById('memberPersonalnummer').value);
      const bestehend = document.getElementById('memberId').value;
      const belegt = new Set(appData.members.filter(x => x.id !== id).map(x => parseInt(x.personalnummer)).filter(n => n > 0 && n < 9999));
      let personalnummer = (bestehend && pnrAlt > 0 && pnrAlt < 9999 && !belegt.has(pnrAlt)) ? pnrAlt : 1;
      if (!(bestehend && pnrAlt > 0 && pnrAlt < 9999 && !belegt.has(pnrAlt))) { while (belegt.has(personalnummer)) personalnummer++; }
      const status = document.getElementById('memberStatus').value;
      const vorname = document.getElementById('memberVorname').value.trim();
      const nachname = document.getElementById('memberNachname').value.trim();
      const geburtsdatum = document.getElementById('memberGeburtsdatum').value;
      const geschlecht = document.getElementById('memberGeschlecht').value;
      const dienstgrad = document.getElementById('memberDienstgrad').value;
      const funktion = document.getElementById('memberFunktion').value;
      const g26Ablauf = document.getElementById('memberG26').value;
      const streckeDatum = document.getElementById('memberStrecke').value;
      const csaDatum = document.getElementById('memberCsa').value;

      const fachAngehakt = Array.from(document.querySelectorAll('#lehrgangGrid input:checked')).map(c => c.value);
      const weitere = Array.from(document.querySelectorAll('#weitereQuals .qual-chip')).map(c => c.dataset.q);
      const lehrgaenge = [...new Set([...memberRangFlags(document.getElementById('memberRang').value), ...fachAngehakt, ...weitere, ...memberVerborgeneQuals])];

      const existingIdx = appData.members.findIndex(m => m.id === id);

      const memberObj = {
        id, personalnummer, status, vorname, nachname, geburtsdatum, geschlecht, dienstgrad, funktion, lehrgaenge,
        g26Ablauf, streckeDatum, csaDatum
      };

      if (existingIdx !== -1) {
        appData.members[existingIdx] = memberObj;
      } else {
        appData.members.push(memberObj);
      }

      sortMembers();
      saveData();
      closeModal('modalMember');
    }

    function deleteMember(id) {
      if (confirm('Kamerad wirklich löschen?')) {
        appData.members = appData.members.filter(m => m.id !== id);
        saveData();
      }
    }
