#!/bin/zsh

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

zsh "$SCRIPT_DIR/deploy-cloud-functions.sh" "測試環境" ".env.development"
