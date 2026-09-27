/**
 * SailBoat Retro - Multiplayer Sync Engine
 * Soporta conexión Socket.io nativa (con el servidor Node.js)
 * y Fallback P2P WebRTC / LocalStorage para despliegues estáticos gratuitos (GitHub Pages).
 */

class MultiplayerClient {
  constructor() {
    this.socket = null;
    this.webrtcRoom = null;
    this.mode = 'local'; // 'socket', 'webrtc', 'local'
    this.currentUser = null;
    this.roomCode = null;
    this.callbacks = {};
    this.localState = null;
  }

  on(event, callback) {
    if (!this.callbacks[event]) this.callbacks[event] = [];
    this.callbacks[event].push(callback);
  }

  emitLocal(event, data) {
    if (this.callbacks[event]) {
      this.callbacks[event].forEach(cb => cb(data));
    }
  }

  // Inicializar conexión
  async connect({ roomCode, passcode, userName, userColor, isFacilitator, sprintName, sprintGoal }) {
    this.roomCode = roomCode.trim().toUpperCase();
    this.currentUser = {
      id: 'usr_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
      name: userName || 'Marinero',
      color: userColor || '#38bdf8',
      isFacilitator: !!isFacilitator
    };

    // 1. Intentar conectar vía Socket.io si la librería está disponible
    if (typeof io !== 'undefined') {
      try {
        const socketUrl = window.SOCKET_SERVER_URL || (window.location.origin.startsWith('http') ? window.location.origin : 'http://localhost:3000');
        this.socket = io(socketUrl, {
          timeout: 4000,
          transports: ['websocket', 'polling']
        });

        const connected = await new Promise((resolve) => {
          const timer = setTimeout(() => resolve(false), 3000);
          this.socket.on('connect', () => {
            clearTimeout(timer);
            resolve(true);
          });
          this.socket.on('connect_error', () => {
            clearTimeout(timer);
            resolve(false);
          });
        });

        if (connected) {
          this.mode = 'socket';
          this.bindSocketEvents();
          this.socket.emit('join-room', {
            roomCode: this.roomCode,
            passcode,
            userName: this.currentUser.name,
            userColor: this.currentUser.color,
            isFacilitator: this.currentUser.isFacilitator,
            sprintName,
            sprintGoal
          });
          console.log('⛵ Conectado mediante Socket.io a la sala:', this.roomCode);
          return true;
        }
      } catch (e) {
        console.warn('Socket.io no disponible o falló:', e);
      }
    }

    // 2. Fallback: Servidor Serverless P2P WebRTC o LocalStorage
    console.log('⚡ Activando motor multiplayer serverless (P2P / LocalStorage)...');
    this.mode = 'webrtc';
    await this.initServerlessMode(passcode, sprintName, sprintGoal);
    return true;
  }

  // Enlazar eventos de Socket.io
  bindSocketEvents() {
    this.socket.on('room-state', state => this.emitLocal('room-state', state));
    this.socket.on('join-error', msg => alert('Error de acceso: ' + msg));
    this.socket.on('presence-update', users => this.emitLocal('presence-update', users));
    this.socket.on('note-created', data => this.emitLocal('note-created', data));
    this.socket.on('note-updated', data => this.emitLocal('note-updated', data));
    this.socket.on('note-moved', data => this.emitLocal('note-moved', data));
    this.socket.on('note-deleted', data => this.emitLocal('note-deleted', data));
    this.socket.on('note-voted', data => this.emitLocal('note-voted', data));
    this.socket.on('sprint-created', data => this.emitLocal('sprint-created', data));
    this.socket.on('sprint-switched', data => this.emitLocal('sprint-switched', data));
    this.socket.on('sprint-archived', data => this.emitLocal('sprint-archived', data));
    this.socket.on('sprint-info-updated', data => this.emitLocal('sprint-info-updated', data));
    this.socket.on('action-items-updated', data => this.emitLocal('action-items-updated', data));
    this.socket.on('timer-tick', data => this.emitLocal('timer-tick', data));
    this.socket.on('timer-finished', () => this.emitLocal('timer-finished'));
    this.socket.on('blur-updated', data => this.emitLocal('blur-updated', data));
    this.socket.on('cursor-moved', data => this.emitLocal('cursor-moved', data));
    this.socket.on('cursor-removed', data => this.emitLocal('cursor-removed', data));
    this.socket.on('reaction-received', data => this.emitLocal('reaction-received', data));
  }

  // Modo Serverless con BroadcastChannel + LocalStorage + Trystero CDN opcional
  async initServerlessMode(passcode, sprintName, sprintGoal) {
    const storageKey = 'sailboat_room_' + this.roomCode;
    let room = null;
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) room = JSON.parse(stored);
    } catch (e) {}

    if (!room) {
      const initialSprintId = 'sprint_' + Date.now();
      room = {
        code: this.roomCode,
        passcode: passcode || '',
        createdAt: new Date().toISOString(),
        facilitator: this.currentUser.name,
        activeSprintId: initialSprintId,
        settings: { blurNotes: false, votingEnabled: true, maxVotesPerUser: 5 },
        timer: { duration: 300, remaining: 300, isRunning: false },
        sprints: [
          {
            id: initialSprintId,
            name: sprintName || 'Sprint 1',
            goal: sprintGoal || '¡Alcanzar la meta del sprint con calidad y trabajo en equipo!',
            createdAt: new Date().toISOString(),
            archived: false,
            notes: [
              {
                id: 'n_w1',
                zone: 'wind',
                text: '🚀 Gran comunicación y apoyo en el equipo',
                color: 'green',
                author: this.currentUser.name,
                authorColor: this.currentUser.color,
                x: 20,
                y: 22,
                votes: [this.currentUser.name]
              },
              {
                id: 'n_s1',
                zone: 'sun',
                text: '☀️ ¡Felicitaciones por el despliegue exitoso!',
                color: 'yellow',
                author: 'Equipo',
                authorColor: '#f59e0b',
                x: 65,
                y: 20,
                votes: []
              },
              {
                id: 'n_a1',
                zone: 'anchor',
                text: '⚓ Tiempos largos en code reviews y aprobaciones',
                color: 'blue',
                author: 'Dev',
                authorColor: '#38bdf8',
                x: 20,
                y: 68,
                votes: []
              },
              {
                id: 'n_r1',
                zone: 'reef',
                text: '🪨 Posibles cambios de requerimiento de último momento',
                color: 'orange',
                author: 'Tech Lead',
                authorColor: '#ef4444',
                x: 75,
                y: 72,
                votes: []
              }
            ],
            actionItems: [
              {
                id: 'act_1',
                text: 'Definir ventana diaria fija de 30 min para revisiones de PR',
                owner: this.currentUser.name,
                status: 'pending'
              }
            ]
          }
        ]
      };
      this.saveLocalRoom(room);
    }

    this.localState = room;

    // Emular presencia y sincronización entre pestañas / navegadores con BroadcastChannel
    this.broadcastChannel = new BroadcastChannel('sailboat_' + this.roomCode);
    this.broadcastChannel.onmessage = (event) => {
      const { type, data } = event.data;
      if (type === 'sync-state') {
        this.localState = data;
        this.saveLocalRoom(data);
        this.emitLocal('room-state', this.localState);
      } else {
        this.emitLocal(type, data);
      }
    };

    // Intentar cargar Trystero P2P vía CDN dinámico para WebRTC entre computadoras distintas
    try {
      const trystero = await import('https://cdn.jsdelivr.net/npm/trystero@0.20.1/dist/trystero-torrent.min.js');
      if (trystero && trystero.joinRoom) {
        this.p2pRoom = trystero.joinRoom({ appId: 'sailboat-scrum-retro-v1', password: passcode || 'public' }, this.roomCode);
        const [sendData, getData] = this.p2pRoom.makeAction('sailboat-event');

        this.p2pSend = sendData;
        getData((data, peerId) => {
          if (data && data.type) {
            if (data.type === 'sync-state') {
              this.localState = data.data;
              this.saveLocalRoom(this.localState);
              this.emitLocal('room-state', this.localState);
            } else {
              this.emitLocal(data.type, data.data);
            }
          }
        });

        this.p2pRoom.onPeerJoin(peerId => {
          console.log('⚡ Nuevo compañero conectado vía WebRTC P2P:', peerId);
          // Enviar estado actual al nuevo peer
          this.p2pSend({ type: 'sync-state', data: this.localState }, peerId);
        });
      }
    } catch (err) {
      console.log('Trystero WebRTC CDN no disponible, funcionando en modo local/BroadcastChannel.');
    }

    // Emitir estado inicial
    setTimeout(() => {
      this.emitLocal('room-state', this.localState);
      this.emitLocal('presence-update', [this.currentUser]);
    }, 100);
  }

  saveLocalRoom(room) {
    try {
      localStorage.setItem('sailboat_room_' + this.roomCode, JSON.stringify(room));
    } catch (e) {}
  }

  broadcast(type, data) {
    if (this.mode === 'socket' && this.socket) {
      this.socket.emit(type, data);
    } else {
      // Broadcast local / P2P
      if (this.broadcastChannel) {
        this.broadcastChannel.postMessage({ type, data });
      }
      if (this.p2pSend) {
        this.p2pSend({ type, data });
      }
    }
  }

  // Métodos de acción
  createNote(sprintId, note) {
    if (this.mode === 'socket') {
      this.socket.emit('create-note', { sprintId, note });
    } else {
      const sprint = this.localState.sprints.find(s => s.id === sprintId) || this.localState.sprints[0];
      sprint.notes.push(note);
      this.saveLocalRoom(this.localState);
      this.emitLocal('note-created', { sprintId: sprint.id, note });
      this.broadcast('note-created', { sprintId: sprint.id, note });
    }
  }

  updateNote(sprintId, noteId, updates) {
    if (this.mode === 'socket') {
      this.socket.emit('update-note', { sprintId, noteId, updates });
    } else {
      const sprint = this.localState.sprints.find(s => s.id === sprintId) || this.localState.sprints[0];
      const note = sprint.notes.find(n => n.id === noteId);
      if (note) {
        Object.assign(note, updates);
        this.saveLocalRoom(this.localState);
        this.emitLocal('note-updated', { sprintId: sprint.id, noteId, updates });
        this.broadcast('note-updated', { sprintId: sprint.id, noteId, updates });
      }
    }
  }

  moveNote(sprintId, noteId, x, y, zone) {
    if (this.mode === 'socket') {
      this.socket.emit('move-note', { sprintId, noteId, x, y, zone });
    } else {
      const sprint = this.localState.sprints.find(s => s.id === sprintId) || this.localState.sprints[0];
      const note = sprint.notes.find(n => n.id === noteId);
      if (note) {
        note.x = x;
        note.y = y;
        if (zone) note.zone = zone;
        this.saveLocalRoom(this.localState);
        this.broadcast('note-moved', { sprintId: sprint.id, noteId, x, y, zone });
      }
    }
  }

  deleteNote(sprintId, noteId) {
    if (this.mode === 'socket') {
      this.socket.emit('delete-note', { sprintId, noteId });
    } else {
      const sprint = this.localState.sprints.find(s => s.id === sprintId) || this.localState.sprints[0];
      sprint.notes = sprint.notes.filter(n => n.id !== noteId);
      this.saveLocalRoom(this.localState);
      this.emitLocal('note-deleted', { sprintId: sprint.id, noteId });
      this.broadcast('note-deleted', { sprintId: sprint.id, noteId });
    }
  }

  voteNote(sprintId, noteId) {
    if (this.mode === 'socket') {
      this.socket.emit('vote-note', { sprintId, noteId });
    } else {
      const sprint = this.localState.sprints.find(s => s.id === sprintId) || this.localState.sprints[0];
      const note = sprint.notes.find(n => n.id === noteId);
      if (note) {
        if (!Array.isArray(note.votes)) note.votes = [];
        const voter = this.currentUser.name;
        const idx = note.votes.indexOf(voter);
        if (idx > -1) note.votes.splice(idx, 1);
        else note.votes.push(voter);
        this.saveLocalRoom(this.localState);
        this.emitLocal('note-voted', { sprintId: sprint.id, noteId, votes: note.votes });
        this.broadcast('note-voted', { sprintId: sprint.id, noteId, votes: note.votes });
      }
    }
  }

  createSprint(name, goal, carryPendingActions) {
    if (this.mode === 'socket') {
      this.socket.emit('create-sprint', { name, goal, carryPendingActions });
    } else {
      const newSprintId = 'sprint_' + Date.now();
      let carried = [];
      if (carryPendingActions) {
        const active = this.localState.sprints.find(s => s.id === this.localState.activeSprintId);
        if (active && active.actionItems) {
          carried = active.actionItems.filter(a => a.status === 'pending');
        }
      }
      const newSprint = {
        id: newSprintId,
        name: name || `Sprint ${this.localState.sprints.length + 1}`,
        goal: goal || '¡Continuar mejorando y navegando juntos!',
        createdAt: new Date().toISOString(),
        archived: false,
        notes: [],
        actionItems: carried
      };
      this.localState.sprints.push(newSprint);
      this.localState.activeSprintId = newSprintId;
      this.saveLocalRoom(this.localState);
      this.emitLocal('sprint-created', { sprint: newSprint, activeSprintId: newSprintId });
      this.broadcast('sprint-created', { sprint: newSprint, activeSprintId: newSprintId });
    }
  }

  switchSprint(sprintId) {
    if (this.mode === 'socket') {
      this.socket.emit('switch-sprint', { sprintId });
    } else {
      this.localState.activeSprintId = sprintId;
      this.saveLocalRoom(this.localState);
      this.emitLocal('sprint-switched', { activeSprintId: sprintId });
      this.broadcast('sprint-switched', { activeSprintId: sprintId });
    }
  }

  updateSprintInfo(sprintId, name, goal) {
    if (this.mode === 'socket') {
      this.socket.emit('update-sprint-info', { sprintId, name, goal });
    } else {
      const sprint = this.localState.sprints.find(s => s.id === sprintId);
      if (sprint) {
        if (name) sprint.name = name;
        if (typeof goal === 'string') sprint.goal = goal;
        this.saveLocalRoom(this.localState);
        this.emitLocal('sprint-info-updated', { sprintId, name: sprint.name, goal: sprint.goal });
        this.broadcast('sprint-info-updated', { sprintId, name: sprint.name, goal: sprint.goal });
      }
    }
  }

  updateActionItems(sprintId, actionItems) {
    if (this.mode === 'socket') {
      this.socket.emit('update-action-items', { sprintId, actionItems });
    } else {
      const sprint = this.localState.sprints.find(s => s.id === sprintId) || this.localState.sprints[0];
      sprint.actionItems = actionItems;
      this.saveLocalRoom(this.localState);
      this.emitLocal('action-items-updated', { sprintId: sprint.id, actionItems });
      this.broadcast('action-items-updated', { sprintId: sprint.id, actionItems });
    }
  }

  toggleBlur(blur) {
    if (this.mode === 'socket') {
      this.socket.emit('toggle-blur', { blur });
    } else {
      this.localState.settings.blurNotes = blur;
      this.saveLocalRoom(this.localState);
      this.emitLocal('blur-updated', { blurNotes: blur });
      this.broadcast('blur-updated', { blurNotes: blur });
    }
  }

  sendCursor(x, y) {
    if (this.mode === 'socket' && this.socket) {
      this.socket.emit('cursor-move', { x, y });
    } else if (this.p2pSend) {
      this.p2pSend({
        type: 'cursor-moved',
        data: {
          id: this.currentUser.id,
          name: this.currentUser.name,
          color: this.currentUser.color,
          x,
          y
        }
      });
    }
  }

  sendReaction(emoji, x, y) {
    const reaction = {
      id: 'react_' + Date.now(),
      emoji,
      x: x || Math.floor(Math.random() * 80 + 10),
      y: y || Math.floor(Math.random() * 60 + 20),
      userName: this.currentUser.name
    };
    if (this.mode === 'socket') {
      this.socket.emit('send-reaction', reaction);
    } else {
      this.emitLocal('reaction-received', reaction);
      this.broadcast('reaction-received', reaction);
    }
  }

  timerAction(action, duration) {
    if (this.mode === 'socket') {
      this.socket.emit('timer-action', { action, duration });
    } else {
      // Local timer emulation
      if (action === 'start') {
        this.localTimerStart();
      } else if (action === 'pause') {
        this.localTimerPause();
      } else if (action === 'reset') {
        this.localTimerReset(duration);
      }
    }
  }

  localTimerStart() {
    if (this.localTimerInterval) clearInterval(this.localTimerInterval);
    this.localState.timer.isRunning = true;
    this.localTimerInterval = setInterval(() => {
      if (this.localState.timer.remaining > 0) {
        this.localState.timer.remaining--;
        this.emitLocal('timer-tick', this.localState.timer);
        this.broadcast('timer-tick', this.localState.timer);
      } else {
        clearInterval(this.localTimerInterval);
        this.localState.timer.isRunning = false;
        this.emitLocal('timer-finished');
        this.broadcast('timer-finished');
      }
    }, 1000);
  }

  localTimerPause() {
    if (this.localTimerInterval) clearInterval(this.localTimerInterval);
    this.localState.timer.isRunning = false;
    this.emitLocal('timer-tick', this.localState.timer);
    this.broadcast('timer-tick', this.localState.timer);
  }

  localTimerReset(duration = 300) {
    if (this.localTimerInterval) clearInterval(this.localTimerInterval);
    this.localState.timer.duration = duration;
    this.localState.timer.remaining = duration;
    this.localState.timer.isRunning = false;
    this.emitLocal('timer-tick', this.localState.timer);
    this.broadcast('timer-tick', this.localState.timer);
  }
}

window.multiplayer = new MultiplayerClient();
