# Refactor: FastAPI Backend + React (Vite) Frontend

## Overview

将 LeRobot Dataset Visualizer 从 Next.js 单体应用拆分为 FastAPI (Python) 后端 + React (Vite) 前端。后端负责本地数据集文件服务和 COS 视频 URL 拼接，前端保留浏览器端 parquet 解析。

## Architecture

```
lerobot-dataset-visualizer/
├── backend/                     # FastAPI Python 后端
│   ├── app/
│   │   ├── main.py              # FastAPI 入口, CORS, 路由注册
│   │   ├── config.py            # Pydantic Settings 配置
│   │   └── routers/
│   │       └── datasets.py      # 统一文件解析路由
│   ├── requirements.txt
│   └── .env.example
│
└── frontend/                    # React + Vite 前端
    ├── src/
    │   ├── main.tsx             # 应用入口
    │   ├── App.tsx              # React Router 路由
    │   ├── api/                 # NEW: API 配置
    │   │   └── config.ts
    │   ├── pages/               # 页面 (从 src/app/ 迁移)
    │   │   ├── HomePage.tsx
    │   │   ├── ExplorePage.tsx
    │   │   ├── DatasetPage.tsx
    │   │   └── EpisodePage.tsx
    │   ├── components/          # 原封迁移
    │   ├── context/             # 原封迁移
    │   ├── types/               # 原封迁移
    │   ├── utils/               # 迁移+修改 versionUtils
    │   └── lib/                 # 原封迁移
    ├── index.html
    ├── vite.config.ts
    ├── tsconfig.json
    └── package.json
```

## Core Design: URL Resolution Strategy

**关键发现**: 所有数据/视频 URL 都通过 `buildVersionedUrl()` 一个函数构建（在 fetch-data.ts 中被调用 17 次）。只需将此函数指向 FastAPI，由 FastAPI 根据路径类型分发即可。

当前: `https://huggingface.co/datasets/{org}/{dataset}/resolve/main/{path}`
新的: `http://localhost:8000/api/datasets/{org}/{dataset}/resolve/{path}`

**FastAPI 路径解析逻辑**:
- `videos/*` 路径 → 302 重定向到 COS URL (`{COS_BASE_URL}/{org}/{dataset}/{path}`)
- 其他路径 (parquet/json) → 本地文件存在则直接返回，否则 302 重定向到 HuggingFace

---

## Part 1: FastAPI Backend

### 1.1 Configuration (`backend/app/config.py`)

```python
class Settings(BaseSettings):
    DATA_ROOT: Path              # 本地数据根目录, 内含 {org}/{dataset}/ 子目录
    COS_BASE_URL: str            # COS bucket 基础 URL
    ENABLE_HF_FALLBACK: bool = True
    HF_BASE_URL: str = "https://huggingface.co/datasets"
    HOST: str = "0.0.0.0"
    PORT: int = 8000
    model_config = SettingsConfigDict(env_file=".env")
```

### 1.2 Core Route (`backend/app/routers/datasets.py`)

唯一核心端点:

```
GET /api/datasets/{org}/{dataset}/resolve/{path:path}
```

逻辑:
1. 如果 path 以 `videos/` 开头 → `RedirectResponse(f"{COS_BASE_URL}/{org}/{dataset}/{path}")`
2. 检查本地文件 `{DATA_ROOT}/{org}/{dataset}/{path}`
   - 存在 → `FileResponse(local_path)`
   - 不存在且 HF_FALLBACK 开启 → `RedirectResponse(f"{HF_BASE_URL}/{org}/{dataset}/resolve/main/{path}")`
   - 否则 → 404

### 1.3 Files to Create

| File | Description |
|------|-------------|
| `backend/app/__init__.py` | 空文件 |
| `backend/app/main.py` | FastAPI app, CORS middleware, 挂载 router |
| `backend/app/config.py` | Pydantic Settings |
| `backend/app/routers/__init__.py` | 空文件 |
| `backend/app/routers/datasets.py` | 文件解析路由 |
| `backend/requirements.txt` | fastapi, uvicorn, pydantic-settings, aiofiles |
| `backend/.env.example` | 示例环境变量 |

---

## Part 2: Frontend Migration (Next.js → Vite)

### 2.1 New Project Setup

**Dependencies to keep**: react, react-dom, recharts, hyparquet, three, @react-three/fiber, @react-three/drei, urdf-loader, react-icons, tailwindcss

**Dependencies to add**: react-router-dom, vite, @vitejs/plugin-react

**Dependencies to remove**: next, eslint-config-next

### 2.2 Key Replacement Mapping

| Next.js | Vite/React Router |
|---------|-------------------|
| `next/link` → `Link` | `react-router-dom` → `Link` |
| `next/navigation` → `useRouter` | `react-router-dom` → `useNavigate` |
| `next/navigation` → `useSearchParams` | `react-router-dom` → `useSearchParams` |
| `next/navigation` → `useParams` | `react-router-dom` → `useParams` |
| `process.env.DATASET_URL` | `import.meta.env.VITE_API_URL` |
| `"use client"` directive | 删除 (Vite 默认全客户端) |
| `"use server"` directive | 删除 (不再需要 server actions) |

### 2.3 Files: Copy As-Is (no changes needed)

这些文件没有 Next.js 依赖，直接复制:

- `src/types/*` → `frontend/src/types/*`
- `src/utils/constants.ts`
- `src/utils/typeGuards.ts`
- `src/utils/stringFormatting.ts`
- `src/utils/dataProcessing.ts`
- `src/utils/pick.ts`
- `src/utils/debounce.ts`
- `src/utils/languageInstructions.ts`
- `src/utils/parquetUtils.ts`
- `src/context/time-context.tsx` (仅删除 `"use client"`)
- `src/context/flagged-episodes-context.tsx` (仅删除 `"use client"`)
- `src/lib/so101-robot.ts`

### 2.4 Files: Migrate with Modifications

#### `src/utils/versionUtils.ts` → `frontend/src/utils/versionUtils.ts`

**唯一关键改动**: 将 `DATASET_URL` 改为 FastAPI 地址

```typescript
// Before
const DATASET_URL = process.env.DATASET_URL || "https://huggingface.co/datasets";
export function buildVersionedUrl(repoId, version, path) {
  return `${DATASET_URL}/${repoId}/resolve/main/${path}`;
}

// After
const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";
export function buildVersionedUrl(repoId, version, path) {
  return `${API_BASE_URL}/api/datasets/${repoId}/resolve/${path}`;
}
```

同样修改 `getDatasetInfo()` 中的 URL 构建逻辑。

#### `src/app/[org]/[dataset]/[episode]/fetch-data.ts` → `frontend/src/services/fetch-data.ts`

- 将 `process.env.MAX_EPISODE_POINTS` 改为 `import.meta.env.VITE_MAX_EPISODE_POINTS`
- 其余逻辑不变（所有 URL 已通过 `buildVersionedUrl` 走 FastAPI）

#### `src/app/[org]/[dataset]/[episode]/actions.ts` → 删除

Server actions 不再需要。`episode-viewer.tsx` 中对 `fetchEpisodeLengthStats` 等的调用改为直接调用 `fetch-data.ts` 中的底层函数。

#### `src/app/[org]/[dataset]/[episode]/episode-viewer.tsx` → `frontend/src/pages/EpisodePage.tsx`

- 删除 `"use client"`
- `useRouter` → `useNavigate` (react-router-dom)
- `useSearchParams` → react-router-dom 版本
- 删除 server action 导入，改为直接调用 fetch-data 函数
- `router.push()` → `navigate()`

#### `src/app/page.tsx` → `frontend/src/pages/HomePage.tsx`

- 删除 `"use client"`
- `Link` → react-router-dom `Link`
- `useRouter` → `useNavigate`
- `useSearchParams` → react-router-dom 版本
- `router.push()` → `navigate()`

#### `src/app/explore/page.tsx` + `explore-grid.tsx` → `frontend/src/pages/ExplorePage.tsx`

- 同上路由替换

#### `src/app/[org]/[dataset]/page.tsx` → `frontend/src/pages/DatasetPage.tsx`

- 获取 params 改为 `useParams()`，然后重定向到 episode_0

#### Components (`src/components/*.tsx`)

所有组件检查并修改:
- 删除 `"use client"`
- 搜索 `next/link`, `next/navigation`, `next/image` 导入并替换
- `side-nav.tsx`: 使用 `Link` from react-router-dom，`useNavigate` 替代 `useRouter`

### 2.5 New Files to Create

| File | Description |
|------|-------------|
| `frontend/index.html` | Vite HTML 模板 |
| `frontend/vite.config.ts` | Vite 配置 (alias @/, proxy /api) |
| `frontend/tsconfig.json` | TypeScript 配置 |
| `frontend/package.json` | 依赖和脚本 |
| `frontend/src/main.tsx` | ReactDOM.createRoot 入口 |
| `frontend/src/App.tsx` | React Router 路由定义 |
| `frontend/src/api/config.ts` | API base URL 配置 |
| `frontend/postcss.config.mjs` | Tailwind CSS PostCSS 配置 |

### 2.6 React Router Configuration

```tsx
// App.tsx
<BrowserRouter>
  <Routes>
    <Route path="/" element={<HomePage />} />
    <Route path="/explore" element={<ExplorePage />} />
    <Route path="/:org/:dataset" element={<DatasetPage />} />
    <Route path="/:org/:dataset/:episode" element={<EpisodePage />} />
  </Routes>
</BrowserRouter>
```

### 2.7 Vite Dev Proxy

开发时将 `/api` 代理到 FastAPI:

```typescript
// vite.config.ts
export default defineConfig({
  server: {
    proxy: {
      '/api': 'http://localhost:8000'
    }
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, 'src') }
  }
})
```

---

## Implementation Order

### Step 1: Create backend/ structure
1. Create all backend files (main.py, config.py, routers/datasets.py)
2. Create requirements.txt and .env.example
3. Test: `cd backend && uvicorn app.main:app --reload`

### Step 2: Initialize frontend/ with Vite
1. Create Vite project structure (index.html, vite.config.ts, package.json, tsconfig.json)
2. Install dependencies
3. Create main.tsx, App.tsx with placeholder routes

### Step 3: Copy unchanged files
1. Copy types/, utils/ (except versionUtils), context/, lib/
2. Remove `"use client"` directives from copied files

### Step 4: Migrate versionUtils.ts
1. Change `buildVersionedUrl` and `getDatasetInfo` to use FastAPI URL

### Step 5: Migrate fetch-data.ts
1. Copy to frontend/src/services/fetch-data.ts
2. Replace `process.env` with `import.meta.env`

### Step 6: Migrate components
1. Copy all components
2. Search-replace Next.js imports (Link, useRouter, etc.)
3. Delete `"use client"` directives

### Step 7: Create page components
1. HomePage.tsx (from src/app/page.tsx)
2. ExplorePage.tsx (from src/app/explore/)
3. DatasetPage.tsx (redirect to episode_0)
4. EpisodePage.tsx (from episode-viewer.tsx + page.tsx)

### Step 8: Remove server actions dependency
1. In EpisodePage, replace server action calls with direct function calls from fetch-data.ts

### Step 9: Styles migration
1. Copy global CSS (from src/app/globals.css)
2. Ensure Tailwind CSS works with Vite

### Step 10: Testing & verification

---

## Verification

1. **Backend**: `cd backend && uvicorn app.main:app --reload`
   - `curl http://localhost:8000/api/datasets/{org}/{dataset}/resolve/meta/info.json` → 返回本地文件或 302 到 HF
   - `curl -I http://localhost:8000/api/datasets/{org}/{dataset}/resolve/videos/...` → 302 到 COS URL

2. **Frontend**: `cd frontend && bun dev`
   - 首页加载正常
   - 输入数据集名称可以导航
   - Episode 页面: 图表数据正常加载（parquet 通过 FastAPI 获取后在浏览器解析）
   - 视频播放正常（从 COS URL 加载）

3. **Integration**: 启动 backend + frontend，用本地数据集目录测试完整流程

4. **Existing tests**: 迁移 `__tests__/` 到 frontend，使用 bun test 运行确认通过
