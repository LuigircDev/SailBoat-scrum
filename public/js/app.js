/**
 * SailBoat Retro - Main Application Controller
 * Coordinador de lobby, parámetros de URL, presencia y sincronización global.
 */

const AVATAR_COLORS = [
  '#38bdf8', // Celeste cielo
  '#f59e0b', // Ámbar dorado
  '#10b981', // Verde esmeralda
  '#f43f5e', // Rosa frambuesa
  '#8b5cf6', // Púrpura real
  '#ec4899', // Fucsia vibrante
  '#06b6d4', // Turquesa
  '#eab308'  // Amarillo sol
];

class AppController {
  constructor() {
    this.selectedJoinColor = AVATAR_COLORS[0];
    this.selectedCreateColor = AVATAR_COLORS[1];
    this.currentRoomCode = null;
    this.init();
  }

  init() {
    this.setupColorPickers();
    this.setupLobbyTabs();
    this.parseUrlParameters();
    this.setupLobbyForms();
    this.setupMultiplayerListeners();
    this.setupInviteButton();
  }

  // Configurar selectores de color de avatar
  setupColorPickers() {
    const renderPickers = (containerId, onSelect, initialColor) => {
      const container = document.getElementById(containerId);
      if (!container) return;
      container.innerHTML = '';
      AVATAR_COLORS.forEach(color => {
        const opt = document.createElement('div');
        opt.className = `avatar-color-option ${color === initialColor ? 'selected' : ''}`;
        opt.style.backgroundColor = color;
        opt.addEventListener('click', () => {
          container.querySelectorAll('.avatar-color-option').forEach(el => el.classList.remove('selected'));
          opt.classList.add('selected');
          onSelect(color);
        });
        container.appendChild(opt);
      });
    };

    renderPickers('joinColorPicker', (c) => this.selectedJoinColor = c, this.selectedJoinColor);
    renderPickers('createColorPicker', (c) => this.selectedCreateColor = c, this.selectedCreateColor);
  }

  // Pestañas de Lobby
  setupLobbyTabs() {
    const tabJoin = document.getElementById('tabJoinBtn');
    const tabCreate = document.getElementById('tabCreateBtn');
    const formJoin = document.getElementById('joinRoomForm');
    const formCreate = document.getElementById('createRoomForm');

    tabJoin?.addEventListener('click', () => {
      tabJoin.classList.add('active');
      tabCreate.classList.remove('active');
      formJoin.classList.remove('hidden');
      formCreate.classList.add('hidden');
    });

    tabCreate?.addEventListener('click', () => {
      tabCreate.classList.add('active');
      tabJoin.classList.remove('active');
      formCreate.classList.remove('hidden');
      formJoin.classList.add('hidden');
      if (!document.getElementById('createRoomCode').value) {
        this.generateRandomRoomCode();
      }
    });

    // Generar código aleatorio
    document.getElementById('btnGenRoomCode')?.addEventListener('click', () => {
      this.generateRandomRoomCode();
    });
  }

  generateRandomRoomCode() {
    const prefixes = ['SPRINT', 'RETRO', 'VELERO', 'EQUIPO', 'AGILE'];
    const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
    const num = Math.floor(Math.random() * 89 + 10);
    const code = `${prefix}-${num}`;
    const input = document.getElementById('createRoomCode');
    if (input) input.value = code;
  }

  // Leer parámetros de URL (?room=SPRINT-1&pin=1234)
  parseUrlParameters() {
    const params = new URLSearchParams(window.location.search);
    const roomParam = params.get('room');
    const pinParam = params.get('pin');
    const userParam = params.get('user');

    if (roomParam) {
      const joinRoomCode = document.getElementById('joinRoomCode');
      if (joinRoomCode) joinRoomCode.value = roomParam.toUpperCase();

      if (pinParam) {
        const joinPasscode = document.getElementById('joinPasscode');
        if (joinPasscode) joinPasscode.value = pinParam;
      }
      if (userParam) {
        const joinUserName = document.getElementById('joinUserName');
        if (joinUserName) joinUserName.value = userParam;
      }
    }
  }

  // Formularios de ingreso
  setupLobbyForms() {
    const formJoin = document.getElementById('joinRoomForm');
    formJoin?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const userName = document.getElementById('joinUserName').value.trim();
      const roomCode = document.getElementById('joinRoomCode').value.trim().toUpperCase();
      const passcode = document.getElementById('joinPasscode').value.trim();

      if (!userName || !roomCode) return;

      const submitBtn = document.getElementById('btnSubmitJoin');
      submitBtn.disabled = true;
      submitBtn.textContent = 'Conectando al velero...';

      await window.multiplayer.connect({
        roomCode,
        passcode,
        userName,
        userColor: this.selectedJoinColor,
        isFacilitator: false
      });
    });

    const formCreate = document.getElementById('createRoomForm');
    formCreate?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const userName = document.getElementById('createUserName').value.trim();
      const roomCode = document.getElementById('createRoomCode').value.trim().toUpperCase();
      const passcode = document.getElementById('createPasscode').value.trim();
      const sprintName = document.getElementById('createSprintName').value.trim();
      const sprintGoal = document.getElementById('createSprintGoal').value.trim();

      if (!userName || !roomCode) return;

      const submitBtn = document.getElementById('btnSubmitCreate');
      submitBtn.disabled = true;
      submitBtn.textContent = 'Creando sala...';

      await window.multiplayer.connect({
        roomCode,
        passcode,
        userName,
        userColor: this.selectedCreateColor,
        isFacilitator: true,
        sprintName,
        sprintGoal
      });
    });
  }

  // Botón de Copiar Invitación
  setupInviteButton() {
    const btnCopy = document.getElementById('btnCopyInvite');
    const toast = document.getElementById('copyNotification');

    btnCopy?.addEventListener('click', () => {
      if (!this.currentRoomCode) return;

      const url = new URL(window.location.href);
      url.searchParams.set('room', this.currentRoomCode);

      navigator.clipboard.writeText(url.toString()).then(() => {
        if (toast) {
          toast.classList.remove('hidden');
          setTimeout(() => toast.classList.add('hidden'), 2500);
        }
      });
    });
  }

  // Conectar eventos recibidos desde MultiplayerClient
  setupMultiplayerListeners() {
    window.multiplayer.on('room-state', (roomState) => {
      this.currentRoomCode = roomState.code;

      // Actualizar etiqueta de sala
      const roomLabel = document.getElementById('currentRoomCodeLabel');
      if (roomLabel) roomLabel.textContent = roomState.code;

      // Ocultar lobby y mostrar tablero
      document.getElementById('lobbyScreen').classList.add('hidden');
      document.getElementById('boardScreen').classList.remove('hidden');

      // Actualizar URL en el navegador sin recargar
      const currentUrl = new URL(window.location.href);
      currentUrl.searchParams.set('room', roomState.code);
      window.history.replaceState({}, '', currentUrl.toString());

      // Actualizar gestores de sprint, tablero y facilitador
      window.sprintManager.updateState(roomState);
      if (roomState.settings) {
        window.facilitator.applyBlur(!!roomState.settings.blurNotes);
      }
      if (roomState.timer) {
        window.facilitator.updateTimer(roomState.timer);
      }

      // Centrar el lienzo en pantalla
      setTimeout(() => window.board.centerStage(), 150);
    });

    // CRUD Notas
    window.multiplayer.on('note-created', ({ sprintId, note }) => {
      const active = window.sprintManager.getActiveSprint();
      if (active && active.id === sprintId) {
        if (!active.notes.some(n => n.id === note.id)) {
          active.notes.push(note);
        }
        window.board.renderNoteElement(note);
        window.board.updateZoneCounts();
      }
    });

    window.multiplayer.on('note-updated', ({ sprintId, noteId, updates }) => {
      const active = window.sprintManager.getActiveSprint();
      if (active && active.id === sprintId) {
        const note = active.notes.find(n => n.id === noteId);
        if (note) {
          Object.assign(note, updates);
          window.board.renderNoteElement(note);
          window.board.updateZoneCounts();
        }
      }
    });

    window.multiplayer.on('note-moved', ({ sprintId, noteId, x, y, zone }) => {
      const active = window.sprintManager.getActiveSprint();
      if (active && active.id === sprintId) {
        const note = active.notes.find(n => n.id === noteId);
        if (note) {
          note.x = x;
          note.y = y;
          if (zone) note.zone = zone;
          const el = document.getElementById('note_' + noteId);
          if (el) {
            el.style.left = `${x}%`;
            el.style.top = `${y}%`;
            if (zone) el.dataset.zone = zone;
          }
          window.board.updateZoneCounts();
        }
      }
    });

    window.multiplayer.on('note-deleted', ({ sprintId, noteId }) => {
      const active = window.sprintManager.getActiveSprint();
      if (active && active.id === sprintId) {
        active.notes = active.notes.filter(n => n.id !== noteId);
        const el = document.getElementById('note_' + noteId);
        if (el) el.remove();
        window.board.updateZoneCounts();
      }
    });

    window.multiplayer.on('note-voted', ({ sprintId, noteId, votes }) => {
      const active = window.sprintManager.getActiveSprint();
      if (active && active.id === sprintId) {
        const note = active.notes.find(n => n.id === noteId);
        if (note) {
          note.votes = votes;
          const el = document.getElementById('note_' + noteId);
          if (el) {
            const btnVote = el.querySelector('.btn-vote');
            const countEl = el.querySelector('.vote-count');
            if (countEl) countEl.textContent = votes.length;
            const hasVoted = window.multiplayer.currentUser && votes.includes(window.multiplayer.currentUser.name);
            btnVote?.classList.toggle('voted', hasVoted);
          }
        }
      }
    });

    // Sprints
    window.multiplayer.on('sprint-created', ({ sprint, activeSprintId }) => {
      if (window.sprintManager.roomState) {
        window.sprintManager.roomState.sprints.push(sprint);
        window.sprintManager.roomState.activeSprintId = activeSprintId;
        window.sprintManager.updateState(window.sprintManager.roomState);
      }
      window.sounds.playCelebration();
    });

    window.multiplayer.on('sprint-switched', ({ activeSprintId }) => {
      if (window.sprintManager.roomState) {
        window.sprintManager.roomState.activeSprintId = activeSprintId;
        window.sprintManager.updateState(window.sprintManager.roomState);
      }
    });

    window.multiplayer.on('sprint-info-updated', ({ sprintId, name, goal }) => {
      const sprint = window.sprintManager.roomState?.sprints.find(s => s.id === sprintId);
      if (sprint) {
        if (name) sprint.name = name;
        if (goal) sprint.goal = goal;
        window.sprintManager.updateState(window.sprintManager.roomState);
      }
    });

    // Plan de acción
    window.multiplayer.on('action-items-updated', ({ sprintId, actionItems }) => {
      const sprint = window.sprintManager.roomState?.sprints.find(s => s.id === sprintId);
      if (sprint) {
        sprint.actionItems = actionItems;
        window.sprintManager.renderActionItems();
      }
    });

    // Temporizador
    window.multiplayer.on('timer-tick', (timerState) => {
      window.facilitator.updateTimer(timerState);
    });

    window.multiplayer.on('timer-finished', () => {
      window.facilitator.onTimerFinished();
    });

    // Desenfoque (Incógnito)
    window.multiplayer.on('blur-updated', ({ blurNotes }) => {
      window.facilitator.applyBlur(blurNotes);
    });

    // Presencia de usuarios en línea
    window.multiplayer.on('presence-update', (users) => {
      const presenceBar = document.getElementById('presenceBar');
      if (!presenceBar) return;
      presenceBar.innerHTML = '';

      users.forEach(user => {
        const badge = document.createElement('div');
        badge.className = 'user-avatar-badge';
        badge.style.backgroundColor = user.color || '#38bdf8';
        badge.title = `${user.name} ${user.isFacilitator ? '(Facilitador 👑)' : ''}`;
        badge.textContent = (user.name || 'M').charAt(0).toUpperCase();
        presenceBar.appendChild(badge);
      });
    });

    // Cursores remotos
    window.multiplayer.on('cursor-moved', (cursorData) => {
      window.board.updateRemoteCursor(cursorData);
    });

    window.multiplayer.on('cursor-removed', ({ id }) => {
      window.board.removeRemoteCursor(id);
    });

    // Reacciones
    window.multiplayer.on('reaction-received', (reaction) => {
      window.board.showFloatingReaction(reaction);
    });
  }
}

// Iniciar aplicación al cargar el DOM
document.addEventListener('DOMContentLoaded', () => {
  window.app = new AppController();
});
