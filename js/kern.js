// FF Christdorf Dienstbuch – Kern: Daten, Speichern, Firebase-Anmeldung und Live-Sync, gemeinsame Hilfsfunktionen, Regeln für Einsätze, Anzeige-Steuerung (renderApp)
// (klassische Skriptdatei: alle Funktionen sind global und werden von den anderen Dateien genutzt)

    // FIREBASE KONFIGURATION (FEUERWEHR CHRISTDORF)
    const firebaseConfig = {
      apiKey: "AIzaSyBqCIht0GEu7kRlgFfM6ksmNDylQLUPrsw",
      authDomain: "feuerwehr-christdorf.firebaseapp.com",
      databaseURL: "https://feuerwehr-christdorf-default-rtdb.europe-west1.firebasedatabase.app",
      projectId: "feuerwehr-christdorf",
      storageBucket: "feuerwehr-christdorf.firebasestorage.app",
      messagingSenderId: "716762987891",
      appId: "1:716762987891:web:6d95c768f38765eaf0d906"
    };

    function updateSyncStatus(state, text) {
      const dot = document.getElementById('syncDot');
      const txt = document.getElementById('syncText');
      if (!dot || !txt) return;
      dot.className = 'sync-dot';
      if (state === 'online') dot.classList.add('online');
      else if (state === 'offline') dot.classList.add('offline');
      txt.innerText = text;
    }

    const STORAGE_KEY = 'FF_CHRISTDORF_DATA_V14';
    let appData = {
      members: [
        {
          id: 'owf-1',
          personalnummer: 1,
          vorname: 'Max',
          nachname: 'Mustermann',
          dienstgrad: 'Brandmeister',
          funktion: 'Ortswehrführer',
          lehrgaenge: ['TM 1', 'TM 2', 'TF Brand', 'TF TH', 'Funk', 'AGT', 'Maschinist', 'GF', 'Motorkettensäge'],
          g26Ablauf: '2027-06-30',
          streckeDatum: '2025-12-15',
          csaDatum: '',
          status: 'Aktiv'
        }
      ],
      dienste: [],
      lehrgangPlan: []
    };

    // Normalisierung einzelner Bereiche (wird auch beim Laden aus der Cloud benutzt)
    function normalizeMembers(liste) {
      liste.forEach((m, idx) => {
        if (m.personalnummer === undefined || m.personalnummer === null || m.personalnummer === '') {
          m.personalnummer = idx + 1;
        } else {
          m.personalnummer = parseInt(m.personalnummer) || (idx + 1);
        }
        if (!m.lehrgaenge) m.lehrgaenge = [];
        // Frühere Einstellung "Nicht einsatzfähig" wird jetzt über den Status abgebildet
        if (m.einsatzfaehig === false && (m.status || 'Aktiv') === 'Aktiv') m.status = 'Nicht einsatzfähig';
        delete m.einsatzfaehig;

        if (m.lehrgaenge) {
          if (m.lehrgaenge.includes('TF') && !m.lehrgaenge.includes('TF Brand')) {
            m.lehrgaenge.push('TF Brand');
          }
          if ((m.lehrgaenge.includes('TH') || m.lehrgaenge.includes('TH-Basis')) && !m.lehrgaenge.includes('TF TH')) {
            m.lehrgaenge.push('TF TH');
          }
          m.lehrgaenge = m.lehrgaenge.filter(k => k !== 'TF' && k !== 'TH' && k !== 'TH-Basis');
        }
      });
    }

    function normalizeDienste(liste) {
      liste.forEach(d => {
        if (!d.teilnehmer) d.teilnehmer = [];
      });
    }

    function normalizeLehrgaenge(liste) {
      // Umbenannt: "Truppführer TH (Technische Hilfe)" heißt jetzt "Truppführer Technische Hilfe"
      liste.forEach(l => { if (l.titel === 'Truppführer TH (Technische Hilfe)') l.titel = 'Truppführer Technische Hilfe'; });
    }

    function normalizeData(parsed) {
      appData.members = parsed.members || appData.members || [];
      appData.dienste = parsed.dienste || [];
      appData.lehrgangPlan = parsed.lehrgangPlan || [];
      normalizeLehrgaenge(appData.lehrgangPlan);
      normalizeMembers(appData.members);
      normalizeDienste(appData.dienste);
    }

    function loadData() {
      const vEl = document.getElementById('appVersion');
      if (vEl) vEl.innerText = 'Version: ' + APP_VERSION;
      if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
      window.scrollTo(0, 0);
      // 1. Zuerst lokalen Stand laden (damit sofort alles da ist)
      const stored = localStorage.getItem(STORAGE_KEY) || localStorage.getItem('FF_CHRISTDORF_DATA_V13') || localStorage.getItem('FF_CHRISTDORF_DATA_V12') || localStorage.getItem('FF_CHRISTDORF_DATA_V11') || localStorage.getItem('FF_CHRISTDORF_DATA_V10') || localStorage.getItem('FF_CHRISTDORF_DATA_V9') || localStorage.getItem('FF_CHRISTDORF_DATA_V8') || localStorage.getItem('FF_CHRISTDORF_DATA_V7') || localStorage.getItem('FF_CHRISTDORF_DATA_V6') || localStorage.getItem('FF_CHRISTDORF_DATA_V5');
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          normalizeData(parsed);
        } catch (e) {
          console.error("Lokale Daten konnten nicht gelesen werden", e);
        }
      }
      sortMembers();
      populateYearFilter();
      renderApp();

      // 2. Firebase: erst anmelden, danach Echtzeit-Verbindung starten
      try {
        firebase.initializeApp(firebaseConfig);
        firebase.auth().onAuthStateChanged((user) => {
          if (user) {
            zeigeLogin(false);
            rolleAnzeigen(user);
            startCloudSync();
            window.scrollTo(0, 0);
          } else {
            stopCloudSync();
            rolleAnzeigen(null);
            zeigeLogin(true, '');
            updateSyncStatus('offline', 'Nicht angemeldet');
          }
        });
      } catch (err) {
        console.error("Firebase konnte nicht gestartet werden:", err);
        updateSyncStatus('offline', 'Nur Lokal');
        zeigeLogin(true, 'Keine Verbindung. Anmeldung ist nur mit Internet möglich.', true);
      }
    }

    // Zugangs-E-Mail: Dieses Konto wird in der Firebase-Konsole (Authentication) angelegt, das Passwort steht NUR dort.
    const APP_VERSION = '12.11.2026 · Rollen und Änderungsprotokoll';  // erscheint unten auf dem Anmeldebildschirm

    const LOGIN_EMAIL = 'dienstbuch@ff-christdorf.de';  // gemeinsamer Zugang (bleibt auf den Handys angemeldet)
    const SUPER_ADMIN_EMAILS = ['mathias.juergens@ff-christdorf.de'];  // eigener Zugang des Super-Admins

    function istSuperAdmin() {
      const u = (typeof firebase !== 'undefined' && firebase.auth) ? firebase.auth().currentUser : null;
      return !!(u && u.email && SUPER_ADMIN_EMAILS.includes(u.email.toLowerCase()));
    }

    // Anzeige der Rolle neben dem Verbindungsstatus
    function rolleAnzeigen(user) {
      const el = document.getElementById('rolleAnzeige');
      if (!el) return;
      if (!user) { el.style.display = 'none'; document.body.classList.remove('rolle-super'); return; }
      const super_ = user.email && SUPER_ADMIN_EMAILS.includes(user.email.toLowerCase());
      document.body.classList.toggle('rolle-super', !!super_);
      el.innerText = super_ ? '👑 Super-Admin' : '🛠️ Admin';
      el.title = user.email || '';
      el.style.display = '';
    }

    // Umschalten zwischen gemeinsamem Passwort und eigener E-Mail
    let loginEigen = false;
    function loginModusWechseln() {
      loginEigen = !loginEigen;
      document.getElementById('loginEmail').style.display = loginEigen ? '' : 'none';
      document.getElementById('loginUmschalter').innerText = loginEigen ? 'Mit gemeinsamem Passwort anmelden' : 'Mit eigener E-Mail anmelden';
      const ziel = document.getElementById(loginEigen ? 'loginEmail' : 'loginPasswort');
      if (ziel) ziel.focus();
    }

    function zeigeLogin(anzeigen, meldung, gesperrt) {
      const ov = document.getElementById('loginOverlay');
      if (!ov) return;
      ov.style.display = anzeigen ? 'flex' : 'none';
      const m = document.getElementById('loginMeldung');
      if (m && meldung !== undefined) m.innerText = meldung;
      const b = document.getElementById('loginButton');
      if (b) b.disabled = !!gesperrt;
      if (anzeigen) {
        const pw = document.getElementById('loginPasswort');
        if (pw) { pw.value = ''; if (!gesperrt) pw.focus(); }
      }
    }

    function loginSubmit(e) {
      e.preventDefault();
      const pw = document.getElementById('loginPasswort').value;
      const email = loginEigen ? document.getElementById('loginEmail').value.trim() : LOGIN_EMAIL;
      if (!pw || !email) return;
      const btn = document.getElementById('loginButton');
      btn.disabled = true;
      document.getElementById('loginMeldung').innerText = 'Melde an...';
      firebase.auth().signInWithEmailAndPassword(email, pw).catch((err) => {
        const code = err && err.code;
        let text = 'Anmeldung fehlgeschlagen.';
        if (code === 'auth/invalid-credential' || code === 'auth/wrong-password' || code === 'auth/user-not-found' || code === 'auth/invalid-login-credentials') text = loginEigen ? 'E-Mail oder Passwort falsch.' : 'Passwort falsch.';
        else if (code === 'auth/invalid-email') text = 'Die E-Mail-Adresse ist ungültig.';
        else if (code === 'auth/too-many-requests') text = 'Zu viele Versuche. Bitte später erneut probieren.';
        else if (code === 'auth/network-request-failed') text = 'Keine Verbindung zum Server.';
        document.getElementById('loginMeldung').innerText = text;
        btn.disabled = false;
      });
    }

    function logout() {
      if (confirm('Von diesem Gerät abmelden?')) firebase.auth().signOut();
    }

    function sortMembers() {
      appData.members.sort((a, b) => {
        const nrA = (a.personalnummer !== undefined && a.personalnummer !== null && a.personalnummer !== '') ? parseInt(a.personalnummer) : 9999;
        const nrB = (b.personalnummer !== undefined && b.personalnummer !== null && b.personalnummer !== '') ? parseInt(b.personalnummer) : 9999;
        if (nrA !== nrB) {
          return nrA - nrB;
        }
        const nameA = a.nachname || '';
        const nameB = b.nachname || '';
        return nameA.localeCompare(nameB);
      });
    }

    // Das Hauptjahr wird im Jahreskalender gewählt (kalenderJahr); die frühere Jahresauswahl der Übersicht entfällt.
    function populateYearFilter() {}

    const DIENSTGRAD_W = {
      'Feuerwehrmann-Anwärter': 'Feuerwehrfrau-Anwärterin',
      'Feuerwehrmann': 'Feuerwehrfrau',
      'Oberfeuerwehrmann': 'Oberfeuerwehrfrau',
      'Hauptfeuerwehrmann': 'Hauptfeuerwehrfrau',
      'Löschmeister': 'Löschmeisterin',
      'Oberlöschmeister': 'Oberlöschmeisterin',
      'Hauptlöschmeister': 'Hauptlöschmeisterin',
      'Erster Hauptlöschmeister': 'Erste Hauptlöschmeisterin',
      'Brandmeister': 'Brandmeisterin',
      'Oberbrandmeister': 'Oberbrandmeisterin',
      'Hauptbrandmeister': 'Hauptbrandmeisterin'
    };
    const FUNKTION_W = {
      'Ortswehrführer': 'Ortswehrführerin',
      'Stellv. Ortswehrführer': 'Stellv. Ortswehrführerin',
      'Gerätewart': 'Gerätewartin',
      'Sicherheitsbeauftragter': 'Sicherheitsbeauftragte',
      'Schriftführer': 'Schriftführerin'
    };

    // Gespeichert wird immer die männliche Grundform (für die Logik), angezeigt wird je nach Geschlecht
    function dienstgradAnzeige(m) {
      const dg = m.dienstgrad || '';
      return m.geschlecht === 'w' ? (DIENSTGRAD_W[dg] || dg) : dg;
    }

    // Kurzname für Rollen im Dienstbuch: Anfangsbuchstabe(n) des Vornamens + Nachname.
    // Ein Buchstabe genügt; bei gleichem Nachnamen und gleichem Anfangsbuchstaben werden so viele Buchstaben genommen, bis es eindeutig ist (z. B. Ro. und Ra. Kissmann).
    // Nachnamen gelten als gleich, wenn sie sich höchstens in einem Buchstaben unterscheiden (Tippfehler wie "Kissman", "Kissmanm", "Kissmann")
    function nachnameAehnlich(a, b) {
      if (a === b) return true;
      if (a.length < 4 || b.length < 4 || a[0] !== b[0] || Math.abs(a.length - b.length) > 1) return false;
      let i = 0;
      while (i < a.length && i < b.length && a[i] === b[i]) i++;
      if (a.length === b.length) return a.slice(i + 1) === b.slice(i + 1);      // ein Buchstabe ersetzt
      const kurz = a.length < b.length ? a : b, lang = a.length < b.length ? b : a;
      return kurz.slice(i) === lang.slice(i + 1);                               // ein Buchstabe zu viel / zu wenig
    }

    function kurzname(m) {
      // Schreibweisen wie "Kißmann" und "Kissmann" oder zusätzliche Leerzeichen gelten als gleicher Nachname
      const lose = t => String(t || '').toLowerCase().replace(/ß/g, 'ss').replace(/[^a-zäöü0-9]/g, '');
      const vorname = (m.vorname || '').trim();
      if (!vorname) return m.nachname || '';
      // Andere Kameraden mit gleichem oder fast gleichem Nachnamen (Vergleich über das Objekt, nicht über die ID)
      const gleiche = appData.members.filter(x => x !== m && !(x.id === m.id && lose(x.vorname) === lose(m.vorname) && lose(x.nachname) === lose(m.nachname)) && nachnameAehnlich(lose(x.nachname), lose(m.nachname)));
      if (!gleiche.length) return `${vorname.charAt(0).toUpperCase()}. ${m.nachname}`;
      const v = lose(vorname);
      let n = 1;
      while (n < vorname.length && gleiche.some(x => lose(x.vorname).startsWith(v.slice(0, n)))) n++;
      const kuerzel = vorname.slice(0, n);
      return `${kuerzel.charAt(0).toUpperCase()}${kuerzel.slice(1).toLowerCase()}. ${m.nachname}`;
    }

    function funktionAnzeige(m) {
      const fk = m.funktion || '';
      return m.geschlecht === 'w' ? (FUNKTION_W[fk] || fk) : fk;
    } // nur für die Handy-Ansicht (ein Monat auf einmal)

    function kalIsoToDate(iso) {
      const t = String(iso || '').split('-');
      if (t.length < 3) return null;
      const d = new Date(parseInt(t[0]), parseInt(t[1]) - 1, parseInt(t[2]));
      return isNaN(d.getTime()) ? null : d;
    }
    function kalKey(d) {
      return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    }
    function kalDeDatum(key) {
      const t = key.split('-');
      return t[2] + '.' + t[1] + '.' + t[0];
    }

    function switchTab(tabId) {
      document.querySelectorAll('.view-section').forEach(el => el.classList.remove('active'));
      document.querySelectorAll('.nav-tab').forEach(el => el.classList.remove('active'));
      document.querySelectorAll('.mobile-btn').forEach(el => el.classList.remove('active'));

      const sec = document.getElementById('view-' + tabId);
      if (sec) sec.classList.add('active');

      const tabs = Array.from(document.querySelectorAll('.nav-tab'));
      const mobBtns = Array.from(document.querySelectorAll('.mobile-btn'));
      const idx = ['kalender', 'dashboard', 'dienste', 'atemschutz', 'lehrgaenge', 'mitglieder', 'verwaltung'].indexOf(tabId);
      if (idx !== -1) {
        if (tabs[idx]) tabs[idx].classList.add('active');
        if (mobBtns[idx]) mobBtns[idx].classList.add('active');
      }
      if (tabId === 'verwaltung' && typeof verwaltungOeffnen === 'function') verwaltungOeffnen();
    }

    // ===== MOBILE ANSICHT: Tabellen als Karten beschriften =====
    function mobileTabellenBeschriften() {
      if (!window.matchMedia('(max-width: 768px)').matches) return;
      document.querySelectorAll('table').forEach(tabelle => {
        const kopf = Array.from(tabelle.querySelectorAll('thead th')).map(th => th.textContent.replace('●', '').trim());
        // Dienstbuch: Datum (2. Spalte) wird die Überschrift der Karte
        const titelIndex = (kopf[0] === 'Status' && (kopf[1] || '').startsWith('Datum')) ? 1 : 0;
        tabelle.classList.toggle('mobil-datum-titel', titelIndex === 1);
        tabelle.querySelectorAll('tbody tr').forEach(zeile => {
          Array.from(zeile.children).forEach((td, i) => {
            if (td.tagName !== 'TD' || td.colSpan > 1) return;
            const label = kopf[i] || '';
            td.setAttribute('data-label', label);
            if (label === 'Aktionen' || label === 'Schnellaktion') td.classList.add('mobil-aktionen');
            if (i !== titelIndex && td.textContent.trim() === '' && !td.querySelector('button')) { td.classList.add('mobil-leer'); return; }
            if (i === titelIndex) return; // diese Zelle ist die Überschrift der Karte
            if (!(td.children.length === 1 && td.firstElementChild.classList.contains('td-inhalt'))) {
              td.innerHTML = '<div class="td-inhalt">' + td.innerHTML + '</div>';
            }
          });
        });
      });
    }
    try {
      const mobilMQ = window.matchMedia('(max-width: 768px)');
      const mobilWechsel = () => { try { renderApp(); } catch (e) {} };
      if (mobilMQ.addEventListener) mobilMQ.addEventListener('change', mobilWechsel);
      else if (mobilMQ.addListener) mobilMQ.addListener(mobilWechsel);
    } catch (e) {}

    function istUvvDienst(d) {
      const t = (d.thema || '').toLowerCase();
      return (d.typ === 'UVV') || t.includes('uvv') || t.includes('sicherheitsbelehrung') || t.includes('sicherheitsunterweisung');
    }

    // Liefert '' wenn der Kamerad für den Einsatz wählbar ist, sonst den Grund der Sperre.
    function einsatzGesperrtGrund(m, einsatzDatum) {
      // Nur Kameraden mit Status "Aktiv" sind einsatzfähig
      if ((m.status || 'Aktiv') !== 'Aktiv') {
        const gruende = { 'Nicht einsatzfähig': 'nicht einsatzfähig', 'Inaktiv': 'inaktiv', 'Reserve': 'Reserve', 'Altersabteilung': 'Alters-/Ehrenabteilung' };
        return gruende[m.status] || 'nicht aktiv';
      }
      const datum = einsatzDatum || kalKey(new Date());
      const jahr = datum.slice(0, 4);
      let uvvSchonGehalten = false, teilgenommen = false;
      (appData.dienste || []).forEach(d => {
        if ((d.status || 'Durchgeführt') !== 'Durchgeführt') return;
        if (!istUvvDienst(d)) return;
        const start = d.datumVon || d.datum || '';
        if (start.slice(0, 4) !== jahr) return;
        if (start >= datum) return; // UVV-Belehrung liegt am selben Tag oder erst nach dem Einsatz
        uvvSchonGehalten = true;
        if (d.teilnehmer && d.teilnehmer.includes(m.id)) teilgenommen = true;
      });
      // Pflicht gilt erst, wenn die Jahres-UVV-Belehrung vor dem Einsatz stattgefunden hat
      if (uvvSchonGehalten && !teilgenommen) return 'keine UVV ' + jahr;
      return '';
    }

    function checkUvvValidityForMember(memberId, year) {
      for (let i = 0; i < appData.dienste.length; i++) {
        const d = appData.dienste[i];
        const dStatus = d.status || 'Durchgeführt';
        if (dStatus !== 'Durchgeführt') continue;

        const dYear = new Date(d.datumVon || d.datum).getFullYear();
        if (dYear === year) {
          const isUvvService = istUvvDienst(d);
          if (isUvvService && d.teilnehmer && d.teilnehmer.includes(memberId)) {
            return true;
          }
        }
      }
      return false;
    }

    function closeModal(id) {
      document.getElementById(id).style.display = 'none';
    }
    // Stunden je Kamerad im gewählten Jahr (Ausbildung, Einsatz, Arbeitsdienst, Lehrgänge)
    function stundenBerechnen(curYear) {
        let totalHours = 0;
        const memberHours = {};
        appData.members.forEach(m => {
          memberHours[m.id] = { ausbildung: 0, nachbereitung: 0, lehrgang: 0, einsatz: 0, gesamt: 0 };
        });

        appData.dienste.forEach(d => {
          const dStatus = d.status || 'Durchgeführt';
          if (dStatus !== 'Durchgeführt') return;
          if (d.typ === 'OWF-Versammlung' || d.typ === 'Veranstaltung') return; // Ortswehrführer-Versammlung und Veranstaltungen zählen nicht zu den Stunden

          const dYear = new Date(d.datumVon || d.datum).getFullYear();
          if (dYear === curYear) {
            totalHours += (d.dauer * (d.teilnehmer ? d.teilnehmer.length : 0));
            if (d.teilnehmer) {
              d.teilnehmer.forEach(mId => {
                if (memberHours[mId]) {
                  if (d.typ === 'Einsatz') memberHours[mId].einsatz += d.dauer;
                  else if (d.typ === 'Arbeitsdienst') memberHours[mId].nachbereitung += d.dauer;
                  else memberHours[mId].ausbildung += d.dauer;
                  memberHours[mId].gesamt += d.dauer;
                }
              });
            }
          }
        });

        (appData.lehrgangPlan || []).forEach(l => {
          if (l.startDatum) {
            const lYear = new Date(l.startDatum).getFullYear();
            if (lYear === curYear && (l.status === 'Bestanden' || l.status === 'Nicht bestanden')) {
              if (memberHours[l.memberId]) {
                memberHours[l.memberId].lehrgang += lehrgangStunden(l);
                memberHours[l.memberId].gesamt += lehrgangStunden(l);
                totalHours += lehrgangStunden(l);
              }
            }
          }
        });

        return memberHours;
    }

    // Gesamte Anzeige neu aufbauen (ruft die Teile der einzelnen Reiter auf)
    function renderApp() {
      try {
        const curYear = kalenderJahr; // Das im Kalender gewählte Jahr gilt für Übersicht, Kacheln und Atemschutz
        const memberHours = stundenBerechnen(curYear);

        kennzahlenRendern(curYear, memberHours);
        uebersichtRendern(curYear, memberHours);
        dienstbuchRendern();
        lehrgaengeRendern();
        atemschutzRendern(curYear);
        mannschaftslisteRendern();
        renderKalender();
        jahresplanButtonAktualisieren();
        mobileTabellenBeschriften();
      } catch (err) {
        console.error("Fehler beim Rendern der Ansicht:", err);
      }
    }


    window.onload = loadData;
