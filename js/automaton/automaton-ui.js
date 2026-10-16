/**
 * Interface e Visualização do Simulador de Autômatos Finitos (AFD, AFND e AFND-ε)
 *
 * Gerencia a renderização do diagrama de estados em SVG (estilo JFLAP),
 * tabela de transição δ com conjuntos de estados, tabela de subconjuntos,
 * fita de processamento e player interativo de passos com destaque multi-nós.
 */

import { FiniteAutomaton, DFA } from './automaton.js';
import { grammarToDFA, regexToDFA, nfaToDFA } from './converters.js';
import { isEpsilon } from '../grammar/grammar.js';

// Exemplos pré-configurados de AFD, AFND e AFND-ε para demonstração e estudo
export const AUTOMATON_EXAMPLES = [
  {
    id: 'nfa-sub-abb',
    name: '1. AFND: Contém ou termina com "abb" (a, b)*abb',
    Q: 'q0, q1, q2, q3',
    Sigma: 'a, b',
    q0: 'q0',
    F: 'q3',
    delta: `q0, a -> q0, q1
q0, b -> q0
q1, b -> q2
q2, b -> q3`,
    sampleWord: 'ababb'
  },
  {
    id: 'nfa-eps-union',
    name: '2. AFND-ε: União a* ∪ b* com transições-ε',
    Q: 'q0, q1, q2',
    Sigma: 'a, b',
    q0: 'q0',
    F: 'q1, q2',
    delta: `q0, ε -> q1, q2
q1, a -> q1
q2, b -> q2`,
    sampleWord: 'aaa'
  },
  {
    id: 'nfa-penult-a',
    name: '3. AFND: Palavras com penúltimo símbolo "a" (a|b)*a(a|b)',
    Q: 'q0, q1, q2',
    Sigma: 'a, b',
    q0: 'q0',
    F: 'q2',
    delta: `q0, a -> q0, q1
q0, b -> q0
q1, a -> q2
q1, b -> q2`,
    sampleWord: 'baab'
  },
  {
    id: 'dfa-binary-even',
    name: '4. AFD: Números binários pares (terminam em 0)',
    Q: 'q0, q1',
    Sigma: '0, 1',
    q0: 'q0',
    F: 'q1',
    delta: `q0, 0 -> q1
q0, 1 -> q0
q1, 0 -> q1
q1, 1 -> q0`,
    sampleWord: '1010'
  },
  {
    id: 'dfa-ident',
    name: "5. AFD: Identificadores (letras, dígitos e _)",
    Q: 'q0, q1',
    Sigma: "'a-z', 'A-Z', '0-9', '_'",
    q0: 'q0',
    F: 'q1',
    delta: `q0, 'a-z' -> q1
q0, 'A-Z' -> q1
q0, '_' -> q1
q1, 'a-z' -> q1
q1, 'A-Z' -> q1
q1, '0-9' -> q1
q1, '_' -> q1`,
    sampleWord: '_var1'
  }
];

// Alias para compatibilidade
export const DFA_EXAMPLES = AUTOMATON_EXAMPLES;

// Estado da simulação
let currentDFA = null;
let currentSimulationResult = null;
let currentStepIndex = 0;
let autoPlayTimer = null;

// Elementos cacheados do DOM
let dom = null;

export function initAutomatonUI() {
  dom = {
    form: document.getElementById('automaton-form'),
    qInput: document.getElementById('automaton-q-input'),
    sigmaInput: document.getElementById('automaton-sigma-input'),
    deltaInput: document.getElementById('automaton-delta-input'),
    q0Input: document.getElementById('automaton-q0-input'),
    fInput: document.getElementById('automaton-f-input'),
    wordInput: document.getElementById('automaton-word-input'),
    exampleSelect: document.getElementById('automaton-example-select'),

    btnBuild: document.getElementById('btn-build-dfa'),
    btnSimulate: document.getElementById('btn-simulate-dfa'),
    btnDeterminize: document.getElementById('btn-determinize-dfa'),
    btnClear: document.getElementById('btn-automaton-clear'),
    btnWordEpsilon: document.getElementById('btn-automaton-word-epsilon'),

    // Painéis de saída
    infoPanel: document.getElementById('automaton-info-panel'),
    typeBadge: document.getElementById('automaton-type-badge'),
    typeTitle: document.getElementById('automaton-type-title'),
    typeDesc: document.getElementById('automaton-type-desc'),
    formalDefDisplay: document.getElementById('automaton-formal-def'),
    alertsContainer: document.getElementById('automaton-alerts'),
    subsetTableContainer: document.getElementById('automaton-subset-table-container'),
    transitionTableContainer: document.getElementById('automaton-transition-table-container'),

    // Visualização do Grafo SVG
    diagramContainer: document.getElementById('automaton-diagram-container'),

    // Simulação e Player
    simulationPanel: document.getElementById('automaton-simulation-panel'),
    statusBadge: document.getElementById('dfa-status-badge'),
    statusMessage: document.getElementById('dfa-status-message'),
    configChainDisplay: document.getElementById('dfa-config-chain'),
    tapeContainer: document.getElementById('dfa-tape-container'),

    stepCounter: document.getElementById('dfa-step-counter'),
    btnFirst: document.getElementById('btn-dfa-first'),
    btnPrev: document.getElementById('btn-dfa-prev'),
    btnPlay: document.getElementById('btn-dfa-play'),
    btnNext: document.getElementById('btn-dfa-next'),
    btnLast: document.getElementById('btn-dfa-last'),
    stepsTableBody: document.getElementById('dfa-steps-tbody')
  };

  if (!dom.form) return;

  populateExamples();

  // Event Listeners
  dom.exampleSelect.addEventListener('change', onExampleChange);

  // Validação e construção em tempo real (Debounced)
  let liveBuildTimer = null;
  const triggerLiveBuild = () => {
    clearTimeout(liveBuildTimer);
    liveBuildTimer = setTimeout(() => {
      if (dom.exampleSelect) {
        dom.exampleSelect.value = '';
      }
      if (dom.deltaInput && dom.deltaInput.value.trim()) {
        handleBuildDFA();
      }
    }, 250);
  };

  [dom.qInput, dom.sigmaInput, dom.deltaInput, dom.q0Input, dom.fInput].forEach(el => {
    if (el) {
      el.addEventListener('input', triggerLiveBuild);
    }
  });

  dom.btnBuild.addEventListener('click', (e) => {
    e.preventDefault();
    handleBuildDFA();
  });

  dom.btnSimulate.addEventListener('click', (e) => {
    e.preventDefault();
    handleSimulateWord();
  });

  if (dom.btnDeterminize) {
    dom.btnDeterminize.addEventListener('click', (e) => {
      e.preventDefault();
      handleDeterminize();
    });
  }

  dom.btnClear.addEventListener('click', () => {
    resetAutomatonUI();
  });

  if (dom.btnWordEpsilon) {
    dom.btnWordEpsilon.addEventListener('click', () => {
      dom.wordInput.value = 'ε';
      handleSimulateWord();
    });
  }

  // Player Controls
  dom.btnFirst.addEventListener('click', () => goToStep(0));
  dom.btnPrev.addEventListener('click', () => goToStep(currentStepIndex - 1));
  dom.btnNext.addEventListener('click', () => goToStep(currentStepIndex + 1));
  dom.btnLast.addEventListener('click', () => {
    if (currentSimulationResult && currentSimulationResult.steps) {
      goToStep(currentSimulationResult.steps.length - 1);
    }
  });
  dom.btnPlay.addEventListener('click', toggleAutoPlay);

  // Carrega o primeiro exemplo por padrão
  loadExample(DFA_EXAMPLES[0]);
}

function populateExamples() {
  if (!dom.exampleSelect) return;
  dom.exampleSelect.innerHTML = '<option value="">-- Selecione um autômato pronto para carregar --</option>';
  for (const ex of DFA_EXAMPLES) {
    const opt = document.createElement('option');
    opt.value = ex.id;
    opt.textContent = ex.name;
    dom.exampleSelect.appendChild(opt);
  }
}

function onExampleChange(e) {
  const selectedId = e.target.value;
  if (!selectedId) return;
  const ex = DFA_EXAMPLES.find(item => item.id === selectedId);
  if (ex) {
    loadExample(ex);
  }
}

export function loadExample(ex) {
  dom.qInput.value = ex.Q;
  dom.sigmaInput.value = ex.Sigma;
  dom.deltaInput.value = ex.delta;
  dom.q0Input.value = ex.q0;
  dom.fInput.value = ex.F;
  dom.wordInput.value = ex.sampleWord;
  dom.exampleSelect.value = ex.id;

  handleBuildDFA();
  handleSimulateWord();
}

/**
 * Constrói o AFD a partir dos campos do formulário.
 */
export function handleBuildDFA() {
  const qVal = dom.qInput.value;
  const sigVal = dom.sigmaInput.value;
  const deltaVal = dom.deltaInput.value;
  const q0Val = dom.q0Input.value;
  const fVal = dom.fInput.value;

  const parsed = DFA.parse(qVal, sigVal, deltaVal, q0Val, fVal);

  if (!parsed.isValid) {
    showErrors(parsed.errors);
    return null;
  }

  currentDFA = parsed.dfa;
  renderDFAInfo(currentDFA, parsed.warnings);
  return currentDFA;
}

/**
 * Executa a simulação da palavra no autômato atual.
 */
export function handleSimulateWord() {
  stopAutoPlay();

  // Sempre reconstrói a partir dos inputs atuais para garantir sincronização com o formulário
  const built = handleBuildDFA();
  if (!built) return;

  const rawWord = dom.wordInput.value;
  const result = currentDFA.simulateWord(rawWord);
  currentSimulationResult = result;

  renderSimulation(result, rawWord);

  if (result.steps.length > 0) {
    goToStep(0);
  }
}

/**
 * Ponto de integração: Converte uma Gramática Regular em AFD e atualiza a UI.
 * @param {import('../grammar/grammar.js').Grammar} grammar
 * @param {string} [sampleWord]
 */
export function loadDFAFromGrammar(grammar, sampleWord = '') {
  try {
    const { dfa, nfaStats } = grammarToDFA(grammar);
    currentDFA = dfa;

    // Atualiza os campos do formulário de AFD
    dom.qInput.value = Array.from(dfa.Q).join(', ');
    dom.sigmaInput.value = Array.from(dfa.Sigma).join(', ');
    dom.q0Input.value = dfa.q0;
    dom.fInput.value = Array.from(dfa.F).join(', ');

    // Formata as transições
    const deltaLines = [];
    for (const [from, transMap] of dfa.delta.entries()) {
      for (const [sym, targetSet] of transMap.entries()) {
        const targets = targetSet instanceof Set ? Array.from(targetSet) : [targetSet];
        for (const to of targets) {
          deltaLines.push(`${from}, ${sym} -> ${to}`);
        }
      }
    }
    dom.deltaInput.value = deltaLines.join('\n');
    dom.wordInput.value = sampleWord || '';
    dom.exampleSelect.value = '';

    const warnings = [
      `AFD gerado automaticamente via Construção de Subconjuntos (Subset Construction) a partir do AFND (${nfaStats.statesCount} estados originais).`
    ];

    if (dom.subsetTableContainer) dom.subsetTableContainer.style.display = 'none';
    renderDFAInfo(dfa, warnings);

    if (sampleWord) {
      handleSimulateWord();
    } else {
      dom.simulationPanel.style.display = 'none';
    }

    return dfa;
  } catch (err) {
    showErrors([`Falha ao converter Gramática para AFD: ${err.message}`]);
    return null;
  }
}

/**
 * Ponto de integração: Converte um Regex em AFD e atualiza a UI.
 * @param {string} regexStr
 * @param {string} [sampleWord]
 */
export function loadDFAFromRegex(regexStr, sampleWord = '') {
  try {
    const dfa = regexToDFA(regexStr);
    currentDFA = dfa;

    dom.qInput.value = Array.from(dfa.Q).join(', ');
    dom.sigmaInput.value = Array.from(dfa.Sigma).join(', ');
    dom.q0Input.value = dfa.q0;
    dom.fInput.value = Array.from(dfa.F).join(', ');

    const deltaLines = [];
    for (const [from, transMap] of dfa.delta.entries()) {
      for (const [sym, targetSet] of transMap.entries()) {
        const targets = targetSet instanceof Set ? Array.from(targetSet) : [targetSet];
        for (const to of targets) {
          deltaLines.push(`${from}, ${sym} -> ${to}`);
        }
      }
    }
    dom.deltaInput.value = deltaLines.join('\n');
    dom.wordInput.value = sampleWord || '';
    dom.exampleSelect.value = '';

    const warnings = [`AFD gerado automaticamente a partir da expressão regular "${regexStr}".`];
    if (dom.subsetTableContainer) dom.subsetTableContainer.style.display = 'none';
    renderDFAInfo(dfa, warnings);

    if (sampleWord) {
      handleSimulateWord();
    } else {
      dom.simulationPanel.style.display = 'none';
    }

    return dfa;
  } catch (err) {
    showErrors([`Falha ao converter Regex para AFD: ${err.message}`]);
    return null;
  }
}

/**
 * Converte o AFND / AFND-ε atual em um AFD equivalente usando Construção de Subconjuntos.
 */
export function handleDeterminize() {
  // Sempre reconstrói a partir dos inputs atuais para garantir sincronização
  const built = handleBuildDFA();
  if (!built) return;

  const typeInfo = currentDFA.getAutomatonType();
  if (typeInfo.type === 'AFD') {
    renderDFAInfo(currentDFA, ['Este autômato já é determinístico (AFD). Não requer determinização.']);
    return;
  }

  try {
    const { dfa, subsetTable } = nfaToDFA(currentDFA);
    const prevType = typeInfo.type;
    currentDFA = dfa;

    // Atualiza campos do formulário com o AFD resultante
    dom.qInput.value = Array.from(dfa.Q).join(', ');
    dom.sigmaInput.value = Array.from(dfa.Sigma).join(', ');
    dom.q0Input.value = dfa.q0;
    dom.fInput.value = Array.from(dfa.F).join(', ');

    const deltaLines = [];
    for (const [from, transMap] of dfa.delta.entries()) {
      for (const [sym, targetSet] of transMap.entries()) {
        const targets = targetSet instanceof Set ? Array.from(targetSet) : [targetSet];
        for (const to of targets) {
          deltaLines.push(`${from}, ${sym} -> ${to}`);
        }
      }
    }
    dom.deltaInput.value = deltaLines.join('\n');
    dom.exampleSelect.value = '';

    const warnings = [
      `⚡ Sucesso! ${prevType} convertido em AFD equivalente via Construção de Subconjuntos (Subset Construction).`,
      `Estados determinísticos gerados: ${dfa.Q.size} estados a partir do fecho-ε e subconjuntos das transições.`
    ];

    renderDFAInfo(dfa, warnings);
    renderSubsetTable(subsetTable);

    if (dom.wordInput.value) {
      handleSimulateWord();
    }
  } catch (err) {
    showErrors([`Falha na determinização: ${err.message}`]);
  }
}

function showErrors(errors) {
  dom.infoPanel.style.display = 'block';
  if (dom.typeBadge) {
    dom.typeBadge.textContent = 'Inválido';
    dom.typeBadge.className = 'classification-badge type-non-regular';
  }
  if (dom.typeTitle) {
    dom.typeTitle.textContent = 'Erro na Definição do Autômato';
  }
  if (dom.typeDesc) {
    dom.typeDesc.textContent = 'A definição fornecida contém inconsistências formais.';
  }
  dom.formalDefDisplay.textContent = 'Erro de Definição Formal';
  dom.alertsContainer.innerHTML = errors.map(e => `<div class="grammar-alert error">✖ ${e}</div>`).join('');
  dom.transitionTableContainer.innerHTML = '';
  if (dom.subsetTableContainer) dom.subsetTableContainer.style.display = 'none';
  dom.diagramContainer.innerHTML = '';
  dom.simulationPanel.style.display = 'none';
}

function renderDFAInfo(dfa, warnings = []) {
  dom.infoPanel.style.display = 'block';
  dom.formalDefDisplay.textContent = dfa.toFormalDefinition();

  // Classificação do Autômato
  const typeInfo = dfa.getAutomatonType();
  if (dom.typeBadge) {
    dom.typeBadge.textContent = typeInfo.type;
    dom.typeBadge.className = 'classification-badge';
    if (typeInfo.type === 'AFD') {
      dom.typeBadge.classList.add('type-afd');
    } else if (typeInfo.type === 'AFND') {
      dom.typeBadge.classList.add('type-afnd');
    } else {
      dom.typeBadge.classList.add('type-afnd-eps');
    }
  }
  if (dom.typeTitle) {
    dom.typeTitle.textContent = typeInfo.type === 'AFD'
      ? 'Autômato Finito Determinístico (AFD)'
      : (typeInfo.type === 'AFND' ? 'Autômato Finito Não Determinístico (AFND)' : 'Autômato Finito Não Determinístico com ε-transições (AFND-ε)');
  }
  if (dom.typeDesc) {
    dom.typeDesc.textContent = typeInfo.details;
  }

  // Renderiza alertas
  const allAlerts = [];
  if (typeInfo.type !== 'AFD' && typeInfo.nonDeterministicReasons && typeInfo.nonDeterministicReasons.length > 0) {
    for (const reason of typeInfo.nonDeterministicReasons) {
      allAlerts.push(`<div class="grammar-alert warning">⚡ <strong>Não-determinismo detectado:</strong> ${reason}</div>`);
    }
  }
  if (warnings && warnings.length > 0) {
    for (const w of warnings) {
      allAlerts.push(`<div class="grammar-alert warning">💡 ${w}</div>`);
    }
  }
  dom.alertsContainer.innerHTML = allAlerts.join('');

  // Renderiza a Tabela de Transição δ
  renderTransitionTable(dfa);

  // Renderiza o Diagrama em SVG inicial
  renderStateDiagramSVG(dfa);
}

function renderSubsetTable(subsetTable) {
  if (!dom.subsetTableContainer) return;
  if (!subsetTable || subsetTable.length === 0) {
    dom.subsetTableContainer.style.display = 'none';
    dom.subsetTableContainer.innerHTML = '';
    return;
  }

  const symbols = Object.keys(subsetTable[0].transitions || {}).sort();
  let thead = '<tr><th>Estado AFD</th><th>Subconjunto P(Q) Original</th><th>Aceitação (F)?</th>';
  for (const sym of symbols) {
    thead += `<th>δ'({ ... }, ${sym})</th>`;
  }
  thead += '</tr>';

  let tbody = '';
  for (const row of subsetTable) {
    tbody += `<tr>
      <td class="state-cell"><strong><code>${row.dfaState}</code></strong></td>
      <td class="desc-cell"><code>{ ${row.subset.join(', ')} }</code></td>
      <td>${row.isFinal ? '<strong style="color: #15803d;">Sim (Final)</strong>' : '<span style="color: #64748b;">Não</span>'}</td>`;
    for (const sym of symbols) {
      const dest = row.transitions[sym] || '∅';
      tbody += `<td><code>${dest}</code></td>`;
    }
    tbody += '</tr>';
  }

  dom.subsetTableContainer.style.display = 'block';
  dom.subsetTableContainer.innerHTML = `
    <h4>Tabela da Construção de Subconjuntos (Subset Construction):</h4>
    <p class="field-hint" style="margin-bottom: 8px;">Mapeamento formal dos novos estados determinísticos para as combinações de estados atingíveis via fecho-ε:</p>
    <div class="table-responsive">
      <table class="dfa-delta-table subset-table">
        <thead>${thead}</thead>
        <tbody>${tbody}</tbody>
      </table>
    </div>
  `;
}

function renderTransitionTable(dfa) {
  const tableData = dfa.getTransitionTable();
  const { symbols, rows } = tableData;

  let thead = '<tr><th>Estado (q)</th><th>Origem / Subconjunto</th>';
  for (const sym of symbols) {
    thead += `<th>${sym}</th>`;
  }
  thead += '</tr>';

  let tbody = '';
  for (const row of rows) {
    let prefix = '';
    if (row.isInitial) prefix += '→ ';
    if (row.isFinal) prefix += '* ';

    tbody += `<tr>
      <td class="state-cell ${row.isFinal ? 'final-state' : ''}"><strong>${prefix}${row.state}</strong></td>
      <td class="desc-cell"><code>${row.description || '—'}</code></td>`;

    for (const sym of symbols) {
      const dest = row.transitions[sym];
      tbody += `<td><code>${dest}</code></td>`;
    }
    tbody += '</tr>';
  }

  dom.transitionTableContainer.innerHTML = `
    <div class="table-responsive">
      <table class="dfa-delta-table">
        <thead>${thead}</thead>
        <tbody>${tbody}</tbody>
      </table>
    </div>
    <div class="table-legend">
      <span class="legend-item"><span class="legend-badge">→</span> Estado Inicial</span>
      <span class="legend-item"><span class="legend-badge">*</span> Estado Final (Aceitação)</span>
    </div>
  `;
}

/**
 * Renderiza o Diagrama de Estados em SVG (estilo JFLAP)
 *
 * @param {FiniteAutomaton} dfa
 * @param {string|string[]|Set<string>|null} activeStates - Estados atualmente ativos para destaque simultâneo
 * @param {Array<{ from: string, to: string, sym?: string }>|{ from: string, sym: string, to: string }|null} activeTransitions
 */
export function renderStateDiagramSVG(dfa, activeStates = null, activeTransitions = null) {
  if (!dfa || !dom.diagramContainer) return;

  const states = Array.from(dfa.Q);
  const N = states.length;
  if (N === 0) return;

  // Dimensões do canvas SVG
  const svgWidth = Math.max(680, N * 130);
  const svgHeight = 320;
  const nodeRadius = 24;

  // Converte activeStates para Set para busca rápida O(1)
  const activeSet = new Set();
  if (activeStates) {
    if (typeof activeStates === 'string') {
      activeSet.add(activeStates);
    } else if (Array.isArray(activeStates) || activeStates instanceof Set) {
      for (const s of activeStates) activeSet.add(s);
    }
  }

  // 1. Calcula coordenadas (x, y) dos nós
  const coords = new Map();

  if (N <= 5) {
    // Disposição horizontal em linha com leve curva
    const spacing = (svgWidth - 160) / Math.max(1, N - 1);
    for (let i = 0; i < N; i++) {
      const st = states[i];
      const x = 90 + i * spacing;
      const y = svgHeight / 2 + (i % 2 === 1 ? -15 : 15);
      coords.set(st, { x, y });
    }
  } else {
    // Disposição elíptica / circular para autômatos maiores
    const cx = svgWidth / 2;
    const cy = svgHeight / 2;
    const rx = (svgWidth - 180) / 2;
    const ry = (svgHeight - 120) / 2;

    for (let i = 0; i < N; i++) {
      const st = states[i];
      const angle = (2 * Math.PI * i) / N - Math.PI / 2;
      const x = cx + rx * Math.cos(angle);
      const y = cy + ry * Math.sin(angle);
      coords.set(st, { x, y });
    }
  }

  // 2. Agrupa transições entre pares de estados (u, v) para condensar rótulos (ex: "0, 1")
  const edgeGroups = new Map(); // key: "u->v" => { from, to, symbols: [] }
  for (const [from, transMap] of dfa.delta.entries()) {
    for (const [sym, targetSet] of transMap.entries()) {
      const targets = targetSet instanceof Set ? Array.from(targetSet) : [targetSet];
      for (const to of targets) {
        const key = `${from}->${to}`;
        if (!edgeGroups.has(key)) {
          edgeGroups.set(key, { from, to, symbols: [] });
        }
        if (!edgeGroups.get(key).symbols.includes(sym)) {
          edgeGroups.get(key).symbols.push(sym);
        }
      }
    }
  }

  const svgLines = [];
  const svgLabels = [];

  // 3. Desenha arestas e transições
  for (const edge of edgeGroups.values()) {
    const { from, to, symbols } = edge;
    const p1 = coords.get(from);
    const p2 = coords.get(to);
    if (!p1 || !p2) continue;

    const labelText = symbols.join(', ');
    let isEdgeActive = false;
    if (activeTransitions) {
      if (Array.isArray(activeTransitions)) {
        isEdgeActive = activeTransitions.some(t => t.from === from && t.to === to);
      } else if (activeTransitions.from === from && activeTransitions.to === to) {
        isEdgeActive = true;
      }
    }

    const hasEpsilon = symbols.some(s => isEpsilon(s));
    const strokeColor = isEdgeActive ? '#f59e0b' : (hasEpsilon ? '#8b5cf6' : '#64748b');
    const strokeWidth = isEdgeActive ? 3.5 : (hasEpsilon ? 2.2 : 2);
    const dashAttr = hasEpsilon ? 'stroke-dasharray="5,4"' : '';
    const markerUrl = isEdgeActive ? 'url(#arrow-head-active)' : (hasEpsilon ? 'url(#arrow-head-eps)' : 'url(#arrow-head)');

    if (from === to) {
      // Auto-laço (Self-loop) no topo do nó
      const loopR = 26;
      const startX = p1.x - 12;
      const startY = p1.y - nodeRadius + 3;
      const endX = p1.x + 12;
      const endY = p1.y - nodeRadius + 3;
      const topY = p1.y - nodeRadius - loopR * 1.6;

      const pathData = `M ${startX} ${startY} C ${p1.x - loopR} ${topY}, ${p1.x + loopR} ${topY}, ${endX} ${endY}`;
      svgLines.push(`
        <path d="${pathData}" fill="none" stroke="${strokeColor}" stroke-width="${strokeWidth}" ${dashAttr}
              marker-end="${markerUrl}" />
      `);

      svgLabels.push(`
        <g class="edge-label-group">
          <rect x="${p1.x - labelText.length * 4 - 4}" y="${topY - 14}" width="${labelText.length * 8 + 8}" height="16"
                fill="#ffffff" rx="4" opacity="0.9" />
          <text x="${p1.x}" y="${topY - 4}" text-anchor="middle"
                fill="${isEdgeActive ? '#b45309' : (hasEpsilon ? '#6b21a8' : '#1e293b')}" font-weight="700" font-size="12px" font-family="monospace">
            ${labelText}
          </text>
        </g>
      `);
    } else {
      // Transição entre nós distintos
      // Verifica se há transição inversa (v -> u) para curvar e evitar sobreposição
      const reciprocalKey = `${to}->${from}`;
      const hasReciprocal = edgeGroups.has(reciprocalKey);

      const dx = p2.x - p1.x;
      const dy = p2.y - p1.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist === 0) continue;

      const unitX = dx / dist;
      const unitY = dy / dist;

      // Pontos na borda do círculo
      const startX = p1.x + unitX * nodeRadius;
      const startY = p1.y + unitY * nodeRadius;
      const endX = p2.x - unitX * (nodeRadius + 4);
      const endY = p2.y - unitY * (nodeRadius + 4);

      if (hasReciprocal) {
        // Traça arco curvado (Curva de Bézier Quadrática)
        const perpX = -unitY;
        const perpY = unitX;
        const curveOffset = 30;

        const midX = (startX + endX) / 2 + perpX * curveOffset;
        const midY = (startY + endY) / 2 + perpY * curveOffset;

        const pathData = `M ${startX} ${startY} Q ${midX} ${midY} ${endX} ${endY}`;
        svgLines.push(`
          <path d="${pathData}" fill="none" stroke="${strokeColor}" stroke-width="${strokeWidth}" ${dashAttr}
                marker-end="${markerUrl}" />
        `);

        // Ponto de rótulo no ápice da curva
        svgLabels.push(`
          <g class="edge-label-group">
            <rect x="${midX - labelText.length * 4 - 4}" y="${midY - 9}" width="${labelText.length * 8 + 8}" height="16"
                  fill="#ffffff" rx="4" opacity="0.92" />
            <text x="${midX}" y="${midY + 3}" text-anchor="middle"
                  fill="${isEdgeActive ? '#b45309' : (hasEpsilon ? '#6b21a8' : '#1e293b')}" font-weight="700" font-size="12px" font-family="monospace">
              ${labelText}
            </text>
          </g>
        `);
      } else {
        // Linha reta
        svgLines.push(`
          <line x1="${startX}" y1="${startY}" x2="${endX}" y2="${endY}"
                stroke="${strokeColor}" stroke-width="${strokeWidth}" ${dashAttr}
                marker-end="${markerUrl}" />
        `);

        const midX = (startX + endX) / 2;
        const midY = (startY + endY) / 2 - 8;

        svgLabels.push(`
          <g class="edge-label-group">
            <rect x="${midX - labelText.length * 4 - 4}" y="${midY - 10}" width="${labelText.length * 8 + 8}" height="16"
                  fill="#ffffff" rx="4" opacity="0.9" />
            <text x="${midX}" y="${midY + 2}" text-anchor="middle"
                  fill="${isEdgeActive ? '#b45309' : (hasEpsilon ? '#6b21a8' : '#1e293b')}" font-weight="700" font-size="12px" font-family="monospace">
              ${labelText}
            </text>
          </g>
        `);
      }
    }
  }

  // 4. Desenha nós (estados) com suporte a múltiplos nós ativos simultâneos (AFND)
  const svgNodes = [];
  for (const st of states) {
    const pt = coords.get(st);
    if (!pt) continue;

    const isInitial = st === dfa.q0;
    const isFinal = dfa.F.has(st);
    const isActive = activeSet.has(st);

    // Seta de estado inicial
    let startIndicator = '';
    if (isInitial) {
      const arrowStartX = pt.x - nodeRadius - 35;
      const arrowStartY = pt.y;
      const arrowEndX = pt.x - nodeRadius - 3;
      startIndicator = `
        <g class="start-indicator">
          <line x1="${arrowStartX}" y1="${arrowStartY}" x2="${arrowEndX}" y2="${arrowStartY}"
                stroke="#2563eb" stroke-width="2.5" marker-end="url(#start-arrow-head)" />
          <text x="${arrowStartX - 4}" y="${arrowStartY + 4}" text-anchor="end"
                fill="#2563eb" font-weight="700" font-size="11px">Início</text>
        </g>
      `;
    }

    // Halo pulsante para estado ativo (simulação AFND com múltiplos nós simultâneos)
    let activeRing = '';
    if (isActive) {
      activeRing = `
        <circle cx="${pt.x}" cy="${pt.y}" r="${nodeRadius + 7}" fill="none" stroke="#f59e0b" stroke-width="3.5" stroke-dasharray="5,4">
          <animate attributeName="stroke-dashoffset" from="0" to="18" dur="1s" repeatCount="indefinite" />
        </circle>
      `;
    }

    // Cores do nó
    let fillColor = isActive ? '#fef3c7' : '#ffffff';
    let strokeColor = isActive ? '#d97706' : (isFinal ? '#15803d' : '#2563eb');
    let textColor = isActive ? '#92400e' : (isFinal ? '#14532d' : '#1e3a8a');

    // Círculo duplo para estado de aceitação (padrão LFA)
    let doubleCircle = '';
    if (isFinal) {
      doubleCircle = `
        <circle cx="${pt.x}" cy="${pt.y}" r="${nodeRadius - 4}"
                fill="none" stroke="${strokeColor}" stroke-width="1.8" />
      `;
    }

    const desc = dfa.stateDescriptions.get(st) || '';

    svgNodes.push(`
      <g class="dfa-node-group" data-state="${st}">
        <title>${st} ${desc ? '— ' + desc : ''}${isFinal ? ' (Final/Aceitação)' : ''}${isInitial ? ' (Inicial)' : ''}</title>
        ${startIndicator}
        ${activeRing}
        <circle cx="${pt.x}" cy="${pt.y}" r="${nodeRadius}"
                fill="${fillColor}" stroke="${strokeColor}" stroke-width="2.2" />
        ${doubleCircle}
        <text x="${pt.x}" y="${pt.y}" text-anchor="middle" dominant-baseline="central"
              fill="${textColor}" font-weight="700" font-size="13px" font-family="monospace">
          ${st}
        </text>
      </g>
    `);
  }

  dom.diagramContainer.innerHTML = `
    <svg viewBox="0 0 ${svgWidth} ${svgHeight}" class="dfa-svg" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <marker id="arrow-head" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto">
          <path d="M 0 1 L 9 5 L 0 9 z" fill="#64748b" />
        </marker>
        <marker id="arrow-head-active" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto">
          <path d="M 0 1 L 9 5 L 0 9 z" fill="#f59e0b" />
        </marker>
        <marker id="arrow-head-eps" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto">
          <path d="M 0 1 L 9 5 L 0 9 z" fill="#8b5cf6" />
        </marker>
        <marker id="start-arrow-head" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto">
          <path d="M 0 1 L 9 5 L 0 9 z" fill="#2563eb" />
        </marker>
      </defs>
      <g class="dfa-edges">${svgLines.join('')}</g>
      <g class="dfa-labels">${svgLabels.join('')}</g>
      <g class="dfa-nodes">${svgNodes.join('')}</g>
    </svg>
    <div class="diagram-legend">
      <span class="legend-item"><span class="legend-badge initial-badge">→</span> Estado Inicial</span>
      <span class="legend-item"><span class="legend-badge final-badge">◎</span> Estado Final (Círculo Duplo)</span>
      <span class="legend-item"><span class="legend-badge active-badge">●</span> Estado Ativo</span>
      <span class="legend-item"><span class="legend-badge" style="background-color: #8b5cf6; color: white; padding: 1px 6px; border-radius: 3px; font-weight: bold;">ε</span> Transição-ε (Tracejada)</span>
    </div>
  `;
}

function renderSimulation(result, rawWordInput) {
  dom.simulationPanel.style.display = 'block';

  const cleanDisplayWord = (!rawWordInput || rawWordInput === 'ε') ? 'ε (Palavra Vazia)' : `"${rawWordInput}"`;

  if (result.isAccepted) {
    dom.statusBadge.className = 'status-badge is-valid';
    dom.statusBadge.textContent = 'Cadeia Aceita ✔';
  } else {
    dom.statusBadge.className = 'status-badge is-invalid';
    dom.statusBadge.textContent = 'Cadeia Rejeitada ✖';
  }

  dom.statusMessage.textContent = result.message;
  dom.configChainDisplay.textContent = result.getFormalChain();

  renderStepsTable(result.steps);
  renderTape(result.word, 0);
}

function renderTape(word, activeCharIndex) {
  if (!dom.tapeContainer) return;

  const chars = Array.from(word);
  if (chars.length === 0) {
    dom.tapeContainer.innerHTML = `
      <div class="tape-wrapper">
        <span class="tape-label">Fita de Entrada:</span>
        <div class="tape-cells">
          <div class="tape-cell active">ε</div>
        </div>
      </div>
    `;
    return;
  }

  let cellsHtml = '';
  for (let i = 0; i < chars.length; i++) {
    const isConsumed = i < activeCharIndex;
    const isCurrent = i === activeCharIndex;
    const cellClass = isCurrent ? 'tape-cell active' : (isConsumed ? 'tape-cell consumed' : 'tape-cell');
    cellsHtml += `<div class="${cellClass}">${chars[i]}</div>`;
  }
  // Célula vazia no final da fita
  cellsHtml += `<div class="tape-cell ${activeCharIndex >= chars.length ? 'active' : ''}">_</div>`;

  dom.tapeContainer.innerHTML = `
    <div class="tape-wrapper">
      <span class="tape-label">Fita de Entrada:</span>
      <div class="tape-cells">${cellsHtml}</div>
    </div>
  `;
}

function renderStepsTable(steps) {
  dom.stepsTableBody.innerHTML = '';
  for (let i = 0; i < steps.length; i++) {
    const s = steps[i];
    const tr = document.createElement('tr');
    tr.id = `dfa-step-row-${i}`;
    tr.className = 'step-row';
    tr.addEventListener('click', () => goToStep(i));

    const symDisplay = s.symbolRead !== null ? `<code>'${s.symbolRead}'</code>` : '<em>(Início)</em>';
    const currDisplay = s.activeStates.length > 1
      ? `{ ${s.activeStates.join(', ')} }`
      : (s.activeStates[0] || '∅');
    const nextDisplay = s.nextActiveStates.length > 0
      ? (s.nextActiveStates.length > 1 ? `{ ${s.nextActiveStates.join(', ')} }` : s.nextActiveStates[0])
      : '<span class="text-danger">✖ Indefinido (Travou)</span>';
    const remainingDisplay = s.remainingInput === '' ? 'ε' : s.remainingInput;

    tr.innerHTML = `
      <td class="step-num">${s.stepNumber}</td>
      <td><code>${currDisplay}</code></td>
      <td>${symDisplay}</td>
      <td><code>${nextDisplay}</code></td>
      <td><code>${remainingDisplay}</code></td>
      <td class="step-sentential"><code>${s.formalConfig}</code></td>
    `;
    dom.stepsTableBody.appendChild(tr);
  }
}

function goToStep(index) {
  if (!currentSimulationResult || !currentSimulationResult.steps || currentSimulationResult.steps.length === 0) return;

  const totalSteps = currentSimulationResult.steps.length;
  if (index < 0) index = 0;
  if (index >= totalSteps) index = totalSteps - 1;

  currentStepIndex = index;

  // Atualiza contador
  dom.stepCounter.textContent = `Passo ${currentStepIndex} de ${totalSteps - 1}`;

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

  const stepObj = currentSimulationResult.steps[currentStepIndex];
  // No passo inicial (0), os estados ativos são os iniciais; nos passos seguintes, os atingidos
  const activeStates = stepObj.symbolRead !== null ? stepObj.nextActiveStates : stepObj.activeStates;

  let activeTransitions = [];
  if (stepObj.symbolRead !== null && stepObj.activeStates && stepObj.nextActiveStates) {
    for (const u of stepObj.activeStates) {
      const uMap = currentDFA.delta.get(u);
      if (!uMap) continue;
      for (const [sym, targetSet] of uMap.entries()) {
        const targets = targetSet instanceof Set ? Array.from(targetSet) : [targetSet];
        for (const v of targets) {
          if (stepObj.nextActiveStates.includes(v)) {
            activeTransitions.push({ from: u, to: v, sym });
          }
        }
      }
    }
  }

  // Atualiza fita e diagrama
  renderTape(currentSimulationResult.word, currentStepIndex);
  renderStateDiagramSVG(currentDFA, activeStates, activeTransitions);
}

function toggleAutoPlay() {
  if (autoPlayTimer) {
    stopAutoPlay();
  } else {
    startAutoPlay();
  }
}

function startAutoPlay() {
  if (!currentSimulationResult || !currentSimulationResult.steps) return;
  dom.btnPlay.textContent = '⏸ Pausar';
  dom.btnPlay.classList.add('is-playing');

  if (currentStepIndex >= currentSimulationResult.steps.length - 1) {
    goToStep(0);
  }

  autoPlayTimer = setInterval(() => {
    if (currentStepIndex < currentSimulationResult.steps.length - 1) {
      goToStep(currentStepIndex + 1);
    } else {
      stopAutoPlay();
    }
  }, 1100);
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

export function resetAutomatonUI() {
  stopAutoPlay();
  dom.qInput.value = '';
  dom.sigmaInput.value = '';
  dom.deltaInput.value = '';
  dom.q0Input.value = '';
  dom.fInput.value = '';
  dom.wordInput.value = '';
  dom.exampleSelect.value = '';

  dom.infoPanel.style.display = 'none';
  if (dom.subsetTableContainer) dom.subsetTableContainer.style.display = 'none';
  dom.simulationPanel.style.display = 'none';
  if (dom.typeBadge) {
    dom.typeBadge.textContent = 'Não Analisado';
    dom.typeBadge.className = 'classification-badge';
  }
  if (dom.typeTitle) {
    dom.typeTitle.textContent = 'Classificação do Autômato';
  }
  if (dom.typeDesc) {
    dom.typeDesc.textContent = '';
  }
  currentDFA = null;
  currentSimulationResult = null;
  currentStepIndex = 0;
}
