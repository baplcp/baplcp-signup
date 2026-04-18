#!/bin/zsh

set -u

cd "$(dirname "$0")/.." || exit 1

DEV_URL="http://localhost:5173"

echo ""
echo "BAPLCP 報名系統 - 啟動開發伺服器"
echo "目前資料夾：$(pwd)"
echo ""

if ! command -v npm >/dev/null 2>&1; then
  echo "找不到 npm。請先安裝 Node.js，再重新執行。"
  echo ""
  read "pause?按 Enter 關閉..."
  exit 1
fi

if command -v curl >/dev/null 2>&1 && curl -fsS "$DEV_URL" >/dev/null 2>&1; then
  echo "開發伺服器已經在執行："
  echo "$DEV_URL/baplcp-signup/"
  echo ""
  echo "已跳過，不會重複執行 npm run dev。"
  echo ""
  read "pause?按 Enter 關閉..."
  exit 0
fi

echo "即將執行 npm run dev。"
echo "啟動後請保持這個視窗開啟；要停止伺服器時按 Ctrl+C。"
echo ""

npm run dev

echo ""
read "pause?伺服器已停止。按 Enter 關閉..."
