#!/bin/bash
#
# Trellis Bootstrap Skill Installer
#
# Usage:
#   curl -sSL https://raw.githubusercontent.com/mindfoldhq/trellis/main/skills/trellis-bootstrap/install.sh | bash
#
set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

SKILL_NAME="trellis-bootstrap"
SKILL_DIR="$HOME/.claude/skills/$SKILL_NAME"
REPO_BASE="https://raw.githubusercontent.com/mindfold-ai/Trellis/main/skills/$SKILL_NAME"

echo ""
echo "╔═══════════════════════════════════════════╗"
echo "║     Trellis Bootstrap Skill Installer     ║"
echo "╚═══════════════════════════════════════════╝"
echo ""

# Check if already installed
if [ -f "$SKILL_DIR/SKILL.md" ]; then
    echo -e "${YELLOW}⚠ Skill already installed at $SKILL_DIR${NC}"
    read -p "Reinstall? [y/N] " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Aborted."
        exit 0
    fi
fi

# Create directory
echo "Creating skill directory..."
mkdir -p "$SKILL_DIR"

# Download SKILL.md
echo "Downloading SKILL.md..."
curl -sSL "$REPO_BASE/SKILL.md" -o "$SKILL_DIR/SKILL.md"

# Verify download
if [ ! -s "$SKILL_DIR/SKILL.md" ]; then
    echo -e "${RED}✗ Failed to download SKILL.md${NC}"
    exit 1
fi

echo ""
echo -e "${GREEN}✓ Installed successfully!${NC}"
echo ""
echo "Location: $SKILL_DIR"
echo ""
echo "┌─────────────────────────────────────────────┐"
echo "│  Next steps:                                │"
echo "│                                             │"
echo "│  1. Open Claude Code                        │"
echo "│  2. Navigate to your project directory     │"
echo "│  3. Say: \"帮我初始化 Trellis\"              │"
echo "│     or: \"Initialize Trellis in this project\"│"
echo "│                                             │"
echo "│  Claude will guide you through the setup.  │"
echo "└─────────────────────────────────────────────┘"
echo ""
