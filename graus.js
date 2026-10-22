/* Leitura de cifra em graus — regra única, compartilhada pelo módulo de cifras e
   pelo de estudos.

   Antes existiam duas cópias destas funções: uma no cifras.html e outra no
   estudos.js. Elas nasceram idênticas, mas nada impedia que um ajuste em um lado
   ficasse de fora do outro — e o sintoma seria silencioso: você estudaria um
   acorde diferente do que toca.

   Convenções que este arquivo carrega (e que não são óbvias):
   - "+" depois do grau significa MAIOR, não aumentado: "3+" em C é E maior.
   - O baixo depois da barra é grau DO ACORDE, não do tom: "5/3" em C é G/B.
   - Um tom escrito como "Am / C" é lido pelo relativo maior (C).            */
(function (global) {
  /* Mais longos primeiro: "m6" tem que ganhar de "m", "7sus4" de "(7)". */
  const SUFFIX_PATTERN = 'm7b5|mmaj7|m\\(maj7\\)|m6|maj7|m7|7sus4|\\(7\\)sus4|sus4\\(7\\)|dim7|add11|add9|sus4|sus2|dim|aug|m|\\(\\+\\)|\\(7\\)|°|\\+';

  /* Fábrica em vez de constante: RegExp com /g guarda lastIndex, e duas partes
     do app compartilhando a mesma instância se atrapalhariam. */
  function tokenRe() {
    return new RegExp(
      '(^|[^A-Za-zÀ-ÿ0-9])([#b]?)([1-7])(' + SUFFIX_PATTERN + ')?(?:\\/\\s*([#b]?)([1-7]))?(?::(\\d+))?(?=$|[^A-Za-zÀ-ÿ0-9:])',
      'gi'
    );
  }

  const SUFFIX_MAP = {
    m: 'm', maj7: 'maj7', m7: 'm7', m7b5: 'm7b5', '(7)': '7', '(+)': '',
    add9: 'add9', add11: 'add11', sus2: 'sus2', sus4: 'sus4',
    /* clichê de linha (C#m C#m(maj7) C#m7 C#m6) e o "B7(4)" das cifras */
    mmaj7: 'm(maj7)', 'm(maj7)': 'm(maj7)', m6: 'm6',
    '7sus4': '7sus4', '(7)sus4': '7sus4', 'sus4(7)': '7sus4',
    dim: '°', dim7: '°7', aug: 'aug', '°': '°', '+': ''
  };

  const MAJOR_STEPS = [0, 2, 4, 5, 7, 9, 11];
  const MINOR_STEPS = [0, 2, 3, 5, 7, 8, 10];

  function normalizeInput(value) {
    return String(value ?? '')
      .replace(/♭/g, 'b').replace(/♯/g, '#').replace(/º/g, '°')
      .replace(/\bsus\s*([24])\b/gi, 'sus$1')
      .replace(/\badd\s*(\d+)\b/gi, 'add$1')
      .replace(/([1-7])\s+(m7b5|mmaj7|m6|maj7|m7|7sus4|dim7|add\d+|sus[24]|dim7|dim|aug|m|\(\+\)|\(7\)|°|\+)/gi, '$1$2');
  }

  /* Tom da música. "Am / C" e "Bm/D" são lidos pelo relativo maior no fim. */
  function keyInfo(value) {
    const parts = String(value ?? '').split('/').map(part => part.trim()).filter(Boolean);
    for (let index = parts.length - 1; index >= 0; index--) {
      const relative = parts[index].match(/^([A-Ga-g])([#b]?)$/);
      if (relative) return { root: relative[1].toUpperCase() + relative[2], minor: false };
    }
    const primary = (parts[0] || '').match(/^([A-Ga-g])([#b]?)(m)?$/);
    return primary ? { root: primary[1].toUpperCase() + primary[2], minor: Boolean(primary[3]) } : null;
  }

  function suffixToNote(suffix) {
    if (!suffix) return '';
    const normalized = String(suffix).toLowerCase();
    if (Object.prototype.hasOwnProperty.call(SUFFIX_MAP, normalized)) return SUFFIX_MAP[normalized];
    return normalized;
  }

  /* Sem sufixo, a qualidade vem do grau na tonalidade. Grau alterado (b6, #4)
     é maior por convenção. */
  function quality(degree, alteration, suffix, minor) {
    const suffixKey = String(suffix ?? '').toLowerCase();
    if (suffixKey && Object.prototype.hasOwnProperty.call(SUFFIX_MAP, suffixKey)) return SUFFIX_MAP[suffixKey];
    if (alteration) return '';
    const qualities = minor ? ['m', '°', '', 'm', 'm', '', ''] : ['', 'm', 'm', '', '', 'm', '°'];
    return qualities[Number(degree) - 1] || '';
  }

  function toPitch(degree, alteration, keyRoot, intervals) {
    const offset = alteration === '#' ? 1 : alteration === 'b' ? -1 : 0;
    return (keyRoot + intervals[Number(degree) - 1] + offset + 12) % 12;
  }

  function chordNames(info) {
    const pitch = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
    const accidental = info.root.endsWith('#') ? 1 : info.root.endsWith('b') ? -1 : 0;
    const keyRoot = (pitch[info.root[0]] + accidental + 12) % 12;
    const flats = new Set(['F', 'Bb', 'Eb', 'Ab', 'Db', 'Gb', 'Cb']);
    const preferFlats = info.root.endsWith('b') || flats.has(info.root);
    const flatNames = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
    const sharpNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    const intervals = info.minor ? MINOR_STEPS : MAJOR_STEPS;
    const pickNames = useFlats => (useFlats ? flatNames : sharpNames);
    return { keyRoot, intervals, preferFlats, pickNames };
  }

  /* Os graus do baixo contam a partir do acorde, e a escala depende da
     qualidade dele: "5/3" é a terça do V, não o terceiro grau do tom. */
  function bassIntervals(chordQuality) {
    if (chordQuality === '°' || chordQuality === '°7') return [0, 2, 3, 5, 6, 8, 9];
    if (/^m(?!aj)/.test(chordQuality)) return [0, 2, 3, 5, 7, 8, 10];
    return [0, 2, 4, 5, 7, 9, 11];
  }

  /* Baixo sem alteração segue a escala do próprio acorde: em menor, "6/7" já é
     o 7 menor (Em/D). Num acorde menor, "b" conta pela escala maior e "#" pela
     menor — assim "6/b7" também dá Em/D (antes abaixava duas vezes: Em/Db) e
     "6/#7" dá a 7ª maior (G#m/G), que antes não tinha como ser escrita. */
  function bassPitchFromChord(chordPitch, bassDegree, bassAlteration, chordQuality) {
    const offset = bassAlteration === '#' ? 1 : bassAlteration === 'b' ? -1 : 0;
    const intervals = offset < 0 && /^m(?!aj)/.test(chordQuality) ? bassIntervals('') : bassIntervals(chordQuality);
    return (chordPitch + intervals[Number(bassDegree) - 1] + offset + 12) % 12;
  }

  /* Um token de grau vira nome de acorde no tom informado. */
  function tokenToNote(degree, alteration, suffix, bassAlteration, bassDegree, duration, info) {
    const { keyRoot, intervals, preferFlats, pickNames } = chordNames(info);
    const chordPitch = toPitch(degree, alteration, keyRoot, intervals);
    const names = pickNames(alteration === 'b' ? true : alteration === '#' ? false : preferFlats);
    const note = names[chordPitch];
    const chordQuality = quality(degree, alteration, suffix, info.minor);
    let out = note + chordQuality;
    if (bassDegree) {
      const bassPitch = bassPitchFromChord(chordPitch, bassDegree, bassAlteration, chordQuality);
      /* "b" num acorde menor é a 3ª/7ª natural dele: grafa pela fundamental —
         G#m/F# (não Gb), mas Fm/Ab (não G#) */
      const bemolDeMenor = bassAlteration === 'b' && /^m(?!aj)/.test(chordQuality);
      const bassNote = pickNames(bemolDeMenor ? !note.includes('#') : bassAlteration === 'b' ? true : bassAlteration === '#' ? false : preferFlats)[bassPitch];
      out += '/' + bassNote;
    }
    if (duration) out += ':' + duration;
    return out;
  }

  /* Leitura estrutural, usada pelo módulo de estudos para montar voicings:
     devolve {root, quality, slash?, token} com root e slash em semitons acima
     da tônica do tom. */
  function parseLine(text, minor) {
    const out = [];
    const src = normalizeInput(text);
    const re = tokenRe();
    let m;
    while ((m = re.exec(src))) {
      const alteration = m[2], degree = m[3], suffix = m[4], bassAlteration = m[5], bassDegree = m[6];
      const steps = minor ? MINOR_STEPS : MAJOR_STEPS;
      const chordQuality = quality(degree, alteration, suffix, minor);
      const root = (((steps[Number(degree) - 1] + (alteration === '#' ? 1 : alteration === 'b' ? -1 : 0)) % 12) + 12) % 12;
      const chord = {
        root,
        quality: chordQuality,
        token: (alteration || '') + degree + (suffix || '') + (bassDegree ? '/' + (bassAlteration || '') + bassDegree : '')
      };
      if (bassDegree) chord.slash = bassPitchFromChord(root, bassDegree, bassAlteration, chordQuality);
      out.push(chord);
    }
    return out;
  }

  global.Graus = {
    SUFFIX_PATTERN, MAJOR_STEPS, MINOR_STEPS,
    tokenRe, normalizeInput, keyInfo, suffixToNote, quality,
    toPitch, chordNames, bassIntervals, bassPitchFromChord, tokenToNote, parseLine
  };
})(typeof window !== 'undefined' ? window : globalThis);
