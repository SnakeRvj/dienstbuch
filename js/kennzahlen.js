// FF Christdorf Dienstbuch – Kennzahlen: die vier Kacheln oben (Ausbildung, Einsätze, Stunden gesamt, Mannschaft)
// (klassische Skriptdatei: alle Funktionen sind global und werden von den anderen Dateien genutzt)

    // Die vier Kennzahlen-Kacheln oben
    function kennzahlenRendern(curYear, memberHours) {
        // ===== KENNZAHLEN OBEN (vier Kacheln) =====
        const setze = (id, text) => { const el = document.getElementById(id); if (el) el.innerText = text; };
        const zahl1 = n => n.toFixed(1).replace('.', ',');
        const tageText = n => `${n} ${n === 1 ? 'Tag' : 'Tage'}`;
        const ampel = p => p < 30 ? '#ef4444' : (p < 55 ? '#facc15' : '#22c55e'); // unter 30 % rot, bis unter 55 % gelb, ab 55 % grün


        const jahrDe = d => new Date(d.datumVon || d.datum).getFullYear() === curYear;
        const dStat = d => d.status || 'Durchgeführt';
        const istAusb = d => d.typ === 'Ausbildung' || d.typ === 'UVV';

        // Kameraden im aktiven Dienst: Status "Aktiv" und "Nicht einsatzfähig" (sie nehmen weiter an der Ausbildung teil)
        const activeMembers = appData.members.filter(m => m.status === 'Aktiv' || m.status === 'Nicht einsatzfähig');
        const aktiveIds = new Set(activeMembers.map(m => m.id));

        // --- Ausbildung: Tage (blau im Kalender: Ausbildung/Übung und UVV), Stunden, Beteiligung ---
        const tageIst = new Set(), tagePlan = new Set();
        let ausbStdIst = 0, ausbStdPlan = 0;
        appData.dienste.forEach(d => {
          if (!istAusb(d) || !jahrDe(d)) return;
          const start = d.datumVon || d.datum;
          const dauer = parseFloat(d.dauer) || 0;
          if (dStat(d) === 'Durchgeführt') { tageIst.add(start); ausbStdIst += dauer; }
          else if (dStat(d) === 'Geplant') { tagePlan.add(start); ausbStdPlan += dauer; }
        });
        let bDienste = 0, bQuoteSumme = 0, bTeilnahmen = 0;
        if (activeMembers.length) {
          appData.dienste.forEach(d => {
            if (dStat(d) !== 'Durchgeführt') return;
            // Beteiligung Ausbildung: nur Dienste, bei denen alle Aktiven teilnehmen sollen
            if (!['Ausbildung', 'UVV', 'Arbeitsdienst', 'Versammlung'].includes(d.typ)) return;
            if (!jahrDe(d)) return;
            const anwesend = (d.teilnehmer || []).filter(id => aktiveIds.has(id)).length;
            bDienste++;
            bQuoteSumme += anwesend / activeMembers.length;
            bTeilnahmen += anwesend;
          });
        }
        const bProzent = bDienste ? Math.round((bQuoteSumme / bDienste) * 100) : 0;
        setze('kzAusbildungTitel', `Ausbildung ${curYear}`);
        const kzAusbProz = document.getElementById('kzAusbildungProzent');
        if (kzAusbProz) {
          kzAusbProz.innerHTML = `${bProzent}%<small>Beteiligung</small>`;
          kzAusbProz.style.color = bDienste ? ampel(bProzent) : '';
        }
        setze('kzAusbildungSchnitt', bDienste ? `Ø ${zahl1(bTeilnahmen / bDienste)} von ${activeMembers.length} Kameraden pro Dienst` : `Noch keine durchgeführten Dienste in ${curYear}`);
        const tageGesamt = tageIst.size + tagePlan.size;
        const balken = document.getElementById('kzAusbildungBalken');
        if (balken) balken.style.display = tageGesamt ? '' : 'none';
        const bi = document.getElementById('kzBalkenIst'), bp = document.getElementById('kzBalkenPlan');
        if (bi && bp && tageGesamt) { bi.style.width = (tageIst.size / tageGesamt * 100) + '%'; bp.style.width = (tagePlan.size / tageGesamt * 100) + '%'; }
        setze('kzAusbildungFortschritt', tageGesamt ? `${tageIst.size} von ${tageGesamt} Ausbildungstagen durchgeführt` : '');
        setze('kzAusbildungTage', `${tageIst.size} durchgeführt · ${tagePlan.size} geplant`);
        setze('kzAusbildungStunden', `${zahl1(ausbStdIst)} h geleistet · ${zahl1(ausbStdPlan)} h geplant`);

        // --- Einsätze: Anzahl, Arten, Beteiligung der einsatzfähigen Kameraden, Einsatzzeit ---
        const einsatzfaehigeIds = new Set(appData.members.filter(m => m.status === 'Aktiv').map(m => m.id));
        let nEinsaetze = 0, eQuoteSumme = 0, eTeilnahmen = 0, eStunden = 0, nBrand = 0, nHilfe = 0, nSonst = 0;
        appData.dienste.forEach(d => {
          if (d.typ !== 'Einsatz' || dStat(d) !== 'Durchgeführt' || !jahrDe(d)) return;
          nEinsaetze++;
          eStunden += parseFloat(d.dauer) || 0;
          const art = einsatzArtVon(d);
          if (art === 'B') nBrand++; else if (art === 'TH') nHilfe++; else nSonst++;
          if (einsatzfaehigeIds.size) {
            const anwesend = (d.teilnehmer || []).filter(id => einsatzfaehigeIds.has(id)).length;
            eQuoteSumme += anwesend / einsatzfaehigeIds.size;
            eTeilnahmen += anwesend;
          }
        });
        const eProzent = nEinsaetze && einsatzfaehigeIds.size ? Math.round((eQuoteSumme / nEinsaetze) * 100) : 0;
        setze('kzEinsatzTitel', `Einsätze ${curYear}`);
        const kzEinsAnz = document.getElementById('kzEinsatzAnzahl');
        if (kzEinsAnz) kzEinsAnz.innerHTML = `${nEinsaetze}<small>${nEinsaetze === 1 ? 'Einsatz' : 'Einsätze'}</small>`;
        setze('kzEinsatzArten', nEinsaetze ? `${nBrand} Brand · ${nHilfe} Hilfeleistung${nSonst ? ` · ${nSonst} Sonstige` : ''}` : `Noch keine Einsätze in ${curYear}`);
        const kzEinsProz = document.getElementById('kzEinsatzProzent');
        if (kzEinsProz) { kzEinsProz.innerText = nEinsaetze ? eProzent + '%' : '–'; kzEinsProz.style.color = nEinsaetze ? ampel(eProzent) : ''; }
        setze('kzEinsatzSchnitt', nEinsaetze && einsatzfaehigeIds.size ? `${zahl1(eTeilnahmen / nEinsaetze)} von ${einsatzfaehigeIds.size}` : '–');
        setze('kzEinsatzZeit', nEinsaetze ? `${zahl1(eStunden)} h` : '–');

        // --- Stunden gesamt: alle Kameraden zusammen, aufgeteilt nach Art ---
        let sAusb = 0, sEins = 0, sArbeit = 0, sLehr = 0;
        Object.values(memberHours).forEach(h => { sAusb += h.ausbildung; sEins += h.einsatz; sArbeit += h.nachbereitung; sLehr += h.lehrgang; });
        setze('kzStundenTitel', `Stunden gesamt ${curYear}`);
        const kzStdGes = document.getElementById('kzStundenGesamt');
        if (kzStdGes) kzStdGes.innerHTML = `${zahl1(sAusb + sEins + sArbeit + sLehr)}<small>h geleistet</small>`;
        setze('kzStdAusbildung', `${zahl1(sAusb)} h`);
        setze('kzStdEinsatz', `${zahl1(sEins)} h`);
        setze('kzStdArbeit', `${zahl1(sArbeit)} h`);
        setze('kzStdLehrgang', `${zahl1(sLehr)} h`);

        // --- Mannschaft: einsatzbereit, Atemschutz, UVV ---
        const heuteKey = kalKey(new Date());
        const bereit = appData.members.filter(m => m.status === 'Aktiv' && !einsatzGesperrtGrund(m, heuteKey)).length;
        const nichtBereit = appData.members.length - bereit;
        const kzMann = document.getElementById('kzMannschaftZahl');
        if (kzMann) kzMann.innerHTML = `<span style="color:#22c55e;">${bereit}</span> / <span style="color:${nichtBereit > 0 ? '#ef4444' : 'var(--text-muted)'};">${nichtBereit}</span>`;
        let agtReady = 0, agtTotal = 0, uvvOk = 0;
        activeMembers.forEach(m => {
          if (checkUvvValidityForMember(m.id, curYear)) uvvOk++;
          if (m.lehrgaenge && m.lehrgaenge.includes('AGT')) {
            agtTotal++;
            const g26 = checkG26Validity(m.g26Ablauf);
            const str = checkOneYearValidity(m.streckeDatum);
            if (g26.status !== 'danger' && str.status !== 'danger') agtReady++;
          }
        });
        setze('kzAtemschutz', `${agtReady} von ${agtTotal}`);
        setze('kzUvvTitel', `UVV ${curYear}`);
        const uvvProzent = activeMembers.length ? Math.round((uvvOk / activeMembers.length) * 100) : 0;
        const kzUvv = document.getElementById('kzUvv');
        if (kzUvv) { kzUvv.innerText = uvvProzent + '%'; kzUvv.style.color = activeMembers.length ? ampel(uvvProzent) : ''; }

    }
