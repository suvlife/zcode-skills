#!/bin/bash
# ZCode Skills & Plugins - Installation / Sync Script
# Usage: bash install.sh

set -e

REPO_DIR="$(cd "$(dirname "$0")" && pwd)"
SKILLS_DIR="$HOME/.agents/skills"
PLUGINS_DIR="$HOME/.zcode/cli/plugins/cache/zcode-plugins-official"

echo "╔══════════════════════════════════════════╗"
echo "║   ZCode Skills & Plugins Installer       ║"
echo "╚══════════════════════════════════════════╝"
echo ""

# ─── Skills ──────────────────────────────────
echo "📦 Installing skills to $SKILLS_DIR/"
mkdir -p "$SKILLS_DIR"

for skill_dir in "$REPO_DIR"/skills/*/; do
  skill_name=$(basename "$skill_dir")
  
  # Skip stock-technical-analysis (handled as submodule, copy separately)
  if [ "$skill_name" = "stock-technical-analysis" ]; then
    if [ -d "$skill_dir" ]; then
      rsync -a --exclude='__pycache__' --exclude='.cache' --exclude='.pytest_cache' \
        "$skill_dir" "$SKILLS_DIR/"
      echo "  ✅ $skill_name (submodule)"
    fi
    continue
  fi
  
  rsync -a --exclude='__pycache__' --exclude='.cache' --exclude='.pytest_cache' \
    --exclude='node_modules' --exclude='.DS_Store' \
    "$skill_dir" "$SKILLS_DIR/"
  echo "  ✅ $skill_name"
done

# ─── Plugins ─────────────────────────────────
echo ""
echo "📦 Installing plugins to $PLUGINS_DIR/"
mkdir -p "$PLUGINS_DIR"

for plugin_dir in "$REPO_DIR"/plugins/*/; do
  plugin_name=$(basename "$plugin_dir")
  # Plugins are stored as plugin-name/version/ in ZCode
  target_dir="$PLUGINS_DIR/$plugin_name/0.1.0"
  mkdir -p "$target_dir"
  rsync -a --exclude='node_modules' --exclude='__pycache__' --exclude='.DS_Store' \
    "$plugin_dir" "$target_dir/../"
  echo "  ✅ $plugin_name"
done

# ─── Config templates ────────────────────────
echo ""
echo "⚙️  Checking config files..."

# Ghost + Feishu config
if [ ! -f "$HOME/.publish_config.json" ]; then
  cp "$REPO_DIR/configs/publish_config.json.example" "$HOME/.publish_config.json"
  echo "  📝 Created ~/.publish_config.json (fill in your API keys!)"
else
  echo "  ✅ ~/.publish_config.json already exists"
fi

# Blog publisher local config
if [ ! -f "$SKILLS_DIR/blog-publisher/config.json" ]; then
  cp "$REPO_DIR/skills/blog-publisher/config.json.example" "$SKILLS_DIR/blog-publisher/config.json"
  echo "  📝 Created blog-publisher/config.json (fill in your Ghost key!)"
else
  echo "  ✅ blog-publisher/config.json already exists"
fi

# Stock analysis env vars
if [ ! -f "$HOME/.zcode_env.sh" ]; then
  cp "$REPO_DIR/configs/env.example" "$HOME/.zcode_env.sh"
  echo "  📝 Created ~/.zcode_env.sh (fill in your API keys!)"
  echo "     Add 'source ~/.zcode_env.sh' to your shell profile."
else
  echo "  ✅ ~/.zcode_env.sh already exists"
fi

# ─── agent-browser ───────────────────────────
echo ""
echo "🌐 Checking agent-browser..."
if ! command -v agent-browser &>/dev/null; then
  echo "  ⚠️  agent-browser not installed. Install with:"
  echo "     npm i -g agent-browser && agent-browser install"
else
  echo "  ✅ agent-browser already installed"
fi

# ─── Python deps for stock analysis ──────────
echo ""
echo "🐍 Checking stock-technical-analysis dependencies..."
if [ -f "$SKILLS_DIR/stock-technical-analysis/requirements.txt" ]; then
  echo "  Install Python deps with:"
  echo "     pip install -r $SKILLS_DIR/stock-technical-analysis/requirements.txt"
fi

# ─── Done ────────────────────────────────────
echo ""
echo "╔══════════════════════════════════════════╗"
echo "║  ✅ Installation complete!               ║"
echo "║                                          ║"
echo "║  Next steps:                             ║"
echo "║  1. Edit ~/.publish_config.json          ║"
echo "║  2. Edit ~/.zcode_env.sh                 ║"
echo "║  3. npm i -g agent-browser (if needed)   ║"
echo "║  4. pip install stock-analysis deps      ║"
echo "╚══════════════════════════════════════════╝"
