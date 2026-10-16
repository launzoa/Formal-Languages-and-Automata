/**
 * Classificador Formal de Gramáticas Regulares
 *
 * Classifica formalmente a gramática G = (V, T, P, S) em:
 * - GLUD: Gramática Linear Unitária à Direita (A -> aB | a | B | ε)
 * - GLUE: Gramática Linear Unitária à Esquerda (A -> Ba | a | B | ε)
 * - GLD:  Gramática Linear à Direita (A -> wB | w, com |w| >= 0)
 * - GLE:  Gramática Linear à Esquerda (A -> Bw | w, com |w| >= 0)
 * - Não Regular: Produções com variáveis no meio, múltiplas variáveis ou direções mistas.
 */

export const GrammarType = {
  GLUD: 'GLUD',
  GLUE: 'GLUE',
  GLD: 'GLD',
  GLE: 'GLE',
  GLUD_GLUE: 'GLUD / GLUE',
  GLD_GLE: 'GLD / GLE',
  NON_REGULAR: 'NÃO REGULAR'
};

/**
 * Analisa individualmente uma produção e determina sua conformidade linear.
 *
 * @param {import('./grammar.js').Production} production
 * @param {import('./grammar.js').Grammar} grammar
 * @returns {{
 *   isRightLinear: boolean,
 *   isLeftLinear: boolean,
 *   isRightUnitary: boolean,
 *   isLeftUnitary: boolean,
 *   details: string,
 *   variableCount: number,
 *   terminalCount: number
 * }}
 */
export function analyzeProduction(production, grammar) {
  const { rhsSymbols, isEpsilon, lhs } = production;

  // Se for epsilon (A -> ε): é unitária tanto à direita quanto à esquerda
  if (isEpsilon) {
    return {
      isRightLinear: true,
      isLeftLinear: true,
      isRightUnitary: true,
      isLeftUnitary: true,
      details: 'Produção vazia (A → ε). Válida em GLUD e GLUE.',
      variableCount: 0,
      terminalCount: 0
    };
  }

  const variables = [];
  const terminals = [];
  for (let idx = 0; idx < rhsSymbols.length; idx++) {
    const sym = rhsSymbols[idx];
    if (grammar.V.has(sym)) {
      variables.push({ sym, index: idx });
    } else {
      terminals.push({ sym, index: idx });
    }
  }

  const varCount = variables.length;
  const termCount = terminals.length;

  // Caso 1: Mais de uma variável no lado direito (A -> BC ou A -> aAbB)
  if (varCount > 1) {
    return {
      isRightLinear: false,
      isLeftLinear: false,
      isRightUnitary: false,
      isLeftUnitary: false,
      details: `Possui ${varCount} variáveis no lado direito (${variables.map(v => v.sym).join(', ')}). Não é regular (Livre de Contexto).`,
      variableCount: varCount,
      terminalCount: termCount
    };
  }

  // Caso 2: Apenas terminais no lado direito (A -> w)
  if (varCount === 0) {
    const isUnitary = termCount <= 1;
    return {
      isRightLinear: true,
      isLeftLinear: true,
      isRightUnitary: isUnitary,
      isLeftUnitary: isUnitary,
      details: isUnitary
        ? (termCount === 1 ? 'Terminal único (A → a). Unitária à direita e à esquerda.' : 'Palavra vazia.')
        : `Cadeia de terminais (|w| = ${termCount}). Linear à direita e à esquerda, porém não-unitária (|w| > 1).`,
      variableCount: 0,
      terminalCount: termCount
    };
  }

  // Caso 3: Exatamente uma variável no lado direito (varCount === 1)
  const varPos = variables[0].index;
  const lastIndex = rhsSymbols.length - 1;

  // Subcaso 3a: Apenas uma variável isolada (A -> B, produção unitária entre variáveis)
  if (rhsSymbols.length === 1) {
    return {
      isRightLinear: true,
      isLeftLinear: true,
      isRightUnitary: true,
      isLeftUnitary: true,
      details: `Transição unitária de variáveis (${lhs} → ${variables[0].sym}). Válida em GLUD e GLUE.`,
      variableCount: 1,
      terminalCount: 0
    };
  }

  // Subcaso 3b: A variável está no final do lado direito (A -> wB) -> Linear à Direita
  if (varPos === lastIndex) {
    const isUnitary = termCount === 1; // Exatamente 1 terminal antes da variável (A -> aB)
    return {
      isRightLinear: true,
      isLeftLinear: false,
      isRightUnitary: isUnitary,
      isLeftUnitary: false,
      details: isUnitary
        ? `Forma unitária à direita (${lhs} → a${variables[0].sym}).`
        : `Forma linear à direita com cadeia de terminais (${lhs} → w${variables[0].sym}, |w| = ${termCount}).`,
      variableCount: 1,
      terminalCount: termCount
    };
  }

  // Subcaso 3c: A variável está no início do lado direito (A -> Bw) -> Linear à Esquerda
  if (varPos === 0) {
    const isUnitary = termCount === 1; // Exatamente 1 terminal após a variável (A -> Ba)
    return {
      isRightLinear: false,
      isLeftLinear: true,
      isRightUnitary: false,
      isLeftUnitary: isUnitary,
      details: isUnitary
        ? `Forma unitária à esquerda (${lhs} → ${variables[0].sym}a).`
        : `Forma linear à esquerda com cadeia de terminais (${lhs} → ${variables[0].sym}w, |w| = ${termCount}).`,
      variableCount: 1,
      terminalCount: termCount
    };
  }

  // Subcaso 3d: A variável está cercada por terminais (A -> aBb)
  return {
    isRightLinear: false,
    isLeftLinear: false,
    isRightUnitary: false,
    isLeftUnitary: false,
    details: `Variável ${variables[0].sym} cercada por terminais (${lhs} → u${variables[0].sym}v). Não é linear regular.`,
    variableCount: 1,
    terminalCount: termCount
  };
}

/**
 * Classifica formalmente toda a gramática e gera o diagnóstico detalhado.
 *
 * @param {import('./grammar.js').Grammar} grammar
 * @returns {{
 *   type: string,
 *   badge: string,
 *   title: string,
 *   description: string,
 *   isRegular: boolean,
 *   isRightLinear: boolean,
 *   isLeftLinear: boolean,
 *   isUnitary: boolean,
 *   analysis: Array<{ production: import('./grammar.js').Production, analysis: ReturnType<typeof analyzeProduction> }>,
 *   reasons: string[]
 * }}
 */
export function classifyGrammar(grammar) {
  if (!grammar || grammar.P.length === 0) {
    return {
      type: GrammarType.NON_REGULAR,
      badge: 'Indefinida',
      title: 'Gramática Vazia ou Inválida',
      description: 'Nenhuma produção definida para classificar.',
      isRegular: false,
      isRightLinear: false,
      isLeftLinear: false,
      isUnitary: false,
      analysis: [],
      reasons: ['A gramática não possui regras de produção válidas.']
    };
  }

  const analysis = grammar.P.map(p => ({
    production: p,
    analysis: analyzeProduction(p, grammar)
  }));

  const allRightLinear = analysis.every(item => item.analysis.isRightLinear);
  const allLeftLinear = analysis.every(item => item.analysis.isLeftLinear);
  const allRightUnitary = analysis.every(item => item.analysis.isRightUnitary);
  const allLeftUnitary = analysis.every(item => item.analysis.isLeftUnitary);

  const reasons = [];

  // 1. Ambas Unitárias (somente A -> a ou A -> ε ou A -> B)
  if (allRightUnitary && allLeftUnitary) {
    return {
      type: GrammarType.GLUD_GLUE,
      badge: 'GLUD / GLUE',
      title: 'Gramática Linear Unitária (Direita e Esquerda)',
      description: 'Todas as produções possuem no máximo um terminal ou são unitárias. Satisfaz simultaneamente os requisitos de GLUD e GLUE.',
      isRegular: true,
      isRightLinear: true,
      isLeftLinear: true,
      isUnitary: true,
      analysis,
      reasons: ['Todas as produções são da forma A → a, A → B ou A → ε.']
    };
  }

  // 2. GLUD estrita
  if (allRightLinear && allRightUnitary) {
    return {
      type: GrammarType.GLUD,
      badge: 'GLUD',
      title: 'GLUD - Gramática Linear Unitária à Direita',
      description: 'Todas as produções são da forma A → aB, A → a, A → B ou A → ε (com no máximo 1 terminal antes da variável).',
      isRegular: true,
      isRightLinear: true,
      isLeftLinear: false,
      isUnitary: true,
      analysis,
      reasons: ['Todas as produções possuem a variável na extremidade direita com no máximo 1 terminal precedente.']
    };
  }

  // 3. GLUE estrita
  if (allLeftLinear && allLeftUnitary) {
    return {
      type: GrammarType.GLUE,
      badge: 'GLUE',
      title: 'GLUE - Gramática Linear Unitária à Esquerda',
      description: 'Todas as produções são da forma A → Ba, A → a, A → B ou A → ε (com no máximo 1 terminal após a variável).',
      isRegular: true,
      isRightLinear: false,
      isLeftLinear: true,
      isUnitary: true,
      analysis,
      reasons: ['Todas as produções possuem a variável na extremidade esquerda com no máximo 1 terminal sucessor.']
    };
  }

  // 4. Ambas Lineares não-unitárias (apenas terminais mais longos A -> w, sem variáveis)
  if (allRightLinear && allLeftLinear) {
    return {
      type: GrammarType.GLD_GLE,
      badge: 'GLD / GLE',
      title: 'Gramática Linear (Direita e Esquerda - Não-Unitária)',
      description: 'Todas as produções contêm apenas cadeias de terminais. É linear à direita e à esquerda, porém não unitária.',
      isRegular: true,
      isRightLinear: true,
      isLeftLinear: true,
      isUnitary: false,
      analysis,
      reasons: ['Produções contêm cadeias com mais de 1 terminal e nenhuma variável no lado direito.']
    };
  }

  // 5. GLD (Linear à Direita não unitária)
  if (allRightLinear) {
    return {
      type: GrammarType.GLD,
      badge: 'GLD',
      title: 'GLD - Gramática Linear à Direita',
      description: 'Todas as produções são da forma A → wB ou A → w. Contém cadeias com mais de 1 terminal (|w| > 1), não sendo estritamente unitária.',
      isRegular: true,
      isRightLinear: true,
      isLeftLinear: false,
      isUnitary: false,
      analysis,
      reasons: ['As variáveis aparecem exclusivamente no final do lado direito, mas existem produções com mais de um terminal (|w| > 1).']
    };
  }

  // 6. GLE (Linear à Esquerda não unitária)
  if (allLeftLinear) {
    return {
      type: GrammarType.GLE,
      badge: 'GLE',
      title: 'GLE - Gramática Linear à Esquerda',
      description: 'Todas as produções são da forma A → Bw ou A → w. Contém cadeias com mais de 1 terminal (|w| > 1), não sendo estritamente unitária.',
      isRegular: true,
      isRightLinear: false,
      isLeftLinear: true,
      isUnitary: false,
      analysis,
      reasons: ['As variáveis aparecem exclusivamente no início do lado direito, mas existem produções com mais de um terminal (|w| > 1).']
    };
  }

  // 7. Não Regular
  const nonLinearProds = analysis.filter(item => !item.analysis.isRightLinear && !item.analysis.isLeftLinear);
  const rightOnlyProds = analysis.filter(item => item.analysis.isRightLinear && !item.analysis.isLeftLinear);
  const leftOnlyProds = analysis.filter(item => item.analysis.isLeftLinear && !item.analysis.isRightLinear);

  if (rightOnlyProds.length > 0 && leftOnlyProds.length > 0) {
    reasons.push('A gramática mistura produções lineares à direita com produções lineares à esquerda (ex: A → aB e C → Da).');
  }

  for (const item of nonLinearProds) {
    reasons.push(`Produção "${item.production.toString()}": ${item.analysis.details}`);
  }

  return {
    type: GrammarType.NON_REGULAR,
    badge: 'Não Regular',
    title: 'Gramática Não Regular (Livre de Contexto / Irrestrita)',
    description: 'A gramática não se enquadra na definição de Gramática Regular (Tipo 3 da Hierarquia de Chomsky).',
    isRegular: false,
    isRightLinear: false,
    isLeftLinear: false,
    isUnitary: false,
    analysis,
    reasons: reasons.length > 0 ? reasons : ['A gramática viola as restrições de linearidade regular.']
  };
}
