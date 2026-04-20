#!/bin/zsh

set -u

cd "$(dirname "$0")/.." || exit 1

echo ""
echo "BAPLCP 報名系統 - 更新遠端資料"
echo "目前資料夾：$(pwd)"
echo ""

if ! command -v git >/dev/null 2>&1; then
  echo "找不到 git。請先安裝 Git，或改用 GitHub Desktop 更新。"
  echo ""
  read "pause?按 Enter 關閉..."
  exit 1
fi

if ! command -v npm >/dev/null 2>&1; then
  echo "找不到 npm。請先安裝 Node.js，再重新執行。"
  echo ""
  read "pause?按 Enter 關閉..."
  exit 1
fi

if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "這個資料夾不是 Git 專案，無法更新遠端資料。"
  echo ""
  read "pause?按 Enter 關閉..."
  exit 1
fi

echo "1/2 從遠端更新資料..."
if ! git pull; then
  echo ""
  echo "更新遠端資料失敗。請確認網路連線、GitHub 權限，或是否有本機檔案衝突。"
  echo ""
  read "pause?按 Enter 關閉..."
  exit 1
fi

echo ""
echo "2/2 安裝套件..."
if ! npm i; then
  echo ""
  echo "安裝套件失敗。請確認 Node.js/npm 版本與網路連線。"
  echo ""
  read "pause?按 Enter 關閉..."
  exit 1
fi

echo ""
echo "完成。遠端資料已更新，套件也已安裝。"
echo ""
read "pause?按 Enter 關閉..."
