/**
 * SailBoat Retro - Facilitator Toolkit
 * Temporizador sincronizado, Guía paso a paso, Modo Incógnito (Desenfoque) y Celebraciones.
 */

class FacilitatorToolkit {
  constructor() {
    this.timer = {
      duration: 300,
      remaining: 300,
      isRunning: false
    };
    this.isBlurred = false;
    this.initEvents();
  }

  initEvents() {
    // 1. Drawer Guía del Facilitador
    const btnOpenGuide = document.getElementById('btnOpenGuide');
    const guideDrawer = document.getElementById('facilitatorDrawer');
    const btnCloseGuide = document.getElementById('btnCloseGuide');

    btnOpenGuide?.addEventListener('click', () => {
      guideDrawer.classList.toggle('hidden');
    });

    btnCloseGuide?.addEventListener('click', () => {
      guideDrawer.classList.add('hidden');
    });

    // Accesos directos a temporizador dentro de la guía
    document.querySelectorAll('.btn-timer-shortcut').forEach(btn => {
      btn.addEventListener('click', () => {
        const mins = parseInt(btn.dataset.minutes, 10) || 5;
        this.setTimerMinutes(mins);
        window.sounds.playPop();
      });
    });

    // Botones de acción dentro de la guía
    document.getElementById('btnGuideToggleBlur')?.addEventListener('click', () => {
      this.toggleBlur();
    });

    document.getElementById('btnGuideOpenActions')?.addEventListener('click', () => {
      guideDrawer.classList.add('hidden');
      document.getElementById('actionItemsDrawer')?.classList.remove('hidden');
    });

    // 2. Controles del Temporizador en Header
    const btnToggle = document.getElementById('btnTimerToggle');
    const btnReset = document.getElementById('btnTimerReset');

    btnToggle?.addEventListener('click', () => {
      if (this.timer.isRunning) {
        window.multiplayer.timerAction('pause');
      } else {
        window.multiplayer.timerAction('start');
      }
    });

    btnReset?.addEventListener('click', () => {
      window.multiplayer.timerAction('reset', this.timer.duration);
    });

    // Presets 3m, 5m, 10m
    document.querySelectorAll('.timer-preset-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.timer-preset-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const mins = parseInt(btn.dataset.min, 10) || 5;
        this.setTimerMinutes(mins);
      });
    });

    // 3. Botón de Modo Incógnito / Desenfoque en Header
    const btnBlur = document.getElementById('btnToggleBlur');
    btnBlur?.addEventListener('click', () => this.toggleBlur());

    // 4. Reacciones flotantes rápidas
    document.querySelectorAll('.btn-reaction').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const emoji = btn.dataset.emoji;
        window.sounds.playPop();
        window.multiplayer.sendReaction(emoji);
        if (emoji === '🎉') {
          this.triggerConfetti();
        }
      });
    });

    // 5. Botón Sonido On/Off
    const btnSound = document.getElementById('btnToggleSound');
    btnSound?.addEventListener('click', () => {
      const enabled = window.sounds.toggle();
      const icon = document.getElementById('soundIcon');
      if (icon) icon.textContent = enabled ? '🔊' : '🔇';
    });
  }

  setTimerMinutes(mins) {
    const duration = mins * 60;
    this.timer.duration = duration;
    this.timer.remaining = duration;
    window.multiplayer.timerAction('reset', duration);
  }

  updateTimer(timerState) {
    this.timer = timerState;
    const clock = document.getElementById('timerClock');
    const btnToggle = document.getElementById('btnTimerToggle');

    if (!clock) return;

    const mins = Math.floor(this.timer.remaining / 60);
    const secs = this.timer.remaining % 60;
    clock.textContent = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;

    if (this.timer.isRunning) {
      clock.style.color = '#38bdf8';
      if (btnToggle) btnToggle.textContent = '⏸️';
    } else {
      if (btnToggle) btnToggle.textContent = '▶️';
    }

    if (this.timer.remaining <= 30 && this.timer.isRunning) {
      clock.style.color = '#ef4444'; // Alerta últimos 30 segundos
    }
  }

  onTimerFinished() {
    const clock = document.getElementById('timerClock');
    if (clock) {
      clock.textContent = '00:00';
      clock.style.color = '#ef4444';
    }
    const btnToggle = document.getElementById('btnTimerToggle');
    if (btnToggle) btnToggle.textContent = '▶️';

    window.sounds.playTimerDing();
    this.triggerConfetti();
    alert('⏱️ ¡Tiempo cumplido!');
  }

  // Alternar desenfoque de notas para evitar sesgos
  toggleBlur() {
    this.isBlurred = !this.isBlurred;
    window.multiplayer.toggleBlur(this.isBlurred);
  }

  applyBlur(blurState) {
    this.isBlurred = blurState;
    const boardScreen = document.getElementById('boardScreen');
    const btnBlur = document.getElementById('btnToggleBlur');
    const blurIcon = document.getElementById('blurIcon');
    const blurLabel = document.getElementById('blurLabel');
    const guideBtnBlur = document.getElementById('btnGuideToggleBlur');

    if (this.isBlurred) {
      boardScreen.classList.add('notes-blurred');
      btnBlur.classList.add('active');
      if (blurIcon) blurIcon.textContent = '🙈';
      if (blurLabel) blurLabel.textContent = 'Revelar notas';
      if (guideBtnBlur) guideBtnBlur.textContent = '✨ Revelar Todas las Notas';
    } else {
      boardScreen.classList.remove('notes-blurred');
      btnBlur.classList.remove('active');
      if (blurIcon) blurIcon.textContent = '👁️';
      if (blurLabel) blurLabel.textContent = 'Ocultar notas';
      if (guideBtnBlur) guideBtnBlur.textContent = '👁️ Activar Modo Ocultar Notas';
    }
  }

  // Disparo de confeti festivo
  triggerConfetti() {
    if (typeof confetti === 'function') {
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.7 }
      });
      window.sounds.playCelebration();
    }
  }
}

window.facilitator = new FacilitatorToolkit();
