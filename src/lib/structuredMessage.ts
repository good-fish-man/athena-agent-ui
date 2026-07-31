export type ClarificationOption = {
  label: string;
  description?: string;
};

export type ClarificationQuestion = {
  question: string;
  options: ClarificationOption[];
  header?: string;
  multi_select?: boolean;
};

export type ClarificationMessage = {
  intro?: string;
  questions: ClarificationQuestion[];
};

type LegacyClarificationMessage = ClarificationQuestion & { intro?: string };

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
    const raw = JSON.parse(candidate.json) as Partial<ClarificationMessage & LegacyClarificationMessage>;
    const questions = Array.isArray(raw.questions)
      ? raw.questions
      : typeof raw.question === 'string' && Array.isArray(raw.options)
        ? [{ question: raw.question, options: raw.options, header: raw.header, multi_select: raw.multi_select }]
        : [];
    if (questions.length < 1 || questions.length > 3) return null;
    const valid = questions.every(question =>
      typeof question.question === 'string'
      && Array.isArray(question.options)
      && question.options.length >= 2
      && question.options.length <= 4
      && question.options.every(option => option && typeof option.label === 'string')
    );
    if (!valid) return null;
    const intro = typeof raw.intro === 'string' ? raw.intro : undefined;
    return { data: { intro, questions }, prefix: candidate.prefix.trim() };
  } catch {
    return null;
  }
}

export function assistantSpeechText(content: string) {
  const clarification = parseClarificationMessage(content)?.data;
  if (!clarification) return content;
  return [clarification.intro, ...clarification.questions.map(item => item.question)].filter(Boolean).join(' ');
}
