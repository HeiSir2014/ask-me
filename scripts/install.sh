#!/usr/bin/env bash
# Ask-Me CLI Installation Script

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Detect platform
OS="$(uname -s)"
ARCH="$(uname -m)"

# Map architecture
case $ARCH in
  x86_64)
    ARCH="x64"
    ;;
  arm64|aarch64)
    ARCH="arm64"
    ;;
  *)
    echo -e "${RED}Unsupported architecture: $ARCH${NC}"
    exit 1
    ;;
esac

# Get latest release version from GitHub
echo -e "${BLUE}Fetching latest release...${NC}"
LATEST_VERSION=$(curl -s https://api.github.com/repos/HeiSir2014/ask-me/releases/latest | grep -o '"tag_name": "v[^"]*"' | cut -d'"' -f4)

if [ -z "$LATEST_VERSION" ]; then
  echo -e "${RED}Failed to fetch latest version${NC}"
  exit 1
fi

echo -e "${GREEN}Latest version: $LATEST_VERSION${NC}"

# Determine binary name based on OS
case $OS in
  Darwin)
    PLATFORM="macos-${ARCH}"
    BINARY_NAME="ask-me"
    ;;
  Linux)
    PLATFORM="linux-${ARCH}"
    BINARY_NAME="ask-me"
    ;;
  CYGWIN*|MINGW*|MSYS*)
    PLATFORM="windows-${ARCH}"
    BINARY_NAME="ask-me.exe"
    ;;
  *)
    echo -e "${RED}Unsupported operating system: $OS${NC}"
    exit 1
    ;;
esac

# Download URL
DOWNLOAD_URL="https://github.com/HeiSir2014/ask-me/releases/download/${LATEST_VERSION}/ask-me-${PLATFORM}"

# Installation directory
INSTALL_DIR="$HOME/.local/bin"

# Create install directory if not exists
if [ ! -d "$INSTALL_DIR" ]; then
  echo -e "${YELLOW}Creating installation directory: $INSTALL_DIR${NC}"
  mkdir -p "$INSTALL_DIR"
fi

# Download binary
TEMP_FILE=$(mktemp)
echo -e "${BLUE}Downloading ask-me ${LATEST_VERSION} for ${OS} ${ARCH}...${NC}"
echo -e "${BLUE}From: $DOWNLOAD_URL${NC}"

if command -v curl >/dev/null 2>&1; then
  curl -L -o "$TEMP_FILE" "$DOWNLOAD_URL"
elif command -v wget >/dev/null 2>&1; then
  wget -O "$TEMP_FILE" "$DOWNLOAD_URL"
else
  echo -e "${RED}Error: Neither curl nor wget is available${NC}"
  exit 1
fi

# Make executable
chmod +x "$TEMP_FILE"

# Move to install directory
mv "$TEMP_FILE" "$INSTALL_DIR/ask-me"
echo -e "${GREEN}✓ Installed to $INSTALL_DIR/ask-me${NC}"

# Create symlink for 'ask' command
if [ ! -e "$INSTALL_DIR/ask" ]; then
  ln -sf "$INSTALL_DIR/ask-me" "$INSTALL_DIR/ask"
  echo -e "${GREEN}✓ Created symlink: $INSTALL_DIR/ask${NC}"
fi

# Check if INSTALL_DIR is in PATH
if [[ ":$PATH:" != *":$INSTALL_DIR:"* ]]; then
  echo -e "${YELLOW}⚠️  $INSTALL_DIR is not in your PATH${NC}"
  echo ""
  echo -e "${BLUE}Add it to your shell profile:${NC}"
  echo ""
  if [[ "$SHELL" == *"zsh"* ]]; then
    echo -e "${YELLOW}  echo 'export PATH=\"$HOME/.local/bin:$PATH\"' >> ~/.zshrc${NC}"
    echo -e "${YELLOW}  source ~/.zshrc${NC}"
  elif [[ "$SHELL" == *"bash"* ]]; then
    echo -e "${YELLOW}  echo 'export PATH=\"$HOME/.local/bin:$PATH\"' >> ~/.bashrc${NC}"
    echo -e "${YELLOW}  source ~/.bashrc${NC}"
  else
    echo -e "${YELLOW}  Add '$INSTALL_DIR' to your PATH${NC}"
  fi
  echo ""
fi

# Test installation
echo -e "${BLUE}Testing installation...${NC}"
if "$INSTALL_DIR/ask-me" --help >/dev/null 2>&1; then
  echo -e "${GREEN}✓ Installation successful!${NC}"
  echo ""
  echo -e "${GREEN}You can now use either command:${NC}"
  echo -e "  ${BLUE}ask-me${NC}  (full name)"
  echo -e "  ${BLUE}ask${NC}     (short alias)"
  echo ""
  echo -e "${GREEN}Examples:${NC}"
  echo -e "  ${BLUE}ask-me --help${NC}"
  echo -e "  ${BLUE}ask --version${NC}"
  echo -e "  ${BLUE}ask-me init${NC}"
else
  echo -e "${RED}✗ Installation test failed${NC}"
  exit 1
fi
