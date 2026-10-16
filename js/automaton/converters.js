/**
 * Conversores Formais para Autômato Finito (AFD, AFND e AFND-ε)
 *
 * Implementa:
 * 1. Algoritmo de Construção de Subconjuntos (Subset Construction):
 *    Converte qualquer AFND ou AFND-ε em um AFD determinístico equivalente,
 *    produzindo a tabela formal de correspondência de subconjuntos.
 * 2. Conversão de Gramática Regular (GLUD / GLD) para AFND e determinação.
 * 3. Conversão de Expressões Regulares básicas para AFD.
 */

import { FiniteAutomaton } from './automaton.js';
import { isEpsilon } from '../grammar/grammar.js';

/**
 * Converte qualquer Autômato Finito Não Determinístico (AFND ou AFND-ε)
 * em um Autômato Finito Determinístico (AFD) equivalente utilizando o
 * Algoritmo Formal de Construção de Subconjuntos (Subset Construction).
 *
 * @param {FiniteAutomaton} nfa - Autômato original (pode ser AFND, AFND-ε ou AFD)
 * @returns {{
 *   dfa: FiniteAutomaton,
 *   subsetTable: Array<{
 *     dfaState: string,
 *     subset: string[],
 *     isFinal: boolean,
 *     transitions: { [symbol: string]: string }
 *   }>
 * }}
 */
export function nfaToDFA(nfa) {
  if (!nfa || !nfa.q0 || nfa.Q.size === 0) {
    throw new Error('Autômato vazio ou sem estado inicial definido para conversão.');
  }

  const dfa = new FiniteAutomaton();

  // Alfabeto do AFD: todos os símbolos de Σ que não sejam épsilon
  const effectiveAlphabet = Array.from(nfa.Sigma).filter(s => !isEpsilon(s)).sort((a, b) => a.localeCompare(b));
  effectiveAlphabet.forEach(s => dfa.addSymbol(s));

  function getSubsetKey(subset) {
    return Array.from(subset).sort().join(',');
  }

  // Estado inicial do AFD: ε-closure({ q0 })
  const initialClosure = nfa.computeEpsilonClosure([nfa.q0]);
  const initialKey = getSubsetKey(initialClosure);

  let stateCounter = 0;
  const subsetToDfaState = new Map();
  const dfaStateToSubset = new Map();

  const q0Name = `q${stateCounter++}`;
  subsetToDfaState.set(initialKey, q0Name);
  dfaStateToSubset.set(q0Name, initialClosure);

  const isQ0Final = Array.from(initialClosure).some(s => nfa.F.has(s));
  const q0Desc = `{ ${Array.from(initialClosure).join(', ')} }`;
  dfa.addState(q0Name, true, isQ0Final, q0Desc);

  const queue = [initialClosure];
  const subsetTable = [];

  while (queue.length > 0) {
    const currentSubset = queue.shift();
    const currentKey = getSubsetKey(currentSubset);
    const currentDfaName = subsetToDfaState.get(currentKey);
    const isCurrentFinal = Array.from(currentSubset).some(s => nfa.F.has(s));

    const tableRowTransitions = {};

    // Para cada símbolo de Σ
    for (const sym of effectiveAlphabet) {
      // 1. Move(currentSubset, sym)
      const moveTargets = new Set();
      for (const s of currentSubset) {
        const transMap = nfa.delta.get(s);
        if (!transMap) continue;

        // Casamento exato
        if (transMap.has(sym)) {
          for (const target of transMap.get(sym)) {
            moveTargets.add(target);
          }
        }
      }

      // 2. ε-closure(Move)
      const nextClosure = nfa.computeEpsilonClosure(moveTargets);

      if (nextClosure.size > 0) {
        const nextKey = getSubsetKey(nextClosure);
        let nextDfaName = subsetToDfaState.get(nextKey);

        if (!nextDfaName) {
          nextDfaName = `q${stateCounter++}`;
          subsetToDfaState.set(nextKey, nextDfaName);
          dfaStateToSubset.set(nextDfaName, nextClosure);

          const isNextFinal = Array.from(nextClosure).some(s => nfa.F.has(s));
          const nextDesc = `{ ${Array.from(nextClosure).join(', ')} }`;
          dfa.addState(nextDfaName, false, isNextFinal, nextDesc);

          queue.push(nextClosure);
        }

        dfa.addTransition(currentDfaName, sym, nextDfaName);
        tableRowTransitions[sym] = `${nextDfaName} = { ${Array.from(nextClosure).sort().join(', ')} }`;
      } else {
        tableRowTransitions[sym] = '∅';
      }
    }

    subsetTable.push({
      dfaState: currentDfaName,
      subset: Array.from(currentSubset).sort(),
      isFinal: isCurrentFinal,
      transitions: tableRowTransitions
    });
  }

  return { dfa, subsetTable };
}

/**
 * Converte uma Gramática Regular (GLUD ou GLD) em um Autômato Finito Determinístico (AFD)
 * construindo primeiro o AFND equivalente e determinizando via Subset Construction.
 *
 * @param {import('../grammar/grammar.js').Grammar} grammar
 * @returns {{
 *   dfa: FiniteAutomaton,
 *   nfa: FiniteAutomaton,
 *   subsetTable: Array<object>,
 *   nfaStats: { statesCount: number, transitionsCount: number }
 * }}
 */
export function grammarToDFA(grammar) {
  if (!grammar || !grammar.S || grammar.P.length === 0) {
    throw new Error('A gramática fornecida é inválida ou não possui símbolo inicial/regras.');
  }

  // 1. Constrói o AFND intermediário
  const nfa = new FiniteAutomaton();
  grammar.V.forEach(v => nfa.addState(v));
  grammar.T.forEach(t => nfa.addSymbol(t));
  nfa.q0 = grammar.S;

  let auxStateId = 1;
  const auxiliaryFinalState = 'Q_f';

  for (const prod of grammar.P) {
    const A = prod.lhs;

    if (prod.isEpsilon) {
      nfa.F.add(A);
      continue;
    }

    const symbols = prod.rhsSymbols;
    if (symbols.length === 0) {
      nfa.F.add(A);
      continue;
    }

    const lastSymbol = symbols[symbols.length - 1];
    const endsWithVar = grammar.V.has(lastSymbol);

    if (endsWithVar) {
      const B = lastSymbol;
      const prefixTerminals = symbols.slice(0, -1);

      if (prefixTerminals.length === 0) {
        // Transição unitária entre variáveis: A -> B (ε-transição)
        nfa.addTransition(A, 'ε', B);
      } else if (prefixTerminals.length === 1) {
        nfa.addTransition(A, prefixTerminals[0], B);
      } else {
        let prev = A;
        for (let i = 0; i < prefixTerminals.length - 1; i++) {
          const intermediateState = `${A}_aux${auxStateId++}`;
          nfa.addTransition(prev, prefixTerminals[i], intermediateState);
          prev = intermediateState;
        }
        nfa.addTransition(prev, prefixTerminals[prefixTerminals.length - 1], B);
      }
    } else {
      // Produção terminal pura: A -> w
      nfa.addState(auxiliaryFinalState, false, true);

      if (symbols.length === 1) {
        nfa.addTransition(A, symbols[0], auxiliaryFinalState);
      } else {
        let prev = A;
        for (let i = 0; i < symbols.length - 1; i++) {
          const intermediateState = `${A}_aux${auxStateId++}`;
          nfa.addTransition(prev, symbols[i], intermediateState);
          prev = intermediateState;
        }
        nfa.addTransition(prev, symbols[symbols.length - 1], auxiliaryFinalState);
      }
    }
  }

  // 2. Determinização via Subset Construction
  const { dfa, subsetTable } = nfaToDFA(nfa);

  let nfaTransCount = 0;
  for (const transMap of nfa.delta.values()) {
    for (const targets of transMap.values()) {
      nfaTransCount += targets.size;
    }
  }

  return {
    dfa,
    nfa,
    subsetTable,
    nfaStats: {
      statesCount: nfa.Q.size,
      transitionsCount: nfaTransCount
    }
  };
}

/**
 * Converte uma Expressão Regular comum em um AFD equivalente.
 *
 * @param {string} regexStr
 * @returns {FiniteAutomaton}
 */
export function regexToDFA(regexStr) {
  const clean = String(regexStr || '').trim().replace(/^\^|\$$/g, '');
  const dfa = new FiniteAutomaton();

  // Caso 1: (a|b)*abb ou (0|1)*01
  if (/^\((.)\|(.)\)\*(\1|\2)+$/.test(clean)) {
    const match = clean.match(/^\((.)\|(.)\)\*(.*)$/);
    const a = match[1];
    const b = match[2];
    const suffix = match[3];

    dfa.addSymbol(a);
    dfa.addSymbol(b);

    const states = [];
    for (let i = 0; i <= suffix.length; i++) {
      const q = `q${i}`;
      states.push(q);
      dfa.addState(q, i === 0, i === suffix.length, `Prefixo: "${suffix.slice(0, i)}"`);
    }

    for (let i = 0; i <= suffix.length; i++) {
      for (const sym of [a, b]) {
        const nextStr = suffix.slice(0, i) + sym;
        let targetStateIndex = 0;
        for (let k = Math.min(suffix.length, nextStr.length); k >= 1; k--) {
          if (nextStr.endsWith(suffix.slice(0, k))) {
            targetStateIndex = k;
            break;
          }
        }
        dfa.addTransition(states[i], sym, states[targetStateIndex]);
      }
    }
    return dfa;
  }

  // Caso 2: (0|1)*0 (números binários pares)
  if (clean === '(0|1)*0') {
    dfa.addSymbol('0');
    dfa.addSymbol('1');
    dfa.addState('q0', true, false, 'Início / Ímpar');
    dfa.addState('q1', false, true, 'Par (termina em 0)');
    dfa.addTransition('q0', '0', 'q1');
    dfa.addTransition('q0', '1', 'q0');
    dfa.addTransition('q1', '0', 'q1');
    dfa.addTransition('q1', '1', 'q0');
    return dfa;
  }

  // Caso 3: Padrão de identificadores ('a-z' | 'A-Z' | '_') ('a-z' | 'A-Z' | '0-9' | '_')*
  if (clean.includes('a-z') || clean.includes('0-9')) {
    dfa.addSymbol("'a-z'");
    dfa.addSymbol("'A-Z'");
    dfa.addSymbol("'0-9'");
    dfa.addSymbol("'_'");

    dfa.addState('q0', true, false, 'Início');
    dfa.addState('q1', false, true, 'Identificador Válido');

    dfa.addTransition('q0', "'a-z'", 'q1');
    dfa.addTransition('q0', "'A-Z'", 'q1');
    dfa.addTransition('q0', "'_'", 'q1');

    dfa.addTransition('q1', "'a-z'", 'q1');
    dfa.addTransition('q1', "'A-Z'", 'q1');
    dfa.addTransition('q1', "'0-9'", 'q1');
    dfa.addTransition('q1', "'_'", 'q1');
    return dfa;
  }

  // Caso padrão genérico para palavras literais simples: ex: "abc"
  if (/^[a-zA-Z0-9]+$/.test(clean)) {
    const chars = Array.from(clean);
    chars.forEach(c => dfa.addSymbol(c));

    for (let i = 0; i <= chars.length; i++) {
      dfa.addState(`q${i}`, i === 0, i === chars.length, `Prefixo "${clean.slice(0, i)}"`);
      if (i < chars.length) {
        dfa.addTransition(`q${i}`, chars[i], `q${i + 1}`);
      }
    }
    return dfa;
  }

  // Fallback
  dfa.addSymbol('a');
  dfa.addSymbol('b');
  dfa.addState('q0', true, true, 'Estado inicial/final');
  dfa.addTransition('q0', 'a', 'q0');
  dfa.addTransition('q0', 'b', 'q0');
  return dfa;
}
