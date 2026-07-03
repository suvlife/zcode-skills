# ZCode Skills & Plugins

ZCode (AI Coding Agent) 的技能与插件集合，支持多电脑间同步。

## 📦 内容

### Skills（用户技能）

| 技能 | 说明 | 来源 |
|:-----|:-----|:-----|
| [agent-browser](skills/agent-browser/) | 浏览器自动化 CLI（导航/填表/截图/数据提取） | npm: `agent-browser` |
| [blog-publisher](skills/blog-publisher/) | 发布 Markdown 到 Ghost 博客 | 自建 |
| [byted-ark-seedance-skill](skills/byted-ark-seedance-skill/) | 豆包 Seedance AI 视频生成 | ByteDance |
| [byted-ark-seedream-skill](skills/byted-ark-seedream-skill/) | 豆包 Seedream 文生图/图生图 | ByteDance |
| [find-skills](skills/find-skills/) | 发现和安装新技能 | 社区 |
| [frontend-design](skills/frontend-design/) | 高质量前端界面设计 | 社区 |
| [stock-technical-analysis](skills/stock-technical-analysis/) | 威科夫股票技术分析 + 四大师评分 | [suvlife/stock-technical-analysis-v2](https://github.com/suvlife/stock-technical-analysis-v2) (submodule) |

### Plugins（ZCode 官方插件）

| 插件 | 说明 |
|:-----|:-----|
| [android-emulator](plugins/android-emulator/) | Android 模拟器自动化测试 |
| [document-skills](plugins/document-skills/) | DOCX + PDF 文档创建与处理 |
| [ios-simulator](plugins/ios-simulator/) | iOS 模拟器自动化测试 |
| [restore-legacy-sessions](plugins/restore-legacy-sessions/) | 恢复历史会话 |
| [skill-creator](plugins/skill-creator/) | 创建/编辑/优化 Skill |

## 🚀 安装

### 方式一：一键安装（推荐）

```bash
git clone --recurse-submodules https://github.com/suvlife/zcode-skills.git ~/zcode-skills
cd ~/zcode-skills
bash install.sh
```

### 方式二：手动安装

```bash
# 1. Clone（含 submodule）
git clone --recurse-submodules https://github.com/suvlife/zcode-skills.git ~/zcode-skills

# 2. 同步技能到 ~/.agents/skills/
mkdir -p ~/.agents/skills
cp -r ~/zcode-skills/skills/* ~/.agents/skills/

# 3. 安装 agent-browser CLI
npm i -g agent-browser && agent-browser install

# 4. 安装 stock-analysis Python 依赖
pip install -r ~/.agents/skills/stock-technical-analysis/requirements.txt
```

## ⚙️ 配置

### 1. Ghost 博客配置

```bash
cp configs/publish_config.json.example ~/.publish_config.json
# 编辑 ~/.publish_config.json，填入你的 Ghost Admin API Key
```

或创建技能本地配置：

```bash
cp skills/blog-publisher/config.json.example skills/blog-publisher/config.json
# 编辑 config.json
```

### 2. 股票分析 API Keys

```bash
# 方式一：环境变量（推荐）
cp configs/env.example ~/.zcode_env.sh
# 编辑 ~/.zcode_env.sh，填入你的 API keys
echo "source ~/.zcode_env.sh" >> ~/.bashrc  # 或 ~/.zshrc

# 方式二：在 stock-technical-analysis/scripts/config.py 中设置
# （不推荐，会暴露在 git 中）
```

获取免费 API Keys：
- **Tiingo**: https://tiingo.com （美股 OHLCV）
- **Alpha Vantage**: https://alphavantage.co/support/#api-key （美股基本面）
- **Finnhub**: https://finnhub.io/register （新闻/情绪）

### 3. agent-browser

```bash
npm i -g agent-browser && agent-browser install
```

## 🔄 多电脑同步

在一台新电脑上：

```bash
# 1. Clone 仓库
git clone --recurse-submodules https://github.com/suvlife/zcode-skills.git ~/zcode-skills

# 2. 运行安装脚本
cd ~/zcode-skills && bash install.sh

# 3. 手动配置 API keys（不会同步到 git）
#    - ~/.publish_config.json (Ghost + 飞书)
#    - ~/.zcode_env.sh (股票分析 API keys)
```

更新已有电脑：

```bash
cd ~/zcode-skills
git pull --recurse-submodules
bash install.sh
```

## 🔒 安全提示

- ⚠️ **永远不要将真实的 API keys 提交到 git**
- 所有含密钥的配置文件已在 `.gitignore` 中排除
- 仅 `.example` 模板文件会被提交
- 如需修改技能，编辑本地 `~/.agents/skills/` 中的副本，然后同步回仓库

## 📝 技能开发

如需创建新技能，参考 [skill-creator](plugins/skill-creator/) 插件。

技能结构：
```
my-skill/
├── SKILL.md          # 技能定义（frontmatter + 说明）
├── scripts/          # 可执行脚本
├── references/       # 参考资料
└── config.json       # 配置（gitignored）
```

## 📄 License

- 用户自建技能：MIT
- 第三方技能：保留原作者许可
- ZCode 官方插件：遵循 ZCode 许可
