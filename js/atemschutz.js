// FF Christdorf Dienstbuch – Atemschutz: G26.3 und Übungsstrecke, Atemschutz-Tabelle
// (klassische Skriptdatei: alle Funktionen sind global und werden von den anderen Dateien genutzt)

    function checkOneYearValidity(dateString) {
      if (!dateString) return { status: 'danger', label: 'Fehlt / Keine', daysLeft: -999 };
      const eventDate = new Date(dateString);
      const validUntil = new Date(eventDate);
      validUntil.setDate(validUntil.getDate() + 365);

      const now = new Date();
      const diffTime = validUntil - now;
      const daysLeft = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      const fDate = validUntil.toLocaleDateString('de-DE');

      if (daysLeft < 0) return { status: 'danger', label: `Abgelaufen (${fDate})`, daysLeft };
      else if (daysLeft <= 30) return { status: 'warning', label: `Bis ${fDate} (${daysLeft} T.)`, daysLeft };
      else return { status: 'success', label: `Bis ${fDate} (${daysLeft} T.)`, daysLeft };
    }

    function checkG26Validity(dateString) {
      if (!dateString) return { status: 'danger', label: 'Keine Angabe', daysLeft: -999 };
      const exp = new Date(dateString);
      const now = new Date();
      const diffTime = exp - now;
      const daysLeft = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      const fDate = exp.toLocaleDateString('de-DE');

      if (daysLeft < 0) return { status: 'danger', label: `Abgelaufen (${fDate})`, daysLeft };
      else if (daysLeft <= 60) return { status: 'warning', label: `Gültig bis ${fDate} (${daysLeft} T.)`, daysLeft };
      else return { status: 'success', label: `Gültig bis ${fDate}`, daysLeft };
    }    // Atemschutz: Tabelle der Atemschutzgeräteträger
    function atemschutzRendern(curYear) {
        const atemschutzTitel = document.getElementById('atemschutzTitel');
        if (atemschutzTitel) atemschutzTitel.innerText = `🤿 Atemschutzüberwachung ${curYear} (365-Tage-Regelung nach FwDV 7)`;
        const agtBody = document.getElementById('agtTableBody');
        if (agtBody) {
          agtBody.innerHTML = '';
          appData.members.filter(m => m.lehrgaenge && m.lehrgaenge.includes('AGT')).forEach(m => {
            const g26 = checkG26Validity(m.g26Ablauf);
            const str = checkOneYearValidity(m.streckeDatum);
            
            // Einsatztauglich: gültige G26.3 und gültige AGT-Übungsstrecke
            const isReady = (g26.status !== 'danger') && (str.status !== 'danger');

            agtBody.innerHTML += `
              <tr>
                <td><strong>${m.nachname}</strong>, ${m.vorname}</td>
                <td><span class="badge badge-${g26.status}">${g26.label}</span></td>
                <td><span class="badge badge-${str.status}">${str.label}</span></td>
                <td>${isReady ? '<span class="badge badge-success">Einsatztauglich ✓</span>' : '<span class="badge badge-danger">Nicht tauglich ✕</span>'}</td>
              </tr>
            `;
          });
        }

    }
