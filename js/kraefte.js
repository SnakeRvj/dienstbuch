// FF Christdorf Dienstbuch – Weitere beteiligte Einheiten und Fahrzeuge (Auswahl im Einsatzbericht)
// (klassische Skriptdatei: alle Funktionen sind global und werden von den anderen Dateien genutzt)
//
// Quelle: Fahrzeugliste der FF Wittstock/Dosse (feuerwehr-wittstock.de, Seite "Fuhrpark").
// Die Liste kann veraltet sein, zum Beispiel wenn Fahrzeuge getauscht werden. Für alles andere gibt es das freie Textfeld.

const KRAEFTE_EINHEITEN = [
  { name: 'Rossow', fz: [['TLF 20/40', '2-24-3'], ['VRW', '2-50-2'], ['MTF', '2-19-5']] },
  { name: 'Wittstock', fz: [['KdoW Wehrführer', '2-14-1'], ['KdoW', '2-14-2'], ['ELW I', '2-11-1'], ['LF 20/16', '2-44-1'], ['TLF 24/50-CAFS', '2-24-1'], ['DLA(K) 23/12', '2-33-1'], ['VRW', '2-50-1'], ['RW', '2-52-1'], ['GW-G', '2-55-1'], ['GW-Logistik', '2-59-1'], ['GW BAB/Bahn', '2-59-5'], ['MTF', '2-19-1'], ['MTF', '2-19-3']] },
  { name: 'Dossow', fz: [['LF 8/6', '2-42-1']] },
  { name: 'Sewekow', fz: [['TSF-W', '2-48-1']] },
  { name: 'Babitz', fz: [['MTF/TSA', '2-98-3']] },
  { name: 'Berlinchen', fz: [['TSF-W', '2-48-2']] },
  { name: 'Biesen', fz: [['TSF/STA', '2-47-4']] },
  { name: 'Dranse', fz: [['MTF-W/S', '2-98-1']] },
  { name: 'Fretzdorf', fz: [['TSF/STA', '2-47-5'], ['MTF', '2-19-2']] },
  { name: 'Freyenstein', fz: [['HLF 20/16', '2-43-1'], ['TLF 16/48', '2-24-2'], ['MTF', '2-19-4'], ['Krad', '2-76-2']] },
  { name: 'Wulfersdorf/Niemerlang', fz: [['HLF 10/10', '2-43-2'], ['TSF-W', '2-48-3']] },
  { name: 'Zempow', fz: [['GTLF 32/80', '2-25-1'], ['GW-TSA', '2-59-4']] },
  { name: 'Zootzen/Gadow', fz: [['GW-Schlauch', '2-59-2'], ['TSF/STA', '2-47-2']] }
];

// Eigenes Fahrzeug der Einheit Christdorf (Vorgabe für neue Einsätze) und übliche Alarmierung
const EINSATZ_STANDARD_FAHRZEUG = 'TSF/STA (Florian Ruppin 2-47-3)';
const EINSATZ_STANDARD_ALARM = 'Leitstelle (Sirene, Funkmelder, App)';

let ebKraefteAuswahl = [];   // gewählte Einträge als Text, zum Beispiel "Rossow: TLF 20/40 (Florian Ruppin 2-24-3)"

function ebKraefteText(einheit, typ, nr) { return `${einheit}: ${typ} (Florian Ruppin ${nr})`; }

function ebKraefteInit() {
  const sel = document.getElementById('ebEinheitWahl');
  if (!sel || sel.options.length > 1) return;
  KRAEFTE_EINHEITEN.forEach(e => {
    const o = document.createElement('option');
    o.value = e.name; o.textContent = e.name;
    sel.appendChild(o);
  });
}

// Fahrzeuge der gewählten Einheit als Häkchen anzeigen
function ebFahrzeugeAnzeigen() {
  const box = document.getElementById('ebFahrzeugListe');
  const einheit = KRAEFTE_EINHEITEN.find(e => e.name === document.getElementById('ebEinheitWahl').value);
  box.innerHTML = '';
  if (!einheit) return;
  einheit.fz.forEach(([typ, nr]) => {
    const text = ebKraefteText(einheit.name, typ, nr);
    const label = document.createElement('label');
    label.className = 'checkbox-item';
    const cb = document.createElement('input');
    cb.type = 'checkbox'; cb.checked = ebKraefteAuswahl.includes(text);
    cb.onchange = () => ebKraeftUmschalten(text, cb.checked);
    label.appendChild(cb);
    label.appendChild(document.createTextNode(` ${typ} · ${nr}`));
    box.appendChild(label);
  });
}

function ebKraeftUmschalten(text, an) {
  if (an && !ebKraefteAuswahl.includes(text)) ebKraefteAuswahl.push(text);
  if (!an) ebKraefteAuswahl = ebKraefteAuswahl.filter(t => t !== text);
  ebKraefteChipsRendern();
}

function ebKraefteChipsRendern() {
  const box = document.getElementById('ebKraefteChips');
  box.innerHTML = '';
  ebKraefteAuswahl.forEach(text => {
    const chip = document.createElement('span');
    chip.className = 'qual-chip';
    chip.appendChild(document.createTextNode(text));
    const x = document.createElement('button');
    x.type = 'button'; x.title = 'Entfernen'; x.textContent = '✕';
    x.onclick = () => { ebKraeftUmschalten(text, false); ebFahrzeugeAnzeigen(); };
    chip.appendChild(x);
    box.appendChild(chip);
  });
}

// Beim Öffnen des Formulars: gespeicherte Auswahl setzen
function ebKraefteSetzen(liste) {
  ebKraefteInit();
  ebKraefteAuswahl = Array.isArray(liste) ? liste.slice() : [];
  document.getElementById('ebEinheitWahl').value = '';
  ebFahrzeugeAnzeigen();
  ebKraefteChipsRendern();
}
