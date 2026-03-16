# lerobot 数据集可视化项目

## 后端
```
cd backend
cp .env.example .env   # 编辑配置
uvicorn app.main:app --reload --port 8090
```

## 前端
```
cd frontend
bun dev   # 启动在 localhost:5173, /api 自动代理到 localhost:8000
```