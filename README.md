# LogVault — Vercel 日志管理系统

**LogVault** 是一个专为 Vercel 设计的私有日志管理系统。通过调用 Vercel Request Logs API，将项目部署日志加密存储至云端数据库，支持定时自动抓取、日志加密归档、私有化部署与自定义域名访问，帮助 Hobby 计划用户突破 Vercel 控制台日志查看限制，实现日志的长期保存与集中管理。

---

## 目录

- [功能概览](#功能概览)
- [技术栈](#技术栈)
- [数据库设计](#数据库设计)
- [API 接口](#api-接口)
- [部署手册](./部署手册.md)

---

## 功能概览

### 用户认证

- GitHub OAuth 唯一登录方式
- `ALLOWED_EMAILS` 邮箱白名单，不配置时所有登录都被拒绝
- `ADMIN_EMAILS` 管理员邮箱白名单，审计日志页面与系统设置仅管理员可见
- 登录成功/失败记录到审计日志

### 日志抓取

- **手动抓取**：页面按钮实时触发
- **定时抓取**：GitHub Actions 驱动，每 30 分钟从**外部**直连 Vercel API 获取完整日志（避免 Vercel 内部调用限制），数据通过 `/api/logs/store` 持久化
- **去重合并**：检测已存在的 `deploymentId`，有重叠时合并最新日志，单记录上限 200 条
- **失败重试**：自动重试 3 次（5s/10s/30s 退避）

### 数据加密与存储

- AES-256-GCM 认证加密，密钥由 `ENCRYPTION_SECRET` 派生
- 加密文件存储：Vercel Blob（云端）或 `public/uploads/`（本地）
- 元数据存储：PostgreSQL（Vercel Postgres 或本地 pg）

### 日志展示

- 响应式仪表盘：统计卡片、分页表格
- 详情弹窗：S/M/L 三档尺寸切换，Path/Message 列横向滚动
- 函数日志展开查看

### 审计日志

- 独立页面 `/audit-logs`，仅管理员可访问
- 记录操作：登录（成功/失败）、手动抓取、删除、设置修改、定时抓取/清理（统一归类为 `cron`，通过 `detail.type` 区分）
- 包含操作者邮箱、IP 地址、操作详情（JSON 可展开）
- 支持按操作类型筛选、批量删除、分页

### 系统设置

- 定时抓取开关与间隔
- 数据保留天数（过期自动清理）
- 设置页面嵌入仪表盘对话框

### 定时维护

- 清理过期日志记录（按 `retention_days`）
- 清理软删除超过保留期的记录
- 清理过期审计日志
- 接口需 `CRON_SECRET` 鉴权

### 权限控制

| 角色                  | 权限               |
| ------------------- | ---------------- |
| 所有登录用户              | 查看日志列表/详情、手动抓取   |
| 管理员（`ADMIN_EMAILS`） | 系统设置、删除日志、审计日志页面 |

---

## 技术栈

| 组件   | 选型                                  |
| ---- | ----------------------------------- |
| 框架   | Next.js (App Router)                |
| 语言   | TypeScript                          |
| UI   | shadcn/ui + Tailwind CSS            |
| 认证   | NextAuth v5 (GitHub OAuth)          |
| 数据库  | PostgreSQL（Vercel Postgres / 本地 pg） |
| 对象存储 | Vercel Blob / 本地文件系统                |
| 定时任务 | GitHub Actions + Vercel Cron Jobs   |
| 加密   | Node.js `crypto` (AES-256-GCM)      |

---

## 数据库设计

### log_records — 日志记录表

```sql
CREATE TABLE IF NOT EXISTS log_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deployment_id TEXT UNIQUE NOT NULL,
  blob_url TEXT NOT NULL,
  log_count INTEGER DEFAULT 0,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'deleted', 'failed')),
  fetched_at TIMESTAMPTZ DEFAULT Now(),
  created_at TIMESTAMPTZ DEFAULT Now()
);

CREATE INDEX IF NOT EXISTS idx_log_records_status ON log_records(status);
CREATE INDEX IF NOT EXISTS idx_log_records_created_at ON log_records(created_at);
CREATE INDEX IF NOT EXISTS idx_log_records_deployment_id ON log_records(deployment_id);
```

### settings — 系统配置表

```sql
CREATE TABLE IF NOT EXISTS settings (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  cron_enabled BOOLEAN DEFAULT TRUE,
  fetch_interval_minutes INTEGER DEFAULT 60,
  retention_days INTEGER DEFAULT 30,
  updated_at TIMESTAMPTZ DEFAULT Now()
);

INSERT INTO settings (id, cron_enabled, fetch_interval_minutes, retention_days)
VALUES (1, TRUE, 60, 30)
ON CONFLICT (id) DO NOTHING;
```

### audit_logs — 审计日志表

```sql
CREATE TABLE IF NOT EXISTS audit_logs (
  id SERIAL PRIMARY KEY,
  action TEXT NOT NULL,
  detail JSONB,
  user_email TEXT,
  created_at TIMESTAMPTZ DEFAULT Now()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);
```

### 初始化脚本

将以上三张表合并在 `lib/schema.sql`，在数据库中执行即可。如果使用 Vercel Postgres，可在 Vercel 控制台的 Storage → Postgres → Data 页面中直接执行。

---

## API 接口

| 路径                        | 方法     | 鉴权                     | 说明                                           |
| ------------------------- | ------ | ---------------------- | -------------------------------------------- |
| `/api/auth/[...nextauth]` | ALL    | —                      | NextAuth 认证路由                                |
| `/api/fetch/manual`       | POST   | Session                | 手动抓取日志                                       |
| `/api/fetch/cron`         | GET    | Bearer (`CRON_SECRET`) | 定时抓取                                         |
| `/api/logs/store`         | POST   | Bearer (`CRON_SECRET`) | 存储预拉取的日志（供 GitHub Actions 直连 Vercel API 后调用） |
| `/api/logs/list`          | GET    | Session                | 分页日志列表                                       |
| `/api/logs/detail/[id]`   | GET    | Session                | 解密日志详情                                       |
| `/api/logs/delete`        | DELETE | Session + Admin        | 批量删除                                         |
| `/api/settings/get`       | GET    | Session + Admin        | 读取系统设置                                       |
| `/api/settings/update`    | PUT    | Session + Admin        | 更新系统设置                                       |
| `/api/audit-logs`         | GET    | Session + Admin        | 审计日志列表                                       |
| `/api/audit-logs`         | DELETE | Session + Admin        | 删除审计日志                                       |
| `/api/cleanup`            | GET    | Bearer (`CRON_SECRET`) | 清理过期数据                                       |
| `/api/me`                 | GET    | —                      | 当前用户身份与权限                                    |

---

## 部署手册

部署相关内容已移入独立文档，请参阅 [部署手册.md](./部署手册.md)。

---

## License

MIT
