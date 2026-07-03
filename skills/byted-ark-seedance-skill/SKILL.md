---
name: byted-ark-seedance-skill
license: MIT
description: 豆包 Seedance AI 视频生成 Skill。支持文生视频、图生视频、参考视频/音频生成、首尾帧控制。当用户说"生视频"、"生成视频"、"seedance"、"做个视频"时激活。火山方舟 Agent Plan 专属版本。
compatibility: Requires Node.js 18+ and network access to VolcEngine Ark API.
metadata:
  author: volcengine/agentplan
  version: "2.0.1"
  category: ai/video-generation
---

# Ark AgentPlan Seedance Skill

## 概述

豆包 Seedance AI 视频生成 Skill - **火山方舟 Agent Plan 专属版本**。

✨ **核心优势：**
- ✅ **零依赖可用** - 无需安装 SQLite 等第三方包，自动检测平台配置获取 API Key。
- ✅ **调用原生接口** - 使用 `/api/plan/v3` 网关，与语言模型共用服务入口。
- ✅ **智能意图识别** - 自动根据 prompt 分配 `2.0`, `2.0 fast`, `1.5 pro` 模型。
- ✅ **原生异步推送** - 结合 `.pending-tasks.json` 与 Agent 框架 Cron 机制实现完成后主动通知。

## 触发条件

用户说以下关键词时自动激活：
- 生视频、生成视频、视频生成
- seedance
- 给我做个视频、做个视频

---

## 🚀 核心命令与用法

### 1. 提交视频任务 (`create`)

在对话中识别到生成需求时，调用此命令（命令瞬间返回，不阻塞对话）：

```bash
node scripts/seedance-wrapper.js create \
  --prompt "小猫在草地上奔跑，阳光明媚，高清" \
  --duration 5 \
  --ratio "16:9"
```

> 💡 **智能参数提取与模型路由**：Agent 层**不需要**强制指定模型，Wrapper 会自动识别：
> - 包含 "快速生成"、"快点" → 自动路由到 `doubao-seedance-2.0-fast`
> - 包含 "样片预览"、"离线" → 自动路由到 `doubao-seedance-1.5-pro`
> - 包含 "1080p"、"高清" → 自动路由到 `doubao-seedance-2.0` (默认)

### 2. 进度查询与主动推送 (`check-pending`)

当用户询问"视频生成好了吗"时，调用此命令：
```bash
node scripts/seedance-wrapper.js check-pending
```
该命令会自动检查所有排队中的任务，如果生成完毕，会**自动将视频下载到本地**，并输出本地路径。

*(推荐：在 Agent 框架中配置 `schedule: every 2 minutes` 触发此命令，实现完全的自动推送)*。

### 3. 查询单个任务 (`get`)

```bash
node scripts/seedance-wrapper.js get --task-id cgt-xxx
```

### 4. 取消任务 (`delete`)

```bash
node scripts/seedance-wrapper.js delete --task-id cgt-xxx
```

### 5. 查看任务列表 (`list`)

```bash
node scripts/seedance-wrapper.js list --filter-status running
```

---

## 输入参数说明

| 参数名 | 类型 | 默认值 | 必填 | 说明 |
|-------|------|--------|------|------|
| `--prompt` | string | - | ✅ | 视频描述提示词，越详细效果越好 |
| `--duration` | integer | `5` | ❌ | 视频时长（秒），支持 4-15 秒，传 -1 自动适配最佳时长 |
| `--ratio` | string | `adaptive` | ❌ | 视频比例：`16:9` / `9:16` / `1:1` / `4:3` / `3:4` / `21:9` / `adaptive` |
| `--resolution` | string | `720p` | ❌ | 视频分辨率：`480p` / `720p` / `1080p` |
| `--generate-audio` | boolean | `true` | ❌ | 是否自动生成音频 |
| `--watermark` | boolean | `false` | ❌ | 是否添加水印 |
| `--image-file` | string | - | ❌ | 本地参考图片路径。传 1 个=首帧生视频，传 2 个=首尾帧生视频 |
| `--image-url` | string | - | ❌ | 在线参考图片 URL（当用户提供 http/https 链接时使用） |
| `--video-file` | string | - | ❌ | 本地参考视频路径 |
| `--video-url` | string | - | ❌ | 在线参考视频 URL |
| `--audio-file` | string | - | ❌ | 本地参考音频路径 |
| `--audio-url` | string | - | ❌ | 在线参考音频 URL |
| `--model` | string | - | ❌ | 模型版本：`2.0`（默认）/ `2.0 fast` / `1.5 pro` |
| `--seed` | integer | - | ❌ | 随机种子，用于复现结果 |
| `--return-last-frame` | boolean | `false` | ❌ | 是否返回尾帧图片，用于长视频拼接 |
| `--camera-fixed` | boolean | `false` | ❌ | 是否固定摄像头视角，保持画面稳定 |
| `--service-tier` | string | `default` | ❌ | 服务等级：`default`（在线快）/ `flex`（离线成本低50%） |
| `--draft` | boolean | `false` | ❌ | 样片预览模式，480p快速预览，成本更低 |
| `--enable-web-search` | boolean | `false` | ❌ | 是否开启联网搜索实时信息 |
| `--api-key` | string | - | ❌ | Agent 层自动传入，无需用户单独配置。默认仅本次临时使用，不保存 |
| `--save-api-key` | boolean | `false` | ❌ | **仅当用户明确同意保存/替换全局 Agent Plan API Key 时使用**。保存后会影响语言模型、生图、生视频、Embedding 等所有能力 |
| `--user-id` | string | `default` | ❌ | 用户ID，用于并发限制和任务列表查询 |

> 💡 **智能参数提取**：Skill 会自动从用户输入中识别参数：
> - "5秒"、"10秒" → `duration`
> - "竖屏"、"手机" → `ratio: "9:16"`
> - "横屏"、"电脑" → `ratio: "16:9"`
> - "方形"、"正方形" → `ratio: "1:1"`
> - "480p"、"720p"、"1080p" → `resolution`
> - "不要声音"、"静音" → `generate-audio: false`
> - "快速生成"、"用fast版" → 模型切换到 2.0 fast
> - "样片预览" → `draft: true`
> - "低成本模式"、"离线模式" → `service-tier: flex`，模型切换到 1.5 pro
> - "用高质量版"、"高分辨率" → 模型切换到 2.0 标准版
> - "固定镜头" → `camera-fixed: true`
> - "用seed=12345" → `seed: 12345`
> - "联网搜索" → `enable-web-search: true`
> - "低成本"、"离线模式" → `service-tier: "flex"`

---

## 🎯 智能模型选择

Skill 会根据用户输入自动选择最合适的模型，无需手动指定：

| 用户意图 / 参数 | 自动选择模型 | 原因 |
|---------------|-------------|------|
| "1080p"、"高清" | Seedance 2.0 | 2.0 fast 不支持 1080p |
| "快速生成"、"快点" | Seedance 2.0 fast | 速度更快 |
| "样片"、"draft"、"预览模式" | Seedance 1.5 pro | 只有 1.5 pro 支持样片模式 |
| "flex"、"离线"、"低成本" | Seedance 1.5 pro | 只有 1.5 pro 支持离线推理 |
| 传入图片/视频/音频参考 | Seedance 2.0 / 2.0 fast | 1.5 pro 不支持多模态参考 |
| "联网搜索"、"实时新闻" | Seedance 2.0 / 2.0 fast | 1.5 pro 不支持联网搜索 |
| **默认情况** | Seedance 2.0 | 功能最全的标准版 |

---

## 🎬 多模态生成模式（本地文件处理）

**重要：** Agent 无需自行上传文件！直接将本地文件的绝对路径传给 Wrapper，底层会自动将其转换为 Base64 提交给 API。

自动识别用户输入，选择最佳模式：

| 用户输入场景 | 自动选择的模式 | 执行参数示例 |
|---------|---------------|---------------|
| 纯文本描述 | 文生视频 | `--prompt "一只小猫在草地上奔跑"` |
| 1张图片 + 文字 | 首帧生视频 | `--image-file "/path/start.jpg"` |
| 2张图片 + 文字 | 首尾帧生视频 | `--image-file "/path/start.jpg" --image-file "/path/end.jpg"` |
| ≥3张图片 + 文字 | 参考图生视频 | 多个 `--image-file` 参数 |
| 视频文件 + 文字 | 参考视频生视频 | `--video-file "/path/ref.mp4"` |
| 音频文件 + 文字 | 参考音频生视频 | `--audio-file "/path/ref.mp3"` |

**支持的高级模式：**
- **首尾帧生视频**："图1是开头画面，图2是结尾画面"
- **参考图生视频**："图1为主体，图2为风格参考，图3为背景"
- **长视频拼接**：开启 `return_last_frame` 后，以上一段视频的尾帧作为下一段的首帧
- **虚拟人/真人素材视频**：传入 `asset://` 格式的素材ID作为参考

支持的输入格式：
- 本地文件绝对路径
- HTTP/HTTPS URL（直接传，无需转换）

---

## 📚 典型场景示例

### 场景 1: 简单文生视频

**用户输入：** "给我生成一个小猫在草地上奔跑的视频，5秒，720p"

**处理：**
```bash
node seedance-wrapper.js create \
  --prompt "一只可爱的小猫在绿草地上奔跑，阳光明媚，高清画质" \
  --duration 5 \
  --ratio "16:9" \
  --resolution "720p"
```

### 场景 2: 首帧生视频

**用户输入：** "[发了一张图片] 用这张图作为开头，生成一个日落海边的视频，8秒"

**处理：**
```bash
node seedance-wrapper.js create \
  --prompt "日落海边，波光粼粼，海鸥飞过，温暖治愈" \
  --duration 8 \
  --image-file "/path/to/image.jpg"
```

### 场景 3: 首尾帧生视频

**用户输入：** "[发了两张图片] 图1是开头，图2是结尾，生成一个日出到日落的过渡视频"

**处理：**
```bash
node seedance-wrapper.js create \
  --prompt "日出东方到日落西山的时间流逝，云彩变化，光线渐变" \
  --duration 10 \
  --image-file "/path/start.jpg" \
  --image-file "/path/end.jpg"
```

### 场景 4: 参考音频生视频

**用户输入：** "[发了一段音乐] 用这首曲子生成一个配合音乐节奏的光影视频"

**处理：**
```bash
node seedance-wrapper.js create \
  --prompt "配合音乐节奏变化的抽象光影艺术视频" \
  --duration 10 \
  --audio-file "/path/to/music.mp3"
```

### 场景 5: 低成本离线生成

**用户输入：** "用低成本模式生成一个城市夜景延时视频，不着急，慢慢生成"

**处理：**
```bash
node seedance-wrapper.js create \
  --prompt "繁华都市的夜景延时摄影，车水马龙，灯光璀璨" \
  --duration 10 \
  --service-tier "flex"
```

---

## 📤 返回结果格式

### 提交成功后：

```text
✅ 视频生成任务已提交！

🆔 任务 ID: cgt-xxx
🤖 使用模型: doubao-seedance-2.0

你可以：
- 问 "我的视频生成好了吗" 来查询进度
- Agent 框架 Cron 会自动定期检查，完成后通知你
```

### 查询到已完成时：

```text
🎉 视频生成完成！

🎬 任务 ID: cgt-xxxxxx
💡 提示词: 一只可爱的小猫在绿草地上奔跑...
🤖 模型: doubao-seedance-2.0
⏱️ 已耗时: 3 分钟
🔗 在线视频地址: https://xxx.xxx/xxx.mp4
💾 已自动下载到本地: <Seedance-Videos 目录>/cgt-xxxx/01-content.video_url.mp4
```

*(Agent 提取 `💾` 对应的本地路径，通过框架发送工具展示给用户即可)*

### 任务管理命令返回：

| 命令 | 返回说明 |
|------|---------|
| `get --task-id <task_id>` | 查询指定任务状态，含进度、下载地址 |
| `list [--filter-status <status>]` | 查询当前用户最近的任务列表，支持按状态过滤 |
| `delete --task-id <task_id>` | 取消指定排队中的任务 |

---

## 📥 文件保存位置

视频自动保存到以下位置（三级自动 fallback，适配所有运行环境）：

| 优先级 | 路径 | 适用场景 |
|-------|------|---------|
| 1 | `~/Desktop/Seedance-Videos/<task-id>/` | 桌面用户（Mac/Windows），默认优先 |
| 2 | `~/Seedance-Videos/<task-id>/` | Linux 服务器、无头环境 |
| 3 | `./Seedance-Videos/<task-id>/` | 极端情况（home 目录不可写） |

✅ 自动检测目录权限，自动选择可用路径。

每个任务独立目录，多任务互不影响，永不覆盖。

---

## ❌ 错误处理

| 错误类型 | 处理方式 |
|----------|---------|
| API Key 未配置 | 提示在对话中发送 Agent Plan 专属 API Key，或检查对应工具配置 |
| API 调用失败 | 返回具体错误信息 |
| 超出并发限制 | 提示等待其他任务完成 |
| 参数不兼容 | 自动降级调整并提示原因（如 1080p→720p） |
| 保存失败 | 返回视频 URL，提示手动下载 |

---

## ⚙️ 配置说明（一般不需要）

### 🔑 API Key 配置（三层优先级）

Skill 会按以下优先级查找 API Key，真正做到「零配置开箱即用」：

#### 🥇 第一层（最高优先级）：用户对话中显式传入
当用户直接在对话中发送 Agent Plan 专属 API Key 时，Agent 层通过参数传给 Skill：
```bash
node scripts/seedance-wrapper.js create --prompt "..." --api-key "ark-xxx"
```
> ✅ Skill 会自动校验 Key 是否 Agent Plan 专属。默认仅用于本次调用，不保存到全局配置。

#### 🥈 第二层（平台专属检测）：根据当前运行工具读取配置
Skill 自动检测当前运行平台，并从对应位置读取：
- **Claude Code**：`~/.claude/settings.json` 中的 `env.ANTHROPIC_AUTH_TOKEN`（或会话环境变量）
- **OpenClaw**：`~/.openclaw/openclaw.json` 中的 `models.providers.*.apiKey`
- **Hermes**：`~/.hermes/config.yaml` 中的 `model.api_key`

#### 🥉 第三层（通用兜底）：6 种通用环境变量
如果无法识别平台，则自动查找以下通用命名的环境变量：
1. `ANTHROPIC_AUTH_TOKEN`
2. `API_KEY`
3. `API_Key`
4. `API_Keys`
5. `api_key`
6. `apiKey`

> 💡 **安全原则**：用户对话中显式传入的 API Key 优先级最高，但**默认仅用于本次调用，不保存到全局配置**。
> 
> 由于 Agent Plan API Key 是当前平台的全局 Key，会影响语言模型、生图、生视频、Embedding 等所有能力，因此**只有用户明确要求「保存 / 替换 / 以后使用这个 Key」**时，Agent 层才应追加 `--save-api-key` 参数，写入当前平台的 Agent Plan 标准配置（如 OpenClaw 的 `volcengine-plan`），后续所有相关功能都可以直接复用。
> 
> ⚠️ 不会默认读取通用的 `ARK_API_KEY` 环境变量，避免误用火山其他业务的 API Key。

#### ❌ 都没找到：明确提示用户
如果以上都没有配置，Skill 会明确提示：
> 请在对话中发送 Agent Plan 专属 API Key，或在当前工具中配置。

---

### 📋 高级配置（一般不需要）

如需自定义 API 地址或其他参数，可以通过以下环境变量覆盖：

| 环境变量 | 说明 |
|---------|------|
| `ARK_SEEDANCE_MODEL` | 自定义模型 ID |
| `ARK_BASE_URL` | 自定义 API 地址（默认：https://ark.cn-beijing.volces.com） |
| `ARK_SEEDANCE_SAVE_PATH` | 自定义视频保存路径 |

---

### 🔄 Cron 配置（可选，用于自动通知）

如需任务完成后自动通知用户，配置 **Agent 框架应用层 Cron**（不是系统级 crontab）：

```yaml
# 每 2 分钟检查一次待完成任务
schedule: every 2 minutes
command: node scripts/seedance-wrapper.js check-pending
```

> 💡 不配 Cron 也完全不影响使用，用户可以随时主动问进度。
> 
> **参数提示**：`check-pending` 也支持 `--api-key`、`--base-url` 等参数透传，与其他命令一致。

---

## 🎯 不同框架的使用建议

### 🌟 配合 OpenClaw / 支持后台 Cron 的框架（推荐，体验最佳）

- ✅ 配置框架级 Cron，每 2 分钟执行一次 `check-pending`
- ✅ 用户提交任务后可以去聊别的，视频生成好后 Agent 会**主动推送**通知
- ✅ 真正的「提交完就不用管了」体验

### 💬 配合 Claude Code / 纯交互式框架（无 Cron）

这种框架没有后台定时能力，有两种使用策略：

#### 策略 A：被动查询（默认，推荐）
- 执行 `create` 提交任务后，回复用户：「任务已提交，大约需要 3 分钟。您可以随时问我进度。」
- 用户问「好了吗」的时候，再执行 `check-pending` 检查并下载

#### 策略 B：主动等待（用户明确要求等待时使用）
- 如果用户说「我就在这里等，好了直接给我」，可以使用底层的 `--wait` 参数：
  ```bash
  node seedance-wrapper.js create --prompt "..." --wait true --download-dir ./outputs
  ```
- ⚠️ 注意：使用 `--wait` 会阻塞当前对话回合，期间无法处理其他请求

---

## 🤖 Agent 层执行规范（大模型必读）

### 📌 多模态文件处理指令

**重要：你作为 Agent 层，不需要自行处理文件上传或格式转换！**

当用户在对话中发送图片、视频或音频时，请按以下规则直接调用 Skill：

#### ✅ 规则 1：框架给你本地路径时 → 直接传路径

如果消息上下文中提供了本地文件绝对路径（例如 `/workspace/temp.jpg`）：

- ❌ **你不需要**：读取文件、转 Base64、上传图床
- ✅ **你只需要**：把这个路径直接传给 `--image-file`、`--video-file` 参数

Skill 底层会自动读取文件、转 Base64、提交 API，你完全不用管。

#### ✅ 规则 2：用户发的是公网链接时 → 直接传 URL

如果用户发的是 `http://` 或 `https://` 开头的公开链接：

- ✅ 直接传给 `--image-url`、`--video-url` 参数即可

**调用示例：**
```bash
# 用户发了本地图片 → 直接传路径
node seedance-wrapper.js create --prompt "日落海边的美丽风景" --image-file "/workspace/images/cat.jpg"

# 用户发了在线链接 → 直接传 URL
node seedance-wrapper.js create --prompt "日落海边的美丽风景" --image-url "https://example.com/cat.jpg"
```

---

### 调用脚本方式

执行 `seedance-wrapper.js`，传入参数即可，所有参数透传给底层 CLI。

---

### 支持的原生 API 接口

| 接口 | 路径 |
|------|------|
| 创建视频任务 | `POST /api/plan/v3/contents/generations/tasks` |
| 查询单个任务 | `GET /api/plan/v3/contents/generations/tasks/{id}` |
| 查询任务列表 | `GET /api/plan/v3/contents/generations/tasks` |
| 取消/删除任务 | `DELETE /api/plan/v3/contents/generations/tasks/{id}` |

本 Skill 调用 Agent Plan 原生视频生成接口，与语言模型共用服务入口。
