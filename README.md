基于我们全部的讨论与架构设计，我为你整理了一份完整的《**Vercel 日志管理系统（Log Management System）需求规格说明书**》。这份文档可以直接作为你后续开发的蓝图，也可以用于个人项目归档。

---

# Vercel 日志管理系统 需求规格说明书 (PRD)

**版本**：V1.0  
**状态**：待开发  
**目标平台**：Vercel (Serverless) + 自定义域名  

---

## 1. 项目背景与目标

### 1.1 背景痛点
- Vercel 免费版（Hobby Plan）在控制台（`vercel.com`）查看日志时，受限于滚动懒加载机制，且 `vercel.com` 在国内访问极不稳定，导致开发者无法有效追溯历史日志。
- 现有的浏览器爬虫方案（Playwright）依赖本地环境与 Cookie，维护成本高且易失效。

### 1.2 项目目标
构建一个**部署在 Vercel 境外服务器上的私有日志管理平台**，通过调用官方 API 抓取指定项目的部署日志，实现日志的**加密持久化存储、可视化查询、定时自动同步及安全访问控制**，彻底摆脱对 Vercel 控制台 UI 和本地网络环境的依赖。

---

## 2. 用户角色与权限

| 角色 | 数量 | 权限描述 |
| :--- | :--- | :--- |
| **超级管理员 (Super Admin)** | 1 人（项目所有者） | 拥有系统的全部权限：登录、手动抓取、查看/删除日志、修改系统配置、开关定时任务。不设多级权限，仅通过 GitHub OAuth 邮箱白名单控制入口。 |

---

## 3. 功能性需求 (Functional Requirements)

系统分为 **7 大核心功能模块**。

### 模块一：用户认证与安全 (Authentication)
- **FR-01**：采用 **GitHub OAuth** 作为唯一登录方式，不支持密码注册。
- **FR-02**：代码层硬编码邮箱白名单（`ALLOWED_EMAILS`），非授权 GitHub 账号访问时返回 `403 Forbidden`。
- **FR-03**：登录态由 NextAuth.js 管理，JWT Session 有效期默认 30 天。
- **FR-04**：所有 `/api/*` 受保护路由必须经过 Session 校验，未登录返回 `401 Unauthorized`。

### 模块二：日志抓取引擎 (Fetch Engine)
- **FR-05**：**手动抓取**：前端页面提供“立即抓取”按钮，实时触发任务。
- **FR-06**：**定时自动抓取**：利用 Vercel Cron Jobs 触发，支持自定义间隔（30分钟 / 1小时 / 6小时 / 12小时 / 每日）。
- **FR-07**：**抓取逻辑**：
  1. 使用 `VERCEL_TOKEN` 调用 Vercel API 获取目标项目的最新 `deploymentId`。
  2. 调用 Logs API 获取该部署的最近 1000 行日志（可配置 `limit`）。
- **FR-08**：**去重机制**：抓取前查询数据库 `log_records` 表，若该 `deploymentId` 已存在则自动跳过，避免重复存储。
- **FR-09**：**失败重试**：抓取失败时自动重试 3 次（指数退避间隔 5s/10s/30s）。

### 模块三：数据加密与持久化 (Encryption & Storage)
- **FR-10**：**加密算法**：使用 AES-256-GCM（认证加密）对日志原文进行加密。密钥 `ENCRYPTION_SECRET` 存储于环境变量。
- **FR-11**：**存储双写**：
  - **Vercel Blob**：存储加密后的 `.enc` 文件，文件名格式 `logs_{timestamp}_{deploymentId}.enc`。
  - **Vercel Postgres**：存储元数据记录（`deployment_id`、`blob_url`、`log_count`、`fetched_at`、`status`）。
- **FR-12**：**解密查看**：用户请求查看详情时，后端从 Blob 读取文件 → 解密 → 返回 JSON 格式明文给前端。

### 模块四：日志展示与操作 (Display & CRUD)
- **FR-13**：**列表页**：分页表格展示元数据（抓取时间、部署ID、日志行数、文件大小、状态）。支持按时间倒序排列。
- **FR-14**：**详情页**：弹窗或独立页面展示解密后的完整日志内容，支持 JSON 格式化或纯文本高亮显示。
- **FR-15**：**删除功能**：
  - 支持单条删除与批量删除。
  - **逻辑删除**：先更新数据库 `status='deleted'`，前端隐藏。
  - **物理删除**：定时清理任务会真正删除 Blob 文件并清理数据库残留。

### 模块五：系统配置与调度管理 (Settings)
- **FR-16**：**全局开关**：前端开关控制 Cron 定时任务是否启用（`cron_enabled`）。
- **FR-17**：**频率调整**：管理员可在界面下拉选择抓取间隔，系统动态生效。
- **FR-18**：**保留策略**：可配置日志保留天数（默认 30 天），超过期限的日志将被自动清理。

### 模块六：定时维护与清理 (Maintenance)
- **FR-19**：系统每日凌晨 3:00（UTC+8）自动执行清理脚本。
- **FR-20**：清理逻辑：删除 `created_at` 早于 `(当前时间 - 保留天数)` 的记录，并同步删除对应的 Blob 文件。

### 模块七：操作审计 (Audit Log)
- **FR-21**：记录管理员的关键操作日志（登录、手动抓取、删除、配置修改），存入 `audit_logs` 表。

---

## 4. 非功能性需求 (Non-Functional Requirements)

| 类别 | 具体要求 |
| :--- | :--- |
| **可用性** | 系统需部署在 Vercel 境外节点，绑定自定义域名，确保中国大陆可稳定访问。 |
| **安全性** | 所有存储内容强制 AES-256 加密；秘钥严禁硬编码；强制 OAuth 登录拦截。 |
| **性能** | 列表页接口响应时间 < 500ms（数据库命中索引）；单次抓取任务执行时间 < 15s（Vercel 函数最大执行时间 10s，需控制 API 调用与加密耗时，必要时异步化）。 |
| **免费额度容灾** | Blob 存储 < 1GB，Postgres < 256MB。需设计自动清理策略保证不超限。 |
| **可维护性** | 代码使用 TypeScript 编写，核心函数（加密/解密/Vercel API 调用）需单元测试覆盖。 |

---

## 5. 技术栈规格 (Technology Stack)

| 组件 | 技术选型 | 版本要求 |
| :--- | :--- | :--- |
| **前端框架** | Next.js (App Router) | >= 14.0 |
| **编程语言** | TypeScript | >= 5.0 |
| **UI 组件库** | shadcn/ui (Radix UI) + Tailwind CSS | 最新 LTS |
| **认证框架** | NextAuth.js (Auth.js) | v5 (Beta 或正式) |
| **关系型数据库** | Vercel Postgres (基于 Neon) | - |
| **对象存储** | Vercel Blob (基于 AWS S3) | - |
| **定时任务** | Vercel Cron Jobs | - |
| **加密库** | Node.js `crypto` 原生模块 | - |

---

## 6. 数据库设计 (Schema Design)

### 表 1：`log_records` (日志记录表)
| 字段名 | 类型 | 约束 | 说明 |
| :--- | :--- | :--- | :--- |
| `id` | UUID | Primary Key | 主键 |
| `deployment_id` | TEXT | Unique, Not Null | Vercel 部署唯一 ID（去重依据） |
| `blob_url` | TEXT | Not Null | 加密文件在 Blob 存储中的访问 URL |
| `log_count` | INTEGER | Default 0 | 该文件包含的日志行数 |
| `status` | TEXT | Default 'active' | active / deleted / failed |
| `fetched_at` | TIMESTAMPTZ | Default Now() | 抓取时间 |
| `created_at` | TIMESTAMPTZ | Default Now() | 插入时间 |

### 表 2：`settings` (系统配置表)
| 字段名 | 类型 | 约束 | 说明 |
| :--- | :--- | :--- | :--- |
| `id` | INTEGER | Primary Default 1 | 固定单行配置 |
| `cron_enabled` | BOOLEAN | Default TRUE | 定时任务总开关 |
| `fetch_interval_minutes` | INTEGER | Default 60 | 抓取间隔（分钟） |
| `retention_days` | INTEGER | Default 30 | 日志保留天数 |
| `updated_at` | TIMESTAMPTZ | - | 更新时间 |

### 表 3：`audit_logs` (审计日志表)
| 字段名 | 类型 | 说明 |
| :--- | :--- | :--- |
| `id` | SERIAL | Primary Key |
| `action` | TEXT | 操作类型 (login/fetch/delete/settings) |
| `detail` | JSONB | 操作详情 (如删除的 ID 列表) |
| `user_email` | TEXT | 操作用户邮箱 |
| `created_at` | TIMESTAMPTZ | 操作时间 |

---

## 7. API 接口设计 (Backend Routes)

所有 API 均位于 `/app/api/` 目录下，除 `auth` 外需校验 Session。

| 接口路径 | 方法 | 功能描述 |
| :--- | :--- | :--- |
| `/api/auth/[...nextauth]` | GET/POST | NextAuth 路由处理登录回调 |
| `/api/fetch/manual` | POST | 手动触发一次抓取任务 |
| `/api/fetch/cron` | GET | 供 Vercel Cron 调用的定时抓取端点 |
| `/api/logs/list` | GET | 分页获取日志元数据列表（支持 status 筛选） |
| `/api/logs/detail/[id]` | GET | 获取解密后的日志内容 |
| `/api/logs/delete` | DELETE | 批量删除（支持传入 id 数组） |
| `/api/settings/get` | GET | 获取当前系统配置 |
| `/api/settings/update` | PUT | 更新配置（频率/开关/保留天数） |
| `/api/cleanup` | GET | 每日定时清理过期数据 |

---

## 8. 页面与交互规划 (Pages)

- **登录页** (`/login`)：仅包含“使用 GitHub 登录”按钮，极简风格。
- **仪表盘/列表页** (`/`)：
  - 顶部：统计卡片（总日志数 / 存储空间占用 / 最近抓取状态）。
  - 中部：操作工具栏（抓取按钮 / 批量删除 / 刷新）。
  - 底部：数据表格 + 分页器。
- **详情弹窗** (`/detail/[id]`)：独立页面，展示格式化 JSON 日志，提供“返回”和“下载 TXT”按钮。
- **设置页** (`/settings`)：开关、下拉选择器、数字输入框，调整系统行为。

---

## 9. 约束与假设 (Constraints)

1. **Vercel Hobby 计划限制**：
   - 无服务器函数执行时间限制为 10 秒（需优化抓取逻辑，若日志量极大需考虑分批或后台队列）。
   - Cron Jobs 免费版每月限制 1000 次执行（每小时 1 次完全够用）。
   - Blob 免费 1GB，若日志量激增，需依赖清理策略维持。
2. **权限模型**：明确为单用户系统，暂不考虑多租户。
3. **日志覆盖范围**：仅抓取目标项目 `production` 环境的 **Runtime Logs**（运行日志），不涉及 Build Logs。

---

## 10. 验收标准 (Acceptance Criteria)

- [ ] 开发者通过自定义域名可正常访问系统并完成 GitHub 登录。
- [ ] 点击“立即抓取”后，5 秒内能成功拉取最新部署日志并加密保存。
- [ ] 数据库中能看到新增的元数据记录，Blob 中能看到新增的 `.enc` 文件。
- [ ] 在列表页点击“查看”，能以良好格式展示解密后的日志原文。
- [ ] 设置定时抓取间隔为 30 分钟，30 分钟后系统自动执行抓取。
- [ ] 手动删除或等待保留期（测试设为 1 天）后，数据库和 Blob 文件均被清除。
- [ ] 未登录状态下访问任意 API 或页面，均被强制跳转或返回 401。

---
