const VALID_EMOJI_SRC = 'assets/emoji_valido.jpg';
const INVALID_EMOJI_SRC = 'assets/emoji_invalido.jpg';

// Cache dos elementos do DOM
const elements = {
  form: document.getElementById('validator-form'),
  regexInput: document.getElementById('regex-input'),
  textInput: document.getElementById('text-input'),
  liveValidationToggle: document.getElementById('live-validation-toggle'),
  resultPanel: document.getElementById('result-panel'),
  resultPlaceholder: document.getElementById('result-placeholder'),
  resultContent: document.getElementById('result-content'),
  emojiWrapper: document.getElementById('emoji-wrapper'),
  emojiImg: document.getElementById('emoji-img'),
  statusBadge: document.getElementById('status-badge'),
  statusMessage: document.getElementById('status-message')
};

export function getFormValues() {
  /**
   * @brief Obtém os valores atuais dos campos de entrada
   * @returns {{ regexPattern: string, testText: string }}
   */

  return {
    regexPattern: elements.regexInput ? elements.regexInput.value : '',
    testText: elements.textInput ? elements.textInput.value : ''
  };
}

export function isLiveValidationActive() {
  /**
   * Verifica se a validação em tempo real está ativa.
   * @returns {boolean}
   */

  return elements.liveValidationToggle ? elements.liveValidationToggle.checked : false;
}


export function renderValid(message = 'Cadeia de texto válida para a expressão regular!') {
/**
 * Aplica o estado visual de VÁLIDO (Verde e Emoji Válido).
 * @param {string} [message] - Mensagem descritiva opcional.
 */

  // Atualiza as classes dos inputs para verde
  elements.regexInput.classList.remove('is-invalid');
  elements.regexInput.classList.add('is-valid');

  elements.textInput.classList.remove('is-invalid');
  elements.textInput.classList.add('is-valid');

  // Atualiza o painel do emoji
  elements.emojiWrapper.classList.remove('is-invalid');
  elements.emojiWrapper.classList.add('is-valid');
  elements.emojiImg.src = VALID_EMOJI_SRC;
  elements.emojiImg.alt = 'Válido';

  // Atualiza os textos e badges de status
  elements.statusBadge.classList.remove('is-invalid');
  elements.statusBadge.classList.add('is-valid');
  elements.statusBadge.textContent = 'Válido ✔';

  elements.statusMessage.textContent = message;

  // Exibe o resultado e oculta o placeholder inicial
  elements.resultPlaceholder.style.display = 'none';
  elements.resultContent.classList.add('show');
}


export function renderInvalid(message = 'Cadeia de texto inválida para a expressão regular!') {
/**
 * Aplica o estado visual de INVÁLIDO (Vermelho e Emoji Inválido).
 * @param {string} [message] - Mensagem descritiva opcional.
 */
  // Atualiza as classes dos inputs para vermelho
  elements.regexInput.classList.remove('is-valid');
  elements.regexInput.classList.add('is-invalid');

  elements.textInput.classList.remove('is-valid');
  elements.textInput.classList.add('is-invalid');

  // Atualiza o painel do emoji
  elements.emojiWrapper.classList.remove('is-valid');
  elements.emojiWrapper.classList.add('is-invalid');
  elements.emojiImg.src = INVALID_EMOJI_SRC;
  elements.emojiImg.alt = 'Inválido';

  // Atualiza os textos e badges de status
  elements.statusBadge.classList.remove('is-valid');
  elements.statusBadge.classList.add('is-invalid');
  elements.statusBadge.textContent = 'Inválido ✖';

  elements.statusMessage.textContent = message;

  // Exibe o resultado e oculta o placeholder inicial
  elements.resultPlaceholder.style.display = 'none';
  elements.resultContent.classList.add('show');
}


export function resetUI() {
/**
 * Limpa os campos e redefine o estado visual da interface para o estado neutro.
 */
  // Limpa valores
  elements.regexInput.value = '';
  elements.textInput.value = '';

  // Remove estilos de validação
  elements.regexInput.classList.remove('is-valid', 'is-invalid');
  elements.textInput.classList.remove('is-valid', 'is-invalid');
  elements.emojiWrapper.classList.remove('is-valid', 'is-invalid');

  // Oculta resultado e restaura placeholder
  elements.resultContent.classList.remove('show');
  elements.resultPlaceholder.style.display = 'block';

  // Limpa textos
  elements.statusBadge.textContent = '';
  elements.statusMessage.textContent = '';

  // Foco no campo inicial
  elements.regexInput.focus();
}


export function getElements() {
/**
 * Retorna os elementos do formulário para vinculação de eventos.
 */
  return elements;
}
