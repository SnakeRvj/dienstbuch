// FF Christdorf Dienstbuch – Cloud: Live-Sync mit Firebase (jeder Eintrag wird einzeln gespeichert),
// Übernahme der alten Daten, Änderungsprotokoll.
// (klassische Skriptdatei: alle Funktionen sind global und werden von den anderen Dateien genutzt)

// Die Daten liegen in Firebase unter "v2" in getrennten Bereichen: Kameraden, Dienste, Lehrgänge, dazu das Protokoll.
// Der alte Sammelblock "dienstbuchData" bleibt unverändert als Sicherung liegen.
const CLOUD_BEREICHE = [
  { name: 'members', teil: 'members', label: 'Kamerad' },
  { name: 'dienste', teil: 'dienste', label: 'Dienst' },
  { name: 'lehrgaenge', teil: 'lehrgangPlan', label: 'Lehrgang' }
];
const CLOUD_ID_GUELTIG = /^[^.#$\[\]\/]+$/;

let cloudDb = null;
let cloudRefs = [];
let cloudConnRef = null;
let cloudStand = { members: {}, dienste: {}, lehrgaenge: {} };            // zuletzt bekannter Stand in der Cloud (je Eintrag als Text)
let cloudGeladen = { members: false, dienste: false, lehrgaenge: false };
let cloudBereit = false;                                                  // erst nach dem ersten vollständigen Laden wird gespeichert

// Hilfsfunktionen zum Vergleichen: Reihenfolge der Schlüssel, leere Listen und leere Werte spielen keine Rolle
function kanonisch(wert) {
  if (Array.isArray(wert)) {
    const a = wert.map(kanonisch).filter(x => x !== undefined);
    return a.length ? a : undefined;
  }
  if (wert && typeof wert === 'object') {
    const o = {};
    Object.keys(wert).sort().forEach(k => { const v = kanonisch(wert[k]); if (v !== undefined) o[k] = v; });
    return Object.keys(o).length ? o : undefined;
  }
  if (wert === null || wert === undefined) return undefined;
  return wert;
}
function kanonischText(obj) { return JSON.stringify(kanonisch(obj) || {}); }
function bereinigt(obj) { return JSON.parse(JSON.stringify(obj)); }  // entfernt undefined

// ===== Änderungsprotokoll: wer, was, wann =====
function cloudNutzerName() {
  const u = (typeof firebase !== 'undefined' && firebase.auth) ? firebase.auth().currentUser : null;
  const mail = ((u && u.email) || '').toLowerCase();
  if (SUPER_ADMIN_EMAILS.includes(mail)) return 'Super-Admin';
  if (mail === LOGIN_EMAIL) return 'Admin (gemeinsamer Zugang)';
  return mail || 'Unbekannt';
}

const CLOUD_FELD_NAMEN = {
  status: 'Status', dienstgrad: 'Dienstgrad', funktion: 'Funktion', teilnehmer: 'Teilnehmer', lehrgaenge: 'Qualifikationen',
  g26Ablauf: 'G26.3', streckeDatum: 'Übungsstrecke', csaDatum: 'CSA-Datum', vorname: 'Vorname', nachname: 'Nachname',
  geburtsdatum: 'Geburtsdatum', geschlecht: 'Geschlecht', personalnummer: 'Nummer', datumVon: 'Datum', datumBis: 'Datum bis',
  zeitVon: 'Beginn', zeitBis: 'Ende', dauer: 'Dauer', thema: 'Thema', typ: 'Kategorie', ausbilder: 'Ausbilder',
  einheitsfuehrer: 'Einheitsführer', maschinist: 'Maschinist', einsatzArt: 'Einsatzart', titel: 'Lehrgang',
  ort: 'Ausbildungsstätte', startDatum: 'Beginn', endeDatum: 'Ende', stunden: 'Stunden', memberId: 'Kamerad'
};
const CLOUD_FELD_MIT_WERT = ['status', 'dienstgrad', 'funktion', 'typ', 'titel', 'ort'];

function cloudKameradName(id) {
  const m = appData.members.find(x => x.id === id);
  if (m) return `${m.vorname || ''} ${m.nachname || ''}`.trim();
  try { const o = JSON.parse(cloudStand.members[id] || '{}'); return `${o.vorname || ''} ${o.nachname || ''}`.trim() || 'Unbekannt'; } catch (e) { return 'Unbekannt'; }
}

function cloudBezeichnung(label, o) {
  if (!o) return '';
  const de = iso => { try { return new Date(iso).toLocaleDateString('de-DE'); } catch (e) { return iso || ''; } };
  if (label === 'Kamerad') return `${o.vorname || ''} ${o.nachname || ''}`.trim();
  if (label === 'Dienst') return `${o.typ || 'Dienst'} am ${de(o.datumVon || o.datum)}${o.thema ? ' – ' + o.thema : ''}`;
  return `${cloudKameradName(o.memberId)}: ${o.titel || 'Lehrgang'}${o.status ? ' (' + o.status + ')' : ''}`;
}

function cloudAenderungen(alt, neu) {
  const felder = [];
  const keys = new Set([...Object.keys(alt || {}), ...Object.keys(neu || {})]);
  keys.forEach(k => {
    if (k === 'id') return;
    const a = JSON.stringify(kanonisch(alt[k])), n = JSON.stringify(kanonisch(neu[k]));
    if (a === n) return;
    const name = CLOUD_FELD_NAMEN[k] || k;
    if (CLOUD_FELD_MIT_WERT.includes(k)) felder.push(`${name}: ${alt[k] === undefined ? '–' : alt[k]} → ${neu[k] === undefined ? '–' : neu[k]}`);
    else felder.push(name);
  });
  return [...new Set(felder)].join(', ');
}

// ===== Speichern: nur geänderte Einträge werden geschrieben =====
function saveData() {
  // Immer sofort lokal sichern
  localStorage.setItem(STORAGE_KEY, JSON.stringify(appData));
  renderApp();
  cloudSpeichern();
}

function cloudSpeichern() {
  if (!cloudDb) return;   // nicht angemeldet: nur lokal
  if (!cloudBereit) {
    alert('Die Verbindung zur Datenbank wird noch aufgebaut. Bitte in wenigen Sekunden noch einmal speichern.');
    return;
  }
  const updates = {};
  const neuerStand = { members: Object.assign({}, cloudStand.members), dienste: Object.assign({}, cloudStand.dienste), lehrgaenge: Object.assign({}, cloudStand.lehrgaenge) };
  const nutzer = cloudNutzerName();
  const logZeit = Date.now();
  let logZaehler = 0;
  const protokoll = (label, aktion, eintrag, aenderung) => {
    const key = cloudDb.ref('v2/protokoll').push().key;
    updates['protokoll/' + key] = { zeit: logZeit + (logZaehler++), nutzer, bereich: label, aktion, eintrag: eintrag || '', aenderung: aenderung || '' };
  };

  CLOUD_BEREICHE.forEach(b => {
    const liste = appData[b.teil] || [];
    const alt = cloudStand[b.name];
    const vorhanden = new Set();
    liste.forEach(item => {
      if (!item || !item.id) return;
      vorhanden.add(item.id);
      const text = kanonischText(item);
      if (alt[item.id] === undefined) {
        updates[b.name + '/' + item.id] = bereinigt(item);
        neuerStand[b.name][item.id] = text;
        protokoll(b.label, 'angelegt', cloudBezeichnung(b.label, item), '');
      } else if (alt[item.id] !== text) {
        let altObj = {};
        try { altObj = JSON.parse(alt[item.id]); } catch (e) { altObj = {}; }
        updates[b.name + '/' + item.id] = bereinigt(item);
        neuerStand[b.name][item.id] = text;
        protokoll(b.label, 'geändert', cloudBezeichnung(b.label, item), cloudAenderungen(altObj, kanonisch(item) || {}));
      }
    });
    Object.keys(alt).forEach(id => {
      if (vorhanden.has(id)) return;
      let altObj = {};
      try { altObj = JSON.parse(alt[id]); } catch (e) { altObj = {}; }
      updates[b.name + '/' + id] = null;
      delete neuerStand[b.name][id];
      protokoll(b.label, 'gelöscht', cloudBezeichnung(b.label, altObj), '');
    });
  });

  if (!Object.keys(updates).length) return;   // nichts geändert
  cloudStand = neuerStand;                    // sofort als bekannt merken (bei Ablehnung stellt der Listener den alten Stand wieder her)
  updateSyncStatus('syncing', 'Synchronisiere...');
  cloudDb.ref('v2').update(updates)
    .then(() => updateSyncStatus('online', 'Live-Sync aktiv'))
    .catch((err) => {
      console.error('Fehler beim Cloud-Speichern:', err);
      if (err && (err.code === 'PERMISSION_DENIED' || /permission/i.test(String(err.message)))) {
        alert('Dafür fehlt die Berechtigung. Die Änderung wurde zurückgenommen.');
        updateSyncStatus('online', 'Live-Sync aktiv');
      } else {
        updateSyncStatus('offline', 'Speicherfehler');
      }
    });
}

// ===== Laden / Live-Sync =====
function cloudEmpfangen(b, snap) {
  const obj = snap.val() || {};
  const liste = Object.keys(obj).map(id => {
    const it = obj[id];
    if (it && typeof it === 'object') { if (!it.id) it.id = id; return it; }
    return null;
  }).filter(Boolean);
  if (b.name === 'members') normalizeMembers(liste);
  else if (b.name === 'dienste') normalizeDienste(liste);
  else normalizeLehrgaenge(liste);

  const stand = {};
  liste.forEach(it => { stand[it.id] = kanonischText(it); });
  const erstesMal = !cloudGeladen[b.name];
  cloudGeladen[b.name] = true;
  cloudBereit = Object.values(cloudGeladen).every(Boolean);
  if (!erstesMal && kanonischText(stand) === kanonischText(cloudStand[b.name])) return;   // nichts Neues

  // feste, nachvollziehbare Reihenfolge
  if (b.name === 'dienste') liste.sort((x, y) => String(x.datumVon || x.datum || '').localeCompare(String(y.datumVon || y.datum || '')) || String(x.zeitVon || '').localeCompare(String(y.zeitVon || '')) || String(x.id).localeCompare(String(y.id)));
  if (b.name === 'lehrgaenge') liste.sort((x, y) => String(x.startDatum || '').localeCompare(String(y.startDatum || '')) || String(x.id).localeCompare(String(y.id)));
  appData[b.teil] = liste;
  cloudStand[b.name] = stand;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(appData));
  sortMembers();
  populateYearFilter();
  renderApp();
  updateSyncStatus('online', 'Live-Sync aktiv');
}

function cloudListenerStarten() {
  CLOUD_BEREICHE.forEach(b => {
    const ref = cloudDb.ref('v2/' + b.name);
    cloudRefs.push(ref);
    ref.on('value', (snap) => cloudEmpfangen(b, snap), (err) => {
      console.error('Firebase Lesefehler (' + b.name + '):', err);
      updateSyncStatus('offline', 'Sync-Fehler');
    });
  });
}

// Einmalige Übernahme der bisherigen Daten (Block "dienstbuchData") in die einzelnen Bereiche
function cloudMigrieren() {
  return cloudDb.ref('dienstbuchData').once('value').then(snap => {
    const alt = snap.val();
    const updates = {};
    const anzahl = { members: 0, dienste: 0, lehrgaenge: 0 };
    let ungueltig = 0;
    const aufnehmen = (name, wert) => {
      const liste = Array.isArray(wert) ? wert : Object.values(wert || {});
      liste.forEach(it => {
        if (!it || typeof it !== 'object') return;
        if (!it.id || !CLOUD_ID_GUELTIG.test(String(it.id))) { ungueltig++; return; }
        updates[name + '/' + it.id] = bereinigt(it);
        anzahl[name]++;
      });
    };
    if (alt) {
      aufnehmen('members', alt.members);
      aufnehmen('dienste', alt.dienste);
      aufnehmen('lehrgaenge', alt.lehrgangPlan);
    }
    if (ungueltig) throw new Error('Übernahme abgebrochen: ' + ungueltig + ' alte Einträge haben keine gültige Kennung. Es wurde nichts verändert.');
    updates['meta/migriert'] = { zeit: Date.now(), von: ((firebase.auth().currentUser || {}).email) || '', anzahl };
    // Kurz vor dem Schreiben noch einmal prüfen, ob ein anderes Gerät schneller war
    return cloudDb.ref('v2/meta/migriert').once('value').then(s2 => {
      if (s2.exists()) return null;
      return cloudDb.ref('v2').update(updates);
    });
  });
}

function startCloudSync() {
  if (cloudDb) return; // läuft bereits
  cloudDb = firebase.database();
  cloudStand = { members: {}, dienste: {}, lehrgaenge: {} };
  cloudGeladen = { members: false, dienste: false, lehrgaenge: false };
  cloudBereit = false;

  // Verbindungsstatus überwachen
  cloudConnRef = cloudDb.ref('.info/connected');
  cloudConnRef.on('value', (snap) => {
    if (snap.val() === true) updateSyncStatus('online', 'Live-Sync aktiv');
    else updateSyncStatus('offline', 'Offline (Lokal)');
  });

  cloudDb.ref('v2/meta/migriert').once('value')
    .then(snap => (snap.exists() ? null : cloudMigrieren()))
    .then(() => cloudListenerStarten())
    .catch((err) => {
      console.error('Cloud-Start fehlgeschlagen:', err);
      updateSyncStatus('offline', 'Sync-Fehler');
      if (err && /Übernahme abgebrochen/.test(String(err.message))) alert(err.message);
    });
}

function stopCloudSync() {
  cloudRefs.forEach(r => r.off());
  cloudRefs = [];
  if (cloudConnRef) { cloudConnRef.off(); cloudConnRef = null; }
  cloudDb = null;
  cloudBereit = false;
}
