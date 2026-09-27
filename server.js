const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'boards.json');

// Ensure data folder and file exist
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

let boards = {};
if (fs.existsSync(DATA_FILE)) {
  try {
    const raw = fs.readFileSync(DATA_FILE, 'utf8');
    boards = JSON.parse(raw);
  } catch (err) {
    console.error('Error al leer boards.json, iniciando con base limpia:', err);
    boards = {};
  }
}

function saveBoards() {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(boards, null, 2), 'utf8');
  } catch (err) {
    console.error('Error al guardar boards.json:', err);
  }
}

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Helpers
function getOrCreateRoom(roomCode, passcode = '', sprintName = 'Sprint 1', facilitatorName = 'Facilitador') {
  const code = roomCode.trim().toUpperCase();
  if (!boards[code]) {
    const initialSprintId = 'sprint_' + Date.now();
    boards[code] = {
      code,
      passcode: passcode ? String(passcode).trim() : '',
      createdAt: new Date().toISOString(),
      facilitator: facilitatorName,
      activeSprintId: initialSprintId,
      settings: {
        blurNotes: false,
        votingEnabled: true,
        maxVotesPerUser: 5
      },
      timer: {
        duration: 300,
        remaining: 300,
        isRunning: false,
        endsAt: null
      },
      sprints: [
        {
          id: initialSprintId,
          name: sprintName || 'Sprint 1',
          goal: '¡Completar los objetivos del sprint con calidad y trabajo en equipo!',
          createdAt: new Date().toISOString(),
          archived: false,
          notes: [
            {
              id: 'note_demo_wind',
              zone: 'wind',
              text: '🚀 Gran comunicación diaria y apoyo constante entre front y back',
              color: 'green',
              author: 'Ejemplo Ágil',
              x: 18,
              y: 22,
              votes: ['Luigi', 'Equipo'],
              createdAt: new Date().toISOString()
            },
            {
              id: 'note_demo_sun',
              zone: 'sun',
              text: '☀️ ¡Felicitaciones a todos por el nuevo release a producción sin caídas!',
              color: 'yellow',
              author: 'Scrum Master',
              x: 65,
              y: 20,
              votes: ['Todos'],
              createdAt: new Date().toISOString()
            },
            {
              id: 'note_demo_anchor',
              zone: 'anchor',
              text: '⚓ Demoras esperando aprobaciones de accesos al entorno de QA',
              color: 'blue',
              author: 'DevOps',
              x: 18,
              y: 68,
              votes: ['DevOps', 'Dev 1'],
              createdAt: new Date().toISOString()
            },
            {
              id: 'note_demo_reef',
              zone: 'reef',
              text: '🪨 Dependencia con API externa de pagos que cambia en 2 semanas',
              color: 'orange',
              author: 'Tech Lead',
              x: 75,
              y: 72,
              votes: ['Tech Lead'],
              createdAt: new Date().toISOString()
            }
          ],
          actionItems: [
            {
              id: 'act_1',
              text: 'Automatizar credenciales del entorno QA en pipeline CI/CD',
              owner: 'DevOps',
              status: 'pending',
              createdAt: new Date().toISOString()
            },
            {
              id: 'act_2',
              text: 'Agendar reunión técnica con el equipo de la API de pagos para mitigar riesgos',
              owner: 'Tech Lead',
              status: 'pending',
              createdAt: new Date().toISOString()
            }
          ]
        }
      ]
    };
    saveBoards();
  }
  return boards[code];
}

// REST Endpoints
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', serverTime: new Date().toISOString(), activeRooms: Object.keys(boards).length });
});

app.post('/api/rooms', (req, res) => {
  const { roomCode, passcode, sprintName, facilitatorName } = req.body;
  if (!roomCode) {
    return res.status(400).json({ error: 'El código de sala es requerido' });
  }
  const room = getOrCreateRoom(roomCode, passcode, sprintName, facilitatorName);
  res.json({ success: true, room: sanitizeRoomForClient(room) });
});

app.get('/api/rooms/:roomCode', (req, res) => {
  const code = req.params.roomCode.trim().toUpperCase();
  const room = boards[code];
  if (!room) {
    return res.status(404).json({ error: 'Sala no encontrada' });
  }
  res.json({ success: true, room: sanitizeRoomForClient(room), hasPasscode: !!room.passcode });
});

app.get('/api/rooms/:roomCode/export', (req, res) => {
  const code = req.params.roomCode.trim().toUpperCase();
  const room = boards[code];
  if (!room) {
    return res.status(404).json({ error: 'Sala no encontrada' });
  }
  res.setHeader('Content-Disposition', `attachment; filename=SailBoat_Retro_${code}.json`);
  res.setHeader('Content-Type', 'application/json');
  res.send(JSON.stringify(room, null, 2));
});

app.post('/api/rooms/:roomCode/import', (req, res) => {
  const code = req.params.roomCode.trim().toUpperCase();
  try {
    const importedData = req.body;
    if (!importedData || !importedData.sprints) {
      return res.status(400).json({ error: 'Estructura de respaldo no válida' });
    }
    importedData.code = code;
    boards[code] = importedData;
    saveBoards();
    io.to(code).emit('room-state', sanitizeRoomForClient(boards[code]));
    res.json({ success: true, message: 'Tablero restaurado correctamente' });
  } catch (err) {
    res.status(500).json({ error: 'Error al importar datos' });
  }
});

function sanitizeRoomForClient(room) {
  const copy = JSON.parse(JSON.stringify(room));
  copy.hasPasscode = !!copy.passcode;
  delete copy.passcode; // Nunca enviar la contraseña plana al cliente
  return copy;
}

// Track active participants per room
const roomUsers = new Map(); // roomCode -> Map of socketId -> { name, color, isFacilitator }

// Realtime Timer Intervals
const roomTimers = new Map();

function startServerTimer(roomCode) {
  const room = boards[roomCode];
  if (!room || !room.timer) return;

  if (roomTimers.has(roomCode)) {
    clearInterval(roomTimers.get(roomCode));
  }

  room.timer.isRunning = true;
  room.timer.endsAt = Date.now() + (room.timer.remaining * 1000);

  const interval = setInterval(() => {
    const currentRoom = boards[roomCode];
    if (!currentRoom || !currentRoom.timer.isRunning) {
      clearInterval(interval);
      roomTimers.delete(roomCode);
      return;
    }

    currentRoom.timer.remaining = Math.max(0, Math.round((currentRoom.timer.endsAt - Date.now()) / 1000));
    io.to(roomCode).emit('timer-tick', currentRoom.timer);

    if (currentRoom.timer.remaining <= 0) {
      currentRoom.timer.isRunning = false;
      clearInterval(interval);
      roomTimers.delete(roomCode);
      io.to(roomCode).emit('timer-finished');
      saveBoards();
    }
  }, 1000);

  roomTimers.set(roomCode, interval);
  saveBoards();
}

function pauseServerTimer(roomCode) {
  const room = boards[roomCode];
  if (!room || !room.timer) return;

  if (roomTimers.has(roomCode)) {
    clearInterval(roomTimers.get(roomCode));
    roomTimers.delete(roomCode);
  }

  room.timer.isRunning = false;
  io.to(roomCode).emit('timer-tick', room.timer);
  saveBoards();
}

function resetServerTimer(roomCode, duration = 300) {
  const room = boards[roomCode];
  if (!room || !room.timer) return;

  if (roomTimers.has(roomCode)) {
    clearInterval(roomTimers.get(roomCode));
    roomTimers.delete(roomCode);
  }

  room.timer.duration = duration;
  room.timer.remaining = duration;
  room.timer.isRunning = false;
  room.timer.endsAt = null;

  io.to(roomCode).emit('timer-tick', room.timer);
  saveBoards();
}

// Socket.io Realtime Logic
io.on('connection', (socket) => {
  let currentRoomCode = null;
  let currentUser = null;

  socket.on('join-room', ({ roomCode, passcode, userName, userColor, isFacilitator, sprintName }) => {
    if (!roomCode) {
      return socket.emit('join-error', 'Código de sala no proporcionado.');
    }
    const code = roomCode.trim().toUpperCase();
    const room = getOrCreateRoom(code, passcode, sprintName, userName);

    if (room.passcode && room.passcode !== String(passcode || '').trim()) {
      return socket.emit('join-error', 'PIN o contraseña de acceso incorrecta.');
    }

    currentRoomCode = code;
    currentUser = {
      id: socket.id,
      name: userName || 'Marinero Anónimo',
      color: userColor || '#38bdf8',
      isFacilitator: !!isFacilitator
    };

    socket.join(code);

    if (!roomUsers.has(code)) {
      roomUsers.set(code, new Map());
    }
    roomUsers.get(code).set(socket.id, currentUser);

    // Send full current room state to new user
    socket.emit('room-state', sanitizeRoomForClient(room));

    // Broadcast user presence list
    const usersInRoom = Array.from(roomUsers.get(code).values());
    io.to(code).emit('presence-update', usersInRoom);

    // Notify team
    socket.to(code).emit('user-joined', currentUser);
  });

  // Note CRUD
  socket.on('create-note', ({ sprintId, note }) => {
    if (!currentRoomCode) return;
    const room = boards[currentRoomCode];
    if (!room) return;

    const sprint = room.sprints.find(s => s.id === sprintId) || room.sprints.find(s => s.id === room.activeSprintId);
    if (!sprint) return;

    const newNote = {
      id: note.id || 'note_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
      zone: note.zone || 'wind',
      text: note.text || '',
      color: note.color || 'yellow',
      author: currentUser ? currentUser.name : (note.author || 'Anónimo'),
      authorColor: currentUser ? currentUser.color : '#38bdf8',
      x: typeof note.x === 'number' ? note.x : 50,
      y: typeof note.y === 'number' ? note.y : 50,
      votes: [],
      createdAt: new Date().toISOString()
    };

    sprint.notes.push(newNote);
    saveBoards();
    io.to(currentRoomCode).emit('note-created', { sprintId: sprint.id, note: newNote });
  });

  socket.on('update-note', ({ sprintId, noteId, updates }) => {
    if (!currentRoomCode) return;
    const room = boards[currentRoomCode];
    if (!room) return;

    const sprint = room.sprints.find(s => s.id === sprintId) || room.sprints.find(s => s.id === room.activeSprintId);
    if (!sprint) return;

    const note = sprint.notes.find(n => n.id === noteId);
    if (!note) return;

    Object.assign(note, updates);
    saveBoards();
    io.to(currentRoomCode).emit('note-updated', { sprintId: sprint.id, noteId, updates });
  });

  socket.on('move-note', ({ sprintId, noteId, x, y, zone }) => {
    if (!currentRoomCode) return;
    const room = boards[currentRoomCode];
    if (!room) return;

    const sprint = room.sprints.find(s => s.id === sprintId) || room.sprints.find(s => s.id === room.activeSprintId);
    if (!sprint) return;

    const note = sprint.notes.find(n => n.id === noteId);
    if (!note) return;

    note.x = x;
    note.y = y;
    if (zone) note.zone = zone;

    saveBoards();
    socket.to(currentRoomCode).emit('note-moved', { sprintId: sprint.id, noteId, x, y, zone });
  });

  socket.on('delete-note', ({ sprintId, noteId }) => {
    if (!currentRoomCode) return;
    const room = boards[currentRoomCode];
    if (!room) return;

    const sprint = room.sprints.find(s => s.id === sprintId) || room.sprints.find(s => s.id === room.activeSprintId);
    if (!sprint) return;

    sprint.notes = sprint.notes.filter(n => n.id !== noteId);
    saveBoards();
    io.to(currentRoomCode).emit('note-deleted', { sprintId: sprint.id, noteId });
  });

  socket.on('vote-note', ({ sprintId, noteId }) => {
    if (!currentRoomCode || !currentUser) return;
    const room = boards[currentRoomCode];
    if (!room) return;

    const sprint = room.sprints.find(s => s.id === sprintId) || room.sprints.find(s => s.id === room.activeSprintId);
    if (!sprint) return;

    const note = sprint.notes.find(n => n.id === noteId);
    if (!note) return;

    if (!Array.isArray(note.votes)) note.votes = [];

    const voterId = currentUser.name;
    const idx = note.votes.indexOf(voterId);

    if (idx > -1) {
      note.votes.splice(idx, 1); // Quitar voto
    } else {
      note.votes.push(voterId); // Agregar voto
    }

    saveBoards();
    io.to(currentRoomCode).emit('note-voted', { sprintId: sprint.id, noteId, votes: note.votes });
  });

  // Sprint Management
  socket.on('create-sprint', ({ name, goal, carryPendingActions }) => {
    if (!currentRoomCode) return;
    const room = boards[currentRoomCode];
    if (!room) return;

    const newSprintId = 'sprint_' + Date.now();
    let carriedActions = [];

    if (carryPendingActions) {
      const activeSprint = room.sprints.find(s => s.id === room.activeSprintId);
      if (activeSprint && activeSprint.actionItems) {
        carriedActions = activeSprint.actionItems
          .filter(a => a.status === 'pending')
          .map(a => ({ ...a, id: 'act_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4) }));
      }
    }

    const newSprint = {
      id: newSprintId,
      name: name || `Sprint ${room.sprints.length + 1}`,
      goal: goal || '¡Continuar mejorando y acelerando hacia la meta!',
      createdAt: new Date().toISOString(),
      archived: false,
      notes: [],
      actionItems: carriedActions
    };

    room.sprints.push(newSprint);
    room.activeSprintId = newSprintId;
    saveBoards();

    io.to(currentRoomCode).emit('sprint-created', { sprint: newSprint, activeSprintId: newSprintId });
  });

  socket.on('switch-sprint', ({ sprintId }) => {
    if (!currentRoomCode) return;
    const room = boards[currentRoomCode];
    if (!room) return;

    const sprint = room.sprints.find(s => s.id === sprintId);
    if (!sprint) return;

    room.activeSprintId = sprintId;
    saveBoards();
    io.to(currentRoomCode).emit('sprint-switched', { activeSprintId: sprintId });
  });

  socket.on('update-sprint-info', ({ sprintId, name, goal }) => {
    if (!currentRoomCode) return;
    const room = boards[currentRoomCode];
    if (!room) return;

    const sprint = room.sprints.find(s => s.id === sprintId);
    if (!sprint) return;

    if (name) sprint.name = name;
    if (typeof goal === 'string') sprint.goal = goal;

    saveBoards();
    io.to(currentRoomCode).emit('sprint-info-updated', { sprintId, name: sprint.name, goal: sprint.goal });
  });

  socket.on('archive-sprint', ({ sprintId }) => {
    if (!currentRoomCode) return;
    const room = boards[currentRoomCode];
    if (!room) return;

    const sprint = room.sprints.find(s => s.id === sprintId);
    if (!sprint) return;

    sprint.archived = !sprint.archived;
    saveBoards();
    io.to(currentRoomCode).emit('sprint-archived', { sprintId, archived: sprint.archived });
  });

  // Action Items
  socket.on('update-action-items', ({ sprintId, actionItems }) => {
    if (!currentRoomCode) return;
    const room = boards[currentRoomCode];
    if (!room) return;

    const sprint = room.sprints.find(s => s.id === sprintId) || room.sprints.find(s => s.id === room.activeSprintId);
    if (!sprint) return;

    sprint.actionItems = actionItems;
    saveBoards();
    io.to(currentRoomCode).emit('action-items-updated', { sprintId: sprint.id, actionItems });
  });

  // Facilitator Controls
  socket.on('toggle-blur', ({ blur }) => {
    if (!currentRoomCode) return;
    const room = boards[currentRoomCode];
    if (!room) return;

    room.settings.blurNotes = !!blur;
    saveBoards();
    io.to(currentRoomCode).emit('blur-updated', { blurNotes: room.settings.blurNotes });
  });

  // Timer Controls
  socket.on('timer-action', ({ action, duration }) => {
    if (!currentRoomCode) return;
    if (action === 'start') {
      startServerTimer(currentRoomCode);
    } else if (action === 'pause') {
      pauseServerTimer(currentRoomCode);
    } else if (action === 'reset') {
      resetServerTimer(currentRoomCode, duration || 300);
    }
  });

  // Multiplayer Interactions
  socket.on('cursor-move', ({ x, y }) => {
    if (!currentRoomCode || !currentUser) return;
    socket.to(currentRoomCode).emit('cursor-moved', {
      id: socket.id,
      name: currentUser.name,
      color: currentUser.color,
      x,
      y
    });
  });

  socket.on('send-reaction', ({ emoji, x, y }) => {
    if (!currentRoomCode || !currentUser) return;
    io.to(currentRoomCode).emit('reaction-received', {
      id: 'reaction_' + Date.now(),
      emoji,
      x: x || 50,
      y: y || 50,
      userName: currentUser.name
    });
  });

  // Disconnect
  socket.on('disconnect', () => {
    if (currentRoomCode && roomUsers.has(currentRoomCode)) {
      const users = roomUsers.get(currentRoomCode);
      users.delete(socket.id);
      io.to(currentRoomCode).emit('presence-update', Array.from(users.values()));
      io.to(currentRoomCode).emit('cursor-removed', { id: socket.id });
      if (users.size === 0) {
        roomUsers.delete(currentRoomCode);
      }
    }
  });
});

// Fallback to index.html for SPA routes
app.use((req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

server.listen(PORT, () => {
  console.log(`⛵ Servidor SailBoat Retro listo y navegando en http://localhost:${PORT}`);
});
