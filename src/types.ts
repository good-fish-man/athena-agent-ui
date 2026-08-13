import type { ModelRuntimeMode } from './lib/runtimeConstants';

export type View = 'dashboard' | 'orchestrator' | 'agents' | 'skills' | 'knowledge' | 'models' | 'media' | 'chat' | 'workspace' | 'website-accounts' | 'settings' | 'inbox';

export interface Agent {
  ulid?: string;
  id: string;
  name: string;
  description: string;
  model: string;
  embedding_model?: string;
  image_model?: string;
  video_model?: string;
  icon: string;
  config?: any;
  config_json?: any;
  is_system?: boolean;
  enabled?: boolean;
  skills: string[];
  capabilities: string[];
  knowledgeBases?: string[];
  isBuiltIn?: boolean;
  channels?: string[];
  is_periodic?: boolean;  // snake_case from backend API
  cron_rule?: string;     // snake_case from backend API
  isPeriodic?: boolean;
  cronRule?: string;
  logs?: AgentLog[];
  memoryLimit?: number;
  longTermMemory?: boolean;
  temperature?: number;
  maxTokens?: number;
  topK?: number;
  rerank?: boolean;
  variables?: Variable[];
  retryCount?: number;
  retryInterval?: number;
  timeout?: number;
  endpoint?: string;
  maxIterations?: number;
  stream?: boolean;
  sandbox?: {
    enabled: boolean;
    mode: 'docker' | 'local';
    image?: string;
    workdir?: string;
    timeoutMs?: number;
    env?: Record<string, string>;
  };
  responseSchema?: {
    type: 'text' | 'markdown' | 'a2ui' | 'audio' | 'image' | 'video' | 'mixed';
    version: string;
    strict: boolean;
    schema: any;
  };
  created_at?: number;
  updated_at?: number;
  created_by?: string;
  updated_by?: string;
}

export interface Variable {
  name: string;
  type: string;
  required: boolean;
}

export interface AgentLog {
  id: string;
  timestamp: Date;
  status: 'success' | 'failed' | 'running';
  message: string;
  duration?: string;
}

export interface BrowserSuggestedAction {
  schema: 'athena.browser.suggestion.v1' | string;
  id: string;
  label: string;
  description?: string;
  kind: 'media' | 'navigate' | string;
  capability: string;
  arguments: Record<string, unknown>;
  risk: 'LOW' | 'MEDIUM' | 'HIGH' | string;
  precondition?: Record<string, unknown>;
  postcondition?: Record<string, unknown>;
}

export interface ControlObservation {
  protocol: string;
  type: 'OBSERVATION' | string;
  task_id: string;
  action_id: string;
  session_id?: string;
  sequence: number;
  status: string;
  observed_at?: string;
  state?: Record<string, any>;
  error?: string;
}

export interface ResearchSourcePage {
  id: string;
  rank: number;
  title: string;
  url: string;
  domain: string;
  provider?: string;
  kind?: string;
  snippet?: string;
  valueSignals: string[];
  authority: number;
  relevance: number;
  freshness: number;
  evidenceScore: number;
  fetched: boolean;
  publishedAt?: string;
}

export interface Skill {
  id: string;
  name: string;
  description: string;
  type: 'built-in' | 'custom' | 'mcp' | 'a2a' | 'skill';
  category: 'logic' | 'data' | 'web' | 'media' | 'mcp' | 'a2a';
  enabled: boolean;
  is_system?: boolean;
  content?: string;
  mcpUrl?: string;
  icon?: string;
  endpoint?: string;
  token?: string;
  sandboxEndpoint?: string;
  method?: 'GET' | 'POST';
  timeout?: number;
  riskLevel?: 'low' | 'medium' | 'high';
  sandboxToken?: string;
  instruction?: string;
  scope?: 'client' | 'server' | 'both';
  trigger?: 'auto' | 'manual';
  entryScript?: string;
  filePath?: string;
  headers?: Record<string, string>;
  args?: string[];
  env?: Record<string, string>;
  command?: string;
}

export interface KnowledgeBase {
  id: string;
  name: string;
  description?: string;
  lastUpdated: string;
  retrievalUrl: string;
  token?: string;
  enabled?: boolean;
}

export interface RecallTestRecord {
  id: string;
  kbId: string;
  kbName: string;
  query: string;
  timestamp: string;
  results: {
    title: string;
    score: number;
    content: string;
  }[];
}

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  files?: FileInfo[];
  thinking?: string;
  trace?: TraceStep[];
  toolCalls?: {
    actionId?: string;
    name: string;
    args: any;
    result?: any;
    progress?: number;
    progressStage?: string;
    progressMessage?: string;
    bytes?: number;
    total?: number;
	searchQueries?: number;
	researchSources?: number;
	researchConfidence?: number;
	researchQueryTexts?: string[];
	researchPages?: ResearchSourcePage[];
    status?: 'pending' | 'running' | 'completed' | 'error';
    observation?: ControlObservation;
    suggestedActions?: BrowserSuggestedAction[];
    selectedSuggestionId?: string;
    suggestionStatus?: 'idle' | 'running' | 'completed' | 'error';
    suggestionError?: string;
  }[];
  recallInfo?: {
    status: 'pending' | 'running' | 'completed';
    count?: number;
    message?: string;
  };
  a2ui?: {
    type: string;
    data: any;
  };
  audioUrl?: string;
  imageUrl?: string;
  videoUrl?: string;
  htmlContent?: string;  // 提取的HTML内容（如数据分析报告）
  reportUrl?: string;   // HTML报告的URL（如 /uploads/{sessionID}/reports/xxx.html）
  pptUrl?: string;      // PPT文件的URL（如 /uploads/{sessionID}/reports/xxx.pptx）
  status?: 'pending_approval' | 'completed' | 'failed' | 'streaming';
  interruptId?: string;  // 用于审批时调用 resume
  metadata?: string;     // 原始 metadata JSON（如 files、imageActions 等）
}

export interface TraceStep {
  id: string;
  type: 'thought' | 'tool' | 'skill' | 'mcp' | 'a2a' | 'observation' | 'retrieval';
  label: string;
  content: string;
  status: 'success' | 'running' | 'error' | 'pending';
  duration?: string;
  timestamp: Date;
}

export interface ApprovalTask {
  id: string;
  agentId: string;
  agentName: string;
  toolName: string;
  description: string;
  params: any;
  timestamp: Date;
  status: 'pending' | 'approved' | 'rejected';
}

export interface FileInfo {
  name: string;
  size: number;
  type: string;
  url?: string;
  virtual_path?: string;
}

export interface Model {
  id: string;
  name: string;
  provider: string;
  baseUrl?: string;
  apiKey?: string;
  status: 'active' | 'configured' | 'disabled' | 'error';
	enabled: boolean;
	runtimeMode: ModelRuntimeMode;
	ownerId?: string;
  latency?: string;
  contextWindow?: string;
  usage?: number;
	usageRate?: number;
	usageCount?: number;
	successRate?: number;
	inputTokens?: number;
	outputTokens?: number;
	totalTokens?: number;
  type: 'llm' | 'embedding' | 'image' | 'video';
  capabilities?: string;
  category?: 'default' | 'rewrite' | 'skill' | 'summarize';
	keyId?: string;
	keyName?: string;
}

export interface Conversation {
  id: string;
  title: string;
  lastMessage?: string;
  timestamp: Date;
  agentId?: string;
  messages?: Message[];
  lastUpdated?: Date;
}

// Chat-related types
export interface ChatSession {
  ulid: string;
  user_id: string;
  agent_id: string;
  title: string;
  channel: string;
  model: string;
  status: string;
  created_at: number;
  updated_at: number;
  created_by: string;
  updated_by: string;
}

export interface ChatMessage {
  ulid: string;
  session_id: string;
  role: string;
  content: string;
  model: string;
  tokens: number;
  latency_ms: number;
  trace: string;
  status: string;
  error_msg: string;
  metadata: string;
  created_at: number;
  updated_at: number;
}

export interface ChatApproval {
  ulid: string;
  message_id: string;
  session_id: string;
  tool_name: string;
  tool_type: string;
  risk_level: string;
  parameters: string;
  status: string;
  interrupt_id: string;
  approved_by: string;
  approved_at: number;
  reason: string;
  created_at: number;
  updated_at: number;
}

export interface PendingApproval {
  id: string;
  sessionId: string;
  messageId: string;
  toolName: string;
  toolType: string;
  riskLevel: string;
  parameters: any;
  status: 'pending' | 'approved' | 'rejected';
  timestamp: Date;
}

// Job execution types
export interface JobExecution {
  ulid: string;
  agent_id: string;
  agent_name: string;
  session_id: string;
  status: 'running' | 'success' | 'failed';
  trigger_time: number;
  started_at: number;
  finished_at: number;
  input_summary: string;
  output_summary: string;
  output_full: string;
  error_msg: string;
  tokens_used: number;
  latency_ms: number;
  created_at: number;
  updated_at: number;
}
