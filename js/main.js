import { validate } from './validator.js';
import {
  getFormValues,
  isLiveValidationActive,
  renderValid,
  renderInvalid,
  resetUI,
  getElements
} from './ui.js';

let debounceTimer = null;

function handleValidation() {
  /*
    @brief Função principal para lidar com a validação do formulário
   */

  const { regexPattern, testText } = getFormValues(); // Obtém os valores atuais do formulário

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
  /*
  @brief Função para lidar com a entrada em tempo real nos campos de regex e texto
  */

  // Se a validação em tempo real não estiver ativa, não faz nada
  if (!isLiveValidationActive()) return;
  
  clearTimeout(debounceTimer);  // Caso contrário, limpa o timer anterior
  // E define um novo timer para chamar `handleValidation` após 200ms de inatividade
  debounceTimer = setTimeout(() => {
    handleValidation();
  }, 200);
}

function init() {
  /*
    @brief Função de inicialização que configura os eventos do formulário e dos campos 
  */

  const elements = getElements(); // Obtém os elementos do DOM necessários

  // Verifica se o formulário existe no DOM antes de adicionar eventos
  if (!elements.form) {
    console.error('Formulário não encontrado no DOM.');
    return;
  }

  // Evento de submissão do formulário (botão "Validar" ou tecla Enter)
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
  // Adiciona o evento de input ao campo de texto, se existir
  if (elements.textInput) {
    elements.textInput.addEventListener('input', handleLiveInput);
  }
}

// Inicializa quando o DOM estiver pronto
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
