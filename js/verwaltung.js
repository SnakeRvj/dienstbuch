// FF Christdorf Dienstbuch – Verwaltung (nur Super-Admin): Sicherung herunterladen, Änderungsprotokoll
// (klassische Skriptdatei: alle Funktionen sind global und werden von den anderen Dateien genutzt)

let protokollDaten = [];

// Wird beim Öffnen des Reiters "Verwaltung" aufgerufen
function verwaltungOeffnen() {
  if (!istSuperAdmin()) return;
  berichtJahreFuellen();
  protokollLaden();
}

// Jahresauswahl für den Jahresbericht: alle Jahre mit Daten, dazu das laufende und das im Kalender gewählte Jahr
function berichtJahreFuellen() {
  const sel = document.getElementById('berichtJahr');
  if (!sel) return;
  const alt = sel.value;
  const jahre = new Set([new Date().getFullYear(), kalenderJahr]);
  appData.dienste.forEach(d => { const j = new Date(d.datumVon || d.datum).getFullYear(); if (j) jahre.add(j); });
  (appData.lehrgangPlan || []).forEach(l => { if (l.startDatum) { const j = new Date(l.startDatum).getFullYear(); if (j) jahre.add(j); } });
  const liste = [...jahre].filter(j => j >= 2000 && j <= 2100).sort((a, b) => b - a);
  sel.innerHTML = liste.map(j => `<option value="${j}">${j}</option>`).join('');
  sel.value = (alt && liste.includes(parseInt(alt))) ? alt : String(kalenderJahr);
}

function jahresberichtAusVerwaltung() {
  const sel = document.getElementById('berichtJahr');
  jahresberichtOeffnen(sel ? sel.value : undefined);
}

// Alle Daten in einer Datei speichern
function sicherungHerunterladen() {
  if (!istSuperAdmin()) { alert('Die Sicherung darf nur der Super-Admin herunterladen.'); return; }
  const jetzt = new Date();
  const daten = {
    erstellt: jetzt.toISOString(),
    app: APP_VERSION,
    members: appData.members,
    dienste: appData.dienste,
    lehrgangPlan: appData.lehrgangPlan
  };
  const p = n => String(n).padStart(2, '0');
  const stempel = `${jetzt.getFullYear()}-${p(jetzt.getMonth() + 1)}-${p(jetzt.getDate())}_${p(jetzt.getHours())}-${p(jetzt.getMinutes())}`;
  const blob = new Blob([JSON.stringify(daten, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Dienstbuch_Sicherung_${stempel}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

// Protokoll aus der Cloud holen (nur Super-Admin darf es lesen)
function protokollLaden() {
  if (!istSuperAdmin()) return;
  const body = document.getElementById('protokollBody');
  if (!body) return;
  if (!cloudDb) {
    body.innerHTML = '<tr><td colspan="6" style="text-align:center; color:var(--text-muted); padding:1.2rem;">Das Protokoll gibt es nur mit Verbindung zur Datenbank.</td></tr>';
    return;
  }
  body.innerHTML = '<tr><td colspan="6" style="text-align:center; color:var(--text-muted); padding:1.2rem;">Lade Protokoll...</td></tr>';
  cloudDb.ref('v2/protokoll').orderByKey().limitToLast(300).once('value').then(snap => {
    const liste = [];
    snap.forEach(kind => { liste.push(kind.val()); });
    liste.sort((x, y) => (y.zeit || 0) - (x.zeit || 0));
    protokollDaten = liste;
    protokollAnzeigen();
  }).catch(err => {
    console.error('Protokoll konnte nicht geladen werden:', err);
    body.innerHTML = '<tr><td colspan="6" style="text-align:center; color:#ef4444; padding:1.2rem;">Das Protokoll konnte nicht geladen werden.</td></tr>';
  });
}

function protokollAnzeigen() {
  const body = document.getElementById('protokollBody');
  if (!body) return;
  const wer = document.getElementById('protokollFilterWer').value;
  const bereich = document.getElementById('protokollFilterBereich').value;
  const aktion = document.getElementById('protokollFilterAktion').value;
  const liste = protokollDaten.filter(e => (!wer || e.nutzer === wer) && (!bereich || e.bereich === bereich) && (!aktion || e.aktion === aktion));
  const farbe = { 'angelegt': 'badge-success', 'geändert': 'badge-warning', 'gelöscht': 'badge-danger' };
  const text = t => String(t === undefined || t === null ? '' : t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  document.getElementById('protokollTreffer').innerText = `${liste.length} von ${protokollDaten.length} Einträgen`;
  if (!liste.length) {
    body.innerHTML = '<tr><td colspan="6" style="text-align:center; color:var(--text-muted); padding:1.2rem;">Keine Einträge.</td></tr>';
  } else {
    body.innerHTML = liste.map(e => {
      const d = new Date(e.zeit || 0);
      const zeit = d.toLocaleDateString('de-DE') + ' ' + d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
      return `<tr>
        <td>${zeit}</td>
        <td>${text(e.nutzer)}</td>
        <td>${text(e.bereich)}</td>
        <td><span class="badge ${farbe[e.aktion] || 'badge-tag'}">${text(e.aktion)}</span></td>
        <td><strong>${text(e.eintrag)}</strong></td>
        <td>${text(e.aenderung)}</td>
      </tr>`;
    }).join('');
  }
  if (typeof mobileTabellenBeschriften === 'function') mobileTabellenBeschriften();
}
