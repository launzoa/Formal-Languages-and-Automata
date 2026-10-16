/**
 * Interface e Controlador Visual do Simulador de Gramática Regular
 *
 * Gerencia a renderização dos formulários, classificação formal (GLD, GLE, GLUD, GLUE),
 * player interativo de passos (estilo JFLAP), tabela de derivação e árvore sintática em SVG.
 */

import { Grammar } from './grammar.js';
import { classifyGrammar, GrammarType } from './classifier.js';
import { deriveWord } from './derivation.js';
import { loadDFAFromGrammar } from '../automaton/automaton-ui.js';

// Exemplos pré-configurados para a demonstração e aprendizado
export const GRAMMAR_EXAMPLES = [
  {
    id: 'glud-1',
    name: '1. GLUD: Cadeias com "abb" no final (a|b)*abb',
    type: 'GLUD',
    V: 'S, A, B',
    T: 'a, b',
    P: 'S -> aS | bS | aA\nA -> bB\nB -> b',
    S: 'S',
    sampleWord: 'ababb'
  },
  {
    id: 'glud-2',
    name: '2. GLUD: Números binários pares (0|1)*0',
    type: 'GLUD',
    V: 'S, A',
    T: '0, 1',
    P: 'S -> 0S | 1S | 0A\nA -> ε',
    S: 'S',
    sampleWord: '1010'
  },
  {
    id: 'glud-identificadores',
    name: '3. GLUD: Identificadores (letras, dígitos e _)',
    type: 'GLUD',
    V: 'S, A, B, C',
    T: "'a-z', 'A-Z', '0-9', '_'",
    P: "S -> 'a-z'B | 'A-Z'B | '_'A\nA -> 'a-z'B | 'A-Z'B | '0-9'B | '_'C | ε\nB -> 'a-z'B | 'A-Z'B | '0-9'B | '_'C | ε\nC -> 'a-z'B | 'A-Z'B | '0-9'B | '_'C",
    S: 'S',
    sampleWord: '_var1'
  },
  {
    id: 'gld-1',
    name: '3. GLD: Linear à Direita não-unitária (|w| > 1)',
    type: 'GLD',
    V: 'S, A',
    T: 'a, b, c',
    P: 'S -> abA | c\nA -> bcS | c',
    S: 'S',
    sampleWord: 'abbcc'
  },
  {
    id: 'glue-1',
    name: '4. GLUE: Linear Unitária à Esquerda',
    type: 'GLUE',
    V: 'S, A',
    T: 'a, b',
    P: 'S -> Aa | b\nA -> Sb | a',
    S: 'S',
    sampleWord: 'bba'
  },
  {
    id: 'gle-1',
    name: '5. GLE: Linear à Esquerda não-unitária (|w| > 1)',
    type: 'GLE',
    V: 'S, A',
    T: 'a, b, c',
    P: 'S -> Aab | c\nA -> Sbc | c',
    S: 'S',
    sampleWord: 'cab'
  },
  {
    id: 'nonreg-cfg',
    name: '6. Não Regular: Livre de Contexto aⁿbⁿ (S -> aSb | ε)',
    type: 'Não Regular',
    V: 'S',
    T: 'a, b',
    P: 'S -> aSb | ε',
    S: 'S',
    sampleWord: 'aabb'
  },
  {
    id: 'nonreg-mixed',
    name: '7. Não Regular: Mistura Direita e Esquerda (A -> aB e C -> Da)',
    type: 'Não Regular',
    V: 'S, A, B',
    T: 'a, b',
    P: 'S -> aA | b\nA -> Bb\nB -> b',
    S: 'S',
    sampleWord: 'abb'
  }
];

// Estado da simulação atual
let currentDerivationResult = null;
let currentStepIndex = 0;
let autoPlayTimer = null;

// Elementos do DOM cacheados
let dom = null;

export function initGrammarUI() {
  dom = {
    form: document.getElementById('grammar-form'),
    vInput: document.getElementById('grammar-v-input'),
    tInput: document.getElementById('grammar-t-input'),
    pInput: document.getElementById('grammar-p-input'),
    sInput: document.getElementById('grammar-s-input'),
    wordInput: document.getElementById('grammar-word-input'),
    exampleSelect: document.getElementById('grammar-example-select'),
    btnClassify: document.getElementById('btn-classify-grammar'),
    btnDerive: document.getElementById('btn-derive-word'),
    btnConvertToDFA: document.getElementById('btn-convert-grammar-to-dfa'),
    btnClear: document.getElementById('btn-grammar-clear'),
    btnInsertEpsilon: document.getElementById('btn-insert-epsilon'),
    btnWordEpsilon: document.getElementById('btn-word-epsilon'),

    // Painéis de saída
    classificationPanel: document.getElementById('grammar-classification-panel'),
    classificationBadge: document.getElementById('grammar-classification-badge'),
    classificationTitle: document.getElementById('grammar-classification-title'),
    classificationDesc: document.getElementById('grammar-classification-desc'),
    classificationRulesList: document.getElementById('grammar-classification-rules'),
    classificationAlerts: document.getElementById('grammar-classification-alerts'),

    // Painel de derivação
    derivationPanel: document.getElementById('grammar-derivation-panel'),
    derivationStatusBadge: document.getElementById('derivation-status-badge'),
    derivationMessage: document.getElementById('derivation-status-message'),
    derivationChain: document.getElementById('derivation-chain-display'),
    derivationPlayer: document.getElementById('derivation-player'),

    // Controles do player
    stepCounter: document.getElementById('player-step-counter'),
    btnFirst: document.getElementById('btn-player-first'),
    btnPrev: document.getElementById('btn-player-prev'),
    btnPlay: document.getElementById('btn-player-play'),
    btnNext: document.getElementById('btn-player-next'),
    btnLast: document.getElementById('btn-player-last'),

    // Visualizadores
    treeContainer: document.getElementById('derivation-tree-container'),
    stepsTableBody: document.getElementById('derivation-steps-tbody')
  };

  if (!dom.form) return;

  // Popula o select de exemplos
  populateExamples();

  // Event Listeners
  dom.exampleSelect.addEventListener('change', onExampleChange);

  dom.btnClassify.addEventListener('click', (e) => {
    e.preventDefault();
    handleClassify();
  });

  dom.btnDerive.addEventListener('click', (e) => {
    e.preventDefault();
    handleDerive();
  });

  if (dom.btnConvertToDFA) {
    dom.btnConvertToDFA.addEventListener('click', (e) => {
      e.preventDefault();
      const parsed = parseCurrentGrammar();
      if (!parsed.isValid) {
        showClassificationErrors(parsed.errors);
        return;
      }
      const sampleWord = dom.wordInput.value;
      const tabAutomaton = document.getElementById('tab-automaton');
      if (tabAutomaton) tabAutomaton.click();
      loadDFAFromGrammar(parsed.grammar, sampleWord);
    });
  }

  dom.btnClear.addEventListener('click', () => {
    resetGrammarUI();
  });

  if (dom.btnInsertEpsilon) {
    dom.btnInsertEpsilon.addEventListener('click', () => {
      insertAtCursor(dom.pInput, 'ε');
    });
  }

  if (dom.btnWordEpsilon) {
    dom.btnWordEpsilon.addEventListener('click', () => {
      dom.wordInput.value = 'ε';
      handleDerive();
    });
  }

  // Controles do Player de Derivação
  dom.btnFirst.addEventListener('click', () => goToStep(0));
  dom.btnPrev.addEventListener('click', () => goToStep(currentStepIndex - 1));
  dom.btnNext.addEventListener('click', () => goToStep(currentStepIndex + 1));
  dom.btnLast.addEventListener('click', () => {
    if (currentDerivationResult && currentDerivationResult.steps) {
      goToStep(currentDerivationResult.steps.length - 1);
    }
  });
  dom.btnPlay.addEventListener('click', toggleAutoPlay);

  // Carrega o primeiro exemplo por padrão para conveniência
  loadExample(GRAMMAR_EXAMPLES[0]);
}

function populateExamples() {
  if (!dom.exampleSelect) return;
  dom.exampleSelect.innerHTML = '<option value="">-- Selecione um exemplo pronto para carregar --</option>';
  for (const ex of GRAMMAR_EXAMPLES) {
    const opt = document.createElement('option');
    opt.value = ex.id;
    opt.textContent = `[${ex.type}] ${ex.name}`;
    dom.exampleSelect.appendChild(opt);
  }
}

function onExampleChange(e) {
  const selectedId = e.target.value;
  if (!selectedId) return;
  const ex = GRAMMAR_EXAMPLES.find(item => item.id === selectedId);
  if (ex) {
    loadExample(ex);
  }
}

function loadExample(ex) {
  dom.vInput.value = ex.V;
  dom.tInput.value = ex.T;
  dom.pInput.value = ex.P;
  dom.sInput.value = ex.S;
  dom.wordInput.value = ex.sampleWord;
  dom.exampleSelect.value = ex.id;

  // Executa automaticamente classificação e derivação ao selecionar exemplo
  handleClassify();
  handleDerive();
}

function insertAtCursor(input, text) {
  const start = input.selectionStart || input.value.length;
  const end = input.selectionEnd || input.value.length;
  const current = input.value;
  input.value = current.substring(0, start) + text + current.substring(end);
  input.selectionStart = input.selectionEnd = start + text.length;
  input.focus();
}

export function handleClassify() {
  const parsed = parseCurrentGrammar();
  if (!parsed.isValid) {
    showClassificationErrors(parsed.errors);
    return null;
  }

  const classification = classifyGrammar(parsed.grammar);
  renderClassification(classification, parsed.warnings);
  return { grammar: parsed.grammar, classification };
}

export function handleDerive() {
  stopAutoPlay();

  // Classifica primeiro para ter os dados da gramática
  const classResult = handleClassify();
  if (!classResult) return;

  const { grammar, classification } = classResult;
  const testWord = dom.wordInput.value;

  const isRightLinear = classification.isRightLinear || !classification.isLeftLinear;
  const result = deriveWord(grammar, testWord, isRightLinear);
  currentDerivationResult = result;

  renderDerivation(result, testWord);

  if (result.isAccepted && result.steps.length > 0) {
    goToStep(0);
  }
}

function parseCurrentGrammar() {
  const vText = dom.vInput.value;
  const tText = dom.tInput.value;
  const pText = dom.pInput.value;
  const sText = dom.sInput.value;

  return Grammar.parse(vText, tText, pText, sText);
}

function showClassificationErrors(errors) {
  dom.classificationPanel.style.display = 'block';
  dom.classificationBadge.className = 'classification-badge type-non-regular';
  dom.classificationBadge.textContent = 'Erro de Definição';
  dom.classificationTitle.textContent = 'A Gramática contém inconsistências formais';
  dom.classificationDesc.textContent = 'Corrija os erros listados abaixo para que a gramática possa ser classificada.';

  dom.classificationRulesList.innerHTML = '';
  dom.classificationAlerts.innerHTML = errors.map(err => `<div class="grammar-alert error">✖ ${err}</div>`).join('');
  dom.derivationPanel.style.display = 'none';
}

function renderClassification(classification, warnings = []) {
  dom.classificationPanel.style.display = 'block';

  // Define a classe CSS do badge
  let badgeClass = 'type-regular';
  if (classification.type === GrammarType.NON_REGULAR) {
    badgeClass = 'type-non-regular';
  } else if (classification.type === GrammarType.GLUD || classification.type === GrammarType.GLUD_GLUE) {
    badgeClass = 'type-glud';
  } else if (classification.type === GrammarType.GLUE) {
    badgeClass = 'type-glue';
  } else if (classification.type === GrammarType.GLD) {
    badgeClass = 'type-gld';
  } else if (classification.type === GrammarType.GLE) {
    badgeClass = 'type-gle';
  }

  dom.classificationBadge.className = `classification-badge ${badgeClass}`;
  dom.classificationBadge.textContent = classification.badge;
  dom.classificationTitle.textContent = classification.title;
  dom.classificationDesc.textContent = classification.description;

  // Renderiza a lista de regras com detalhes
  dom.classificationRulesList.innerHTML = '';
  for (const item of classification.analysis) {
    const li = document.createElement('li');
    li.className = 'rule-item';

    let ruleStatusTag = '<span class="rule-tag tag-valid">✔ Regular</span>';
    if (!item.analysis.isRightLinear && !item.analysis.isLeftLinear) {
      ruleStatusTag = '<span class="rule-tag tag-invalid">✖ Não Linear</span>';
    } else if (item.analysis.isRightUnitary || item.analysis.isLeftUnitary) {
      ruleStatusTag = '<span class="rule-tag tag-unitary">✔ Unitária</span>';
    }

    li.innerHTML = `
      <div class="rule-text"><code>${item.production.toString()}</code></div>
      <div class="rule-details">${item.analysis.details}</div>
      ${ruleStatusTag}
    `;
    dom.classificationRulesList.appendChild(li);
  }

  // Renderiza alertas/avisos
  let alertsHtml = '';
  if (classification.reasons && classification.reasons.length > 0 && !classification.isRegular) {
    alertsHtml += classification.reasons.map(r => `<div class="grammar-alert error">✖ ${r}</div>`).join('');
  }
  if (warnings && warnings.length > 0) {
    alertsHtml += warnings.map(w => `<div class="grammar-alert warning">⚠ ${w}</div>`).join('');
  }
  dom.classificationAlerts.innerHTML = alertsHtml;
}

function renderDerivation(result, rawWordInput) {
  dom.derivationPanel.style.display = 'block';

  const cleanDisplayWord = (!rawWordInput || rawWordInput === 'ε') ? 'ε (Palavra Vazia)' : `"${rawWordInput}"`;

  if (result.isAccepted) {
    dom.derivationStatusBadge.className = 'status-badge is-valid';
    dom.derivationStatusBadge.textContent = 'Cadeia Aceita ✔';
    dom.derivationMessage.textContent = `A palavra ${cleanDisplayWord} é gerada com sucesso pela gramática em ${result.steps.length - 1} passos de derivação.`;
    dom.derivationChain.textContent = result.getFormattedDerivation();
    dom.derivationChain.style.display = 'block';
    dom.derivationPlayer.style.display = 'flex';
    dom.treeContainer.style.display = 'block';
    dom.stepsTableBody.parentElement.style.display = 'table';
    renderStepsTable(result.steps);
  } else {
    dom.derivationStatusBadge.className = 'status-badge is-invalid';
    dom.derivationStatusBadge.textContent = 'Cadeia Rejeitada ✖';
    dom.derivationMessage.textContent = result.failureReason || `A palavra ${cleanDisplayWord} NÃO pode ser gerada pela gramática.`;
    dom.derivationChain.style.display = 'none';
    dom.derivationPlayer.style.display = 'none';
    dom.treeContainer.style.display = 'none';
    dom.stepsTableBody.parentElement.style.display = 'none';
  }
}

function renderStepsTable(steps) {
  dom.stepsTableBody.innerHTML = '';
  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    const tr = document.createElement('tr');
    tr.id = `step-row-${i}`;
    tr.className = 'step-row';
    tr.addEventListener('click', () => goToStep(i));

    const prodText = step.productionApplied ? step.productionApplied.toString() : '<em>(Inicial)</em>';
    const varText = step.variableExpanded ? `<code>${step.variableExpanded}</code>` : '—';

    tr.innerHTML = `
      <td class="step-num">${step.stepNumber}</td>
      <td class="step-sentential"><code>${step.snapshotString}</code></td>
      <td class="step-rule"><code>${prodText}</code></td>
      <td class="step-var">${varText}</td>
    `;
    dom.stepsTableBody.appendChild(tr);
  }
}

function goToStep(index) {
  if (!currentDerivationResult || !currentDerivationResult.steps || currentDerivationResult.steps.length === 0) return;

  const totalSteps = currentDerivationResult.steps.length;
  if (index < 0) index = 0;
  if (index >= totalSteps) index = totalSteps - 1;

  currentStepIndex = index;

  // Atualiza contador do player
  dom.stepCounter.textContent = `Passo ${currentStepIndex} de ${totalSteps - 1}`;

  // Atualiza estado dos botões
  dom.btnFirst.disabled = currentStepIndex === 0;
  dom.btnPrev.disabled = currentStepIndex === 0;
  dom.btnNext.disabled = currentStepIndex === totalSteps - 1;
  dom.btnLast.disabled = currentStepIndex === totalSteps - 1;

  // Destaca a linha da tabela
  const rows = dom.stepsTableBody.querySelectorAll('.step-row');
  rows.forEach((row, i) => {
    if (i === currentStepIndex) {
      row.classList.add('active-step-row');
      row.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    } else {
      row.classList.remove('active-step-row');
    }
  });

  // Atualiza a árvore SVG
  renderTreeSVG(currentDerivationResult.treeRoot, currentStepIndex);
}

function toggleAutoPlay() {
  if (autoPlayTimer) {
    stopAutoPlay();
  } else {
    startAutoPlay();
  }
}

function startAutoPlay() {
  if (!currentDerivationResult || !currentDerivationResult.steps) return;
  dom.btnPlay.textContent = '⏸ Pausar';
  dom.btnPlay.classList.add('is-playing');

  // Se já estiver no fim, recomeça do início
  if (currentStepIndex >= currentDerivationResult.steps.length - 1) {
    goToStep(0);
  }

  autoPlayTimer = setInterval(() => {
    if (currentStepIndex < currentDerivationResult.steps.length - 1) {
      goToStep(currentStepIndex + 1);
    } else {
      stopAutoPlay();
    }
  }, 1200);
}

function stopAutoPlay() {
  if (autoPlayTimer) {
    clearInterval(autoPlayTimer);
    autoPlayTimer = null;
  }
  if (dom && dom.btnPlay) {
    dom.btnPlay.textContent = '▶ Reproduzir';
    dom.btnPlay.classList.remove('is-playing');
  }
}

/**
 * Renderiza dinamicamente a árvore sintática em SVG (estilo JFLAP)
 * exibindo apenas os nós gerados até o passo indicado.
 */
function renderTreeSVG(root, maxStep) {
  if (!root || !dom.treeContainer) return;

  // Encontra os limites das coordenadas para ajustar o viewBox
  let minX = Infinity, maxX = -Infinity, maxY = -Infinity;

  function findBounds(node) {
    if (node.stepAppeared > maxStep) return;
    minX = Math.min(minX, node.x);
    maxX = Math.max(maxX, node.x);
    maxY = Math.max(maxY, node.y);
    for (const child of node.children) {
      findBounds(child);
    }
  }

  findBounds(root);

  const padding = 50;
  const svgWidth = Math.max(500, (maxX - minX) + padding * 2);
  const svgHeight = Math.max(220, maxY + padding + 20);

  // Ajuste de offset X para centralizar
  const offsetX = (svgWidth - (maxX - minX)) / 2 - minX;

  const lines = [];
  const nodes = [];

  function drawNode(node) {
    if (node.stepAppeared > maxStep) return;

    const posX = node.x + offsetX;
    const posY = node.y;

    // Desenha arestas para os filhos visíveis
    for (const child of node.children) {
      if (child.stepAppeared <= maxStep) {
        const childX = child.x + offsetX;
        const childY = child.y;
        lines.push(`
          <line x1="${posX}" y1="${posY}" x2="${childX}" y2="${childY}"
                stroke="#94a3b8" stroke-width="2.5" stroke-linecap="round" />
        `);
        drawNode(child);
      }
    }

    // Estilo do nó conforme sua natureza formal
    let fillColor = '#2563eb'; // Variável: Azul JFLAP
    let strokeColor = '#1d4ed8';
    let textColor = '#ffffff';
    let nodeRadius = 18;

    if (node.isTerminal) {
      if (node.isEpsilon) {
        fillColor = '#64748b'; // Épsilon: Cinza ardósia
        strokeColor = '#475569';
      } else {
        fillColor = '#16a34a'; // Terminal: Verde sucesso
        strokeColor = '#15803d';
      }
    }

    // Se foi o nó expandido neste passo, adiciona um anel de destaque
    const currentStepObj = currentDerivationResult.steps[maxStep];
    const isRecentlyExpanded = currentStepObj && currentStepObj.treeNodeExpandedId === node.id;
    const highlightRing = isRecentlyExpanded ? `
      <circle cx="${posX}" cy="${posY}" r="${nodeRadius + 6}" fill="none" stroke="#f59e0b" stroke-width="3" stroke-dasharray="4,3">
        <animate attributeName="stroke-dashoffset" from="0" to="14" dur="1s" repeatCount="indefinite" />
      </circle>
    ` : '';

    nodes.push(`
      <g class="tree-node-group" data-node-id="${node.id}">
        ${highlightRing}
        <circle cx="${posX}" cy="${posY}" r="${nodeRadius}" fill="${fillColor}" stroke="${strokeColor}" stroke-width="2" />
        <text x="${posX}" y="${posY}" text-anchor="middle" dominant-baseline="central"
              fill="${textColor}" font-weight="700" font-size="14px" font-family="monospace">
          ${node.symbol}
        </text>
      </g>
    `);
  }

  drawNode(root);

  dom.treeContainer.innerHTML = `
    <svg viewBox="0 0 ${svgWidth} ${svgHeight}" class="derivation-svg" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <filter id="node-shadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="2" stdDeviation="3" flood-color="#000000" flood-opacity="0.15" />
        </filter>
      </defs>
      <g class="tree-edges">
        ${lines.join('')}
      </g>
      <g class="tree-nodes" filter="url(#node-shadow)">
        ${nodes.join('')}
      </g>
    </svg>
    <div class="tree-legend">
      <span class="legend-item"><span class="legend-badge var-badge">V</span> Variável (Não-Terminal)</span>
      <span class="legend-item"><span class="legend-badge term-badge">T</span> Terminal</span>
      <span class="legend-item"><span class="legend-badge eps-badge">ε</span> Palavra Vazia</span>
      <span class="legend-item"><span class="legend-badge highlight-badge">◎</span> Nó em Expansão</span>
    </div>
  `;
}

export function resetGrammarUI() {
  stopAutoPlay();
  dom.vInput.value = '';
  dom.tInput.value = '';
  dom.pInput.value = '';
  dom.sInput.value = '';
  dom.wordInput.value = '';
  dom.exampleSelect.value = '';

  dom.classificationPanel.style.display = 'none';
  dom.derivationPanel.style.display = 'none';
  currentDerivationResult = null;
  currentStepIndex = 0;
}
