#!/bin/zsh

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

zsh "$SCRIPT_DIR/deploy-cloud-functions.sh" "正式環境" ".env.production"
