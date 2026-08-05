import { Agent, Skill, KnowledgeBase } from './types';

export const INITIAL_AGENTS: Agent[] = [
  {
    id: 'image',
    name: '图像生成',
    description: '生成高质量图像',
    model: 'gemini-3.1-pro-preview',
    skills: ['image-generation'],
    capabilities: ['media.image.generate'],
    icon: 'ImageIcon',
    isBuiltIn: true,
  },
  {
    id: 'write',
    name: '帮我写作',
    description: '辅助文章、邮件和创意写作',
    model: 'gemini-3.1-pro-preview',
    skills: ['creative-writing'],
    capabilities: ['filesystem.write'],
    icon: 'PenTool',
    isBuiltIn: true,
  },
  {
    id: 'translate',
    name: '翻译',
    description: '多语言实时翻译',
    model: 'gemini-3.1-pro-preview',
    skills: ['translation'],
    capabilities: [],
    icon: 'Languages',
    isBuiltIn: true,
  },
  {
    id: 'code',
    name: '编程',
    description: '代码编写、调试和优化',
    model: 'gemini-3.1-pro-preview',
    skills: ['coding'],
    capabilities: ['python.execute'],
    icon: 'Code',
    isBuiltIn: true,
  },
  {
    id: 'research',
    name: '深入研究',
    description: '深度资料搜集 and 分析报告',
    model: 'gemini-3.1-pro-preview',
    skills: ['deep-research'],
    capabilities: ['internet.search', 'internet.fetch'],
    icon: 'Search',
    isBuiltIn: true,
  },
  {
    id: 'podcast',
    name: 'AI 播客',
    description: '生成音频播客内容',
    model: 'gemini-3.1-pro-preview',
    skills: ['audio-generation'],
    capabilities: [],
    icon: 'Podcast',
    isBuiltIn: true,
  },
  {
    id: 'meeting',
    name: '记录会议',
    description: '会议摘要 and 待办事项提取',
    model: 'gemini-3.1-pro-preview',
    skills: ['transcription'],
    capabilities: [],
    icon: 'CircleDot',
    isBuiltIn: true,
  },
  {
    id: 'music',
    name: '音乐生成',
    description: '创作各种风格的音乐',
    model: 'gemini-3.1-pro-preview',
    skills: ['music-composition'],
    capabilities: [],
    icon: 'Music',
    isBuiltIn: true,
  },
  {
    id: 'qa',
    name: '解题答疑',
    description: '学科问题解答 and 知识讲解',
    model: 'gemini-3.1-pro-preview',
    skills: ['problem-solving'],
    capabilities: [],
    knowledgeBases: ['kb-1', 'kb-2', 'kb-3'],
    icon: 'CheckSquare',
    isBuiltIn: true,
  },
  {
    id: 'data',
    name: '数据分析',
    description: '数据清洗、分析 and 可视化',
    model: 'gemini-3.1-pro-preview',
    skills: ['data-analysis'],
    capabilities: ['python.execute'],
    icon: 'PieChart',
    isBuiltIn: true,
  },
];

export const INITIAL_SKILLS: Skill[] = [
  { id: 'web-search', name: 'Web Search', description: 'Search the live web for information', type: 'built-in', category: 'web', enabled: true, icon: 'Globe', riskLevel: 'low' },
  { id: 'summarization', name: 'Summarization', description: 'Condense long texts into key points', type: 'built-in', category: 'logic', enabled: true, icon: 'Zap', riskLevel: 'low' },
  { id: 'mcp-github', name: 'GitHub MCP', description: 'Interact with GitHub repositories', type: 'mcp', category: 'mcp', enabled: true, icon: 'Box', riskLevel: 'medium' },
  { id: 's3-upload', name: 'S3 Upload', description: 'Upload files to Amazon S3', type: 'a2a', category: 'a2a', enabled: true, icon: 'Users', riskLevel: 'high' },
  { id: 'a2a-scheduler', name: 'Meeting Scheduler', description: 'Agent-to-Agent scheduling service', type: 'a2a', category: 'a2a', enabled: true, icon: 'Users', riskLevel: 'medium' },
];

export const MOCK_MODELS = [
  { id: 'gemini-3.1-pro-preview', name: 'Gemini 3.1 Pro' },
  { id: 'gemini-3.1-flash-preview', name: 'Gemini 3.1 Flash' },
  { id: 'gemini-3.1-flash-lite-preview', name: 'Gemini 3.1 Flash Lite' },
  { id: 'gpt-4o', name: 'GPT-4o' },
  { id: 'claude-3-5-sonnet', name: 'Claude 3.5 Sonnet' },
];

export const INITIAL_KNOWLEDGE_BASES: KnowledgeBase[] = [
  {
    id: 'kb-1',
    name: 'External Search API',
    description: 'Connects to internal search engine',
    lastUpdated: '2024-03-15',
    retrievalUrl: 'http://10.4.110.176:32199/api/intelli-search/',
    enabled: true
  },
  {
    id: 'kb-2',
    name: 'Product Documentation',
    description: 'Internal product guides and manuals',
    lastUpdated: '2024-03-20',
    retrievalUrl: 'http://docs.internal.com/api/v1/search',
    enabled: true
  },
  {
    id: 'kb-3',
    name: 'Customer Support Wiki',
    description: 'Common issues and troubleshooting steps',
    lastUpdated: '2024-03-25',
    retrievalUrl: 'http://wiki.support.com/api/query',
    enabled: true
  },
];
