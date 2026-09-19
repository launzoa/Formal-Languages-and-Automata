/**
 * Valida se um determinado texto é aceito por uma determinada expressão regular.
 *
 * @param {string} regexPattern - A expressão regular inserida no campo.
 * @param {string} testText - O texto de teste inserido no campo abaixo.
 * @returns {{ isValid: boolean, message?: string }} Objeto contendo o resultado da validação.
 */
export function validate(regexPattern, testText) {
  // Verifica se a expressão regular foi informada
  if (!regexPattern || !regexPattern.trim()) {
    return {
      isValid: false,
      message: 'Por favor, insira uma expressão regular.'
    };
  }

  const rawPattern = regexPattern.trim();
  const text = testText !== undefined && testText !== null ? String(testText) : '';

  try {
    let regex;

    // Suporte para notação com barras e flags (ex: /^[0-9]+$/i ou /abc/g)
    const slashMatch = rawPattern.match(/^\/(.*)\/([a-z]*)$/i);

    if (slashMatch) {
      const patternBody = slashMatch[1];
      const flags = slashMatch[2];
      // Ancorar se ainda não estiver ancorada, para validar a cadeia completa
      const anchored = (patternBody.startsWith('^') && patternBody.endsWith('$'))
        ? patternBody
        : `^(?:${patternBody})$`;
      regex = new RegExp(anchored, flags);
    } else {
      // Se não tiver delimitadores de barra (ex: (a|b)*abb ou ^[0-9]+$)
      // Ancoramos para validar se a cadeia inteira é aceita pela regex
      const anchored = (rawPattern.startsWith('^') && rawPattern.endsWith('$'))
        ? rawPattern
        : `^(?:${rawPattern})$`;
      regex = new RegExp(anchored);
    }

    const isValid = regex.test(text);

    return {
      isValid,
      message: isValid
        ? 'Cadeia de texto válida para a expressão regular!'
        : 'Cadeia de texto inválida para a expressão regular!'
    };
  } catch (error) {
    return {
      isValid: false,
      message: `Erro na expressão regular: ${error.message}`
    };
  }
}
