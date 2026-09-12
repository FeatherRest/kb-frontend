# Standalone Knowledge Base UI

知识库独立前端（Vue 3 + Vite + Naive UI + Pinia）。它取代了 Dashboard 内置的
React 知识库页面（`hermes-agent/web/src/pages/KnowledgePage.tsx`），功能对齐其全部
tab，并新增「多知识库管理 + 配置 + 文件夹 + Git 仓库」能力。

## 功能

| 页面 | 路由 | 说明 |
|:--|:--|:--|
| 搜索 | `#/search` | 混合 / 向量 / 关键词三种模式，CrossEncoder 重排，关键词高亮，历史记录 |
| 专区 | `#/zones` | 待学习 / 文档库 / 新闻事件 / GitHub 周报 / 错误报告（含已读标记与评论） |
| 待处理 | `#/pending` | pending 清单分页、搜索、复制绝对/相对路径 |
| 文档解析 | `#/preview` | 任意文件 dry-run 预览（同一解析管线），Markdown / 元数据 / 警告 / 资源 |
| 解析器 | `#/parsers` | 启用/禁用开关、扩展名、引擎与详情 |
| 计划表 | `#/plan` | CRUD + 评论 + 状态/阶段流转 + 搜索过滤 |
| 知识库管理 | `#/kbs` | 新建知识库（自动建文件夹骨架 + `git init`）、列表、路径复制 |
| 知识库配置 | `#/kbs/:id/config` | 基本信息 / 文件夹 / Git 仓库 / 运行配置 / 危险操作 |

文档详情抽屉（搜索与专区共用）：概览、正文（含原始 HTML 报告）、分块（含向量信息）、
讲解（DeepSeek 生成 + CosyVoice 语音播报，支持 ±10s、倍速、重新生成）。

## 开发

```bash
npm ci
npm run dev          # http://127.0.0.1:8081/knowledge/
```

开发服务器把 `/kb/api/*` **原样**代理到 kb-api（`127.0.0.1:9999`，可用
`KB_API_TARGET` 覆盖）。路径不重写是刻意的：kb-api 自己识别并归一化 `/kb/api` 前缀，
生产链路（nginx 剥离前缀）与开发链路因此落到同一批端点。

## 构建与部署

```bash
npm run build        # 产物 → dist/，base 默认 /knowledge/
npm run build:check  # 只做构建校验，产物进 dist-test/（不动线上 dist/）
```

线上由 nginx 直接托管 `dist/`：

```nginx
location /knowledge/ {
    auth_request /authelia-auth;            # 必须登录
    alias /home/sage/kb-frontend/dist/;
    try_files $uri $uri/ /knowledge/index.html;
}
```

`base` 必须与部署路径一致（默认 `/knowledge/`，可用 `VITE_BASE` 覆盖）；
改部署路径时同步改 `vite.config.js`，否则静态资源 404。

kb-api 独立服务（`KB_WEB_DIR`，默认 `/srv/sage-data/knowledge/web`）已符号链接到本仓库
`dist/`，因此 `http://127.0.0.1:9999/` 与 `/knowledge/` 是同一份产物，不存在陈旧副本。

## API

前端只与 kb-api 通信，全部路径以 `/kb/api` 为基地址：

- 检索/文档：`/v1/search`、`/v1/documents…`、`/v1/stats`、`/v1/jobs`
- 摄取：`/v1/ingest/file`、`/api/knowledge/upload`、`/preview-parse`
- 治理：`/api/knowledge/parsers`、`/api/knowledge/pending-files`
- 错误报告：`/errors…`；计划表：`/plan…`
- 知识库注册表：`/kbs`、`/kbs/<id>`、`/kbs/<id>/config`、`/kbs/<id>/git-init`、`/kbs/<id>/git-status`

接口清单以 `agent-hub/hub/knowledge/api.py` 的 `_KbHandler` 为唯一真相源。

## 测试

```bash
npm test             # node --test（apiBase 单元测试）
```

端到端验证用 Playwright 逐页跑真实浏览器（0 控制台错误）并覆盖
搜索 → 详情抽屉 → 新建知识库（含 git init）→ 配置保存 → 危险删除的完整链路。
