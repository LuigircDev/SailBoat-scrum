/**
 * SailBoat Retro - Canvas & Board Engine
 * Maneja zoom, paneo, renderizado de notas adhesivas, drag & drop porcentual y cursores.
 */

class BoardEngine {
  constructor() {
    this.viewport = document.getElementById('canvasViewport');
    this.stage = document.getElementById('canvasStage');
    this.notesContainer = document.getElementById('notesContainer');
    this.cursorsContainer = document.getElementById('cursorsContainer');
    this.reactionsContainer = document.getElementById('reactionsContainer');

    // Estado de transformación del lienzo (Zoom & Paneo)
    this.scale = 1;
    this.panX = 0;
    this.panY = 0;
    this.isPanning = false;
    this.panStartX = 0;
    this.panStartY = 0;

    // Dimensiones fijas de referencia del canvas interno (16:9 HD)
    this.STAGE_WIDTH = 1920;
    this.STAGE_HEIGHT = 1080;

    // Estado local de notas y sprint activo
    this.activeSprint = null;
    this.selectedColor = 'yellow';
    this.myNotes = new Set();

    // Arrastre de notas
    this.activeDragNote = null;
    this.dragStartMouse = { x: 0, y: 0 };
    this.dragStartNotePos = { x: 0, y: 0 };

    this.initEvents();
  }

  initEvents() {
    // 1. Paneo con clic central o arrastre en el fondo del lienzo
    this.viewport.addEventListener('pointerdown', (e) => {
      // Ignorar si el clic fue en un post-it o en un botón
      if (e.target.closest('.post-it') || e.target.closest('button') || e.target.closest('.retro-zone-overlay')) {
        return;
      }
      this.isPanning = true;
      this.panStartX = e.clientX - this.panX;
      this.panStartY = e.clientY - this.panY;
      this.viewport.setPointerCapture(e.pointerId);
    });

    this.viewport.addEventListener('pointermove', (e) => {
      // Enviar posición de cursor al multiplayer
      this.handlePointerCursorMove(e);

      if (this.isPanning) {
        this.panX = e.clientX - this.panStartX;
        this.panY = e.clientY - this.panStartY;
        this.applyTransform();
      } else if (this.activeDragNote) {
        this.handleNoteDrag(e);
      }
    });

    this.viewport.addEventListener('pointerup', (e) => {
      if (this.isPanning) {
        this.isPanning = false;
        try { this.viewport.releasePointerCapture(e.pointerId); } catch (err) {}
      }
      if (this.activeDragNote) {
        this.finishNoteDrag();
      }
    });

    // 2. Zoom con la rueda del ratón centrado en el puntero
    this.viewport.addEventListener('wheel', (e) => {
      e.preventDefault();
      const zoomFactor = e.deltaY < 0 ? 1.08 : 0.92;
      this.zoomAtPoint(e.clientX, e.clientY, zoomFactor);
    }, { passive: false });

    // 3. Doble clic para crear nota rápida en la posición
    this.viewport.addEventListener('dblclick', (e) => {
      if (e.target.closest('.post-it') || e.target.closest('button')) return;
      const coords = this.screenToCanvasPercent(e.clientX, e.clientY);
      this.promptQuickNote(coords.x, coords.y);
    });

    // 4. Selector de color de notas
    const palette = document.getElementById('noteColorPalette');
    if (palette) {
      palette.addEventListener('click', (e) => {
        const dot = e.target.closest('.color-dot');
        if (!dot) return;
        palette.querySelectorAll('.color-dot').forEach(d => d.classList.remove('active'));
        dot.classList.add('active');
        this.selectedColor = dot.dataset.color || 'yellow';
      });
    }

    // 5. Botones de Zoom en Toolbar
    document.getElementById('btnZoomIn')?.addEventListener('click', () => this.zoomRelative(1.15));
    document.getElementById('btnZoomOut')?.addEventListener('click', () => this.zoomRelative(0.85));
    document.getElementById('btnZoomReset')?.addEventListener('click', () => this.centerStage());

    // 6. Botones "+ Nota" en cada zona
    document.querySelectorAll('.btn-quick-add').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const zone = btn.dataset.zone;
        this.createNoteInZone(zone);
      });
    });

    // 7. Botón "+ Crear Post-it" en barra inferior
    document.getElementById('btnCreateNewNote')?.addEventListener('click', () => {
      this.createNoteInZone('wind');
    });

    // Auto-centrar en el montaje inicial
    window.addEventListener('resize', () => this.centerStage());
  }

  // Centrar y ajustar el lienzo automáticamente al tamaño de pantalla
  centerStage() {
    const vpRect = this.viewport.getBoundingClientRect();
    const scaleX = (vpRect.width - 40) / this.STAGE_WIDTH;
    const scaleY = (vpRect.height - 40) / this.STAGE_HEIGHT;
    this.scale = Math.min(scaleX, scaleY, 1.1);

    this.panX = (vpRect.width - (this.STAGE_WIDTH * this.scale)) / 2;
    this.panY = (vpRect.height - (this.STAGE_HEIGHT * this.scale)) / 2;

    this.applyTransform();
  }

  zoomRelative(factor) {
    const vpRect = this.viewport.getBoundingClientRect();
    const cx = vpRect.left + vpRect.width / 2;
    const cy = vpRect.top + vpRect.height / 2;
    this.zoomAtPoint(cx, cy, factor);
  }

  zoomAtPoint(screenX, screenY, factor) {
    const prevScale = this.scale;
    const newScale = Math.min(Math.max(0.35, prevScale * factor), 2.5);
    if (newScale === prevScale) return;

    const vpRect = this.viewport.getBoundingClientRect();
    const mouseX = screenX - vpRect.left;
    const mouseY = screenY - vpRect.top;

    this.panX = mouseX - (mouseX - this.panX) * (newScale / prevScale);
    this.panY = mouseY - (mouseY - this.panY) * (newScale / prevScale);
    this.scale = newScale;

    this.applyTransform();
  }

  applyTransform() {
    this.stage.style.transform = `translate(${this.panX}px, ${this.panY}px) scale(${this.scale})`;
    const zoomDisplay = document.getElementById('zoomLevelDisplay');
    if (zoomDisplay) {
      zoomDisplay.textContent = Math.round(this.scale * 100) + '%';
    }
  }

  screenToCanvasPercent(screenX, screenY) {
    const vpRect = this.viewport.getBoundingClientRect();
    const localX = (screenX - vpRect.left - this.panX) / this.scale;
    const localY = (screenY - vpRect.top - this.panY) / this.scale;

    const percentX = Math.max(2, Math.min(98, (localX / this.STAGE_WIDTH) * 100));
    const percentY = Math.max(2, Math.min(98, (localY / this.STAGE_HEIGHT) * 100));

    return { x: Math.round(percentX * 10) / 10, y: Math.round(percentY * 10) / 10 };
  }

  // Detectar zona según coordenadas porcentuales
  detectZone(x, y) {
    if (x > 75 && y < 45) return 'goal';
    if (y < 48) {
      return x < 48 ? 'wind' : 'sun';
    } else {
      return x < 48 ? 'anchor' : 'reef';
    }
  }

  getDefaultZoneCoords(zone) {
    // Puntos centrales seguros con dispersión aleatoria suave
    const spread = (Math.random() - 0.5) * 8;
    switch (zone) {
      case 'wind': return { x: 22 + spread, y: 24 + spread };
      case 'sun': return { x: 68 + spread, y: 22 + spread };
      case 'anchor': return { x: 22 + spread, y: 72 + spread };
      case 'reef': return { x: 74 + spread, y: 74 + spread };
      case 'goal': return { x: 86 + spread, y: 26 + spread };
      default: return { x: 50 + spread, y: 50 + spread };
    }
  }

  // Renderizado del Sprint completo en el lienzo
  renderSprint(sprint) {
    this.activeSprint = sprint;
    this.notesContainer.innerHTML = '';

    if (!sprint || !sprint.notes) return;

    // Actualizar nombre y goal en header
    const sprintNameEl = document.getElementById('headerSprintName');
    const badgeLabel = document.getElementById('currentSprintBadgeLabel');
    const goalTextEl = document.getElementById('displaySprintGoal');

    if (sprintNameEl) sprintNameEl.textContent = sprint.name;
    if (badgeLabel) badgeLabel.textContent = sprint.name;
    if (goalTextEl) goalTextEl.textContent = sprint.goal || 'Sin meta definida aún';

    sprint.notes.forEach(note => this.renderNoteElement(note));
    this.updateZoneCounts();
  }

  // Renderizar un post-it individual
  renderNoteElement(note) {
    const existing = document.getElementById('note_' + note.id);
    if (existing) existing.remove();

    const noteEl = document.createElement('div');
    noteEl.id = 'note_' + note.id;
    noteEl.className = 'post-it';
    noteEl.dataset.noteId = note.id;
    noteEl.dataset.color = note.color || 'yellow';
    noteEl.dataset.zone = note.zone || 'wind';

    // Inclinación visual orgánica (-3deg a +3deg) basada en su ID
    const tilt = ((note.id.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0) % 7) - 3) * 0.8;
    noteEl.style.setProperty('--tilt', `${tilt}deg`);

    // Coordenadas absolutas en % del canvas
    noteEl.style.left = `${note.x}%`;
    noteEl.style.top = `${note.y}%`;

    // Identificar si es nota propia
    const isMine = window.multiplayer.currentUser &&
      (note.author === window.multiplayer.currentUser.name || this.myNotes.has(note.id));
    if (isMine) noteEl.classList.add('my-note');

    // Votos
    const votes = Array.isArray(note.votes) ? note.votes : [];
    const voteCount = votes.length;
    const hasVoted = window.multiplayer.currentUser && votes.includes(window.multiplayer.currentUser.name);

    noteEl.innerHTML = `
      <div class="post-it-header">
        <div class="post-it-author">
          <span class="post-it-author-dot" style="background:${note.authorColor || '#0284c7'};"></span>
          <span>${this.escapeHtml(note.author || 'Anónimo')}</span>
        </div>
        <div class="post-it-actions">
          <button class="btn-note-action btn-edit-note" title="Editar">✏️</button>
          <button class="btn-note-action btn-del-note" title="Eliminar">🗑️</button>
        </div>
      </div>
      <div class="post-it-body">${this.escapeHtml(note.text || '')}</div>
      <div class="post-it-footer">
        <button class="btn-vote ${hasVoted ? 'voted' : ''}" title="${hasVoted ? 'Quitar voto' : 'Votar este tema'}">
          <span class="vote-icon">❤️</span>
          <span class="vote-count">${voteCount}</span>
        </button>
        <span class="post-it-time">${this.formatTime(note.createdAt)}</span>
      </div>
    `;

    // Eventos del post-it
    this.attachNoteEvents(noteEl, note);
    this.notesContainer.appendChild(noteEl);
  }

  attachNoteEvents(noteEl, note) {
    // 1. Drag & Drop
    noteEl.addEventListener('pointerdown', (e) => {
      // Si hizo clic en un botón interno (editar, borrar, votar), no iniciar arrastre
      if (e.target.closest('button')) return;
      e.stopPropagation();

      this.activeDragNote = {
        id: note.id,
        el: noteEl,
        origX: note.x,
        origY: note.y
      };

      noteEl.classList.add('dragging');
      this.dragStartMouse = { x: e.clientX, y: e.clientY };
      this.dragStartNotePos = { x: note.x, y: note.y };

      this.viewport.setPointerCapture(e.pointerId);
    });

    // 2. Votar nota
    const btnVote = noteEl.querySelector('.btn-vote');
    btnVote?.addEventListener('click', (e) => {
      e.stopPropagation();
      window.sounds.playChime();
      window.multiplayer.voteNote(this.activeSprint.id, note.id);
    });

    // 3. Editar nota
    const btnEdit = noteEl.querySelector('.btn-edit-note');
    btnEdit?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.openEditModal(note);
    });

    // 4. Doble clic en nota abre edición
    noteEl.addEventListener('dblclick', (e) => {
      e.stopPropagation();
      this.openEditModal(note);
    });

    // 5. Eliminar nota
    const btnDel = noteEl.querySelector('.btn-del-note');
    btnDel?.addEventListener('click', (e) => {
      e.stopPropagation();
      if (confirm('¿Eliminar esta nota adhesiva?')) {
        window.sounds.playPop();
        window.multiplayer.deleteNote(this.activeSprint.id, note.id);
      }
    });
  }

  handleNoteDrag(e) {
    if (!this.activeDragNote) return;

    // Calcular desplazamiento en porcentaje de stage
    const deltaScreenX = e.clientX - this.dragStartMouse.x;
    const deltaScreenY = e.clientY - this.dragStartMouse.y;

    const deltaPercentX = (deltaScreenX / this.scale / this.STAGE_WIDTH) * 100;
    const deltaPercentY = (deltaScreenY / this.scale / this.STAGE_HEIGHT) * 100;

    let newX = Math.max(3, Math.min(97, this.dragStartNotePos.x + deltaPercentX));
    let newY = Math.max(3, Math.min(97, this.dragStartNotePos.y + deltaPercentY));

    newX = Math.round(newX * 10) / 10;
    newY = Math.round(newY * 10) / 10;

    this.activeDragNote.el.style.left = `${newX}%`;
    this.activeDragNote.el.style.top = `${newY}%`;

    this.activeDragNote.currentX = newX;
    this.activeDragNote.currentY = newY;
  }

  finishNoteDrag() {
    if (!this.activeDragNote) return;

    const noteId = this.activeDragNote.id;
    const finalX = this.activeDragNote.currentX || this.activeDragNote.origX;
    const finalY = this.activeDragNote.currentY || this.activeDragNote.origY;
    const newZone = this.detectZone(finalX, finalY);

    this.activeDragNote.el.classList.remove('dragging');

    // Sonido sutil
    window.sounds.playPop();

    // Actualizar en el sprint local
    const note = this.activeSprint?.notes.find(n => n.id === noteId);
    if (note) {
      note.x = finalX;
      note.y = finalY;
      note.zone = newZone;
      this.activeDragNote.el.dataset.zone = newZone;
    }

    // Emitir cambio de posición a los compañeros
    window.multiplayer.moveNote(this.activeSprint.id, noteId, finalX, finalY, newZone);

    this.updateZoneCounts();
    this.activeDragNote = null;
  }

  // Crear nota rápida desde un cuadrante
  createNoteInZone(zone) {
    const coords = this.getDefaultZoneCoords(zone);
    this.promptQuickNote(coords.x, coords.y, zone);
  }

  promptQuickNote(x, y, forcedZone = null) {
    const zone = forcedZone || this.detectZone(x, y);
    const zoneData = {
      wind: { icon: '💨', title: 'Nuevo Post-it: Viento', question: '¿Qué nos impulsó, aceleró o funcionó muy bien?' },
      sun: { icon: '☀️', title: 'Nuevo Post-it: Sol', question: '¿Qué logros, celebraciones o agradecimientos queremos destacar?' },
      anchor: { icon: '⚓', title: 'Nuevo Post-it: Ancla', question: '¿Qué nos frenó, bloqueó o causó frustración?' },
      reef: { icon: '🪨', title: 'Nuevo Post-it: Arrecife', question: '¿Qué riesgos futuros, incertidumbres o alertas vemos adelante?' },
      goal: { icon: '🏝️', title: 'Nuevo Post-it: Destino', question: 'Meta común y compromisos de llegada.' }
    };

    const info = zoneData[zone] || zoneData.wind;
    const modal = document.getElementById('addNoteModal');
    const titleEl = document.getElementById('addNoteModalTitle');
    const iconEl = document.getElementById('addNoteModalIcon');
    const questionEl = document.getElementById('addNoteModalQuestion');
    const inputZone = document.getElementById('addNoteZone');
    const inputX = document.getElementById('addNoteX');
    const inputY = document.getElementById('addNoteY');
    const textInput = document.getElementById('addNoteTextInput');
    const palette = document.getElementById('addNoteColorPalette');

    if (titleEl) titleEl.textContent = info.title;
    if (iconEl) iconEl.textContent = info.icon;
    if (questionEl) questionEl.textContent = info.question;
    if (inputZone) inputZone.value = zone;
    if (inputX) inputX.value = x;
    if (inputY) inputY.value = y;
    if (textInput) textInput.value = '';

    let chosenColor = this.selectedColor || 'yellow';
    if (palette) {
      palette.querySelectorAll('.color-dot').forEach(d => {
        d.classList.toggle('active', d.dataset.color === chosenColor);
      });
      palette.onclick = (e) => {
        const dot = e.target.closest('.color-dot');
        if (dot) {
          palette.querySelectorAll('.color-dot').forEach(d => d.classList.remove('active'));
          dot.classList.add('active');
          chosenColor = dot.dataset.color;
        }
      };
    }

    const form = document.getElementById('addNoteForm');
    form.onsubmit = (e) => {
      e.preventDefault();
      const text = textInput.value.trim();
      if (!text) return;

      const newNote = {
        id: 'note_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
        zone: inputZone.value,
        text: text,
        color: chosenColor,
        author: window.multiplayer.currentUser?.name || 'Marinero',
        authorColor: window.multiplayer.currentUser?.color || '#38bdf8',
        x: parseFloat(inputX.value),
        y: parseFloat(inputY.value),
        votes: [],
        createdAt: new Date().toISOString()
      };

      this.myNotes.add(newNote.id);
      window.sounds.playPop();
      window.multiplayer.createNote(this.activeSprint.id, newNote);
      modal.classList.add('hidden');
    };

    const btnClose = document.getElementById('btnCloseAddNoteModal');
    const btnCancel = document.getElementById('btnCancelAddNote');
    btnClose.onclick = () => modal.classList.add('hidden');
    btnCancel.onclick = () => modal.classList.add('hidden');

    modal.classList.remove('hidden');
    setTimeout(() => textInput.focus(), 80);
  }

  openEditModal(note) {
    const modal = document.getElementById('editNoteModal');
    const inputId = document.getElementById('editNoteId');
    const inputText = document.getElementById('editNoteText');
    const selectZone = document.getElementById('editNoteZone');
    const palette = document.getElementById('editNoteColorPalette');

    inputId.value = note.id;
    inputText.value = note.text;
    selectZone.value = note.zone || 'wind';

    palette.querySelectorAll('.color-dot').forEach(d => {
      d.classList.toggle('active', d.dataset.color === note.color);
    });

    let chosenColor = note.color || 'yellow';
    const onPaletteClick = (e) => {
      const dot = e.target.closest('.color-dot');
      if (dot) {
        palette.querySelectorAll('.color-dot').forEach(d => d.classList.remove('active'));
        dot.classList.add('active');
        chosenColor = dot.dataset.color;
      }
    };
    palette.onclick = onPaletteClick;

    const form = document.getElementById('editNoteForm');
    form.onsubmit = (e) => {
      e.preventDefault();
      const updates = {
        text: inputText.value.trim(),
        zone: selectZone.value,
        color: chosenColor
      };
      window.sounds.playPop();
      window.multiplayer.updateNote(this.activeSprint.id, note.id, updates);
      modal.classList.add('hidden');
    };

    const btnDelete = document.getElementById('btnDeleteNoteModal');
    btnDelete.onclick = () => {
      if (confirm('¿Eliminar esta nota?')) {
        window.multiplayer.deleteNote(this.activeSprint.id, note.id);
        modal.classList.add('hidden');
      }
    };

    modal.classList.remove('hidden');
    inputText.focus();
  }

  // Contadores de notas por cuadrante
  updateZoneCounts() {
    if (!this.activeSprint || !this.activeSprint.notes) return;
    const counts = { wind: 0, sun: 0, anchor: 0, reef: 0, goal: 0 };
    this.activeSprint.notes.forEach(n => {
      if (counts[n.zone] !== undefined) counts[n.zone]++;
    });

    Object.keys(counts).forEach(z => {
      const el = document.getElementById('count_' + z);
      if (el) {
        el.textContent = `${counts[z]} nota${counts[z] === 1 ? '' : 's'}`;
      }
    });
  }

  // Manejo de cursores multiplayer
  handlePointerCursorMove(e) {
    if (!window.multiplayer.currentUser) return;
    const coords = this.screenToCanvasPercent(e.clientX, e.clientY);
    window.multiplayer.sendCursor(coords.x, coords.y);
  }

  updateRemoteCursor(cursorData) {
    let cursorEl = document.getElementById('cursor_' + cursorData.id);
    if (!cursorEl) {
      cursorEl = document.createElement('div');
      cursorEl.id = 'cursor_' + cursorData.id;
      cursorEl.className = 'remote-cursor';
      cursorEl.innerHTML = `
        <svg class="cursor-pointer-svg" viewBox="0 0 24 24" fill="${cursorData.color || '#38bdf8'}">
          <path d="M5.5 3.2L18.8 12.8L12.4 14.2L15.6 20.8L12.8 22.2L9.6 15.6L5.5 19.5V3.2Z"/>
        </svg>
        <span class="cursor-tag" style="background:${cursorData.color || '#38bdf8'}">${this.escapeHtml(cursorData.name)}</span>
      `;
      this.cursorsContainer.appendChild(cursorEl);
    }

    cursorEl.style.left = `${cursorData.x}%`;
    cursorEl.style.top = `${cursorData.y}%`;
  }

  removeRemoteCursor(id) {
    const el = document.getElementById('cursor_' + id);
    if (el) el.remove();
  }

  // Reacciones flotantes
  showFloatingReaction(reaction) {
    const el = document.createElement('div');
    el.className = 'floating-reaction';
    el.textContent = reaction.emoji;
    el.style.left = `${reaction.x}%`;
    el.style.top = `${reaction.y}%`;

    this.reactionsContainer.appendChild(el);
    setTimeout(() => el.remove(), 2600);
  }

  escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  formatTime(isoDate) {
    if (!isoDate) return '';
    const d = new Date(isoDate);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
}

window.board = new BoardEngine();
