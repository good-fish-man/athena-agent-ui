import React from 'react';
import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import {
  CheckCircle2,
  Code2,
  Edit3,
  Eye,
  FileDiff,
  FileCode2,
  Folder,
  Loader2,
  Minus,
  Plus,
  Search,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  agentApi,
  workspaceApi,
  type WorkspaceContextFile,
  type WorkspaceEditChange,
  type WorkspaceInfo,
  type WorkspaceSearchHit,
  type WorkspaceTreeNode,
} from '../lib/api';
import { cn } from '../lib/utils';
import type { Agent } from '../types';

const MAX_AGENT_ROUNDS = 30;
const MAX_CONTEXT_CHARS = 24 * 1024;
const MAX_CONTEXT_FILE_CHARS = 8 * 1024;

function extractPatch(text: string) {
  const fenced = text.match(/```(?:diff|patch)?\s*([\s\S]*?)```/i);
  const raw = (fenced ? fenced[1] : text).trim();
  const markers = ['diff --git ', '--- a/', '--- '];
  const firstMarker = markers
    .map(marker => raw.indexOf(marker))
    .filter(index => index >= 0)
    .sort((a, b) => a - b)[0];
  return (firstMarker > 0 ? raw.slice(firstMarker) : raw).replace(/\n```[\s\S]*$/, '').trim();
}

function parseModelJson(text: string, t?: TFunction): Record<string, unknown> {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = (fenced ? fenced[1] : text).trim();
  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  if (start < 0 || end <= start) {
    throw new Error(t ? t('workspacePage.modelNoJson') : 'The model did not return JSON');
  }
  return JSON.parse(candidate.slice(start, end + 1));
}

function extractPlanError(text: string) {
  try {
    const plan = parseModelJson(text);
    return typeof plan.error === 'string' ? plan.error.trim() : '';
  } catch {
    return '';
  }
}

function extractEditChanges(text: string, t: TFunction): WorkspaceEditChange[] {
  const plan = parseModelJson(text, t);
  if (typeof plan.error === 'string' && plan.error.trim()) {
    const detail = plan.error.trim();
    if (detail === '缺少的文件或信息') {
      throw new Error(t('workspacePage.contextStillMissing'));
    }
    throw new Error(t('workspacePage.modelMissingContext', { detail }));
  }
  const changes = Array.isArray(plan.changes) ? plan.changes : plan.edits;
  if (!Array.isArray(changes) || changes.length === 0) {
    throw new Error(t('workspacePage.planMissingChanges'));
  }
  if (changes.length > 20) {
    throw new Error(t('workspacePage.tooManyChanges'));
  }
  return changes.map((change: unknown, index: number) => {
    const item = change as Partial<WorkspaceEditChange>;
    const startLine = typeof item.start_line === 'number' && Number.isInteger(item.start_line) && item.start_line > 0
      ? item.start_line
      : undefined;
    const endLine = typeof item.end_line === 'number' && Number.isInteger(item.end_line) && item.end_line >= (startLine || 1)
      ? item.end_line
      : startLine;
    const find = typeof item.find === 'string' && item.find ? item.find : undefined;
    if (typeof item.path !== 'string' || typeof item.replace !== 'string' || (!startLine && !find)) {
      throw new Error(t('workspacePage.invalidChange', { index: index + 1 }));
    }
    const occurrence = typeof item.occurrence === 'number' && Number.isInteger(item.occurrence) && item.occurrence > 0
      ? item.occurrence
      : undefined;
    return { path: item.path, find, replace: item.replace, occurrence, start_line: startLine, end_line: endLine };
  });
}

type DiffLineType = 'add' | 'del' | 'ctx' | 'hunk' | 'meta';

interface DiffLine {
  type: DiffLineType;
  text: string;
  oldLine?: number;
  newLine?: number;
}

interface DiffFile {
  path: string;
  oldPath: string;
  newPath: string;
  additions: number;
  deletions: number;
  lines: DiffLine[];
}

interface WorkspaceReadRequest {
  path: string;
  start_line?: number;
  end_line?: number;
}

interface WorkspaceLoopStep {
  round: number;
  status: 'running' | 'completed' | 'error';
  message: string;
}

function cleanDiffPath(path: string) {
  return path
    .trim()
    .replace(/^"|"$/g, '')
    .replace(/^[ab]\//, '');
}

function pathFromDiffHeader(line: string) {
  const match = line.match(/^diff --git\s+a\/(.+?)\s+b\/(.+)$/);
  return match ? cleanDiffPath(match[2]) : '';
}

function parseUnifiedDiff(patch: string): DiffFile[] {
  const files: DiffFile[] = [];
  let current: DiffFile | null = null;
  let oldLine: number | undefined;
  let newLine: number | undefined;
  const lines = patch.replace(/\n$/, '').split('\n');

  const ensureCurrent = () => {
    if (!current) {
      current = { path: 'unknown', oldPath: '', newPath: '', additions: 0, deletions: 0, lines: [] };
      files.push(current);
    }
    return current;
  };

  for (const line of lines) {
    if (line.startsWith('diff --git ')) {
      oldLine = undefined;
      newLine = undefined;
      current = {
        path: pathFromDiffHeader(line) || `file-${files.length + 1}`,
        oldPath: '',
        newPath: '',
        additions: 0,
        deletions: 0,
        lines: [{ type: 'meta', text: line }],
      };
      files.push(current);
      continue;
    }

    if (line.startsWith('--- ')) {
      const file = ensureCurrent();
      file.oldPath = cleanDiffPath(line.slice(4));
      file.lines.push({ type: 'meta', text: line });
      continue;
    }

    if (line.startsWith('+++ ')) {
      const file = ensureCurrent();
      file.newPath = cleanDiffPath(line.slice(4));
      file.path = file.newPath === '/dev/null' ? file.oldPath : file.newPath;
      file.lines.push({ type: 'meta', text: line });
      continue;
    }

    if (!current) continue;

    if (
      line.startsWith('index ') ||
      line.startsWith('new file mode ') ||
      line.startsWith('deleted file mode ') ||
      line.startsWith('similarity index ') ||
      line.startsWith('rename from ') ||
      line.startsWith('rename to ') ||
      line.startsWith('Binary files ')
    ) {
      current.lines.push({ type: 'meta', text: line });
    } else if (line.startsWith('@@')) {
      const hunk = line.match(/^@@\s+-(\d+)(?:,\d+)?\s+\+(\d+)(?:,\d+)?\s+@@/);
      oldLine = hunk ? Number(hunk[1]) : undefined;
      newLine = hunk ? Number(hunk[2]) : undefined;
      current.lines.push({ type: 'hunk', text: line });
    } else if (line.startsWith('+')) {
      current.additions += 1;
      current.lines.push({ type: 'add', text: line, newLine });
      if (newLine !== undefined) newLine += 1;
    } else if (line.startsWith('-')) {
      current.deletions += 1;
      current.lines.push({ type: 'del', text: line, oldLine });
      if (oldLine !== undefined) oldLine += 1;
    } else {
      const type = line.startsWith('\\') ? 'meta' : 'ctx';
      current.lines.push({ type, text: line, oldLine, newLine });
      if (type === 'ctx') {
        if (oldLine !== undefined) oldLine += 1;
        if (newLine !== undefined) newLine += 1;
      }
    }
  }

  return files.filter(file => file.lines.some(line => line.type === 'add' || line.type === 'del' || line.type === 'hunk'));
}

function flattenFiles(node?: WorkspaceTreeNode): WorkspaceTreeNode[] {
  if (!node) return [];
  if (node.type === 'file') return [node];
  return (node.children || []).flatMap(flattenFiles);
}

function clipPromptContent(content: string, maxChars = MAX_CONTEXT_FILE_CHARS) {
  if (content.length <= maxChars) return content;
  return content.slice(0, maxChars);
}

function numberPromptContent(content: string, startLine = 1) {
  const normalized = content.endsWith('\n') ? content.slice(0, -1) : content;
  return normalized.split('\n').map((line, index) => `${startLine + index} | ${line}`).join('\n');
}

function promptLineCount(content: string) {
  if (!content) return 0;
  return content.split('\n').length - (content.endsWith('\n') ? 1 : 0);
}

function extractReadRequests(text: string, availablePaths: Set<string>): WorkspaceReadRequest[] {
  const result = parseModelJson(text);
  const rawRequests = Array.isArray(result.requests)
    ? result.requests
    : Array.isArray(result.paths)
      ? result.paths.map(path => ({ path }))
      : [];
  return rawRequests
    .flatMap((request: unknown): WorkspaceReadRequest[] => {
      const item = request as Partial<WorkspaceReadRequest>;
      const path = typeof item.path === 'string' ? item.path.replace(/^\.\//, '').trim() : '';
      if (!availablePaths.has(path)) return [];
      const startLine = typeof item.start_line === 'number' && item.start_line > 0 ? Math.floor(item.start_line) : undefined;
      const endLine = typeof item.end_line === 'number' && item.end_line >= (startLine || 1)
        ? Math.floor(item.end_line)
        : undefined;
      return [{ path, start_line: startLine, end_line: endLine }];
    })
    .slice(0, 6);
}

function fallbackContextPaths(files: WorkspaceTreeNode[], excluded: Set<string>) {
  return files
    .filter(file => !excluded.has(file.path) && /\.(?:go|ts|tsx|js|jsx|py|rs|java)$/i.test(file.path))
    .map(file => {
      const path = file.path.toLowerCase();
      let score = 0;
      if (/(?:^|\/)(?:app|main|index)\.[^/]+$/.test(path)) score += 12;
      if (path.includes('/components/')) score += 5;
      if (path.includes('/lib/') || path.includes('/services/')) score += 4;
      if (path.includes('/routes/') || path.includes('/pages/')) score += 4;
      return { path: file.path, score };
    })
    .sort((a, b) => b.score - a.score || a.path.localeCompare(b.path))
    .slice(0, 4)
    .map(file => file.path);
}

function mergeContextFiles(priority: WorkspaceContextFile[], fallback: WorkspaceContextFile[]) {
  const seen = new Set<string>();
  const merged: WorkspaceContextFile[] = [];
  let used = 0;
  for (const file of [...priority, ...fallback]) {
    const key = `${file.path}:${file.start_line || 1}`;
    if (seen.has(key) || used >= MAX_CONTEXT_CHARS) continue;
    seen.add(key);
    const remaining = MAX_CONTEXT_CHARS - used;
    const content = file.content.slice(0, Math.min(MAX_CONTEXT_FILE_CHARS, remaining));
    if (!content) continue;
    merged.push({ ...file, content });
    used += content.length;
  }
  return merged;
}

function buildPatchPrompt(params: {
  workspace: WorkspaceInfo;
  task: string;
  selectedFile?: { path: string; content: string };
  searchHits: WorkspaceSearchHit[];
  files: WorkspaceTreeNode[];
  contextFiles: WorkspaceContextFile[];
  observations?: string[];
  round?: number;
}) {
  const hitText = params.searchHits
    .slice(0, 12)
    .map(hit => `${hit.path}:${hit.line} ${hit.preview}`)
    .join('\n');
  const fileText = params.files
    .slice(0, 120)
    .map(file => file.path)
    .join('\n');
  const contextText = params.contextFiles
    .filter(file => file.path !== params.selectedFile?.path)
    .map(file => [
      `<<<FILE path="${file.path}" line_count="${file.line_count || promptLineCount(file.content)}" excerpt_start="${file.start_line || 1}">>>`,
      numberPromptContent(clipPromptContent(file.content), file.start_line || 1),
      '<<<END FILE>>>',
    ].join('\n'))
    .join('\n\n');
  const loadedContext = params.contextFiles
    .map(file => {
      const start = file.start_line || 1;
      const end = start + Math.max(0, promptLineCount(file.content) - 1);
      return `${file.path}:${start}-${end}/${file.line_count || end}`;
    })
    .join('\n');
  const selectedContent = params.selectedFile
    ? params.contextFiles.find(file => file.path === params.selectedFile?.path)?.content || params.selectedFile.content
    : '';
  const selectedStartLine = params.contextFiles.find(file => file.path === params.selectedFile?.path)?.start_line || 1;
  const selectedLineCount = params.contextFiles.find(file => file.path === params.selectedFile?.path)?.line_count
    || promptLineCount(params.selectedFile?.content || '');

  return [
    '你是一个在受控工具循环中工作的代码修改 Agent。每轮只能选择读取更多上下文或提交结构化编辑。',
    '重要约束：',
    '1. 只输出 JSON，不要输出 Markdown、diff 或解释文字。',
    '2. 上下文不足时输出：{"action":"read","requests":[{"path":"相对路径","start_line":1,"end_line":200}]}。',
    '3. 足够修改时输出：{"action":"edit","changes":[{"path":"相对路径","start_line":10,"end_line":12,"replace":"替换后的完整代码"}]}。',
    '4. start_line 和 end_line 是文件中的真实行号，范围包含首尾两行；replace 是整个行范围替换后的完整文本，删除时可以为空字符串。',
    '5. 每行开头的“行号 | ”只用于定位，不属于源码，绝对不能放入 replace。',
    '6. 追加到文件末尾时，start_line 和 end_line 都必须等于 line_count + 1。',
    '7. 不要返回 error。缺少信息时必须选择 action=read；已经拥有目标代码时必须选择 action=edit。',
    '8. 不要修改用户没有要求修改的内容；多个位置或文件使用多个 changes。',
    '9. <<<FILE ...>>> 和 <<<END FILE>>> 只是内容边界，绝对不是文件中的真实文本。',
    '10. 禁止重复“前序工具观察”中已失败或已执行的 JSON。已读取某范围后，要么提交 edit，要么读取不同范围。',
    `当前轮次：${params.round || 1}`,
    `工作区根目录：${params.workspace.root}`,
    `用户需求：${params.task}`,
    fileText ? `项目文件结构摘要：\n${fileText}` : '',
    hitText ? `搜索上下文：\n${hitText}` : '',
    loadedContext ? `已加载文件范围：\n${loadedContext}` : '',
    params.observations?.length ? `前序工具观察：\n${params.observations.slice(-4).join('\n\n')}` : '',
    contextText ? `自动召回的相关文件内容：\n${contextText}` : '',
    params.selectedFile
      ? `当前选中文件：\n<<<FILE path="${params.selectedFile.path}" line_count="${selectedLineCount}" excerpt_start="${selectedStartLine}">>>\n${numberPromptContent(clipPromptContent(selectedContent), selectedStartLine)}\n<<<END FILE>>>`
      : '',
  ].filter(Boolean).join('\n\n');
}

function TreeNode({
  node,
  level = 0,
  activePath,
  onSelect,
}: {
  node: WorkspaceTreeNode;
  level?: number;
  activePath?: string;
  onSelect: (node: WorkspaceTreeNode) => void;
}) {
  const isFile = node.type === 'file';
  const Icon = isFile ? FileCode2 : Folder;

  return (
    <div>
      <button
        type="button"
        onClick={() => onSelect(node)}
        className={cn(
          'w-full flex items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition-colors',
          activePath === node.path ? 'bg-emerald-100 text-emerald-900' : 'hover:bg-slate-100 text-slate-700'
        )}
        style={{ paddingLeft: `${8 + level * 14}px` }}
      >
        <Icon className={cn('w-4 h-4 shrink-0', isFile ? 'text-slate-400' : 'text-amber-500')} />
        <span className="truncate">{node.name}</span>
      </button>
      {!isFile && node.children?.map(child => (
        <TreeNode
          key={child.path}
          node={child}
          level={level + 1}
          activePath={activePath}
          onSelect={onSelect}
        />
      ))}
    </div>
  );
}

function DiffLineView({ line }: { line: DiffLine }) {
  const style = {
    add: 'bg-emerald-50 text-emerald-900 border-l-emerald-400',
    del: 'bg-rose-50 text-rose-900 border-l-rose-400',
    hunk: 'bg-sky-50 text-sky-800 border-l-sky-300 font-semibold',
    meta: 'bg-slate-100 text-slate-500 border-l-slate-300',
    ctx: 'bg-white text-slate-700 border-l-transparent',
  }[line.type];
  const code = line.type === 'add' || line.type === 'del' || line.type === 'ctx'
    ? line.text.slice(1)
    : line.text;
  return (
    <div className={cn('grid min-w-[620px] grid-cols-[48px_48px_28px_1fr] border-l-2 font-mono text-xs leading-6', style)}>
      <span className="select-none border-r border-slate-200/70 px-2 text-right text-slate-400">
        {line.oldLine ?? ''}
      </span>
      <span className="select-none border-r border-slate-200/70 px-2 text-right text-slate-400">
        {line.newLine ?? ''}
      </span>
      <span className="select-none px-2 text-center font-bold text-slate-500">
        {line.type === 'add' ? '+' : line.type === 'del' ? '-' : ''}
      </span>
      <code className="whitespace-pre px-2">{code || ' '}</code>
    </div>
  );
}

export function ProjectWorkspace() {
  const { t } = useTranslation();
  const [inputPath, setInputPath] = React.useState('/Users/dom/agent-ui');
  const [workspace, setWorkspace] = React.useState<WorkspaceInfo | null>(null);
  const [tree, setTree] = React.useState<WorkspaceTreeNode | null>(null);
  const [selectedPath, setSelectedPath] = React.useState('');
  const [fileContent, setFileContent] = React.useState('');
  const [task, setTask] = React.useState('');
  const [patch, setPatch] = React.useState('');
  const [activePatchPath, setActivePatchPath] = React.useState('');
  const [showRawPatch, setShowRawPatch] = React.useState(false);
  const [patchError, setPatchError] = React.useState('');
  const [searchQuery, setSearchQuery] = React.useState('');
  const [searchHits, setSearchHits] = React.useState<WorkspaceSearchHit[]>([]);
  const [contextFiles, setContextFiles] = React.useState<WorkspaceContextFile[]>([]);
  const [agents, setAgents] = React.useState<Agent[]>([]);
  const [agentId, setAgentId] = React.useState('');
  const [loading, setLoading] = React.useState('');
  const [loopSteps, setLoopSteps] = React.useState<WorkspaceLoopStep[]>([]);

  const allFiles = React.useMemo(() => flattenFiles(tree), [tree]);
  const files = allFiles.slice(0, 80);
  const diffFiles = React.useMemo(() => parseUnifiedDiff(patch), [patch]);
  const activeDiffFile = diffFiles.find(file => file.path === activePatchPath) || diffFiles[0];
  const totalAdditions = diffFiles.reduce((sum, file) => sum + file.additions, 0);
  const totalDeletions = diffFiles.reduce((sum, file) => sum + file.deletions, 0);

  React.useEffect(() => {
    setActivePatchPath(parseUnifiedDiff(patch)[0]?.path || '');
  }, [patch]);

  React.useEffect(() => {
    let canceled = false;
    agentApi.findAll()
      .then(items => {
        if (canceled) return;
        const enabledAgents = (items || []).filter(agent => agent.enabled !== false);
        setAgents(enabledAgents);
        setAgentId(current => current || enabledAgents[0]?.ulid || enabledAgents[0]?.id || '');
      })
      .catch(() => {
        if (!canceled) setAgents([]);
      });
    return () => {
      canceled = true;
    };
  }, []);

  const importWorkspace = async () => {
    if (!inputPath.trim()) {
      toast.error(t('workspacePage.enterPath'));
      return;
    }
    setLoading('import');
    try {
      const next = await workspaceApi.import(inputPath.trim());
      const treeData = await workspaceApi.tree(next.id);
      setWorkspace(next);
      setTree(treeData.tree);
      setSelectedPath('');
      setFileContent('');
      setContextFiles([]);
      setPatch('');
      setPatchError('');
      toast.success(t('workspacePage.imported'));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('workspacePage.importFailed'));
    } finally {
      setLoading('');
    }
  };

  const selectAndImportFolder = async () => {
    setLoading('select');
    try {
      const selected = await workspaceApi.selectFolder();
      if (!selected.path) return;
      setInputPath(selected.path);
      const next = await workspaceApi.import(selected.path);
      const treeData = await workspaceApi.tree(next.id);
      setWorkspace(next);
      setTree(treeData.tree);
      setSelectedPath('');
      setFileContent('');
      setContextFiles([]);
      setPatch('');
      setPatchError('');
      toast.success(t('workspacePage.imported'));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('workspacePage.selectFailed'));
    } finally {
      setLoading('');
    }
  };

  const readFile = async (node: WorkspaceTreeNode) => {
    if (!workspace || node.type !== 'file') return;
    setSelectedPath(node.path);
    setLoading('file');
    try {
      const data = await workspaceApi.readFile(workspace.id, node.path);
      setFileContent(data.content);
    } catch (error) {
      setFileContent('');
      toast.error(error instanceof Error ? error.message : t('workspacePage.readFailed'));
    } finally {
      setLoading('');
    }
  };

  const searchWorkspace = async () => {
    if (!workspace || !searchQuery.trim()) return;
    setLoading('search');
    try {
      const data = await workspaceApi.search(workspace.id, searchQuery.trim());
      setSearchHits(data.hits || []);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('workspacePage.searchFailed'));
    } finally {
      setLoading('');
    }
  };

  const generatePatch = async () => {
    if (!workspace || !task.trim()) {
      toast.error(t('workspacePage.requireWorkspaceTask'));
      return;
    }
    setLoading('generate');
    setPatch('');
    setPatchError('');
    setShowRawPatch(false);
    setLoopSteps([]);
    try {
      const contextData = await workspaceApi.context(workspace.id, task.trim(), 6);
      const recalled = contextData.files || [];
      const availablePaths = new Set(allFiles.map(file => file.path));
      const readContextRequests = async (requests: WorkspaceReadRequest[]) => {
        const results = await Promise.all(requests.map(async request => {
          try {
            const data = await workspaceApi.readFile(workspace.id, request.path);
            const lines = data.content.endsWith('\n')
              ? data.content.slice(0, -1).split('\n')
              : data.content.split('\n');
            const startLine = Math.max(1, Math.min(request.start_line || 1, data.line_count || 1));
            const endLine = Math.max(startLine, Math.min(request.end_line || startLine + 249, data.line_count || startLine));
            return {
              path: request.path,
              content: lines.slice(startLine - 1, endLine).join('\n'),
              size: data.size,
              score: 100,
              start_line: startLine,
              line_count: data.line_count,
            } satisfies WorkspaceContextFile;
          } catch {
            return null;
          }
        }));
        return results.filter((file): file is NonNullable<typeof file> => file !== null);
      };
      let resolvedContext = mergeContextFiles([], recalled);
      if (resolvedContext.length === 0 && !selectedPath) {
        const fallbackPaths = fallbackContextPaths(allFiles, new Set());
        resolvedContext = mergeContextFiles(
          await readContextRequests(fallbackPaths.map(path => ({ path }))),
          [],
        );
      }
      setContextFiles(resolvedContext);
      const observations: string[] = [];
      const seenResponses = new Set<string>();
      let lastError = t('workspacePage.agentNoPatch');

      for (let round = 1; round <= MAX_AGENT_ROUNDS; round += 1) {
        setLoopSteps(previous => [
          ...previous.filter(step => step.round !== round),
          { round, status: 'running', message: t('workspacePage.agentAnalyzing') },
        ]);
        let text: string;
        try {
          text = await workspaceApi.generatePatch(buildPatchPrompt({
            workspace,
            task,
            selectedFile: selectedPath ? { path: selectedPath, content: fileContent } : undefined,
            searchHits,
            files: allFiles,
            contextFiles: resolvedContext,
            observations,
            round,
          }), agentId || undefined);
        } catch (error) {
          lastError = error instanceof Error ? error.message : t('workspacePage.modelCallFailed');
          setLoopSteps(previous => previous.map(step => step.round === round
            ? { ...step, status: 'error', message: lastError }
            : step));
          throw error;
        }

        const signature = text.trim();
        if (!signature) {
          lastError = t('workspacePage.modelEmpty');
          observations.push(`第 ${round} 轮：${lastError}，下一轮必须选择 read 或 edit。`);
          setLoopSteps(previous => previous.map(step => step.round === round
            ? { ...step, status: 'error', message: lastError }
            : step));
          continue;
        }
        if (seenResponses.has(signature)) {
          let recoveryRequests: WorkspaceReadRequest[] = [];
          try {
            const repeatedReads = extractReadRequests(text, availablePaths);
            recoveryRequests = repeatedReads.flatMap(request => {
              const loaded = resolvedContext.filter(file => file.path === request.path);
              const furthestLine = loaded.reduce((max, file) => Math.max(
                max,
                (file.start_line || 1) + Math.max(0, promptLineCount(file.content) - 1),
              ), 0);
              const lineCount = loaded.find(file => file.line_count)?.line_count || 0;
              if (lineCount > furthestLine) {
                return [{
                  path: request.path,
                  start_line: furthestLine + 1,
                  end_line: Math.min(lineCount, furthestLine + 250),
                }];
              }
              return [];
            });
          } catch {
            recoveryRequests = [];
          }
          if (recoveryRequests.length === 0) {
            try {
              const repeatedChanges = extractEditChanges(text, t);
              recoveryRequests = repeatedChanges.map(change => ({
                path: change.path,
                start_line: change.start_line ? Math.max(1, change.start_line - 80) : undefined,
                end_line: change.end_line ? change.end_line + 80 : undefined,
              }));
            } catch {
              const loadedPaths = new Set(resolvedContext.map(file => file.path));
              recoveryRequests = fallbackContextPaths(allFiles, loadedPaths).map(path => ({ path }));
            }
          }
          const recoveryContext = await readContextRequests(recoveryRequests);
          lastError = t('workspacePage.modelRepeated');
          observations.push(
            `第 ${round} 轮：${lastError}。以下 JSON 已被拒绝，禁止再次返回：${signature.slice(0, 1600)}`,
          );
          if (recoveryContext.length > 0) {
            resolvedContext = mergeContextFiles(recoveryContext, resolvedContext);
            setContextFiles(resolvedContext);
            const recovered = recoveryContext.map(file => `${file.path}:${file.start_line}`).join(', ');
            observations.push(`系统自动扩展了不同上下文：${recovered}`);
            setLoopSteps(previous => previous.map(step => step.round === round
              ? { ...step, status: 'completed', message: t('workspacePage.repeatRecovered', { context: recovered }) }
              : step));
          } else {
            setLoopSteps(previous => previous.map(step => step.round === round
              ? { ...step, status: 'error', message: t('workspacePage.repeatNoContext', { error: lastError }) }
              : step));
          }
          continue;
        }
        seenResponses.add(signature);

        const directPatch = extractPatch(text);
        if (parseUnifiedDiff(directPatch).length > 0) {
          try {
            await workspaceApi.applyPatch(workspace.id, directPatch, true);
            setPatch(directPatch);
            setShowRawPatch(false);
            setLoopSteps(previous => previous.map(step => step.round === round
              ? { ...step, status: 'completed', message: t('workspacePage.patchGenerated') }
              : step));
            toast.success(t('workspacePage.patchGeneratedRound', { round }));
            return;
          } catch (error) {
            lastError = error instanceof Error ? error.message : t('workspacePage.patchValidationFailed');
            observations.push(`第 ${round} 轮补丁校验失败：${lastError}\n禁止重复补丁：${signature.slice(0, 1600)}`);
            setLoopSteps(previous => previous.map(step => step.round === round
              ? { ...step, status: 'error', message: lastError }
              : step));
            continue;
          }
        }

        let readRequests: WorkspaceReadRequest[] = [];
        try {
          readRequests = extractReadRequests(text, availablePaths);
        } catch {
          readRequests = [];
        }
        const planError = extractPlanError(text);
        if (readRequests.length > 0 || planError) {
          if (readRequests.length === 0) {
            const loadedPaths = new Set(resolvedContext.map(file => file.path));
            readRequests = fallbackContextPaths(allFiles, loadedPaths).map(path => ({ path }));
          }
          const supplemental = await readContextRequests(readRequests);
          if (supplemental.length === 0) {
            lastError = planError || t('workspacePage.noNewFiles');
            observations.push(`第 ${round} 轮读取失败：${lastError}`);
            setLoopSteps(previous => previous.map(step => step.round === round
              ? { ...step, status: 'error', message: lastError }
              : step));
            continue;
          }
          resolvedContext = mergeContextFiles(supplemental, resolvedContext);
          setContextFiles(resolvedContext);
          const paths = supplemental.map(file => `${file.path}:${file.start_line}`).join(', ');
          observations.push(`第 ${round} 轮读取成功：${paths}`);
          setLoopSteps(previous => previous.map(step => step.round === round
            ? { ...step, status: 'completed', message: t('workspacePage.filesRead', { paths }) }
            : step));
          continue;
        }

        let changes: WorkspaceEditChange[];
        try {
          changes = extractEditChanges(text, t);
        } catch (error) {
          lastError = error instanceof Error ? error.message : t('workspacePage.invalidPlan');
          observations.push(`第 ${round} 轮计划解析失败：${lastError}\n禁止重复结果：${signature.slice(0, 1600)}`);
          setLoopSteps(previous => previous.map(step => step.round === round
            ? { ...step, status: 'error', message: lastError }
            : step));
          continue;
        }

        let built: { patch: string };
        try {
          built = await workspaceApi.buildPatch(workspace.id, changes);
        } catch (error) {
          lastError = error instanceof Error ? error.message : t('workspacePage.planValidationFailed');
          observations.push(`第 ${round} 轮编辑器拒绝计划：${lastError}\n禁止重复计划：${signature.slice(0, 1600)}`);
          const targetPaths = [...new Set(changes.map(change => change.path))]
            .filter(path => availablePaths.has(path));
          const refreshed = await readContextRequests(targetPaths.map(path => ({ path })));
          resolvedContext = mergeContextFiles(refreshed, resolvedContext);
          setContextFiles(resolvedContext);
          setLoopSteps(previous => previous.map(step => step.round === round
            ? { ...step, status: 'error', message: lastError }
            : step));
          continue;
        }

        try {
          await workspaceApi.applyPatch(workspace.id, built.patch, true);
          setPatch(built.patch);
          setShowRawPatch(false);
          setLoopSteps(previous => previous.map(step => step.round === round
            ? { ...step, status: 'completed', message: t('workspacePage.editPlanReady') }
            : step));
          toast.success(t('workspacePage.patchGeneratedRound', { round }));
          return;
        } catch (error) {
          lastError = error instanceof Error ? error.message : t('workspacePage.dryRunFailed');
          observations.push(`第 ${round} 轮 dry-run 失败：${lastError}\n禁止重复计划：${signature.slice(0, 1600)}`);
          setLoopSteps(previous => previous.map(step => step.round === round
            ? { ...step, status: 'error', message: lastError }
            : step));
        }
      }

      throw new Error(t('workspacePage.roundLimit', { count: MAX_AGENT_ROUNDS, error: lastError }));
    } catch (error) {
      const message = error instanceof Error ? error.message : t('workspacePage.generateFailed');
      setPatchError(message);
      toast.error(message);
    } finally {
      setLoading('');
    }
  };

  const applyPatch = async (dryRun: boolean) => {
    if (!workspace || !patch.trim()) return;
    setLoading(dryRun ? 'check' : 'apply');
    try {
      await workspaceApi.applyPatch(workspace.id, patch, dryRun);
      setPatchError('');
      toast.success(dryRun ? t('workspacePage.patchValid') : t('workspacePage.patchApplied'));
      if (!dryRun) {
        const treeData = await workspaceApi.tree(workspace.id);
        setTree(treeData.tree);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : t('workspacePage.patchProcessFailed');
      setPatchError(message);
      toast.error(message);
    } finally {
      setLoading('');
    }
  };

  return (
    <div className="theme-canvas min-h-full p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <header className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-white/70 px-3 py-1 text-xs font-semibold text-emerald-700 shadow-sm">
              <Code2 className="w-3.5 h-3.5" />
              {t('workspacePage.badge')}
            </div>
            <h1 className="mt-4 text-3xl font-bold tracking-tight text-slate-950">{t('workspacePage.title')}</h1>
            <p className="mt-2 text-slate-600">
              {t('workspacePage.subtitle')}
            </p>
          </div>
          <div className="flex w-full lg:w-[620px] rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">
            <input
              value={inputPath}
              onChange={event => setInputPath(event.target.value)}
              className="min-w-0 flex-1 bg-transparent px-3 text-sm outline-none"
              placeholder="/Users/dom/your-project"
            />
            <button
              type="button"
              onClick={selectAndImportFolder}
              disabled={loading === 'select' || loading === 'import'}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
            >
              {loading === 'select' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Folder className="w-4 h-4" />}
              {t('workspacePage.selectFolder')}
            </button>
            <button
              type="button"
              onClick={importWorkspace}
              disabled={loading === 'import'}
              className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-slate-800 disabled:opacity-60"
            >
              {loading === 'import' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Folder className="w-4 h-4" />}
              {t('workspacePage.importFolder')}
            </button>
          </div>
        </header>

        <section className="grid grid-cols-1 xl:grid-cols-[360px_1fr_420px] gap-5">
          <aside className="rounded-3xl border border-white/70 bg-white/85 p-4 shadow-sm backdrop-blur">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-semibold text-slate-900">{t('workspacePage.fileTree')}</h2>
                <p className="text-xs text-slate-500 truncate max-w-[280px]">{workspace?.root || t('workspacePage.noFolder')}</p>
              </div>
              {workspace && <ShieldCheck className="w-5 h-5 text-emerald-600" />}
            </div>
            <div className="mt-4 flex gap-2">
              <input
                value={searchQuery}
                onChange={event => setSearchQuery(event.target.value)}
                onKeyDown={event => {
                  if (event.key === 'Enter') searchWorkspace();
                }}
                className="min-w-0 flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-emerald-400"
                placeholder={t('workspacePage.searchPlaceholder')}
              />
              <button
                type="button"
                onClick={searchWorkspace}
                disabled={!workspace || loading === 'search'}
                className="rounded-xl border border-slate-200 px-3 text-slate-600 hover:bg-slate-50 disabled:opacity-50"
              >
                {loading === 'search' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              </button>
            </div>
            <div className="mt-4 max-h-[620px] overflow-y-auto pr-1">
              {tree ? (
                <TreeNode node={tree} activePath={selectedPath} onSelect={readFile} />
              ) : (
                <div className="rounded-2xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500">
                  {t('workspacePage.importHint')}
                </div>
              )}
            </div>
          </aside>

          <main className="rounded-3xl border border-white/70 bg-white/90 shadow-sm backdrop-blur overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <div>
                <h2 className="font-semibold text-slate-900">{t('workspacePage.contextPreview')}</h2>
                <p className="text-xs text-slate-500">{selectedPath || t('workspacePage.selectContextFile')}</p>
              </div>
              {loading === 'file' && <Loader2 className="w-4 h-4 animate-spin text-slate-400" />}
            </div>
            <pre className="h-[440px] overflow-auto bg-slate-950 p-5 text-xs leading-5 text-slate-100">
              {fileContent || t('workspacePage.filePreviewEmpty')}
            </pre>
            <div className="border-t border-slate-100 p-5">
              <h3 className="text-sm font-semibold text-slate-900">{t('workspacePage.searchHits')}</h3>
              <div className="mt-3 max-h-40 space-y-2 overflow-y-auto">
                {searchHits.length > 0 ? searchHits.map(hit => (
                  <button
                    key={`${hit.path}:${hit.line}`}
                    type="button"
                    onClick={() => readFile({ name: hit.path.split('/').pop() || hit.path, path: hit.path, type: 'file' })}
                    className="block w-full rounded-xl bg-slate-50 px-3 py-2 text-left text-xs hover:bg-emerald-50"
                  >
                    <span className="font-semibold text-emerald-700">{hit.path}:{hit.line}</span>
                    <span className="ml-2 text-slate-600">{hit.preview}</span>
                  </button>
                )) : (
                  <p className="text-sm text-slate-500">{t('workspacePage.noSearchResults')}</p>
                )}
              </div>
            </div>
          </main>

          <aside className="rounded-3xl border border-white/70 bg-white/90 p-5 shadow-sm backdrop-blur">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-emerald-600" />
              <h2 className="font-semibold text-slate-900">{t('workspacePage.agentTask')}</h2>
            </div>
            <textarea
              value={task}
              onChange={event => setTask(event.target.value)}
              className="mt-4 h-32 w-full resize-none rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-emerald-400"
              placeholder={t('workspacePage.taskPlaceholder')}
            />
            <div className="mt-3">
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">{t('workspacePage.useAgent')}</label>
              <select
                value={agentId}
                onChange={event => setAgentId(event.target.value)}
                className="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-emerald-400"
              >
                <option value="">{t('workspacePage.defaultModel')}</option>
                {agents.map(agent => (
                  <option key={agent.ulid || agent.id} value={agent.ulid || agent.id}>
                    {agent.name}
                  </option>
                ))}
              </select>
              <p className="mt-2 text-xs text-slate-500">
                {t('workspacePage.agentHint')}
              </p>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-500">
              <div className="rounded-2xl bg-slate-50 p-3">
                <div className="font-semibold text-slate-700">{files.length}</div>
                <div>{t('workspacePage.indexedFiles')}</div>
              </div>
              <div className="rounded-2xl bg-emerald-50 p-3">
                <div className="font-semibold text-emerald-700">{contextFiles.length || t('workspacePage.auto')}</div>
                <div>{t('workspacePage.recalledContext')}</div>
              </div>
            </div>
            <button
              type="button"
              onClick={generatePatch}
              disabled={!workspace || !task.trim() || loading === 'generate'}
              className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50"
            >
              {loading === 'generate' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              {t('workspacePage.generatePatch')}
            </button>
            {loopSteps.length > 0 && (
              <div className="mt-3 rounded-2xl border border-slate-200 bg-white p-3">
                <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
                  <span>{t('workspacePage.agentLoop')}</span>
                  <span>{t('workspacePage.roundCount', { current: loopSteps.length, total: MAX_AGENT_ROUNDS })}</span>
                </div>
                <div className="mt-2 space-y-2">
                  {loopSteps.map(step => (
                    <div key={step.round} className="flex items-start gap-2 text-xs">
                      {step.status === 'running' ? (
                        <Loader2 className="mt-0.5 h-3.5 w-3.5 shrink-0 animate-spin text-sky-500" />
                      ) : step.status === 'completed' ? (
                        <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500" />
                      ) : (
                        <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-rose-400" />
                      )}
                      <div className="min-w-0">
                        <span className="font-semibold text-slate-700">{t('workspacePage.round', { round: step.round })}</span>
                        <p className="mt-0.5 break-words leading-5 text-slate-500">{step.message}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50/80 p-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                    <FileDiff className="h-4 w-4 text-emerald-600" />
                    {t('workspacePage.changePreview')}
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    {diffFiles.length > 0
                      ? t('workspacePage.diffSummary', { count: diffFiles.length, additions: totalAdditions, deletions: totalDeletions })
                      : t('workspacePage.diffEmptyHint')}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowRawPatch(value => !value)}
                  className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100"
                >
                  {showRawPatch ? <Eye className="h-3.5 w-3.5" /> : <Edit3 className="h-3.5 w-3.5" />}
                  {showRawPatch ? t('workspacePage.viewPreview') : t('workspacePage.editRawPatch')}
                </button>
              </div>

              {patchError && (
                <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs leading-5 text-rose-700">
                  {patchError}
                </div>
              )}

              {showRawPatch ? (
                <textarea
                  value={patch}
                  onChange={event => {
                    setPatch(event.target.value);
                    setPatchError('');
                  }}
                  className="mt-3 h-72 w-full resize-none rounded-2xl border border-slate-200 bg-slate-950 px-4 py-3 font-mono text-xs leading-5 text-slate-100 outline-none focus:border-emerald-400"
                  placeholder={t('workspacePage.rawPatchPlaceholder')}
                />
              ) : diffFiles.length > 0 ? (
                <div className="mt-3 grid grid-cols-1 gap-3">
                  <div className="max-h-40 space-y-2 overflow-y-auto pr-1">
                    {diffFiles.map(file => (
                      <button
                        key={file.path}
                        type="button"
                        onClick={() => setActivePatchPath(file.path)}
                        className={cn(
                          'w-full rounded-xl border px-3 py-2 text-left transition-colors',
                          activeDiffFile?.path === file.path
                            ? 'border-emerald-300 bg-white shadow-sm'
                            : 'border-transparent bg-white/70 hover:bg-white'
                        )}
                      >
                        <div className="flex items-center gap-2">
                          <FileCode2 className="h-4 w-4 shrink-0 text-slate-400" />
                          <span className="min-w-0 flex-1 truncate text-xs font-semibold text-slate-800">{file.path}</span>
                        </div>
                        <div className="mt-1 flex items-center gap-3 text-xs">
                          <span className="inline-flex items-center gap-1 text-emerald-700">
                            <Plus className="h-3 w-3" />
                            {file.additions}
                          </span>
                          <span className="inline-flex items-center gap-1 text-rose-700">
                            <Minus className="h-3 w-3" />
                            {file.deletions}
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>
                  <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                    <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2">
                      <span className="truncate text-xs font-semibold text-slate-700">
                        {activeDiffFile?.path || t('workspacePage.noFileSelected')}
                      </span>
                      <span className="text-[10px] font-medium uppercase tracking-wider text-slate-400">
                        {t('workspacePage.oldNewLines')}
                      </span>
                    </div>
                    <div className="max-h-[420px] overflow-auto bg-white">
                      {activeDiffFile?.lines.filter(line => line.type !== 'meta').map((line, index) => (
                        <DiffLineView key={`${activeDiffFile.path}-${index}`} line={line} />
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="mt-3 rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-8 text-center text-sm text-slate-500">
                  {t('workspacePage.noDiff')}
                </div>
              )}
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => applyPatch(true)}
                disabled={!patch.trim() || loading === 'check'}
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-emerald-200 bg-white px-4 py-3 text-sm font-semibold text-emerald-700 hover:bg-emerald-50 disabled:opacity-50"
              >
                {loading === 'check' ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                {t('workspacePage.validatePatch')}
              </button>
              <button
                type="button"
                onClick={() => applyPatch(false)}
                disabled={!patch.trim() || loading === 'apply'}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
              >
                {loading === 'apply' ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
                {t('workspacePage.applyToFolder')}
              </button>
            </div>
          </aside>
        </section>
      </div>
    </div>
  );
}
