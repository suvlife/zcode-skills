---
name: byted-ark-seedream-skill
license: MIT
description: |
  🎨 WHAT：豆包 Seedream 文生图 / 图生图 / 连贯组图 Skill。
  ⏰ WHEN：用户说「生图/画图/seedream/给我画一张」，或发图片+「参考这个画」。
  ❗ NOT FOR：视频生成（请使用 byted-ark-seedance-skill）。
  火山方舟 Agent Plan 专属版本，支持联网搜索、流式输出。

compatibility: Requires Node.js 18+ and network access to VolcEngine Ark API.

metadata:
  author: volcengine/agentplan
  version: "2.0.0"
  category: ai/image-generation
---

# Ark AgentPlan Seedream Skill

## 概述

豆包 Seedream AI 图片生成 Skill - **火山方舟 Agent Plan 专属版本**。

✨ **核心优势：**
- ✅ **真正零配置** - 三层智能检测自动读取平台 API Key，无需任何配置
- 🔑 **安全默认** - 用户在对话中直接发送 ark-xxx，默认仅本次临时使用，显式确认后才保存到平台配置
- 📂 **智能路径降级** - 三级保存策略，桌面/服务器都兼容
- ✅ **调用原生接口** - 与语言模型共用服务入口
- ✅ **功能完整** - 支持文生图、连贯图、图生图、联网搜索等 6 种场景

---

## 触发条件

用户说以下关键词时自动激活：
- 生图、画图、生成图片
- seedream
- 给我画、画一张、画一个
- 图生图、参考图
- 生成一组图、四季变迁、多风格
- 豆包画图、方舟画图

---

## 输入参数

| 参数名 | 类型 | 默认值 | 必填 | 说明 |
|-------|------|--------|------|------|
| `prompt` | string | - | ✅ | 图片描述提示词，越详细效果越好 |
| `mode` | string | `text-to-image` | ❌ | 生成模式：`text-to-image`（文生图） / `image-to-image`（图生图） |
| `size` | string | `2K` | ❌ | 图片分辨率：`1K` / `2K` / `3K` / `4K` 或具体像素值 |
| `sequential` | boolean | `false` | ❌ | 是否生成一组连贯图片（风格保持一致） |
| `count` | integer | `4` | ❌ | 连贯图数量（sequential=true 时有效，1~15张） |
| `reference_images` | array | - | ❌ | 参考图片列表（最多 14 张） |
| `reference_strength` | number | `0.7` | ❌ | 参考图影响强度（0~1） |
| `watermark` | boolean | `true` | ❌ | 是否添加水印 |
| `optimize` | boolean | `true` | ❌ | 是否自动优化提示词 |
| `stream` | boolean | `auto` | ❌ | 流式输出模式（sequential=true 自动开启） |
| `enable_web_search` | boolean | `false` | ❌ | 是否开启联网搜索（实时新闻、赛事等） |
| `api_key` | string | - | ❌ | Agent 层自动传入，默认仅本次临时使用 |
| `save_api_key` | boolean | `false` | ❌ | **仅当用户明确要求保存时才传 true**。将 API Key 保存为平台全局 Agent Plan 配置，语言模型、生图、生视频、Embedding 等所有能力自动复用 |
| `response_format` | string | `jpeg` | ❌ | 图片输出格式：`png`（无损） / `jpeg`（体积小） |

> 💡 **智能参数提取**：Agent 层应从用户输入中识别参数，并按下表传给 Skill：
> - "一组图"、"多风格" → `sequential=true, count=4`
> - "3K"、"超高清" → `size="3K"`
> - "不要水印" → `watermark=false`
> - "不要优化" → `optimize=false`

---

## 🚀 快速开始

### 30 秒上手

```
用户：给我画一只可爱的英短蓝猫，趴在洒满阳光的木质窗台上
  ↓
Skill：🎨 正在生成（约 10~15 秒）
  ↓
Skill：✅ 生成完成，已保存到桌面
       [显示图片]
```

---

## ✨ 功能特性

### 🎯 六种生成场景
- ✅ 纯文生图 → 单张
- ✅ 纯文生图 → 一组连贯图（2~15张，风格统一）
- ✅ 单参考图生图 → 单张
- ✅ 单参考图生图 → 一组风格统一图
- ✅ 多参考图融合 → 单张
- ✅ 多参考图融合 → 一组风格统一图

### 🎨 提示词优化（默认开启）
自动增强画质描述，提升出图质量：
- 电影质感、专业摄影、8K分辨率
- 极致细节、光影层次、色彩饱满

### 🎭 内置 10 大风格预设
自动识别风格关键词：电影风、二次元、插画风、写实风、国潮风、赛博朋克、水彩风、3D渲染、暗黑风、治愈系

### 🌐 联网搜索（可选）
自动识别需要实时信息的场景：
- 实时新闻、体育赛事
- 最新热点、节日活动
- 天气相关、时间相关场景

---

## ❌ 错误处理

| 错误类型 | 处理方式 |
|----------|---------|
| API Key 未配置 | 提示直接在对话中发送 API Key（Agent Plan 专属），默认仅本次临时使用，显式确认后才保存到平台配置 |
| API 调用失败 | 返回具体错误信息 |
| 网络超时 | 提示重试 |
| 保存失败 | 返回图片 URL，提示手动下载 |

---

## 📚 更多文档

完整示例、配置说明、开发指南请参考 reference 目录：

| 文件 | 说明 |
|------|------|
| `references/EXAMPLES.md` | 典型场景示例 + 完整参数参考 |
| `references/CONFIG.md` | 配置说明、模型速查表、技术实现细节 |
| `references/DEVELOPER.md` | Agent 开发指南、图片预处理、脚本调用方式 |

