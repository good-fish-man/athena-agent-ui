const sourcedLinePattern = /^\s*(?:[-*]\s*)?(.+?)\s+(?:Source|来源)\s*[：:]\s*(https?:\/\/\S+)\s*$/i;

function sourceLabel(rawURL: string) {
  try {
    return new URL(rawURL).hostname.replace(/^www\./i, '');
  } catch {
    return 'source';
  }
}

// Normalize terse model output into readable Markdown without changing facts.
export function formatAssistantOutput(content: string) {
  let index = 0;
  return content.split('\n').map(line => {
    const match = line.match(sourcedLinePattern);
    if (!match) return line;
    index += 1;
    const statement = match[1].trim();
    const url = match[2].replace(/[),.;]+$/, '');
    return `${index}. ${statement}\n\n   [${sourceLabel(url)}](${url})`;
  }).join('\n');
}
