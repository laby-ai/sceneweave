export function repairFilmScriptJson(raw: string): string {
  let s = raw;
  s = s.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '');
  s = s.replace(/[\u201C\u201D]/g, '"');
  s = s.replace(/[\u2018\u2019]/g, "'");
  s = s.replace(/：/g, ':');
  s = s.replace(/，/g, ',');
  s = s.replace(/；/g, ';');
  s = s.replace(/\/\/.*$/gm, '');
  s = s.replace(/\/\*[\s\S]*?\*\//g, '');
  s = s.replace(/,\s*([\]}])/g, '$1');
  s = s.replace(/([{,]\s*)([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g, '$1"$2":');
  s = s.replace(/:\s*'([^']*?)'\s*([,}\]])/g, ': "$1"$2');
  s = s.replace(/:\s*"([^"]*)\n([^"]*)"([,}\]])/g, (_match: string, p1: string, p2: string, p3: string) =>
    `: "${p1}\\n${p2}"${p3}`
  );

  const braceStart = s.indexOf('{');
  const braceEnd = s.lastIndexOf('}');
  if (braceStart > 0 || braceEnd < s.length - 1) {
    s = s.substring(braceStart, braceEnd + 1);
  }

  s = s.replace(/"\s*\n\s*"/g, '",\n"');
  s = s.replace(/(\d)\s*\n\s*"/g, '$1,\n"');
  s = s.replace(/}\s*\n\s*{"/g, '},\n{"');
  s = s.replace(/}\s*\n\s*"/g, '},\n"');
  s = s.replace(/]\s*\n\s*"/g, '],\n"');
  return s;
}

function findMatchingBracket(str: string, startIdx: number): number {
  const openChar = str[startIdx];
  const closeChar = openChar === '[' ? ']' : '}';
  let depth = 1;
  let inString = false;
  let escape = false;

  for (let i = startIdx + 1; i < str.length && depth > 0; i++) {
    const ch = str[i];
    if (escape) {
      escape = false;
      continue;
    }
    if (ch === '\\') {
      escape = true;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (ch === openChar) depth++;
    else if (ch === closeChar) depth--;
    if (depth === 0) return i;
  }

  return -1;
}

function closeBraces(str: string): string {
  let inString = false;
  let escape = false;
  let needBracket = '';

  for (let i = 0; i < str.length; i++) {
    const ch = str[i];
    if (escape) {
      escape = false;
      continue;
    }
    if (ch === '\\') {
      escape = true;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (ch === '{') needBracket = '}' + needBracket;
    else if (ch === '}') needBracket = needBracket.slice(1);
    else if (ch === '[') needBracket = ']' + needBracket;
    else if (ch === ']') needBracket = needBracket.slice(1);
  }

  if (inString) str += '"';
  str = str.replace(/,\s*$/, '');
  return str + needBracket;
}

function repairArrayElements(arrayStr: string): unknown[] {
  const results: unknown[] = [];
  let i = 0;

  while (i < arrayStr.length) {
    const objStart = arrayStr.indexOf('{', i);
    if (objStart < 0) break;

    const objEnd = findMatchingBracket(arrayStr, objStart);
    if (objEnd < 0) {
      const closed = closeBraces(arrayStr.substring(objStart));
      try {
        results.push(JSON.parse(repairFilmScriptJson(closed)));
      } catch {
        // Skip malformed trailing object.
      }
      break;
    }

    const elementStr = arrayStr.substring(objStart, objEnd + 1);
    try {
      results.push(JSON.parse(repairFilmScriptJson(elementStr)));
    } catch {
      // Skip malformed object.
    }
    i = objEnd + 1;
  }

  return results;
}

function extractJsonArray(jsonStr: string, key: string): unknown[] {
  const keyPattern = new RegExp(`"${key}"\\s*:\\s*\\[`, 'g');
  const match = keyPattern.exec(jsonStr);
  if (!match) return [];

  const bracketStart = jsonStr.indexOf('[', match.index);
  if (bracketStart < 0) return [];

  const bracketEnd = findMatchingBracket(jsonStr, bracketStart);
  if (bracketEnd < 0) {
    return repairArrayElements(jsonStr.substring(bracketStart));
  }

  const arrayStr = jsonStr.substring(bracketStart, bracketEnd + 1);
  try {
    return JSON.parse(arrayStr);
  } catch {
    try {
      return JSON.parse(repairFilmScriptJson(arrayStr));
    } catch {
      return repairArrayElements(arrayStr);
    }
  }
}

export function parseFilmScriptJson(content: string): Record<string, unknown> {
  let jsonStr: string;
  const codeBlockMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlockMatch) {
    jsonStr = codeBlockMatch[1].trim();
  } else {
    const braceMatch = content.match(/\{[\s\S]*\}/);
    jsonStr = braceMatch ? braceMatch[0] : content;
  }

  try {
    const parsed = JSON.parse(jsonStr);
    console.log('[Film Script Agent] parseFilmScriptJson: direct parse succeeded');
    return parsed;
  } catch (error) {
    console.log('[Film Script Agent] parseFilmScriptJson: direct parse failed:', (error as Error).message?.substring(0, 80));
  }

  try {
    const parsed = JSON.parse(repairFilmScriptJson(jsonStr));
    console.log('[Film Script Agent] parseFilmScriptJson: repaired parse succeeded');
    return parsed;
  } catch (error) {
    console.log('[Film Script Agent] parseFilmScriptJson: repaired parse failed:', (error as Error).message?.substring(0, 80));
  }

  try {
    const repaired = repairFilmScriptJson(jsonStr);
    for (let i = repaired.length - 1; i >= 0; i--) {
      if (repaired[i] !== '}') continue;
      try {
        const parsed = JSON.parse(repaired.substring(0, i + 1));
        if (parsed && (parsed.screenplay || parsed.shots || parsed.characters || parsed.scenes)) {
          return parsed;
        }
      } catch {
        // Try the previous closing brace.
      }
    }
  } catch {
    // Continue to field-level extraction.
  }

  try {
    const result: Record<string, unknown> = {};
    const titleMatch = jsonStr.match(/"title"\s*:\s*"([^"]*)"/);
    if (titleMatch) result.title = titleMatch[1];
    const coreThemeMatch = jsonStr.match(/"coreTheme"\s*:\s*"([^"]*)"/);
    if (coreThemeMatch) result.coreTheme = coreThemeMatch[1];
    const styleMatch = jsonStr.match(/"style"\s*:\s*"([^"]*)"/);
    if (styleMatch) result.style = styleMatch[1];

    result.screenplay = extractJsonArray(jsonStr, 'screenplay');
    result.shots = extractJsonArray(jsonStr, 'shots');
    result.characterCards = extractJsonArray(jsonStr, 'characterCards');
    result.sceneCards = extractJsonArray(jsonStr, 'sceneCards');
    result.propCards = extractJsonArray(jsonStr, 'propCards');
    result.characters = extractJsonArray(jsonStr, 'characters');
    result.scenes = extractJsonArray(jsonStr, 'scenes');

    const narrationMatch = jsonStr.match(/"narrationScript"\s*:\s*"([\s\S]*?)"(?:\s*[,}])/);
    if (narrationMatch) result.narrationScript = narrationMatch[1];
    const bgmMatch = jsonStr.match(/"bgmSuggestion"\s*:\s*"([^"]*)"/);
    if (bgmMatch) result.bgmSuggestion = bgmMatch[1];

    if (result.screenplay || result.shots || result.characters || result.scenes) {
      console.log(
        '[Film Script Agent] parseFilmScriptJson: field extraction succeeded, sp:',
        (result.screenplay as unknown[])?.length,
        'shots:',
        (result.shots as unknown[])?.length,
        'chars:',
        (result.characters as unknown[])?.length,
        'scenes:',
        (result.scenes as unknown[])?.length
      );
      return result;
    }
  } catch {
    // Fall through to user-facing parse error.
  }

  throw new Error('无法从AI响应中解析脚本JSON，LLM返回格式异常');
}
