// Motor Lógico del Círculo de Ahorro / Tanda Mensual
// 100% Gratuito, Sin Servidores de Pago, Almacenamiento Local Seguro

const safeStorage = {
  _mem: {},
  getItem(key) {
    try {
      if (typeof window !== 'undefined' && 'localStorage' in window && window.localStorage) {
        return window.localStorage.getItem(key);
      }
    } catch (e) {}
    return this._mem[key] || null;
  },
  setItem(key, val) {
    try {
      if (typeof window !== 'undefined' && 'localStorage' in window && window.localStorage) {
        window.localStorage.setItem(key, val);
        return;
      }
    } catch (e) {}
    this._mem[key] = String(val);
  }
};

if (typeof window !== 'undefined') {
  window.safeStorage = safeStorage;
}

class AhorroManager {
  constructor() {
    this.storageKey = 'circulo_ahorro_data_v1';

    // Configuración por defecto
    this.config = {
      nombreGrupo: 'Mi Círculo de Ahorro',
      cuota: 100, // 100 € por persona = 1.000 € de bote total
      moneda: '€',
      activeRound: 1 // Mes/Ronda activa actual (1..10)
    };

    // 10 Participantes iniciales por defecto (editables con lápiz)
    this.participants = [
      { id: 1, name: 'Participante 1', turn: 1 },
      { id: 2, name: 'Participante 2', turn: 2 },
      { id: 3, name: 'Participante 3', turn: 3 },
      { id: 4, name: 'Participante 4', turn: 4 },
      { id: 5, name: 'Participante 5', turn: 5 },
      { id: 6, name: 'Participante 6', turn: 6 },
      { id: 7, name: 'Participante 7', turn: 7 },
      { id: 8, name: 'Participante 8', turn: 8 },
      { id: 9, name: 'Participante 9', turn: 9 },
      { id: 10, name: 'Participante 10', turn: 10 }
    ];

    // 10 Rondas (una por cada mes/turno)
    this.rounds = {};
    this.initDefaultRounds();

    this.load();
  }

  initDefaultRounds() {
    for (let r = 1; r <= 10; r++) {
      if (!this.rounds[r]) {
        this.rounds[r] = {
          round: r,
          payments: {}, // { [participantId]: boolean }
          delivered: false, // si ya se le entregó el dinero al beneficiario
          deliveredDate: null
        };
      }
    }
  }

  save() {
    try {
      const data = {
        config: this.config,
        participants: this.participants,
        rounds: this.rounds
      };
      safeStorage.setItem(this.storageKey, JSON.stringify(data));
    } catch (e) {
      console.warn('Error al guardar datos de ahorro', e);
    }
  }

  load() {
    try {
      const saved = safeStorage.getItem(this.storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.config) this.config = { ...this.config, ...parsed.config };
        if (parsed.participants && Array.isArray(parsed.participants)) {
          this.participants = parsed.participants;
        }
        if (parsed.rounds) {
          this.rounds = parsed.rounds;
        }
      }
    } catch (e) {
      console.warn('Error al cargar datos guardados', e);
    }
  }

  // --- GESTIÓN DE CONFIGURACIÓN Y PARTICIPANTES ---

  setCuota(amount) {
    const val = parseFloat(amount);
    if (!isNaN(val) && val > 0) {
      this.config.cuota = val;
      this.save();
      return true;
    }
    return false;
  }

  setNombreGrupo(name) {
    if (name && name.trim()) {
      this.config.nombreGrupo = name.trim();
      this.save();
    }
  }

  setActiveRound(roundNum) {
    const r = parseInt(roundNum, 10);
    if (r >= 1 && r <= this.participants.length) {
      this.config.activeRound = r;
      this.save();
    }
  }

  editParticipant(id, newName) {
    const trimmed = newName ? newName.trim() : '';
    if (!trimmed) return false;
    const p = this.participants.find(x => x.id === id);
    if (p) {
      p.name = trimmed;
      this.save();
      return true;
    }
    return false;
  }

  // Obtener participante asignado a un turno
  getParticipantByTurn(turnNumber) {
    return this.participants.find(p => p.turn === turnNumber) || null;
  }

  // Obtener lista ordenada por turnos (1..10)
  getParticipantsSortedByTurn() {
    return [...this.participants].sort((a, b) => a.turn - b.turn);
  }

  // --- ASIGNACIÓN DE TURNOS: MANUAL Y AL AZAR ---

  // Sorteo al azar (Algoritmo Fisher-Yates para sorteo justo y transparente)
  randomizeTurns() {
    const total = this.participants.length;
    // Generar array de turnos [1, 2, ..., total]
    const turns = Array.from({ length: total }, (_, i) => i + 1);

    // Barajar turnos
    for (let i = turns.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [turns[i], turns[j]] = [turns[j], turns[i]];
    }

    // Asignar los turnos mezclados
    this.participants.forEach((p, idx) => {
      p.turn = turns[idx];
    });

    this.save();
    return this.getParticipantsSortedByTurn();
  }

  // Intercambiar turno entre dos participantes
  swapTurns(participantIdA, participantIdB) {
    const pA = this.participants.find(p => p.id === participantIdA);
    const pB = this.participants.find(p => p.id === participantIdB);
    if (pA && pB) {
      const temp = pA.turn;
      pA.turn = pB.turn;
      pB.turn = temp;
      this.save();
      return true;
    }
    return false;
  }

  // Subir o bajar turno
  shiftTurn(participantId, direction) { // direction: -1 (subir) o +1 (bajar)
    const p = this.participants.find(x => x.id === participantId);
    if (!p) return false;

    const targetTurn = p.turn + direction;
    if (targetTurn < 1 || targetTurn > this.participants.length) return false;

    const other = this.participants.find(x => x.turn === targetTurn);
    if (other) {
      other.turn = p.turn;
      p.turn = targetTurn;
      this.save();
      return true;
    }
    return false;
  }

  // --- CONTROL DE PAGOS Y ENTREGA DEL BOTE ---

  isPaymentMade(roundNum, participantId) {
    const r = this.rounds[roundNum];
    if (!r || !r.payments) return false;
    return !!r.payments[participantId];
  }

  togglePayment(roundNum, participantId) {
    if (!this.rounds[roundNum]) {
      this.initDefaultRounds();
    }
    const r = this.rounds[roundNum];
    r.payments[participantId] = !r.payments[participantId];
    this.save();
    return r.payments[participantId];
  }

  markAllPayments(roundNum, paid = true) {
    if (!this.rounds[roundNum]) {
      this.initDefaultRounds();
    }
    const r = this.rounds[roundNum];
    this.participants.forEach(p => {
      r.payments[p.id] = paid;
    });
    this.save();
  }

  toggleDelivered(roundNum) {
    if (!this.rounds[roundNum]) {
      this.initDefaultRounds();
    }
    const r = this.rounds[roundNum];
    r.delivered = !r.delivered;
    if (r.delivered) {
      const now = new Date();
      r.deliveredDate = now.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });
    } else {
      r.deliveredDate = null;
    }
    this.save();
    return r.delivered;
  }

  // --- CONSULTAS Y ESTADÍSTICAS DEL MES / RONDA ---

  getRoundDetails(roundNum) {
    const rNum = parseInt(roundNum, 10);
    const roundData = this.rounds[rNum] || { round: rNum, payments: {}, delivered: false, deliveredDate: null };
    const beneficiary = this.getParticipantByTurn(rNum);
    const nextBeneficiary = this.getParticipantByTurn(rNum + 1);

    const totalParticipants = this.participants.length;
    const cuota = this.config.cuota;
    const totalPot = cuota * totalParticipants;

    let paidCount = 0;
    const paidList = [];
    const pendingList = [];

    this.participants.forEach(p => {
      const isPaid = !!roundData.payments[p.id];
      if (isPaid) {
        paidCount++;
        paidList.push(p);
      } else {
        pendingList.push(p);
      }
    });

    const collectedAmount = paidCount * cuota;
    const percentage = totalParticipants > 0 ? Math.round((paidCount / totalParticipants) * 100) : 0;
    const isCompleted = paidCount === totalParticipants && roundData.delivered;

    return {
      round: rNum,
      beneficiary: beneficiary ? beneficiary : { id: 0, name: `Turno ${rNum}`, turn: rNum },
      nextBeneficiary: nextBeneficiary || null,
      cuota,
      totalPot,
      collectedAmount,
      paidCount,
      totalParticipants,
      percentage,
      delivered: !!roundData.delivered,
      deliveredDate: roundData.deliveredDate,
      paidList,
      pendingList,
      isCompleted
    };
  }

  // Resumen global de todo el ciclo de 10 meses
  getGlobalOverview() {
    const list = [];
    const total = this.participants.length;

    for (let r = 1; r <= total; r++) {
      const details = this.getRoundDetails(r);
      list.push(details);
    }

    const alreadyGiven = list.filter(item => item.delivered);
    const currentRound = this.config.activeRound;
    const upcomingWaiting = list.filter(item => item.round > currentRound && !item.delivered);

    return {
      allRounds: list,
      alreadyGiven,
      currentRound,
      upcomingWaiting,
      totalRounds: total,
      completedRoundsCount: alreadyGiven.length
    };
  }

  // Historial de pagos de un participante a lo largo de los 10 meses
  getParticipantHistory(participantId) {
    const total = this.participants.length;
    let paidCount = 0;
    const paidMonths = [];

    for (let r = 1; r <= total; r++) {
      if (this.isPaymentMade(r, participantId)) {
        paidCount++;
        paidMonths.push(r);
      }
    }

    return {
      paidCount,
      totalMonths: total,
      paidMonths,
      totalContributed: paidCount * this.config.cuota
    };
  }

  // Matriz completa de pagos mes a mes (todas las personas x todos los meses)
  getGlobalPaymentMatrix() {
    const total = this.participants.length;
    return this.getParticipantsSortedByTurn().map(p => {
      const history = this.getParticipantHistory(p.id);
      const months = [];
      for (let r = 1; r <= total; r++) {
        months.push({
          round: r,
          paid: this.isPaymentMade(r, p.id),
          isBeneficiary: p.turn === r
        });
      }
      return {
        participant: p,
        months,
        paidCount: history.paidCount,
        totalMonths: total,
        totalContributed: history.totalContributed
      };
    });
  }

  // --- GENERADOR DE INFORME PARA WHATSAPP (1 TOQUE) ---

  getWhatsAppMessage(roundNum) {
    const details = this.getRoundDetails(roundNum);
    const overview = this.getGlobalOverview();
    const moneda = this.config.moneda;

    let msg = `💰 *${this.config.nombreGrupo.toUpperCase()} - MES ${details.round}*\n\n`;

    // 1. Quién cobra este mes
    msg += `🎯 *LE TOCA COBRAR:* ${details.beneficiary.name}\n`;
    msg += `💵 *Bote Total:* ${details.totalPot.toLocaleString('es-ES')} ${moneda} (${details.totalParticipants} x ${details.cuota} ${moneda})\n`;
    msg += `📦 *Estado de entrega:* ${details.delivered ? `✅ BOTE ENTREGADO (${details.deliveredDate})` : '⏳ Pendiente de entregar'}\n\n`;

    // 2. Progreso de cobro
    msg += `📊 *RECAUDACIÓN:* ${details.collectedAmount.toLocaleString('es-ES')} ${moneda} de ${details.totalPot.toLocaleString('es-ES')} ${moneda} (${details.paidCount}/${details.totalParticipants})\n\n`;

    // 3. Quiénes ya pagaron
    msg += `✅ *Ya pagaron (${details.paidList.length}):*\n`;
    if (details.paidList.length === 0) {
      msg += `  _(Ninguno todavía)_\n`;
    } else {
      details.paidList.forEach(p => {
        msg += `  • ${p.name}\n`;
      });
    }

    // 4. Quiénes faltan por pagar
    msg += `\n⏳ *Faltan por pagar (${details.pendingList.length}):*\n`;
    if (details.pendingList.length === 0) {
      msg += `  🎉 _¡Todos han pagado su cuota!_\n`;
    } else {
      details.pendingList.forEach(p => {
        msg += `  • ${p.name} (debe ${details.cuota} ${moneda})\n`;
      });
    }

    // 5. Quién sigue el mes siguiente
    if (details.nextBeneficiary) {
      msg += `\n⏩ *SIGUIENTE EN COBRAR (Mes ${details.round + 1}):* ${details.nextBeneficiary.name}\n`;
    }

    // 6. Resumen de quiénes ya han cobrado en rondas anteriores
    const pastDelivered = overview.alreadyGiven.filter(item => item.round !== details.round);
    if (pastDelivered.length > 0) {
      msg += `\n🏆 *Ya recibieron su bote anteriormente:*\n`;
      pastDelivered.forEach(item => {
        msg += `  ✔ Mes ${item.round}: ${item.beneficiary.name}\n`;
      });
    }

    return msg;
  }
}

if (typeof window !== 'undefined') {
  window.ahorroManager = new AhorroManager();
}
