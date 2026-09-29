// Controlador Principal de la App: Círculo de Ahorro y Tanda Mensual

class SoundFX {
  constructor() {
    this.ctx = null;
  }
  init() {
    if (!this.ctx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) this.ctx = new AudioContext();
    }
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  }
  playBeep(freq = 600, duration = 0.08, type = 'sine') {
    try {
      this.init();
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
      gain.gain.setValueAtTime(0.15, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + duration);
    } catch (e) {}
  }
  clickPay() {
    this.playBeep(650, 0.08, 'triangle');
    if (navigator.vibrate) navigator.vibrate(25);
  }
  clickUnpay() {
    this.playBeep(380, 0.08, 'sine');
    if (navigator.vibrate) navigator.vibrate(15);
  }
  clickDeliver() {
    // Sonido festivo de entrega
    this.playBeep(523.25, 0.1);
    setTimeout(() => this.playBeep(659.25, 0.1), 100);
    setTimeout(() => this.playBeep(783.99, 0.2), 200);
    if (navigator.vibrate) navigator.vibrate([40, 60, 80]);
  }
  tickRaffle() {
    this.playBeep(880, 0.04, 'square');
  }
}

const sounds = new SoundFX();

// Estado de la interfaz
let currentTab = 'mes-actual';

document.addEventListener('DOMContentLoaded', () => {
  initTabs();
  initRoundControls();
  initRaffleControls();
  initSettingsControls();
  initPWA();

  // Render inicial
  renderCurrentRound();
  renderTurnsList();
  renderTimeline();
  renderSettings();
});

// --- PESTAÑAS DE NAVEGACIÓN ---
function initTabs() {
  document.querySelectorAll('.nav-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      const tabId = tab.getAttribute('data-tab');
      switchTab(tabId);
    });
  });
}

function switchTab(tabId) {
  currentTab = tabId;
  document.querySelectorAll('.nav-tab').forEach(t => {
    t.classList.toggle('active', t.getAttribute('data-tab') === tabId);
  });
  document.querySelectorAll('.tab-pane').forEach(p => {
    p.classList.toggle('active', p.id === `pane-${tabId}`);
  });

  const titles = {
    'mes-actual': window.ahorroManager.config.nombreGrupo || 'Círculo de Ahorro',
    'turnos': 'Turnos y Sorteo',
    'calendario': 'Calendario e Historial',
    'ajustes': 'Ajustes de la Tanda'
  };
  document.getElementById('brand-title').textContent = titles[tabId] || 'Círculo de Ahorro';

  if (tabId === 'mes-actual') renderCurrentRound();
  if (tabId === 'turnos') renderTurnsList();
  if (tabId === 'calendario') renderTimeline();
  if (tabId === 'ajustes') renderSettings();
}

// --- CONTROLES DE NAVEGACIÓN DE MES / RONDA ---
function initRoundControls() {
  const manager = window.ahorroManager;

  document.getElementById('btn-prev-round').addEventListener('click', () => {
    let r = manager.config.activeRound - 1;
    if (r < 1) r = manager.participants.length;
    manager.setActiveRound(r);
    renderCurrentRound();
  });

  document.getElementById('btn-next-round').addEventListener('click', () => {
    let r = manager.config.activeRound + 1;
    if (r > manager.participants.length) r = 1;
    manager.setActiveRound(r);
    renderCurrentRound();
  });

  // Botón entregar bote
  document.getElementById('btn-deliver-pot').addEventListener('click', () => {
    const r = manager.config.activeRound;
    const isDelivered = manager.toggleDelivered(r);
    if (isDelivered) {
      sounds.clickDeliver();
      showToast('🎉 ¡Bote marcado como ENTREGADO con éxito!');
    } else {
      sounds.clickUnpay();
      showToast('Bote marcado como pendiente de entrega.');
    }
    renderCurrentRound();
    renderTimeline();
  });

  // Marcar todos / desmarcar todos
  document.getElementById('btn-check-all-payments').addEventListener('click', () => {
    const r = manager.config.activeRound;
    manager.markAllPayments(r, true);
    sounds.clickPay();
    renderCurrentRound();
    showToast('Todos los participantes marcados como pagados.');
  });

  document.getElementById('btn-uncheck-all-payments').addEventListener('click', () => {
    const r = manager.config.activeRound;
    manager.markAllPayments(r, false);
    sounds.clickUnpay();
    renderCurrentRound();
    showToast('Pagos desmarcados.');
  });

  // Botón Compartir en WhatsApp
  document.getElementById('btn-share-whatsapp').addEventListener('click', () => {
    const r = manager.config.activeRound;
    const text = manager.getWhatsAppMessage(r);

    if (navigator.share) {
      navigator.share({
        title: `${manager.config.nombreGrupo} - Mes ${r}`,
        text: text
      }).catch(() => copyToClipboard(text));
    } else {
      copyToClipboard(text);
    }
  });
}

function copyToClipboard(text) {
  navigator.clipboard.writeText(text).then(() => {
    showToast('¡Mensaje copiado! Ya puedes pegarlo en WhatsApp 📲');
  }).catch(() => {
    prompt('Copia este informe para enviarlo a WhatsApp:', text);
  });
}

function showToast(msg) {
  const toast = document.getElementById('toast-msg');
  toast.textContent = msg;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2800);
}

// --- RENDERIZADO: PESTAÑA MES ACTUAL ---
function renderCurrentRound() {
  const manager = window.ahorroManager;
  const currentRound = manager.config.activeRound;
  const details = manager.getRoundDetails(currentRound);
  const moneda = manager.config.moneda;

  // Cabecera del mes
  document.getElementById('round-nav-title').textContent = `Mes ${details.round} de ${details.totalParticipants}`;
  document.getElementById('round-nav-sub').textContent = details.delivered
    ? `✅ Bote entregado a ${details.beneficiary.name}`
    : `En curso: le toca a ${details.beneficiary.name}`;

  // Tarjeta Héroe: A quién le toca cobrar
  document.getElementById('hero-beneficiary-name').textContent = details.beneficiary.name;
  document.getElementById('hero-avatar').textContent = details.beneficiary.name.charAt(0).toUpperCase();
  document.getElementById('hero-pot-amount').textContent = `${details.totalPot.toLocaleString('es-ES')} ${moneda}`;

  // Botón estado de entrega
  const btnDeliver = document.getElementById('btn-deliver-pot');
  if (details.delivered) {
    btnDeliver.classList.add('delivered');
    btnDeliver.innerHTML = `<span>✅ Bote Entregado el ${details.deliveredDate || 'hoy'}</span>`;
  } else {
    btnDeliver.classList.remove('delivered');
    btnDeliver.innerHTML = `<span>💰 Marcar Bote como Entregado a ${details.beneficiary.name}</span>`;
  }

  // Tarjeta: Quién sigue
  const nextCard = document.getElementById('next-in-line-container');
  if (details.nextBeneficiary) {
    nextCard.style.display = 'flex';
    document.getElementById('next-beneficiary-name').textContent = `${details.nextBeneficiary.name} (Mes ${details.round + 1})`;
  } else {
    nextCard.style.display = 'flex';
    document.getElementById('next-beneficiary-name').textContent = '🎉 ¡Este es el último mes del ciclo!';
  }

  // Barra de progreso de recaudación
  document.getElementById('progress-collected-amount').textContent = `${details.collectedAmount.toLocaleString('es-ES')} ${moneda}`;
  document.getElementById('progress-total-pot').textContent = `${details.totalPot.toLocaleString('es-ES')} ${moneda}`;
  document.getElementById('progress-bar-fill').style.width = `${details.percentage}%`;
  document.getElementById('progress-footer-stats').textContent = `${details.paidCount} de ${details.totalParticipants} personas han pagado (${details.percentage}%)`;

  // Renderizar lista de pagos de las 10 personas
  const paymentsContainer = document.getElementById('payments-list-container');
  paymentsContainer.innerHTML = '';

  const sortedParticipants = manager.getParticipantsSortedByTurn();

  sortedParticipants.forEach(p => {
    const isPaid = manager.isPaymentMade(currentRound, p.id);
    const isBeneficiary = p.turn === currentRound;

    const card = document.createElement('div');
    card.className = `payment-card ${isPaid ? 'paid' : ''}`;
    card.innerHTML = `
      <div class="participant-info">
        <div class="participant-turn-pill">${p.turn}º</div>
        <div class="participant-name-wrap">
          <span class="participant-name">${p.name} ${isBeneficiary ? '🎯 (Cobra este mes)' : ''}</span>
          <span class="participant-sub">Cuota: ${details.cuota} ${moneda}</span>
        </div>
      </div>
      <div class="payment-status-pill">
        ${isPaid ? 'Pagado ✅' : 'Pendiente ⚪'}
      </div>
    `;

    card.addEventListener('click', () => {
      const nowPaid = manager.togglePayment(currentRound, p.id);
      if (nowPaid) sounds.clickPay();
      else sounds.clickUnpay();
      renderCurrentRound();
    });

    paymentsContainer.appendChild(card);
  });
}

// --- RENDERIZADO Y CONTROL: PESTAÑA TURNOS Y SORTEO ---
function initRaffleControls() {
  const manager = window.ahorroManager;

  document.getElementById('btn-start-raffle').addEventListener('click', () => {
    if (confirm('¿Quieres sortear los turnos del 1 al 10 al azar entre los participantes?')) {
      runRaffleAnimation();
    }
  });

  // Modal cerrar
  document.getElementById('btn-close-raffle-modal').addEventListener('click', () => {
    document.getElementById('modal-raffle').classList.remove('open');
  });
}

function runRaffleAnimation() {
  const manager = window.ahorroManager;
  const modal = document.getElementById('modal-raffle');
  const slot = document.getElementById('roulette-slot');
  const names = manager.participants.map(p => p.name);

  modal.classList.add('open');
  document.getElementById('btn-close-raffle-modal').style.display = 'none';

  let counter = 0;
  const totalTicks = 24;
  let speed = 60;

  function tick() {
    counter++;
    const randomName = names[Math.floor(Math.random() * names.length)];
    slot.textContent = `🎲 ${randomName}`;
    sounds.tickRaffle();

    if (counter < totalTicks) {
      speed += 10;
      setTimeout(tick, speed);
    } else {
      // Sorteo finalizado
      manager.randomizeTurns();
      sounds.clickDeliver();
      slot.textContent = '🎉 ¡Turnos Sorteados!';
      document.getElementById('btn-close-raffle-modal').style.display = 'block';
      renderTurnsList();
      renderCurrentRound();
      renderTimeline();
      showToast('¡Sorteo completado con éxito!');
    }
  }

  tick();
}

function renderTurnsList() {
  const manager = window.ahorroManager;
  const listContainer = document.getElementById('turns-list-container');
  listContainer.innerHTML = '';

  const sorted = manager.getParticipantsSortedByTurn();

  sorted.forEach(p => {
    const card = document.createElement('div');
    card.className = 'turn-item-card';
    card.innerHTML = `
      <div class="turn-left">
        <div class="turn-badge">${p.turn}º</div>
        <span class="turn-name">${p.name}</span>
      </div>
      <div class="turn-actions">
        <button type="button" class="btn-icon-sub edit" title="Editar nombre">✏️</button>
        <button type="button" class="btn-icon-sub up" title="Subir de puesto">⬆️</button>
        <button type="button" class="btn-icon-sub down" title="Bajar de puesto">⬇️</button>
        <button type="button" class="btn-icon-sub swap" title="Intercambiar turno">🔄</button>
      </div>
    `;

    // Editar nombre
    card.querySelector('.edit').addEventListener('click', () => {
      const nuevo = prompt(`Editar nombre de "${p.name}":`, p.name);
      if (nuevo && nuevo.trim() && nuevo.trim() !== p.name) {
        manager.editParticipant(p.id, nuevo);
        renderTurnsList();
        renderCurrentRound();
        renderTimeline();
        showToast('Nombre actualizado.');
      }
    });

    // Subir puesto (direction -1)
    card.querySelector('.up').addEventListener('click', () => {
      if (manager.shiftTurn(p.id, -1)) {
        renderTurnsList();
        renderCurrentRound();
        renderTimeline();
      }
    });

    // Bajar puesto (direction +1)
    card.querySelector('.down').addEventListener('click', () => {
      if (manager.shiftTurn(p.id, 1)) {
        renderTurnsList();
        renderCurrentRound();
        renderTimeline();
      }
    });

    // Intercambiar puesto con otro participante
    card.querySelector('.swap').addEventListener('click', () => {
      const otherNames = manager.participants.filter(x => x.id !== p.id);
      let promptText = `¿Con quién quieres intercambiar el turno ${p.turn} de "${p.name}"?\nEscribe el número de turno (1 a 10):`;
      const targetTurnStr = prompt(promptText);
      const targetTurn = parseInt(targetTurnStr, 10);
      if (targetTurn >= 1 && targetTurn <= manager.participants.length && targetTurn !== p.turn) {
        const targetP = manager.getParticipantByTurn(targetTurn);
        if (targetP) {
          manager.swapTurns(p.id, targetP.id);
          renderTurnsList();
          renderCurrentRound();
          renderTimeline();
          showToast(`¡Turno intercambiado con ${targetP.name}!`);
        }
      }
    });

    listContainer.appendChild(card);
  });
}

// --- RENDERIZADO: PESTAÑA CALENDARIO E HISTORIAL ---
function renderTimeline() {
  const manager = window.ahorroManager;
  const overview = manager.getGlobalOverview();
  const currentRound = manager.config.activeRound;
  const moneda = manager.config.moneda;

  // 1. Grupo: Ya entregados
  const deliveredContainer = document.getElementById('timeline-delivered-list');
  deliveredContainer.innerHTML = '';
  if (overview.alreadyGiven.length === 0) {
    deliveredContainer.innerHTML = '<div style="color: var(--text-dim); font-size: 0.8rem; padding: 6px;">Aún no se ha completado ninguna entrega.</div>';
  } else {
    overview.alreadyGiven.forEach(item => {
      const card = createTimelineCard(item, 'delivered', moneda);
      deliveredContainer.appendChild(card);
    });
  }

  // 2. Grupo: En curso este mes
  const currentContainer = document.getElementById('timeline-current-list');
  currentContainer.innerHTML = '';
  const currentDetails = manager.getRoundDetails(currentRound);
  const currentCard = createTimelineCard(currentDetails, 'current', moneda);
  currentContainer.appendChild(currentCard);

  // 3. Grupo: Próximos turnos en espera
  const waitingContainer = document.getElementById('timeline-waiting-list');
  waitingContainer.innerHTML = '';
  const waitingRounds = overview.allRounds.filter(item => item.round !== currentRound && !item.delivered);
  if (waitingRounds.length === 0) {
    waitingContainer.innerHTML = '<div style="color: var(--text-dim); font-size: 0.8rem; padding: 6px;">¡Todos los participantes han cobrado!</div>';
  } else {
    waitingRounds.forEach(item => {
      const card = createTimelineCard(item, 'waiting', moneda);
      waitingContainer.appendChild(card);
    });
  }
}

function createTimelineCard(item, statusType, moneda) {
  const card = document.createElement('div');
  card.className = `timeline-card ${statusType}`;
  card.style.cursor = 'pointer';

  let statusBadgeText = 'En espera ⏳';
  if (statusType === 'delivered') statusBadgeText = `Entregado ✅ (${item.deliveredDate || 'Listo'})`;
  if (statusType === 'current') statusBadgeText = item.delivered ? 'Bote Entregado ✅' : 'Cobrando este mes 🎯';

  card.innerHTML = `
    <div class="timeline-info">
      <span class="timeline-round">Mes ${item.round}</span>
      <span class="timeline-beneficiary">${item.beneficiary.name}</span>
      <span style="font-size: 0.72rem; color: var(--text-dim);">Bote: ${item.totalPot.toLocaleString('es-ES')} ${moneda}</span>
    </div>
    <div class="timeline-status ${statusType}">
      ${statusBadgeText}
    </div>
  `;

  // Al tocar la tarjeta, ir a ver ese mes
  card.addEventListener('click', () => {
    window.ahorroManager.setActiveRound(item.round);
    switchTab('mes-actual');
  });

  return card;
}

// --- RENDERIZADO Y CONTROL: PESTAÑA AJUSTES ---
function initSettingsControls() {
  const manager = window.ahorroManager;

  document.getElementById('settings-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const groupName = document.getElementById('settings-group-name').value.trim();
    const cuotaVal = parseFloat(document.getElementById('settings-cuota').value);

    if (groupName) manager.setNombreGrupo(groupName);
    if (!isNaN(cuotaVal) && cuotaVal > 0) manager.setCuota(cuotaVal);

    showToast('Ajustes guardados correctamente.');
    renderCurrentRound();
    renderTimeline();
    switchTab('mes-actual');
  });

  // Reiniciar ciclo
  document.getElementById('btn-reset-cycle').addEventListener('click', () => {
    if (confirm('¿Estás seguro de reiniciar todos los pagos y entregas para empezar un ciclo nuevo? Los nombres y turnos se mantendrán.')) {
      manager.initDefaultRounds();
      manager.setActiveRound(1);
      manager.save();
      showToast('¡Ciclo reiniciado para una nueva tanda!');
      renderCurrentRound();
      renderTimeline();
      switchTab('mes-actual');
    }
  });
}

function renderSettings() {
  const manager = window.ahorroManager;
  document.getElementById('settings-group-name').value = manager.config.nombreGrupo || '';
  document.getElementById('settings-cuota').value = manager.config.cuota || 100;
}

// --- PWA SERVICE WORKER ---
function initPWA() {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js')
        .then(reg => console.log('SW de Ahorro registrado', reg.scope))
        .catch(err => console.warn('SW no disponible en local', err));
    });
  }
}
