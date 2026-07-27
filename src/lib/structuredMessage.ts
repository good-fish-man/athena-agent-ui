export type ClarificationOption = {
  label: string;
  description?: string;
};

export type ClarificationMessage = {
  question: string;
  options: ClarificationOption[];
  header?: string;
  multi_select?: boolean;
};

function firstJSONObject(content: string) {
  const start = content.indexOf('{');
  if (start < 0) return null;
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let index = start; index < content.length; index += 1) {
    const char = content[index];
    if (inString) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === '"') inString = false;
      continue;
    }
    if (char === '"') inString = true;
    else if (char === '{') depth += 1;
    else if (char === '}') {
      depth -= 1;
      if (depth === 0) return { json: content.slice(start, index + 1), prefix: content.slice(0, start) };
    }
  }
  return null;
}

export function parseClarificationMessage(content: string): { data: ClarificationMessage; prefix: string } | null {
  const candidate = firstJSONObject(content.replace(/^\s*```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, ''));
  if (!candidate) return null;
  try {
    const data = JSON.parse(candidate.json) as ClarificationMessage;
    if (typeof data.question !== 'string' || !Array.isArray(data.options) || data.options.length < 2) return null;
    const validOptions = data.options.every(option => option && typeof option.label === 'string');
    if (!validOptions) return null;
    return { data, prefix: candidate.prefix.trim() };
  } catch {
    return null;
  }
}

export function assistantSpeechText(content: string) {
  return parseClarificationMessage(content)?.data.question || content;
}
