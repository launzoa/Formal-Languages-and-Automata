/**
 * Modelo de Autômato Finito (AFD, AFND e AFND-ε)
 *
 * Representa formalmente a 5-tupla:
 * M = (Q, Σ, δ, q0, F)
 * - Q: Conjunto finito de estados
 * - Σ: Alfabeto de entrada
 * - δ: Função de transição (Q × (Σ ∪ {ε}) → P(Q))
 * - q0: Estado inicial (q0 ∈ Q)
 * - F: Conjunto de estados finais ou de aceitação (F ⊆ Q)
 */

import { stripQuotes, isRangeTerminal, isEpsilon } from '../grammar/grammar.js';
import { matchesTerminal } from '../grammar/derivation.js';

export const AutomatonType = {
  DFA: 'AFD',           // Determinístico
  NFA: 'AFND',          // Não Determinístico sem épsilon
  NFA_EPSILON: 'AFND-ε' // Não Determinístico com transições épsilon
};

/**
 * Representa um passo da simulação de uma palavra no Autômato.
 */
export class AutomatonStep {
  /**
   * @param {number} stepNumber
   * @param {string[]} activeStates - Lista de estados ativos neste passo
   * @param {string|null} symbolRead - Símbolo lido ou null no início
   * @param {string[]} nextActiveStates - Próximos estados ativos
   * @param {string} consumedInput - Cadeia já consumida
   * @param {string} remainingInput - Cadeia restante
   * @param {boolean} transitionFound - Se houve transição válida
   * @param {string} formalConfig - Ex: ({q0, q1}, "ab") ⊢ ({q1, q2}, "b")
   */
  constructor(
    stepNumber,
    activeStates,
    symbolRead,
    nextActiveStates,
    consumedInput,
    remainingInput,
    transitionFound = true,
    formalConfig = ''
  ) {
    this.stepNumber = stepNumber;
    this.activeStates = [...activeStates];
    this.symbolRead = symbolRead;
    this.nextActiveStates = [...nextActiveStates];
    this.consumedInput = consumedInput;
    this.remainingInput = remainingInput;
    this.transitionFound = transitionFound;
    this.formalConfig = formalConfig;
  }

  get currentState() {
    if (this.activeStates.length === 0) return '';
    return this.activeStates.length === 1 ? this.activeStates[0] : `{ ${this.activeStates.join(', ')} }`;
  }

  get nextState() {
    if (this.nextActiveStates.length === 0) return null;
    return this.nextActiveStates.length === 1 ? this.nextActiveStates[0] : `{ ${this.nextActiveStates.join(', ')} }`;
  }
}

/**
 * Resultado completo da simulação de uma palavra no Autômato.
 */
export class AutomatonSimulationResult {
  /**
   * @param {boolean} isAccepted
   * @param {string} word
   * @param {AutomatonStep[]} steps
   * @param {string[]} finalActiveStates
   * @param {string} message
   * @param {string[]} acceptingStatesReached
   */
  constructor(
    isAccepted,
    word,
    steps = [],
    finalActiveStates = [],
    message = '',
    acceptingStatesReached = []
  ) {
    this.isAccepted = isAccepted;
    this.word = word;
    this.steps = steps;
    this.finalActiveStates = [...finalActiveStates];
    this.message = message;
    this.acceptingStatesReached = [...acceptingStatesReached];
  }

  /**
   * Retorna a sequência formal de configurações instantâneas:
   * ({q0}, "abb") ⊢ ({q0, q1}, "bb") ⊢ ({q0, q2}, "b") ⊢ ({q0, q3}, ε)
   * @returns {string}
   */
  getFormalChain() {
    if (this.steps.length === 0) return '';
    return this.steps.map(s => s.formalConfig).join('  ⊢  ');
  }
}

/**
 * Divide símbolos de transição agrupados por vírgula ou barra vertical (ex: "0, 1", "0,1" ou "0|1")
 * preservando símbolos compostos e intervalos com aspas (ex: "'a-z', 'A-Z'").
 * @param {string} symRaw
 * @returns {string[]}
 */
export function splitSymbols(symRaw) {
  const s = String(symRaw || '').trim();
  if (!s) return [];
  const symbols = [];
  let current = '';
  let inSingleQuote = false;
  let inDoubleQuote = false;

  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch === "'" && !inDoubleQuote) {
      inSingleQuote = !inSingleQuote;
      current += ch;
    } else if (ch === '"' && !inSingleQuote) {
      inDoubleQuote = !inDoubleQuote;
      current += ch;
    } else if ((ch === ',' || ch === '|') && !inSingleQuote && !inDoubleQuote) {
      const trimmed = current.trim();
      if (trimmed) symbols.push(trimmed);
      current = '';
    } else {
      current += ch;
    }
  }
  const lastTrimmed = current.trim();
  if (lastTrimmed) symbols.push(lastTrimmed);
  return symbols.length > 0 ? symbols : [s];
}

/**
 * Classe principal para manipulação de Autômatos Finitos (AFD, AFND e AFND-ε).
 */
export class FiniteAutomaton {
  constructor() {
    this.Q = new Set();               // Conjunto de estados (strings)
    this.Sigma = new Set();           // Alfabeto (strings, ex: 'a', '0', 'a-z')
    // delta: Map<fromState, Map<symbol, Set<toState>>>
    this.delta = new Map();
    this.q0 = '';                     // Estado inicial
    this.F = new Set();               // Estados finais / de aceitação
    this.stateDescriptions = new Map(); // Opcional: descrição da origem (ex: subconjunto {S, A})
  }

  /**
   * Adiciona um estado ao autômato.
   * @param {string} state
   * @param {boolean} isInitial
   * @param {boolean} isFinal
   * @param {string} [description]
   */
  addState(state, isInitial = false, isFinal = false, description = '') {
    const s = String(state).trim();
    if (!s) return;
    this.Q.add(s);
    if (isInitial) this.q0 = s;
    if (isFinal) this.F.add(s);
    if (description) this.stateDescriptions.set(s, description);
    if (!this.delta.has(s)) {
      this.delta.set(s, new Map());
    }
  }

  /**
   * Adiciona um símbolo ao alfabeto Σ.
   * @param {string} sym
   */
  addSymbol(sym) {
    const s = String(sym).trim();
    if (s && !isEpsilon(s)) {
      this.Sigma.add(s);
    }
  }

  /**
   * Adiciona uma transição δ(fromState, symbol) ∋ toState.
   * Suporta tanto destinos únicos quanto múltiplos destinos.
   *
   * @param {string} fromState
   * @param {string} symbol
   * @param {string|string[]} toState
   */
  addTransition(fromState, symbol, toState) {
    const u = String(fromState).trim();
    const sym = String(symbol).trim();

    this.addState(u);
    if (!isEpsilon(sym)) {
      this.addSymbol(sym);
    }

    if (!this.delta.has(u)) {
      this.delta.set(u, new Map());
    }
    const stateTransitions = this.delta.get(u);
    if (!stateTransitions.has(sym)) {
      stateTransitions.set(sym, new Set());
    }

    const targets = Array.isArray(toState) ? toState : [toState];
    for (const target of targets) {
      const v = String(target).trim();
      if (v) {
        this.addState(v);
        stateTransitions.get(sym).add(v);
      }
    }
  }

  /**
   * Analisa e classifica o autômato como AFD, AFND ou AFND-ε.
   *
   * @returns {{
   *   type: string,
   *   badge: string,
   *   isDFA: boolean,
   *   hasEpsilon: boolean,
   *   details: string,
   *   nonDeterministicReasons: string[]
   * }}
   */
  getAutomatonType() {
    let hasEpsilonTransitions = false;
    let hasMultipleDestinations = false;
    const reasons = [];

    for (const [from, transMap] of this.delta.entries()) {
      for (const [sym, targets] of transMap.entries()) {
        if (isEpsilon(sym)) {
          hasEpsilonTransitions = true;
          reasons.push(`Estado "${from}" possui transição épsilon (ε) para { ${Array.from(targets).join(', ')} }.`);
        } else if (targets.size > 1) {
          hasMultipleDestinations = true;
          reasons.push(`Estado "${from}" possui múltiplas transições lendo "${sym}" para { ${Array.from(targets).join(', ')} }.`);
        }
      }
    }

    if (hasEpsilonTransitions) {
      return {
        type: AutomatonType.NFA_EPSILON,
        badge: 'AFND-ε',
        isDFA: false,
        hasEpsilon: true,
        details: 'Autômato Finito Não Determinístico com transições vazias (ε-transições).',
        nonDeterministicReasons: reasons
      };
    }

    if (hasMultipleDestinations) {
      return {
        type: AutomatonType.NFA,
        badge: 'AFND',
        isDFA: false,
        hasEpsilon: false,
        details: 'Autômato Finito Não Determinístico (possui estados com múltiplos destinos para o mesmo símbolo).',
        nonDeterministicReasons: reasons
      };
    }

    return {
      type: AutomatonType.DFA,
      badge: 'AFD',
      isDFA: true,
      hasEpsilon: false,
      details: 'Autômato Finito Determinístico (para cada par (estado, símbolo) há no máximo um estado de destino).',
      nonDeterministicReasons: []
    };
  }

  /**
   * Calcula o fecho-épsilon (ε-closure) de um conjunto de estados.
   * Retorna o conjunto de todos os estados alcançáveis a partir de `statesSet`
   * utilizando apenas transições por palavra vazia (ε).
   *
   * @param {Iterable<string>} statesSet
   * @returns {Set<string>}
   */
  computeEpsilonClosure(statesSet) {
    const closure = new Set(statesSet);
    const stack = Array.from(statesSet);

    while (stack.length > 0) {
      const state = stack.pop();
      const transitions = this.delta.get(state);
      if (!transitions) continue;

      for (const [sym, targets] of transitions.entries()) {
        if (isEpsilon(sym)) {
          for (const target of targets) {
            if (!closure.has(target)) {
              closure.add(target);
              stack.push(target);
            }
          }
        }
      }
    }

    return closure;
  }

  /**
   * Busca todos os estados de destino a partir de um conjunto de estados lendo um caractere.
   * Suporta correspondência exata e por intervalo/classe de caracteres.
   *
   * @param {Iterable<string>} fromStates
   * @param {string} char
   * @returns {{ nextStates: Set<string>, matchedSymbols: Set<string> }}
   */
  findTransitionsForSet(fromStates, char) {
    const nextStates = new Set();
    const matchedSymbols = new Set();

    for (const from of fromStates) {
      const stateTransitions = this.delta.get(from);
      if (!stateTransitions) continue;

      // 1. Transições exatas
      if (stateTransitions.has(char)) {
        matchedSymbols.add(char);
        for (const target of stateTransitions.get(char)) {
          nextStates.add(target);
        }
      }

      // 2. Transições por intervalo (ex: 'a-z', '0-9')
      for (const [sym, targets] of stateTransitions.entries()) {
        if (!isEpsilon(sym) && matchesTerminal(sym, char)) {
          matchedSymbols.add(sym);
          for (const target of targets) {
            nextStates.add(target);
          }
        }
      }
    }

    return { nextStates, matchedSymbols };
  }

  /**
   * Simula a execução de uma palavra no Autômato (funciona para AFD, AFND e AFND-ε).
   * Rastreia múltiplos ramos ativos simultaneamente e computa fecho-épsilon a cada passo.
   *
   * @param {string} rawWord - Palavra a ser testada
   * @returns {AutomatonSimulationResult}
   */
  simulateWord(rawWord = '') {
    let word = (rawWord === null || rawWord === undefined) ? '' : String(rawWord).trim();
    // Remove aspas externas se houver
    word = word.replace(/^['"‘’“”]|['"‘’“”]$/g, '').trim();

    // Validação básica
    if (!this.q0 || !this.Q.has(this.q0)) {
      return new AutomatonSimulationResult(false, word, [], [], 'Autômato sem estado inicial definido.');
    }

    const steps = [];
    const chars = Array.from(word);

    // Passo inicial 0: Fecho-épsilon do estado inicial
    let currentActiveStates = this.computeEpsilonClosure([this.q0]);
    const initialRemaining = word === '' ? 'ε' : word;

    steps.push(
      new AutomatonStep(
        0,
        Array.from(currentActiveStates),
        null,
        Array.from(currentActiveStates),
        '',
        word,
        true,
        `({${Array.from(currentActiveStates).join(', ')}}, "${initialRemaining}")`
      )
    );

    // Se a palavra for vazia
    if (chars.length === 0) {
      const finalStatesReached = Array.from(currentActiveStates).filter(s => this.F.has(s));
      const isAccepted = finalStatesReached.length > 0;
      const message = isAccepted
        ? `Palavra vazia (ε) ACEITA ✔: fecho-épsilon de "${this.q0}" alcançou o(s) estado(s) de aceitação { ${finalStatesReached.join(', ')} } ⊆ F.`
        : `Palavra vazia (ε) REJEITADA ✖: nenhum dos estados em ε-closure(${this.q0}) pertence a F.`;
      return new AutomatonSimulationResult(isAccepted, word, steps, Array.from(currentActiveStates), message, finalStatesReached);
    }

    // Processa caractere por caractere
    let consumed = '';
    for (let i = 0; i < chars.length; i++) {
      const ch = chars[i];
      const remaining = chars.slice(i + 1).join('');
      const displayRemaining = remaining === '' ? 'ε' : `"${remaining}"`;

      const { nextStates, matchedSymbols } = this.findTransitionsForSet(currentActiveStates, ch);

      // Aplica fecho-épsilon nos estados alcançados
      const nextActiveWithEpsilon = this.computeEpsilonClosure(nextStates);

      if (nextActiveWithEpsilon.size === 0) {
        // Nenhuma ramificação continuou (morte/travamento de todos os caminhos)
        steps.push(
          new AutomatonStep(
            i + 1,
            Array.from(currentActiveStates),
            ch,
            [],
            consumed + ch,
            remaining,
            false,
            `({${Array.from(currentActiveStates).join(', ')}}, "${ch}${remaining}") ⊢ ∅ (Travamento)`
          )
        );
        return new AutomatonSimulationResult(
          false,
          word,
          steps,
          [],
          `Palavra REJEITADA ✖: todas as ramificações travaram lendo '${ch}' a partir de { ${Array.from(currentActiveStates).join(', ')} }.`
        );
      }

      consumed += ch;
      const prevActiveList = Array.from(currentActiveStates);
      currentActiveStates = nextActiveWithEpsilon;
      const currentActiveList = Array.from(currentActiveStates);

      steps.push(
        new AutomatonStep(
          i + 1,
          prevActiveList,
          ch,
          currentActiveList,
          consumed,
          remaining,
          true,
          `({${currentActiveList.join(', ')}}, ${displayRemaining})`
        )
      );
    }

    // Ao final, verifica se ao menos um ramo atingiu um estado final
    const finalStatesReached = Array.from(currentActiveStates).filter(s => this.F.has(s));
    const isAccepted = finalStatesReached.length > 0;

    let message = '';
    if (isAccepted) {
      message = `Palavra ACEITA ✔: processamento encerrou com caminho(s) bem-sucedido(s) no(s) estado(s) de aceitação { ${finalStatesReached.join(', ')} } ⊆ F.`;
    } else {
      message = `Palavra REJEITADA ✖: nenhum dos estados ativos finais { ${Array.from(currentActiveStates).join(', ')} } pertence ao conjunto de aceitação F = { ${Array.from(this.F).join(', ')} }.`;
    }

    return new AutomatonSimulationResult(
      isAccepted,
      word,
      steps,
      Array.from(currentActiveStates),
      message,
      finalStatesReached
    );
  }

  /**
   * Retorna a matriz da tabela de transição bidimensional.
   * Suporta células com conjuntos de múltiplos destinos (ex: {q0, q1}).
   *
   * @returns {{
   *   symbols: string[],
   *   rows: Array<{
   *     state: string,
   *     isInitial: boolean,
   *     isFinal: boolean,
   *     description: string,
   *     transitions: { [symbol: string]: string }
   *   }>
   * }}
   */
  getTransitionTable() {
    const classification = this.getAutomatonType();
    const symbols = Array.from(this.Sigma).sort((a, b) => a.localeCompare(b));

    // Se houver transições épsilon, inclui 'ε' como coluna
    if (classification.hasEpsilon && !symbols.includes('ε')) {
      symbols.push('ε');
    }

    const states = Array.from(this.Q).sort((a, b) => {
      if (a === this.q0) return -1;
      if (b === this.q0) return 1;
      return a.localeCompare(b, undefined, { numeric: true });
    });

    const rows = states.map(state => {
      const isInitial = state === this.q0;
      const isFinal = this.F.has(state);
      const description = this.stateDescriptions.get(state) || '';
      const stateTransitions = this.delta.get(state) || new Map();

      const transMap = {};
      for (const sym of symbols) {
        let targets = stateTransitions.get(sym);

        // Se for coluna ε e não achou com 'ε', tenta outros símbolos de épsilon
        if (sym === 'ε' && !targets) {
          for (const [sKey, tSet] of stateTransitions.entries()) {
            if (isEpsilon(sKey)) {
              targets = tSet;
              break;
            }
          }
        }

        if (targets && targets.size > 0) {
          const list = Array.from(targets).sort();
          transMap[sym] = list.length === 1 ? list[0] : `{ ${list.join(', ')} }`;
        } else {
          transMap[sym] = '—';
        }
      }

      return {
        state,
        isInitial,
        isFinal,
        description,
        transitions: transMap
      };
    });

    return { symbols, rows };
  }

  /**
   * Converte a definição do autômato para texto formal legível.
   * @returns {string}
   */
  toFormalDefinition() {
    const classification = this.getAutomatonType();
    const qList = Array.from(this.Q).join(', ');
    const sigmaList = Array.from(this.Sigma).join(', ');
    const fList = Array.from(this.F).join(', ') || '∅';

    return `M = (Q, Σ, δ, q0, F) [${classification.badge}]
Tipo: ${classification.details}
Q = { ${qList} }
Σ = { ${sigmaList} }
q0 = ${this.q0 || '—'}
F = { ${fList} }`;
  }

  /**
   * Valida a consistência formal do autômato.
   * @returns {{ isValid: boolean, errors: string[], warnings: string[] }}
   */
  validate() {
    const errors = [];
    const warnings = [];

    if (this.Q.size === 0) {
      errors.push('O conjunto de estados (Q) não pode estar vazio.');
    }

    if (this.Sigma.size === 0) {
      errors.push('O alfabeto (Σ) não pode estar vazio.');
    }

    if (!this.q0) {
      errors.push('O estado inicial (q0) deve ser informado.');
    } else if (!this.Q.has(this.q0)) {
      errors.push(`O estado inicial "${this.q0}" não pertence a Q.`);
    }

    for (const f of this.F) {
      if (!this.Q.has(f)) {
        errors.push(`O estado final "${f}" não pertence a Q.`);
      }
    }

    if (this.F.size === 0) {
      warnings.push('O conjunto de estados finais (F) está vazio. Nenhuma cadeia será aceita.');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Realiza o parse de entradas manuais de texto para construir um autômato.
   * Suporta notação para AFD, AFND e AFND-ε (múltiplos destinos e épsilon).
   *
   * Formatos aceitos para transições:
   * - "q0, a -> q0, q1"
   * - "q0, a -> q0" seguido de "q0, a -> q1"
   * - "q0, ε -> q1"
   * - "delta(q0, a) = {q0, q1}"
   *
   * @param {string} qInput - Ex: "q0, q1, q2"
   * @param {string} sigmaInput - Ex: "0, 1" ou "a, b"
   * @param {string} deltaInput - Linhas de transições
   * @param {string} q0Input - Ex: "q0"
   * @param {string} fInput - Ex: "q1, q2"
   * @returns {{ automaton: FiniteAutomaton, errors: string[], warnings: string[], isValid: boolean }}
   */
  static parse(qInput, sigmaInput, deltaInput, q0Input, fInput) {
    const automaton = new FiniteAutomaton();
    const errors = [];
    const warnings = [];

    // Limpeza de prefixos "Q =", "Σ =", "q0 =", "F =", chaves {...}
    const cleanQ = (qInput || '').replace(/^\s*Q\s*[:=]\s*/i, '').replace(/[{}]/g, ' ').trim();
    const cleanSigma = (sigmaInput || '').replace(/^\s*(?:Σ|Sigma|ALFABETO)\s*[:=]\s*/i, '').replace(/[{}]/g, ' ').trim();
    const cleanQ0 = (q0Input || '').replace(/^\s*q0\s*[:=]\s*/i, '').replace(/[{}]/g, ' ').trim();
    const cleanF = (fInput || '').replace(/^\s*F\s*[:=]\s*/i, '').replace(/[{}]/g, ' ').trim();

    // 1. Estados Q
    if (cleanQ) {
      const qTokens = cleanQ.split(/[,;\s]+/).map(s => s.trim()).filter(Boolean);
      for (const q of qTokens) {
        automaton.addState(q);
      }
    }

    // 2. Alfabeto Σ
    if (cleanSigma) {
      const sigTokens = cleanSigma.split(/[,;\s]+/).map(s => s.trim()).filter(Boolean);
      for (const sym of sigTokens) {
        automaton.addSymbol(sym);
      }
    }

    // 3. Estado inicial q0
    if (cleanQ0) {
      automaton.q0 = cleanQ0;
      automaton.addState(cleanQ0);
    } else if (automaton.Q.size > 0) {
      automaton.q0 = Array.from(automaton.Q)[0];
    }

    // 4. Estados finais F
    if (cleanF) {
      const fTokens = cleanF.split(/[,;\s]+/).map(s => s.trim()).filter(Boolean);
      for (const f of fTokens) {
        automaton.F.add(f);
        automaton.addState(f);
      }
    }

    // 5. Transições δ
    if (deltaInput && typeof deltaInput === 'string') {
      const lines = deltaInput.split('\n');
      for (let i = 0; i < lines.length; i++) {
        let line = lines[i].trim();
        if (!line || line.startsWith('#') || line.startsWith('//')) continue;

        // Ignora definição da tupla formal M = (Q, Σ, δ, q0, F) se colada no campo
        if (/^M\s*[:=]\s*\(.*?\)/i.test(line)) continue;

        // Extrai Q, Sigma, q0 ou F se o usuário colou a especificação completa
        const qMatch = line.match(/^Q\s*[:=]\s*(.*)/i);
        if (qMatch) {
          const tokens = qMatch[1].replace(/[{}]/g, '').split(/[,;\s]+/).map(s => s.trim()).filter(Boolean);
          tokens.forEach(q => automaton.addState(q));
          continue;
        }

        const sigMatch = line.match(/^(?:Σ|Sigma|ALFABETO)\s*[:=]\s*(.*)/i);
        if (sigMatch) {
          const tokens = sigMatch[1].replace(/[{}]/g, '').split(/[,;\s]+/).map(s => s.trim()).filter(Boolean);
          tokens.forEach(sym => automaton.addSymbol(sym));
          continue;
        }

        const q0Match = line.match(/^q0\s*[:=]\s*(.*)/i);
        if (q0Match) {
          const q0Clean = q0Match[1].replace(/[{}]/g, '').trim();
          if (q0Clean) {
            automaton.q0 = q0Clean;
            automaton.addState(q0Clean);
          }
          continue;
        }

        const fMatch = line.match(/^F\s*[:=]\s*(.*)/i);
        if (fMatch) {
          const tokens = fMatch[1].replace(/[{}]/g, '').split(/[,;\s]+/).map(s => s.trim()).filter(Boolean);
          tokens.forEach(f => {
            automaton.F.add(f);
            automaton.addState(f);
          });
          continue;
        }

        // Ignora linhas de abertura/fechamento ou rótulo como "δ = {", "delta = {", "{", "}"
        if (line === '{' || line === '}' || /^(?:delta|δ)\s*[:=]?\s*\{?$/i.test(line)) continue;

        // Remove chaves externas ou pontuação final
        line = line.replace(/^\s*\{\s*/, '').replace(/\s*\}\s*$/, '').replace(/[,;]+$/, '').trim();
        if (!line) continue;

        let matched = false;

        // Padrão 1: delta(q0, a) = {q1, q2} ou δ(q0, a) = q1
        const funcMatch = line.match(/^(?:delta|δ)?\s*\(\s*([^,]+)\s*,\s*([^)]+)\s*\)\s*=\s*(.*)$/i);
        if (funcMatch) {
          const from = funcMatch[1].trim();
          const symRaw = funcMatch[2].trim();
          const toRaw = funcMatch[3].replace(/[{}]/g, '').trim();
          const toList = toRaw.split(/[,;\s]+/).map(s => s.trim()).filter(Boolean);
          const symList = splitSymbols(symRaw);
          for (const s of symList) {
            automaton.addTransition(from, s, toList);
          }
          matched = true;
        }

        // Padrão 2: "from, sym -> to1, to2" ou "from, sym -> to"
        if (!matched) {
          const arrowMatch = line.match(/^([^,]+)\s*,\s*(.*?)\s*(?:->|→|=>|=)\s*(.*)$/);
          if (arrowMatch) {
            const from = arrowMatch[1].trim();
            const symRaw = arrowMatch[2].trim();
            const toRaw = arrowMatch[3].replace(/[{}]/g, '').trim();
            const toList = toRaw.split(/[,;\s]+/).map(s => s.trim()).filter(Boolean);
            const symList = splitSymbols(symRaw);
            for (const s of symList) {
              automaton.addTransition(from, s, toList);
            }
            matched = true;
          }
        }

        // Padrão 3: "from sym -> to" ou "from sym to"
        if (!matched) {
          const spaceArrowMatch = line.match(/^(\S+)\s+(\S+)\s*(?:->|→|=>)\s*(.*)$/);
          if (spaceArrowMatch) {
            const from = spaceArrowMatch[1].trim();
            const symRaw = spaceArrowMatch[2].trim();
            const toRaw = spaceArrowMatch[3].replace(/[{}]/g, '').trim();
            const toList = toRaw.split(/[,;\s]+/).map(s => s.trim()).filter(Boolean);
            const symList = splitSymbols(symRaw);
            for (const s of symList) {
              automaton.addTransition(from, s, toList);
            }
            matched = true;
          }
        }

        if (!matched) {
          errors.push(`Linha ${i + 1}: Formato de transição inválido "${line}". Use "origem, símbolo -> destino".`);
        }
      }
    }

    if (!automaton.q0 && automaton.Q.size > 0) {
      automaton.q0 = Array.from(automaton.Q)[0];
    }

    const val = automaton.validate();
    errors.push(...val.errors);
    warnings.push(...val.warnings);

    return {
      automaton,
      dfa: automaton, // Alias retrocompatível
      errors,
      warnings,
      isValid: errors.length === 0
    };
  }
}

// Alias retrocompatível para DFA
export const DFA = FiniteAutomaton;
export const DFAStep = AutomatonStep;
export const DFASimulationResult = AutomatonSimulationResult;
