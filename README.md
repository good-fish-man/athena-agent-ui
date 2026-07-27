# Athena Agent UI

Athena 的 React 管理与聊天前端，连接 `agent-runtime-client`，提供 Agent、模型、知识库、Skills、工作区、语音对话和服务配置界面。

## Requirements

- Node.js 20+
- npm 10+
- 已运行的 [agent-runtime-client](https://github.com/good-fish-man/agent-runtime-client)

## Development

```bash
npm install
cp .env.example .env.local
npm run dev
```

开发服务默认运行在 `http://localhost:3000`。

## Build

```bash
npm run lint
npm run build
```

## Related Projects

- [agent-runtime](https://github.com/good-fish-man/agent-runtime)
- [agent-runtime-client](https://github.com/good-fish-man/agent-runtime-client)
- [athena-launcher](https://github.com/good-fish-man/athena-launcher)
