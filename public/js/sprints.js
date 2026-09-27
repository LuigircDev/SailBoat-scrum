/**
 * SailBoat Retro - Multi-Sprint Management, Action Items & Export
 * Permite guardar y alternar entre sprints, gestionar acuerdos y exportar resúmenes.
 */

class SprintManager {
  constructor() {
    this.roomState = null;
    this.initEvents();
  }

  initEvents() {
    // 1. Selector de Sprints en Barra Superior
    const btnSprintMenu = document.getElementById('btnSprintMenu');
    const dropdownMenu = document.getElementById('sprintDropdownMenu');

    btnSprintMenu?.addEventListener('click', (e) => {
      e.stopPropagation();
      dropdownMenu.classList.toggle('hidden');
    });

    document.addEventListener('click', (e) => {
      if (!dropdownMenu.contains(e.target) && e.target !== btnSprintMenu) {
        dropdownMenu.classList.add('hidden');
      }
    });

    // 2. Modal Nuevo Sprint
    const btnOpenNew = document.getElementById('btnOpenNewSprintModal');
    const newSprintModal = document.getElementById('newSprintModal');
    const btnCloseNew = document.getElementById('btnCloseNewSprintModal');
    const btnCancelNew = document.getElementById('btnCancelNewSprint');
    const formNewSprint = document.getElementById('createNewSprintForm');

    btnOpenNew?.addEventListener('click', () => {
      dropdownMenu.classList.add('hidden');
      const nextNum = (this.roomState?.sprints?.length || 1) + 1;
      document.getElementById('modalNewSprintName').value = `Sprint ${nextNum}`;
      document.getElementById('modalNewSprintGoal').value = '';
      newSprintModal.classList.remove('hidden');
      document.getElementById('modalNewSprintName').focus();
    });

    btnCloseNew?.addEventListener('click', () => newSprintModal.classList.add('hidden'));
    btnCancelNew?.addEventListener('click', () => newSprintModal.classList.add('hidden'));

    formNewSprint?.addEventListener('submit', (e) => {
      e.preventDefault();
      const name = document.getElementById('modalNewSprintName').value.trim();
      const goal = document.getElementById('modalNewSprintGoal').value.trim();
      const carryActions = document.getElementById('modalCarryActionsCheckbox').checked;

      window.multiplayer.createSprint(name, goal, carryActions);
      newSprintModal.classList.add('hidden');
    });

    // 3. Editar Sprint Goal inline
    const btnEditGoal = document.getElementById('btnEditSprintGoal');
    btnEditGoal?.addEventListener('click', () => {
      const activeSprint = this.getActiveSprint();
      if (!activeSprint) return;
      const newGoal = prompt('Editar Objetivo del Sprint (Sprint Goal):', activeSprint.goal || '');
      if (newGoal !== null) {
        window.multiplayer.updateSprintInfo(activeSprint.id, activeSprint.name, newGoal.trim());
      }
    });

    // 4. Panel de Acuerdos / Plan de Acción
    const btnOpenActions = document.getElementById('btnOpenActionItems');
    const actionsDrawer = document.getElementById('actionItemsDrawer');
    const btnCloseActions = document.getElementById('btnCloseActions');
    const newActionForm = document.getElementById('newActionForm');

    btnOpenActions?.addEventListener('click', () => {
      actionsDrawer.classList.toggle('hidden');
      this.renderActionItems();
    });

    btnCloseActions?.addEventListener('click', () => actionsDrawer.classList.add('hidden'));

    newActionForm?.addEventListener('submit', (e) => {
      e.preventDefault();
      const text = document.getElementById('newActionText').value.trim();
      const owner = document.getElementById('newActionOwner').value.trim();
      if (!text) return;

      const activeSprint = this.getActiveSprint();
      if (!activeSprint) return;

      const items = activeSprint.actionItems || [];
      items.push({
        id: 'act_' + Date.now(),
        text,
        owner: owner || 'Equipo',
        status: 'pending',
        createdAt: new Date().toISOString()
      });

      window.sounds.playPop();
      window.multiplayer.updateActionItems(activeSprint.id, items);

      document.getElementById('newActionText').value = '';
      document.getElementById('newActionText').focus();
    });

    // 5. Modal de Exportar Resumen
    const btnOpenExport = document.getElementById('btnOpenExportModal');
    const exportModal = document.getElementById('exportModal');
    const btnCloseExport = document.getElementById('btnCloseExportModal');

    btnOpenExport?.addEventListener('click', () => {
      this.updateMarkdownPreview();
      exportModal.classList.remove('hidden');
    });

    btnCloseExport?.addEventListener('click', () => exportModal.classList.add('hidden'));

    // Botones dentro del modal de exportación
    document.getElementById('btnCopyMarkdownSummary')?.addEventListener('click', () => this.copyMarkdown());
    document.getElementById('btnCopyPreviewText')?.addEventListener('click', () => this.copyMarkdown());
    document.getElementById('btnDownloadBoardPng')?.addEventListener('click', () => this.downloadBoardImage());
    document.getElementById('btnDownloadJsonBackup')?.addEventListener('click', () => this.downloadJsonBackup());

    // Exportar e Importar JSON desde el dropdown
    document.getElementById('btnExportAllSprints')?.addEventListener('click', () => this.downloadJsonBackup());
    const fileInput = document.getElementById('backupFileInput');
    document.getElementById('btnImportSprintBackup')?.addEventListener('click', () => fileInput.click());
    fileInput?.addEventListener('change', (e) => this.handleImportBackup(e));
  }

  updateState(roomState) {
    this.roomState = roomState;
    this.renderSprintDropdownList();
    this.renderActionItems();

    const activeSprint = this.getActiveSprint();
    if (activeSprint) {
      window.board.renderSprint(activeSprint);
    }
  }

  getActiveSprint() {
    if (!this.roomState || !this.roomState.sprints) return null;
    return this.roomState.sprints.find(s => s.id === this.roomState.activeSprintId) || this.roomState.sprints[0];
  }

  // Renderizar la lista de sprints en el menú desplegable
  renderSprintDropdownList() {
    const listContainer = document.getElementById('sprintListItems');
    if (!listContainer || !this.roomState?.sprints) return;

    listContainer.innerHTML = '';
    const activeId = this.roomState.activeSprintId;

    this.roomState.sprints.forEach(sprint => {
      const row = document.createElement('div');
      row.className = `sprint-item-row ${sprint.id === activeId ? 'active' : ''}`;
      
      const noteCount = sprint.notes ? sprint.notes.length : 0;
      const dateStr = new Date(sprint.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric' });

      row.innerHTML = `
        <div>
          <div class="sprint-item-title">${this.escapeHtml(sprint.name)}</div>
          <div class="sprint-item-meta">${dateStr} · ${noteCount} notas</div>
        </div>
        ${sprint.id === activeId ? '<span class="badge-count">Activo</span>' : ''}
      `;

      row.addEventListener('click', () => {
        window.multiplayer.switchSprint(sprint.id);
        document.getElementById('sprintDropdownMenu').classList.add('hidden');
      });

      listContainer.appendChild(row);
    });
  }

  // Renderizar compromisos del sprint actual
  renderActionItems() {
    const list = document.getElementById('actionItemsList');
    const badge = document.getElementById('actionsPendingBadge');
    const headerCount = document.getElementById('actionItemsCount');
    if (!list) return;

    const activeSprint = this.getActiveSprint();
    const items = activeSprint?.actionItems || [];
    const pendingCount = items.filter(i => i.status === 'pending').length;

    if (badge) badge.textContent = `${pendingCount} pendiente${pendingCount === 1 ? '' : 's'}`;
    if (headerCount) headerCount.textContent = pendingCount;

    list.innerHTML = '';
    if (items.length === 0) {
      list.innerHTML = '<p class="helper-text" style="text-align:center; padding: 16px;">No hay acuerdos registrados todavía para este sprint.</p>';
      return;
    }

    items.forEach((item, index) => {
      const card = document.createElement('div');
      card.className = `action-item-card ${item.status === 'completed' ? 'completed' : ''}`;
      card.innerHTML = `
        <input type="checkbox" class="action-checkbox" ${item.status === 'completed' ? 'checked' : ''}>
        <div class="action-content">
          <div class="action-text">${this.escapeHtml(item.text)}</div>
          <div class="action-meta">
            <span class="action-owner">👤 ${this.escapeHtml(item.owner || 'Equipo')}</span>
          </div>
        </div>
        <button class="btn-delete-action" title="Eliminar acuerdo">✕</button>
      `;

      // Toggle completado
      const checkbox = card.querySelector('.action-checkbox');
      checkbox.addEventListener('change', () => {
        item.status = checkbox.checked ? 'completed' : 'pending';
        window.sounds.playPop();
        window.multiplayer.updateActionItems(activeSprint.id, items);
      });

      // Eliminar
      const btnDel = card.querySelector('.btn-delete-action');
      btnDel.addEventListener('click', () => {
        items.splice(index, 1);
        window.multiplayer.updateActionItems(activeSprint.id, items);
      });

      list.appendChild(card);
    });
  }

  // Generar y previsualizar reporte en Markdown
  buildMarkdownReport() {
    const sprint = this.getActiveSprint();
    if (!sprint) return 'Sin datos de sprint.';

    const notes = sprint.notes || [];
    const windNotes = notes.filter(n => n.zone === 'wind');
    const sunNotes = notes.filter(n => n.zone === 'sun');
    const anchorNotes = notes.filter(n => n.zone === 'anchor').sort((a,b) => (b.votes?.length || 0) - (a.votes?.length || 0));
    const reefNotes = notes.filter(n => n.zone === 'reef').sort((a,b) => (b.votes?.length || 0) - (a.votes?.length || 0));
    const goalNotes = notes.filter(n => n.zone === 'goal');
    const actions = sprint.actionItems || [];

    let md = `# ⛵ Retrospectiva SailBoat · ${sprint.name}\n`;
    md += `**Fecha:** ${new Date().toLocaleDateString()} | **Sala:** ${this.roomState.code}\n`;
    md += `**Objetivo del Sprint (Sprint Goal):** ${sprint.goal || 'No especificado'}\n\n`;

    md += `## 💨 VIENTO (Lo que nos impulsó hacia adelante)\n`;
    if (windNotes.length) {
      windNotes.forEach(n => md += `- ${n.text} *(por ${n.author}${n.votes?.length ? `, ${n.votes.length} votos` : ''})*\n`);
    } else {
      md += `*Sin notas registradas*\n`;
    }
    md += `\n`;

    md += `## ☀️ SOL (Lo que nos hizo sentir bien / Felicitaciones)\n`;
    if (sunNotes.length) {
      sunNotes.forEach(n => md += `- ${n.text} *(por ${n.author}${n.votes?.length ? `, ${n.votes.length} votos` : ''})*\n`);
    } else {
      md += `*Sin notas registradas*\n`;
    }
    md += `\n`;

    md += `## ⚓ ANCLA (Lo que nos frenó / Bloqueos prioritarios)\n`;
    if (anchorNotes.length) {
      anchorNotes.forEach(n => md += `- ${n.text} *(por ${n.author} | ❤️ ${n.votes?.length || 0} votos)*\n`);
    } else {
      md += `*Sin notas registradas*\n`;
    }
    md += `\n`;

    md += `## 🪨 ARRECIFE (Riesgos a futuro)\n`;
    if (reefNotes.length) {
      reefNotes.forEach(n => md += `- ${n.text} *(por ${n.author} | ❤️ ${n.votes?.length || 0} votos)*\n`);
    } else {
      md += `*Sin notas registradas*\n`;
    }
    md += `\n`;

    md += `## 📋 PLAN DE ACCIÓN Y COMPROMISOS (SMART)\n`;
    if (actions.length) {
      actions.forEach(a => {
        const check = a.status === 'completed' ? '[x]' : '[ ]';
        md += `- ${check} **${a.text}** (Responsable: @${a.owner})\n`;
      });
    } else {
      md += `*No se definieron acuerdos formales*\n`;
    }

    return md;
  }

  updateMarkdownPreview() {
    const preview = document.getElementById('markdownPreviewText');
    if (preview) {
      preview.textContent = this.buildMarkdownReport();
    }
  }

  copyMarkdown() {
    const md = this.buildMarkdownReport();
    navigator.clipboard.writeText(md).then(() => {
      alert('¡Informe Markdown copiado al portapapeles! Listo para pegar en Jira, Confluence o Slack.');
    });
  }

  // Descarga visual PNG mediante html2canvas
  async downloadBoardImage() {
    const stage = document.getElementById('canvasStage');
    if (!stage || typeof html2canvas === 'undefined') {
      alert('Librería de captura no disponible.');
      return;
    }

    // Temporalmente restablecer escala a 1 para captura nítida 1920x1080
    const currentTransform = stage.style.transform;
    stage.style.transform = 'translate(0px, 0px) scale(1)';

    try {
      const canvas = await html2canvas(stage, {
        useCORS: true,
        scale: 1,
        width: 1920,
        height: 1080
      });

      const link = document.createElement('a');
      link.download = `SailBoat_${this.roomState.code}_${this.getActiveSprint()?.name || 'Sprint'}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (err) {
      alert('Error al generar la imagen: ' + err.message);
    } finally {
      stage.style.transform = currentTransform;
    }
  }

  // Descarga de backup JSON completo
  downloadJsonBackup() {
    if (!this.roomState) return;
    const blob = new Blob([JSON.stringify(this.roomState, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.download = `SailBoat_Respaldo_${this.roomState.code}.json`;
    link.href = url;
    link.click();
    URL.revokeObjectURL(url);
  }

  // Importar backup JSON
  handleImportBackup(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target.result);
        if (!parsed.sprints) {
          alert('El archivo no parece ser un respaldo válido de SailBoat Retro.');
          return;
        }
        if (confirm(`¿Restaurar respaldo para la sala ${parsed.code || this.roomState.code}? Esto reemplazará los datos actuales.`)) {
          if (window.multiplayer.mode === 'socket') {
            fetch(`/api/rooms/${this.roomState.code}/import`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(parsed)
            }).then(() => alert('Tablero restaurado correctamente.'));
          } else {
            this.updateState(parsed);
            window.multiplayer.localState = parsed;
            window.multiplayer.saveLocalRoom(parsed);
            alert('Tablero restaurado localmente.');
          }
        }
      } catch (err) {
        alert('Error al leer el archivo JSON: ' + err.message);
      }
    };
    reader.readAsText(file);
  }

  escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
}

window.sprintManager = new SprintManager();
