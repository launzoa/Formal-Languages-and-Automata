/**
 * Modelo de Gramática Formal G = (V, T, P, S)
 *
 * Representa e valida uma gramática com:
 * - V: Conjunto de variáveis / não-terminais
 * - T: Conjunto de símbolos terminais
 * - P: Conjunto de produções / regras
 * - S: Símbolo inicial (S ∈ V)
 */

export const EPSILON_SYMBOLS = new Set(['ε', 'ϵ', 'λ', '&', 'E', 'lambda', '']);

/**
 * Verifica se uma cadeia ou símbolo representa a palavra vazia (épsilon).
 * @param {string} str
 * @returns {boolean}
 */
export function isEpsilon(str) {
  if (!str) return true;
  return EPSILON_SYMBOLS.has(str.trim());
}

/**
 * Classe que representa uma produção A -> α.
 */
export class Production {
  /**
   * @param {number} id - Identificador único
   * @param {string} lhs - Lado esquerdo (variável)
   * @param {string} rhsRaw - Lado direito bruto
   * @param {string[]} rhsSymbols - Lista de símbolos individuais do lado direito
   */
  constructor(id, lhs, rhsRaw, rhsSymbols = []) {
    this.id = id;
    this.lhs = lhs;
    this.rhsRaw = rhsRaw;
    this.rhsSymbols = rhsSymbols;
    this.isEpsilon = rhsSymbols.length === 0 || (rhsSymbols.length === 1 && isEpsilon(rhsSymbols[0]));
  }

  /**
   * Retorna a representação formatada da produção (ex: S -> aA).
   * @returns {string}
   */
  toString() {
    const rhsDisplay = this.isEpsilon ? 'ε' : this.rhsSymbols.join('');
    return `${this.lhs} → ${rhsDisplay}`;
  }
}

/**
 * Remove aspas simples, duplas ou tipográficas (smart quotes) ao redor de um símbolo.
 * @param {string} str
 * @returns {string}
 */
export function stripQuotes(str) {
  if (!str) return '';
  return str.replace(/^['"‘’“”]|['"‘’“”]$/g, '').trim();
}

/**
 * Verifica se um símbolo representa um intervalo/classe de caracteres como 'a-z', '0-9', '[a-z]', 'A-Z', etc.
 * @param {string} str
 * @returns {boolean}
 */
export function isRangeTerminal(str) {
  if (!str) return false;
  const clean = stripQuotes(str).replace(/^\[|\]$/g, '').replace(/\s+/g, '');
  if (clean === 'a-z' || clean === 'A-Z' || clean === '0-9') return true;
  return /^[a-zA-Z0-9]-[a-zA-Z0-9]$/.test(clean);
}

/**
 * Classe principal para representar a Gramática G = (V, T, P, S).
 */
export class Grammar {
  constructor() {
    this.V = new Set(); // Variáveis / Não-terminais
    this.T = new Set(); // Terminais
    this.P = [];        // Lista de Production
    this.S = '';        // Símbolo inicial
  }

  /**
   * Verifica se um símbolo é considerado um terminal da gramática (mesmo com aspas ou se for um intervalo).
   * @param {string} sym
   * @returns {boolean}
   */
  hasTerminal(sym) {
    if (!sym || isEpsilon(sym)) return false;
    if (this.T.has(sym)) return true;
    const clean = stripQuotes(sym);
    if (this.T.has(clean) || this.T.has(`'${clean}'`) || this.T.has(`"${clean}"`)) return true;
    if (isRangeTerminal(sym) || isRangeTerminal(clean)) return true;
    return false;
  }

  /**
   * Realiza o parse da quádrupla formal a partir de entradas de texto.
   *
   * @param {string} vInput - Ex: "S, A, B"
   * @param {string} tInput - Ex: "a, b" ou "0, 1"
   * @param {string} pInput - Ex: "S -> aA | b\nA -> bS | ε"
   * @param {string} sInput - Ex: "S"
   * @returns {{ grammar: Grammar, errors: string[], warnings: string[] }}
   */
  static parse(vInput, tInput, pInput, sInput) {
    const grammar = new Grammar();
    const errors = [];
    const warnings = [];

    // Sanitização de entradas com prefixos "V =", "T =", "P =", "S =" ou chaves de conjunto "{...}"
    const cleanV = (vInput || '')
      .replace(/^\s*V\s*[:=]\s*/i, '')
      .replace(/[{}]/g, ' ')
      .trim();

    const cleanT = (tInput || '')
      .replace(/^\s*T\s*[:=]\s*/i, '')
      .replace(/[{}]/g, ' ')
      .trim();

    const cleanP = (pInput || '')
      .replace(/^\s*P\s*[:=]\s*/i, '')
      .trim();

    const cleanS = (sInput || '')
      .replace(/^\s*S\s*[:=]\s*/i, '')
      .replace(/[{}]/g, ' ')
      .trim();

    // 1. Extração de V (Não-terminais)
    if (cleanV) {
      const vTokens = cleanV.split(/[,;\s]+/).map(s => s.trim()).filter(Boolean);
      for (const token of vTokens) {
        grammar.V.add(token);
      }
    }

    // 2. Extração de T (Terminais)
    if (cleanT) {
      const tTokens = cleanT.split(/[,;\s]+/).map(s => s.trim()).filter(Boolean);
      for (const token of tTokens) {
        if (!isEpsilon(token)) {
          grammar.T.add(token);
        }
      }
    }

    // 3. Extração de S (Símbolo inicial)
    if (cleanS) {
      grammar.S = cleanS.trim();
    } else if (grammar.V.size > 0) {
      // Se não informado explicitamente, assume o primeiro de V
      grammar.S = Array.from(grammar.V)[0];
    }

    // 4. Pré-escaneamento para inferir V a partir de todos os LHS se V não foi preenchido
    if (grammar.V.size === 0 && cleanP) {
      const preLines = cleanP.split('\n');
      for (const line of preLines) {
        const arrowMatch = line.match(/^([^->→=:]+)(?:->|→|=>|:)/);
        if (arrowMatch) {
          const lhs = arrowMatch[1].trim();
          if (lhs) grammar.V.add(lhs);
        }
      }
    }

    // 5. Extração de P (Produções)
    if (cleanP) {
      const lines = cleanP.split('\n');
      let prodId = 1;

      for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
        const line = lines[lineIndex].trim();
        if (!line || line.startsWith('#') || line.startsWith('//')) {
          continue; // Ignora vazias e comentários
        }

        // Divide lado esquerdo (LHS) e lado direito (RHS)
        // Suporta ->, →, =>, :
        const arrowMatch = line.match(/^([^->→=:]+)(?:->|→|=>|:)(.*)$/);
        if (!arrowMatch) {
          errors.push(`Linha ${lineIndex + 1}: Formato inválido na produção "${line}". Use "LHS -> RHS".`);
          continue;
        }

        const lhs = arrowMatch[1].trim();
        const rhsFull = arrowMatch[2].trim();

        if (!lhs) {
          errors.push(`Linha ${lineIndex + 1}: Lado esquerdo da produção não pode estar vazio.`);
          continue;
        }

        grammar.V.add(lhs);

        // Divide alternativas separadas por '|'
        const alternatives = rhsFull.split('|');
        for (const alt of alternatives) {
          const trimmedAlt = alt.trim();
          const symbols = Grammar.tokenizeRHS(trimmedAlt, grammar.V, grammar.T);
          const prod = new Production(prodId++, lhs, trimmedAlt, symbols);
          grammar.P.push(prod);
        }
      }
    }

    // Se S ainda não foi definido e temos produções, usa o LHS da primeira produção
    if (!grammar.S && grammar.P.length > 0) {
      grammar.S = grammar.P[0].lhs;
    }

    // Se T estava vazio, infere terminais a partir dos símbolos do RHS que não estão em V
    if (grammar.T.size === 0) {
      for (const p of grammar.P) {
        for (const sym of p.rhsSymbols) {
          if (!grammar.V.has(sym) && !isEpsilon(sym)) {
            grammar.T.add(sym);
          }
        }
      }
    }

    // Validações da quádrupla
    const validation = grammar.validate();
    errors.push(...validation.errors);
    warnings.push(...validation.warnings);

    return {
      grammar,
      errors,
      warnings,
      isValid: errors.length === 0
    };
  }

  /**
   * Tokeniza o lado direito de uma produção em uma lista de símbolos atômicos.
   * Suporta literais com aspas (ex: 'a-z', 'A-Z', '0-9', '_') e símbolos em V e T.
   *
   * @param {string} rhsStr
   * @param {Set<string>} V
   * @param {Set<string>} T
   * @returns {string[]}
   */
  static tokenizeRHS(rhsStr, V, T) {
    if (!rhsStr || isEpsilon(rhsStr)) {
      return [];
    }

    const trimmed = rhsStr.trim();
    if (isEpsilon(trimmed)) {
      return [];
    }

    // Conjunto de todos os símbolos conhecidos ordenados pelo tamanho decrescente
    const knownSymbols = Array.from(new Set([...V, ...T])).sort((a, b) => b.length - a.length);

    const result = [];
    let i = 0;

    while (i < trimmed.length) {
      // Pula espaços
      if (/\s/.test(trimmed[i])) {
        i++;
        continue;
      }

      // Suporte a literais entre aspas ou colchetes: 'a-z', 'A-Z', '0-9', '_', "abc", [a-z], ‘a-z’, “a-z”
      const quoteChars = ["'", '"', '‘', '“', '['];
      if (quoteChars.includes(trimmed[i])) {
        const opening = trimmed[i];
        let closer = opening;
        if (opening === '[') closer = ']';
        else if (opening === '‘') closer = '’';
        else if (opening === '“') closer = '”';

        let j = i + 1;
        while (j < trimmed.length && trimmed[j] !== closer) {
          if (trimmed[j] === '\\' && j + 1 < trimmed.length) j++;
          j++;
        }
        if (j < trimmed.length && trimmed[j] === closer) {
          const quotedToken = trimmed.slice(i, j + 1);
          result.push(quotedToken);
          i = j + 1;
          continue;
        }
      }

      // Suporte a intervalos de caracteres sem aspas (ex: a-z, A-Z, 0-9, a - z)
      const unquotedRangeMatch = trimmed.slice(i).match(/^[a-zA-Z0-9]\s*-\s*[a-zA-Z0-9]/);
      if (unquotedRangeMatch) {
        result.push(unquotedRangeMatch[0].replace(/\s+/g, ''));
        i += unquotedRangeMatch[0].length;
        continue;
      }

      // Tenta casamento guloso com símbolos conhecidos
      let matched = false;
      for (const sym of knownSymbols) {
        if (trimmed.startsWith(sym, i)) {
          result.push(sym);
          i += sym.length;
          matched = true;
          break;
        }
      }

      // Se nenhum símbolo conhecido casou, pega o caractere individual
      if (!matched) {
        const char = trimmed[i];
        if (!isEpsilon(char)) {
          result.push(char);
        }
        i++;
      }
    }

    return result;
  }

  /**
   * Valida a consistência formal da gramática.
   * @returns {{ errors: string[], warnings: string[] }}
   */
  validate() {
    const errors = [];
    const warnings = [];

    // 1. Variáveis V não pode estar vazio
    if (this.V.size === 0) {
      errors.push('O conjunto de variáveis (V) não pode estar vazio.');
    }

    // 2. Terminais T não pode estar vazio
    if (this.T.size === 0) {
      errors.push('O conjunto de símbolos terminais (T) não pode estar vazio.');
    }

    // 3. V e T devem ser disjuntos: V ∩ T = ∅
    for (const v of this.V) {
      if (this.T.has(v)) {
        errors.push(`O símbolo "${v}" está presente simultaneamente em V e em T (V e T devem ser disjuntos).`);
      }
    }

    // 4. Símbolo inicial S deve pertencer a V
    if (!this.S) {
      errors.push('O símbolo inicial (S) deve ser informado.');
    } else if (!this.V.has(this.S)) {
      errors.push(`O símbolo inicial "${this.S}" não pertence ao conjunto de variáveis V.`);
    }

    // 5. Deve haver pelo menos uma produção
    if (this.P.length === 0) {
      errors.push('A gramática deve possuir pelo menos uma regra de produção em P.');
    }

    // 6. Todas as produções devem ter LHS em V
    for (const p of this.P) {
      if (!this.V.has(p.lhs)) {
        errors.push(`Lado esquerdo "${p.lhs}" na produção "${p.toString()}" não pertence a V.`);
      }

      // Verifica se há símbolos não declarados no RHS
      for (const sym of p.rhsSymbols) {
        if (!this.V.has(sym) && !this.hasTerminal(sym)) {
          warnings.push(`Símbolo "${sym}" na produção "${p.toString()}" não foi explicitamente declarado em V nem em T.`);
        }
      }
    }

    return { errors, warnings };
  }
}
