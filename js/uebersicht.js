// FF Christdorf Dienstbuch – Übersicht: Jahresstunden je Kamerad
// (klassische Skriptdatei: alle Funktionen sind global und werden von den anderen Dateien genutzt)

    // ===== EINSATZ-AUSWAHL: UVV-Pflicht & Einsatzfähigkeit =====
    // Stunden-Anzeige als farbige Pille (Farben wie im Kalender)
    function stdPille(stunden, farbe, textfarbe, fett) {
      const leer = !stunden;
      return `<span class="std-pille" style="background:${farbe}; color:${textfarbe || '#ffffff'}; ${fett ? 'font-size:0.9rem; box-shadow:0 0 0 2px rgba(250,204,21,0.35);' : ''} ${leer ? 'opacity:0.4;' : ''}">${stunden.toFixed(1)} h</span>`;
    }    // Jahresstunden-Übersicht
    function uebersichtRendern(curYear, memberHours) {
        const uebersichtTitel = document.getElementById('uebersichtTitel');
        if (uebersichtTitel) uebersichtTitel.innerText = `📊 Jahresstunden-Übersicht ${curYear}`;
        const rankBody = document.getElementById('rankingTableBody');
        if (rankBody) {
          rankBody.innerHTML = '';
          appData.members.forEach((m) => {
            const h = memberHours[m.id] || { ausbildung: 0, nachbereitung: 0, lehrgang: 0, einsatz: 0, gesamt: 0 };
            const isUvvOk = checkUvvValidityForMember(m.id, curYear);
            const uvvBadge = isUvvOk ? `<span class="badge badge-success">✓ ${curYear}</span>` : `<span class="badge badge-danger">⚠️ Fällig</span>`;

            rankBody.innerHTML += `
              <tr>
                <td><strong>${m.nachname || ''}</strong>, ${m.vorname || ''}</td>
                <td>${funktionAnzeige(m)}</td>
                <td>${uvvBadge}</td>
                <td>${stdPille(h.einsatz, '#e02424')}</td>
                <td>${stdPille(h.ausbildung, '#1f8fff')}</td>
                <td>${stdPille(h.nachbereitung, '#10a874')}</td>
                <td>${stdPille(h.lehrgang, '#5b61ad')}</td>
                <td>${stdPille(h.gesamt, '#facc15', '#1e293b', true)}</td>
              </tr>
            `;
          });
        }

    }
