/* Motor de metrônomo — agenda, saída de áudio e clique, compartilhados pelo
   módulo de cifras e pelo de estudos.

   Antes existiam dois motores completos e independentes, e cada um sabia uma
   coisa que o outro não sabia: o das cifras escolhia a saída de áudio (mandar o
   clique para o in-ear sem vazar no PA) e remarcava a agenda sem reiniciar o
   compasso; o dos estudos tinha levadas, subdivisão e rampa de tempo. Quem
   estudava não conseguia mandar o clique para o fone; quem tocava não tinha
   levada. É a mesma história do graus.js: duas cópias que nasceram iguais e
   foram divergindo em silêncio.

   O que mora aqui é o que os dois precisam idêntico — o relógio e o caminho do
   som. O que é política de cada módulo (acentos, levadas, compassos mudos,
   desenho na tela) fica de fora, em quem chama.

   Três coisas não óbvias que este arquivo carrega:

   - O clique é marcado na linha do tempo do WebAudio com antecedência, não
     tocado por timer. Navegador estrangula timer de aba oculta; a agenda do
     áudio não. Com a janela escondida o pulso continua exato e só o desenho
     atrasa — por isso o dreno colapsa os atrasados em vez de disparar todos.

   - Remarcar não é reiniciar. Mudar andamento no meio cancela só o que ainda
     NÃO soou e emenda o próximo tempo um intervalo depois do último que soou.
     Reiniciar fazia o clique já entregue ao hardware tocar junto com o novo.

   - A saída padrão precisa ir direto ao AudioContext. Em alguns WebViews o
     setSinkId existe no elemento <audio> mas o play() é recusado; encaminhar o
     clique para lá mesmo assim deixava o metrônomo mudo. O elemento
     intermediário só entra quando há uma saída escolhida.                     */
(function (global) {
  'use strict';

  const SCHED_MS = 60;
  const LOOK_VISIVEL = 0.35;
  const LOOK_OCULTO = 1.5;

  /* WebKit às vezes nunca resolve setSinkId/play/getUserMedia (janela sem foco,
     dispositivo sumido). Sem prazo, o "ligar som" ficava esperando para sempre e
     o metrônomo nem começava. Estourou o prazo: segue pela saída padrão. */
  const PRAZO_MS = 1500;
  function comPrazo(promessa, ms) {
    let t;
    return Promise.race([
      Promise.resolve(promessa).finally(() => clearTimeout(t)),
      new Promise((_, rejeita) => { t = setTimeout(() => rejeita(new Error('prazo')), ms); })
    ]);
  }

  let ctx = null;
  let dest = null;      /* MediaStreamDestination, só com saída escolhida */
  let sinkEl = null;    /* <audio> que carrega essa stream até o dispositivo */
  let sinkVia = 'ctx';
  let sinkId = '';

  /* ---------- contexto e saída ---------- */

  function contexto() {
    try {
      const AC = global.AudioContext || global.webkitAudioContext;
      if (!AC) return null;
      if (!ctx) {
        try { ctx = new AC({ latencyHint: 'interactive' }); }
        catch (e) { ctx = new AC(); }
      }
      return ctx;
    } catch (e) { return null; }
  }

  /* iPhone: WebAudio fica mudo se o resume() não vier do mesmo toque.
     Um WAV mudo no <audio> e um buffer de 1 sample no contexto marcam o
     gesto; depois o setTimeout do drill já consegue soar. */
  let silencioEl = null;
  function toqueHtml() {
    try {
      if (typeof document === 'undefined') return;
      if (!silencioEl) {
        silencioEl = document.createElement('audio');
        silencioEl.setAttribute('playsinline', '');
        silencioEl.setAttribute('webkit-playsinline', '');
        silencioEl.preload = 'auto';
        silencioEl.src = 'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA';
        silencioEl.volume = 0.01;
      }
      const p = silencioEl.play();
      if (p && p.catch) p.catch(function () {});
    } catch (e) {}
  }

  function pulsoMudo(c) {
    if (!c) return;
    try {
      const buf = c.createBuffer(1, 1, c.sampleRate || 22050);
      const src = c.createBufferSource();
      src.buffer = buf;
      src.connect(c.destination);
      src.start(0);
    } catch (e) {}
  }

  function liberar() {
    const c = contexto();
    if (!c) { toqueHtml(); return null; }
    if (c.state !== 'running') {
      toqueHtml();
      try { c.resume(); } catch (e) {}
      pulsoMudo(c);
    }
    return c;
  }

  /* Devolve o contexto já acordado, ou null se o navegador ainda não liberou
     áudio (falta o gesto do usuário). */
  async function ativar() {
    liberar();
    const c = contexto();
    if (!c) return null;
    try { if (c.state === 'suspended' || c.state === 'interrupted') await comPrazo(c.resume(), PRAZO_MS); } catch (e) {}
    if (c.state !== 'running') return null;
    await aplicarSaida(c);
    return c;
  }

  function acordar() {
    return liberar();
  }

  /* O nó onde o clique deve ser ligado, respeitando o roteamento atual. */
  function destino() {
    const c = contexto();
    if (!c) return null;
    return (sinkVia === 'el' && dest) ? dest : c.destination;
  }

  function podeEscolherSaida() {
    const AC = global.AudioContext || global.webkitAudioContext;
    const ctxHas = !!(AC && AC.prototype && typeof AC.prototype.setSinkId === 'function');
    const elHas = typeof HTMLAudioElement !== 'undefined' &&
      typeof HTMLAudioElement.prototype.setSinkId === 'function';
    const picker = !!(navigator.mediaDevices && navigator.mediaDevices.selectAudioOutput);
    return !!(navigator.mediaDevices && navigator.mediaDevices.enumerateDevices && (ctxHas || elHas || picker));
  }

  function rotuloSaida(device, index) {
    const label = (device.label || '').trim();
    if (label) return label;
    if (!device.deviceId || device.deviceId === 'default') return 'Padrão do sistema';
    return 'Saída ' + (index + 1);
  }

  async function saidasDoSistema() {
    try {
      /* no WebKit, com a janela sem foco, enumerateDevices pode nunca responder */
      return (await comPrazo(navigator.mediaDevices.enumerateDevices(), PRAZO_MS)).filter(d => d.kind === 'audiooutput');
    } catch (e) { return []; }
  }

  /* No app desktop (WKWebView) o enumerateDevices não devolve NENHUMA saída
     até a página ter tido acesso ao microfone — no Chrome elas aparecem sem
     isso. Sem a lista, o clique só ia para a saída padrão do Mac, nunca para o
     fone/interface ao lado do MainStage. Abrir e fechar o microfone uma vez por
     sessão destrava a lista. Só no app: no navegador/iPhone isso viraria um
     pedido de microfone sem motivo aparente. */
  let saidasLiberadas = null;
  function noApp() { return !!(global.__TAURI__ || global.__TAURI_INTERNALS__); }
  function liberarSaidas() {
    if (!noApp() || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return Promise.resolve(false);
    if (!saidasLiberadas) {
      const pedido = navigator.mediaDevices.getUserMedia({ audio: true })
        .then(st => { st.getTracks().forEach(t => t.stop()); return true; });
      saidasLiberadas = pedido.catch(() => false);
      /* se a resposta demorar, não segura quem pediu — e deixa tentar de novo depois */
      return comPrazo(pedido, PRAZO_MS * 2).catch(() => { pedido.then(ok => { if (!ok) saidasLiberadas = null; }, () => { saidasLiberadas = null; }); return false; });
    }
    return comPrazo(saidasLiberadas, PRAZO_MS * 2).catch(() => false);
  }

  /* [{id, nome}] — sempre começa pelo padrão do sistema e, onde existe, termina
     com a entrada que abre o seletor do próprio sistema operacional. */
  async function listarSaidas() {
    if (!podeEscolherSaida()) return [];
    let devices = await saidasDoSistema();
    if (!devices.length && await liberarSaidas()) devices = await saidasDoSistema();
    const ids = new Set(devices.map(d => d.deviceId));
    /* lista vazia = o sistema não respondeu, não que a saída sumiu: não esquece a escolhida */
    if (devices.length && sinkId && sinkId !== 'default' && !ids.has(sinkId)) sinkId = '';
    const out = [{ id: '', nome: 'Padrão do sistema' }];
    devices.forEach((d, i) => {
      if (!d.deviceId || d.deviceId === 'default') return;
      out.push({ id: d.deviceId, nome: rotuloSaida(d, i) });
    });
    if (typeof navigator.mediaDevices.selectAudioOutput === 'function') {
      out.push({ id: '__pick__', nome: 'Escolher no sistema…' });
    }
    return out;
  }

  async function aplicarSaida(ativo) {
    const c = ativo || contexto();
    if (!c) return false;
    sinkVia = 'ctx';
    if (!sinkId || sinkId === 'default') {
      if (sinkEl) { try { sinkEl.pause(); } catch (e) {} }
      if (typeof c.setSinkId === 'function') { try { await comPrazo(c.setSinkId(''), PRAZO_MS); } catch (e) {} }
      return true;
    }
    if (!(await saidasDoSistema()).length) await liberarSaidas();
    if (typeof c.setSinkId === 'function') {
      try { await comPrazo(c.setSinkId(sinkId), PRAZO_MS); return true; } catch (e) {}
    }
    if (typeof HTMLAudioElement === 'undefined' ||
        typeof HTMLAudioElement.prototype.setSinkId !== 'function') return false;
    if (!dest) {
      dest = c.createMediaStreamDestination();
      sinkEl = new Audio();
      sinkEl.playsInline = true;
      sinkEl.srcObject = dest.stream;
    }
    try {
      await comPrazo(sinkEl.setSinkId(sinkId), PRAZO_MS);
      await comPrazo(sinkEl.play(), PRAZO_MS);
      sinkVia = 'el';
      return true;
    } catch (e) {
      try { sinkEl.pause(); } catch (e2) {}
      sinkVia = 'ctx';
      return false;
    }
  }

  async function usarSaida(id) {
    if (id === '__pick__') return escolherNoSistema();
    sinkId = id || '';
    await aplicarSaida();
    return sinkId;
  }

  async function escolherNoSistema() {
    if (!navigator.mediaDevices || typeof navigator.mediaDevices.selectAudioOutput !== 'function') return sinkId;
    try {
      const dev = await navigator.mediaDevices.selectAudioOutput();
      if (dev && dev.deviceId) { sinkId = dev.deviceId; await aplicarSaida(); }
    } catch (e) {}
    return sinkId;
  }

  function saidaAtual() { return sinkId; }
  function definirSaidaSalva(id) { sinkId = typeof id === 'string' ? id : ''; }

  /* ---------- clique ---------- */

  /* spec: {freq, ganho, decai, tipo}. O timbre é de quem chama — o que este
     arquivo garante é que o clique sai no destino certo e no tempo certo. */
  function clique(spec, quando) {
    const c = acordar();
    if (!c || !spec) return null;
    const saida = destino();
    if (!saida) return null;
    try {
      const t = quando === undefined ? c.currentTime : Math.max(quando, c.currentTime);
      const o = c.createOscillator();
      const g = c.createGain();
      o.type = spec.tipo || 'sine';
      o.frequency.value = spec.freq;
      g.gain.setValueAtTime(spec.ganho, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + (spec.decai || 0.03));
      o.connect(g); g.connect(saida);
      o.start(t); o.stop(t + (spec.decai || 0.03) + 0.02);
      return { osc: o, time: t };
    } catch (e) { return null; }
  }

  function lookahead() {
    return (typeof document !== 'undefined' && document.hidden) ? LOOK_OCULTO : LOOK_VISIVEL;
  }

  /* ---------- relógio ---------- */

  /* opts:
       passo()      segundos entre um tempo e o seguinte
       soar(n)      spec de clique para o tempo n, ou null para silêncio
       aoTocar(n)   desenho na tela, chamado quando o tempo n realmente chega
       colapsar()   quantos tempos atrasados toleram antes de pular para o último  */
  function criar(opts) {
    const r = {
      n: 0, rodando: false, fila: [], agendados: [],
      proximo: 0, ultimo: 0, viaAudio: false, timer: null, proximoMs: 0
    };

    const passo = () => Math.max(0.02, opts.passo());
    const colapsar = () => Math.max(2, (opts.colapsar ? opts.colapsar() : 2));

    function agendar() {
      if (!r.rodando || !r.viaAudio) return;
      const c = ctx;
      if (!c || c.state !== 'running') {   /* áudio dormiu: cai no timer */
        r.viaAudio = false; r.proximoMs = performance.now(); pulso(); return;
      }
      const limite = c.currentTime + lookahead();
      while (r.proximo < limite) {
        const spec = opts.soar ? opts.soar(r.n) : null;
        if (spec) { const nodo = clique(spec, r.proximo); if (nodo) r.agendados.push(nodo); }
        r.fila.push({ n: r.n, time: r.proximo });
        r.proximo += passo();
        r.n++;
      }
      r.agendados = r.agendados.filter(a => a.time > c.currentTime - 0.2);
      drenar();
      r.timer = setTimeout(agendar, SCHED_MS);
    }

    function drenar() {
      if (!ctx) return;
      const agora = ctx.currentTime, devidos = [];
      while (r.fila.length && r.fila[0].time <= agora + 0.02) devidos.push(r.fila.shift());
      if (!devidos.length) return;
      r.ultimo = devidos[devidos.length - 1].time;
      const usar = devidos.length > colapsar() ? devidos.slice(-1) : devidos;
      usar.forEach(d => opts.aoTocar && opts.aoTocar(d.n));
    }

    /* Sem áudio liberado: timer simples, que vira agendador assim que acordar. */
    function pulso() {
      if (!r.rodando || r.viaAudio) return;
      const c = acordar();
      if (c && c.state === 'running') { remarcar(false); return; }
      const spec = opts.soar ? opts.soar(r.n) : null;
      if (spec) clique(spec);
      if (opts.aoTocar) opts.aoTocar(r.n);
      if (!r.rodando) return;
      r.n++;
      r.proximoMs += passo() * 1000;
      r.timer = setTimeout(pulso, Math.max(5, r.proximoMs - performance.now()));
    }

    /* reiniciar=false emenda a agenda sem voltar ao tempo 1. */
    function remarcar(reiniciar) {
      if (!r.rodando) return;
      clearTimeout(r.timer);
      const c = acordar();
      const comAudio = !!(c && c.state === 'running');
      const agora = comAudio ? c.currentTime : 0;
      const corte = agora + 0.02;
      if (comAudio && !reiniciar) {
        let cancelados = 0;
        r.agendados = r.agendados.filter(nodo => {
          if (nodo.time > corte) { try { nodo.osc.stop(); } catch (e) {} return false; }
          return true;
        });
        r.fila = r.fila.filter(d => { if (d.time > corte) { cancelados++; return false; } return true; });
        r.n = Math.max(0, r.n - cancelados);
        /* inclui o que já foi entregue ao áudio mas ainda não foi drenado */
        const jaSoou = r.fila.map(d => d.time)
          .concat(r.agendados.map(nodo => nodo.time))
          .concat(r.ultimo || []);
        let prox = (jaSoou.length ? Math.max.apply(null, jaSoou) : agora) + passo();
        while (prox <= corte) prox += passo();
        r.proximo = prox;
      } else {
        r.agendados.forEach(nodo => { try { nodo.osc.stop(); } catch (e) {} });
        r.agendados = []; r.fila = []; r.ultimo = 0;
        if (reiniciar) r.n = 0;
        r.proximo = agora + 0.06;
      }
      if (comAudio) { r.viaAudio = true; agendar(); }
      else { r.viaAudio = false; r.proximoMs = performance.now(); pulso(); }
    }

    r.iniciar = function (aPartirDe) {
      r.parar();
      r.rodando = true;
      r.n = Number(aPartirDe) || 0;
      remarcar(true);
      return r;
    };
    r.remarcar = function () { remarcar(false); return r; };
    r.reiniciar = function () { remarcar(true); return r; };
    r.parar = function () {
      r.rodando = false;
      clearTimeout(r.timer); r.timer = null;
      r.agendados.forEach(nodo => { try { nodo.osc.stop(); } catch (e) {} });
      r.agendados = []; r.fila = []; r.viaAudio = false;
      return r;
    };
    return r;
  }

  global.Metronomo = {
    contexto, ativar, acordar, liberar, destino,
    podeEscolherSaida, listarSaidas, usarSaida, escolherNoSistema,
    saidaAtual, definirSaidaSalva, aplicarSaida,
    clique, criar
  };
})(window);
