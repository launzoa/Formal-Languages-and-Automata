import { validate } from './validator.js';
import {
  getFormValues,
  isLiveValidationActive,
  renderValid,
  renderInvalid,
  resetUI,
  getElements
} from './ui.js';
import { initGrammarUI } from './grammar/grammar-ui.js';
import { initAutomatonUI, loadDFAFromRegex } from './automaton/automaton-ui.js';

let debounceTimer = null;

function handleValidation() {
  /**
   * Função principal para lidar com a validação do formulário de expressões regulares
   */
  const { regexPattern, testText } = getFormValues();

  // Se ambos os campos estiverem vazios e não for submit explícito, redefinir
  if (!regexPattern.trim() && !testText.trim()) {
    resetUI();
    return;
  }

  // Executa a validação (em validator.js)
  const result = validate(regexPattern, testText);

  // Atualiza o estado visual conforme o retorno booleano de `isValid`
  if (result && result.isValid) {
    renderValid(result.message);
  } else {
    renderInvalid(result ? result.message : undefined);
  }
}

function handleLiveInput() {
  /**
   * Lida com a entrada em tempo real nos campos de regex e texto
   */
  if (!isLiveValidationActive()) return;

  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    handleValidation();
  }, 200);
}

function setupNavigation() {
  /**
   * Configura o menu superior de navegação por abas
   */
  const tabs = document.querySelectorAll('.nav-tab');
  const views = document.querySelectorAll('.tab-view');

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const targetViewId = tab.getAttribute('data-target');

      // Atualiza aba ativa
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');

      // Atualiza visualização ativa
      views.forEach(view => {
        if (view.id === targetViewId) {
          view.classList.add('active');
        } else {
          view.classList.remove('active');
        }
      });
    });
  });
}

function initRegexModule() {
  const elements = getElements();

  if (!elements.form) {
    console.error('Formulário de regex não encontrado no DOM.');
    return;
  }

  // Evento de submissão do formulário
  elements.form.addEventListener('submit', (e) => {
    e.preventDefault();
    handleValidation();
  });

  // Evento do botão "Limpar"
  const clearBtn = document.getElementById('btn-clear');
  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      resetUI();
    });
  }

  // Eventos de entrada em tempo real nos campos
  if (elements.regexInput) {
    elements.regexInput.addEventListener('input', handleLiveInput);
  }
  if (elements.textInput) {
    elements.textInput.addEventListener('input', handleLiveInput);
  }

  // Evento do botão "Gerar AFD a partir do Regex"
  const btnRegexToDfa = document.getElementById('btn-convert-regex-to-dfa');
  if (btnRegexToDfa) {
    btnRegexToDfa.addEventListener('click', () => {
      const { regexPattern, testText } = getFormValues();
      if (!regexPattern.trim()) {
        alert('Por favor, informe uma expressão regular para converter em AFD.');
        return;
      }
      const tabAutomaton = document.getElementById('tab-automaton');
      if (tabAutomaton) tabAutomaton.click();
      loadDFAFromRegex(regexPattern, testText);
    });
  }
}

function init() {
  // 1. Configura navegação do menu superior
  setupNavigation();

  // 2. Inicializa módulo do Validador de Expressões Regulares
  initRegexModule();

  // 3. Inicializa módulo do Simulador de Gramática Regular
  initGrammarUI();

  // 4. Inicializa módulo do Simulador de Autômato Finito Determinístico (AFD)
  initAutomatonUI();
}

// Inicializa quando o DOM estiver pronto
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
