/**
 * Motor de Derivação Sintática para Gramáticas Regulares
 *
 * Realiza a busca em largura (BFS) com poda otimizada para encontrar a derivação
 * completa de uma palavra w a partir do símbolo inicial S, construindo também
 * a árvore sintática de derivação (estilo JFLAP).
 */

import { isEpsilon } from './grammar.js';

let nodeIdCounter = 0;

/**
 * Nó da árvore de derivação sintática.
 */
export class TreeNode {
  constructor(symbol, isVariable, isTerminal, isEpsilonNode = false, stepAppeared = 0) {
    this.id = ++nodeIdCounter;
    this.symbol = symbol;
    this.isVariable = isVariable;
    this.isTerminal = isTerminal;
    this.isEpsilon = isEpsilonNode;
    this.stepAppeared = stepAppeared;
    this.children = [];
    this.parent = null;
    // Posições para renderização gráfica
    this.x = 0;
    this.y = 0;
  }

  addChild(childNode) {
    childNode.parent = this;
    this.children.push(childNode);
  }

  /**
   * Retorna as folhas da árvore até determinado passo.
   */
  getLeaves(maxStep = Infinity) {
    if (this.stepAppeared > maxStep) return [];
    if (this.children.length === 0 || this.children.every(c => c.stepAppeared > maxStep)) {
      return [this];
    }
    const leaves = [];
    for (const c of this.children) {
      leaves.push(...c.getLeaves(maxStep));
    }
    return leaves;
  }
}

/**
 * Representa um passo da derivação sintática.
 */
export class DerivationStep {
  constructor(stepNumber, sententialForm, productionApplied, variableExpanded, snapshotString, treeNodeExpandedId) {
    this.stepNumber = stepNumber;
    this.sententialForm = [...sententialForm];
    this.productionApplied = productionApplied; // Production ou null
    this.variableExpanded = variableExpanded;   // string ou null
    this.snapshotString = snapshotString;       // ex: "abA"
    this.treeNodeExpandedId = treeNodeExpandedId;
  }
}

/**
 * Resultado da busca de derivação.
 */
export class DerivationResult {
  constructor(isAccepted, word, steps = [], treeRoot = null, failureReason = '') {
    this.isAccepted = isAccepted;
    this.word = word;
    this.steps = steps;
    this.treeRoot = treeRoot;
    this.failureReason = failureReason;
  }

  /**
   * Retorna a cadeia de passos formatada formalmente:
   * S => aA => abB => abb
   */
  getFormattedDerivation() {
    if (!this.isAccepted || this.steps.length === 0) return '';
    return this.steps.map(s => s.snapshotString).join('  ⇒  ');
  }
}

/**
 * Compara um símbolo terminal da gramática (que pode ser literal ou intervalo como 'a-z', '0-9')
 * com um caractere da cadeia de teste.
 *
 * @param {string} grammarTerminal
 * @param {string} char
 * @returns {boolean}
 */
export function matchesTerminal(grammarTerminal, char) {
  if (!grammarTerminal || !char) return false;
  const clean = grammarTerminal.replace(/^['"‘’“”]|['"‘’“”]$/g, '').trim();
  const unbracketed = clean.replace(/^\[|\]$/g, '').replace(/\s+/g, '');

  // Suporte a intervalos gerais (ex: a-z, A-Z, 0-9, 0-7, a-f, etc.)
  const rangeMatch = unbracketed.match(/^([a-zA-Z0-9])-([a-zA-Z0-9])$/);
  if (rangeMatch) {
    const startCode = rangeMatch[1].charCodeAt(0);
    const endCode = rangeMatch[2].charCodeAt(0);
    const charCode = char.charCodeAt(0);
    return charCode >= startCode && charCode <= endCode;
  }

  return clean === char;
}

/**
 * Executa a busca em largura (BFS) para encontrar a derivação sintática de `word`.
 *
 * @param {import('./grammar.js').Grammar} grammar
 * @param {string} testWord - A palavra a ser derivada (ex: "abb" ou "")
 * @param {boolean} [isRightLinear=true] - Se a gramática é linear à direita (otimiza poda)
 * @returns {DerivationResult}
 */
export function deriveWord(grammar, testWord = '', isRightLinear = true) {
  let targetWord = (testWord === null || testWord === undefined) ? '' : String(testWord).trim();
  // Se o usuário colocou aspas em volta da palavra de teste (ex: 'a' ou "a"), remove para evitar rejeição espúria
  targetWord = targetWord.replace(/^['"‘’“”]|['"‘’“”]$/g, '').trim();

  const isTargetEmpty = targetWord === '' || isEpsilon(targetWord);
  const cleanTarget = isTargetEmpty ? '' : targetWord;

  // Validação básica da gramática
  if (!grammar || !grammar.S || grammar.P.length === 0) {
    return new DerivationResult(false, cleanTarget, [], null, 'Gramática vazia ou sem símbolo inicial.');
  }

  // Verifica se o usuário inseriu um intervalo literal como palavra de teste (ex: a-z ou 'a-z')
  const intervalWordMatch = cleanTarget.replace(/^\[|\]$/g, '').match(/^([a-zA-Z0-9])-([a-zA-Z0-9])$/);
  if (intervalWordMatch && !grammar.T.has(cleanTarget) && !grammar.T.has('-')) {
    return new DerivationResult(
      false,
      cleanTarget,
      [],
      null,
      `Você inseriu o intervalo "${cleanTarget}" como palavra de teste. Como "${cleanTarget}" representa um conjunto de caracteres (${intervalWordMatch[1]} a ${intervalWordMatch[2]}), para simular a derivação informe um caractere ou cadeia concreta gerada por ele (por exemplo: "${intervalWordMatch[1]}" ou "${intervalWordMatch[2]}").`
    );
  }

  // Verifica se todos os caracteres da palavra pertencem a T ou casam com intervalos de T
  for (const ch of cleanTarget) {
    const hasMatch = Array.from(grammar.T).some(t => matchesTerminal(t, ch));
    if (!hasMatch && !grammar.T.has(ch)) {
      return new DerivationResult(
        false,
        cleanTarget,
        [],
        null,
        `O símbolo "${ch}" da palavra de teste não pode ser gerado pelos símbolos terminais T = {${Array.from(grammar.T).join(', ')}}.`
      );
    }
  }

  nodeIdCounter = 0;

  // Nó raiz da árvore sintática
  const rootNode = new TreeNode(grammar.S, true, false, false, 0);

  // Fila para BFS: cada elemento representa um ramo de derivação
  const queue = [
    {
      sententialForm: [grammar.S],
      treeLeaves: [rootNode],
      steps: [
        new DerivationStep(0, [grammar.S], null, null, grammar.S, null)
      ]
    }
  ];

  const visited = new Set();
  visited.add(grammar.S);

  const MAX_ITERATIONS = 4000;
  const MAX_DEPTH = 50;
  let iterations = 0;

  while (queue.length > 0) {
    if (++iterations > MAX_ITERATIONS) {
      break;
    }

    const current = queue.shift();
    const currentForm = current.sententialForm;
    const currentLeaves = current.treeLeaves;
    const currentSteps = current.steps;

    // Encontra variáveis (não-terminais) na forma sentencial atual
    const varIndices = [];
    for (let i = 0; i < currentForm.length; i++) {
      if (grammar.V.has(currentForm[i])) {
        varIndices.push(i);
      }
    }

    // Se não há mais variáveis, a forma sentencial é composta exclusivamente de terminais
    if (varIndices.length === 0) {
      if (currentForm.length === cleanTarget.length) {
        let allMatched = true;
        for (let idx = 0; idx < currentForm.length; idx++) {
          if (!matchesTerminal(currentForm[idx], cleanTarget[idx])) {
            allMatched = false;
            break;
          }
        }
        if (allMatched) {
          // Encontrou a derivação completa com sucesso!
          layoutTree(rootNode);
          return new DerivationResult(true, cleanTarget, currentSteps, rootNode);
        }
      }
      // Chegou em terminais que não batem com o alvo; ramo morto
      continue;
    }

    if (currentSteps.length > MAX_DEPTH) {
      continue;
    }

    // Estratégia de derivação mais à esquerda (Leftmost derivation)
    const targetVarIndex = varIndices[0];
    const targetVar = currentForm[targetVarIndex];
    const targetTreeNode = currentLeaves[targetVarIndex];

    // Busca produções com LHS == targetVar
    const matchingProds = grammar.P.filter(p => p.lhs === targetVar);

    for (const prod of matchingProds) {
      // Identifica quantos terminais já foram acumulados no prefixo da forma atual
      let currentPrefixLen = 0;
      for (const s of currentForm.slice(0, targetVarIndex)) {
        if (!grammar.V.has(s)) currentPrefixLen++;
      }

      // Converte símbolos do lado direito em terminais concretos se casarem com o alvo
      const concreteRhs = [];
      let termOffset = 0;
      for (const sym of prod.rhsSymbols) {
        if (grammar.V.has(sym)) {
          concreteRhs.push(sym);
        } else {
          const matchIdx = currentPrefixLen + termOffset;
          const targetChar = cleanTarget[matchIdx];
          if (targetChar !== undefined && matchesTerminal(sym, targetChar)) {
            concreteRhs.push(targetChar); // Usa o caractere concreto da palavra de teste!
          } else {
            concreteRhs.push(sym.replace(/^['"‘’“”]|['"‘’“”]$/g, ''));
          }
          termOffset++;
        }
      }

      // Nova forma sentencial substituindo a variável pelo lado direito da produção
      const newForm = [
        ...currentForm.slice(0, targetVarIndex),
        ...(prod.isEpsilon ? [] : concreteRhs),
        ...currentForm.slice(targetVarIndex + 1)
      ];

      // Poda por tamanho de terminais excedente
      const terminalCount = newForm.filter(s => !grammar.V.has(s)).length;
      if (terminalCount > cleanTarget.length + 5) {
        continue;
      }

      // Poda por prefixo em gramáticas lineares à direita
      if (isRightLinear) {
        const prefixTerminals = [];
        for (const s of newForm) {
          if (!grammar.V.has(s)) prefixTerminals.push(s);
          else break;
        }

        // Verifica casamento prefixo por prefixo
        let prefixMismatch = false;
        for (let pIdx = 0; pIdx < prefixTerminals.length; pIdx++) {
          if (pIdx >= cleanTarget.length || !matchesTerminal(prefixTerminals[pIdx], cleanTarget[pIdx])) {
            prefixMismatch = true;
            break;
          }
        }
        if (prefixMismatch) {
          continue; // Prefixo não bate com a palavra alvo, poda ramo
        }
      }

      const formKey = newForm.join('|');
      // Evita ciclos infinitos entre as mesmas variáveis (A -> B -> A)
      if (visited.has(formKey) && newForm.length <= currentForm.length) {
        // Permite se ainda não excedeu tentativas
      }
      visited.add(formKey);

      // Cria novos nós na árvore sintática para este ramo
      const newLeaves = [...currentLeaves];
      const createdChildNodes = [];

      const stepNum = currentSteps.length;

      if (prod.isEpsilon) {
        const epsNode = new TreeNode('ε', false, true, true, stepNum);
        targetTreeNode.addChild(epsNode);
        // Substitui a folha na lista
        newLeaves.splice(targetVarIndex, 1, epsNode);
      } else {
        for (const sym of concreteRhs) {
          const isV = grammar.V.has(sym);
          const isT = !isV;
          const childNode = new TreeNode(sym, isV, isT, false, stepNum);
          targetTreeNode.addChild(childNode);
          createdChildNodes.push(childNode);
        }
        newLeaves.splice(targetVarIndex, 1, ...createdChildNodes);
      }

      const snapshot = newForm.length === 0 ? 'ε' : newForm.join('');
      const newStep = new DerivationStep(stepNum, newForm, prod, targetVar, snapshot, targetTreeNode.id);

      const nextState = {
        sententialForm: newForm,
        treeLeaves: newLeaves,
        steps: [...currentSteps, newStep]
      };

      // Se já atingiu a palavra alvo e é só de terminais, retorna imediatamente
      if (newForm.filter(s => grammar.V.has(s)).length === 0) {
        const genWord = newForm.join('');
        if (genWord === cleanTarget) {
          layoutTree(rootNode);
          return new DerivationResult(true, cleanTarget, nextState.steps, rootNode);
        }
      }

      queue.push(nextState);
    }
  }

  // Se a fila esvaziou sem encontrar a palavra
  const displayWord = cleanTarget === '' ? 'ε (vazia)' : `"${cleanTarget}"`;
  return new DerivationResult(
    false,
    cleanTarget,
    [],
    null,
    `A palavra ${displayWord} não pode ser gerada pelas regras de produção da gramática a partir do símbolo inicial ${grammar.S}.`
  );
}

/**
 * Calcula as coordenadas (x, y) de cada nó da árvore para renderização em SVG estilo JFLAP.
 *
 * @param {TreeNode} root
 */
export function layoutTree(root) {
  if (!root) return;

  // 1. Calcula larguras de subárvores e posicionamento horizontal
  let currentLeafX = 40;
  const X_SPACING = 55;
  const Y_SPACING = 65;

  function assignPositions(node, depth = 0) {
    node.y = 40 + depth * Y_SPACING;

    if (node.children.length === 0) {
      node.x = currentLeafX;
      currentLeafX += X_SPACING;
      return;
    }

    for (const child of node.children) {
      assignPositions(child, depth + 1);
    }

    // O pai fica centralizado entre o primeiro e o último filho
    const firstX = node.children[0].x;
    const lastX = node.children[node.children.length - 1].x;
    node.x = (firstX + lastX) / 2;
  }

  assignPositions(root, 0);
}
