#!/bin/zsh

set -u

cd "$(dirname "$0")/.." || exit 1

DEV_URL="http://localhost:5173"
APP_URL="$DEV_URL/baplcp-signup/"

open_dev_server() {
  if command -v open >/dev/null 2>&1; then
    open "$APP_URL"
  fi
}

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
  echo "$APP_URL"
  echo ""
  echo "已跳過，不會重複執行 npm run dev。"
  echo "正在開啟瀏覽器..."
  open_dev_server
  echo ""
  read "pause?按 Enter 關閉..."
  exit 0
fi

echo "即將執行 npm run dev。"
echo "啟動後請保持這個視窗開啟；要停止伺服器時按 Ctrl+C。"
echo ""

npm run dev &
dev_pid=$!

if command -v curl >/dev/null 2>&1; then
  for _ in {1..30}; do
    if curl -fsS "$DEV_URL" >/dev/null 2>&1; then
      echo ""
      echo "開發伺服器已啟動："
      echo "$APP_URL"
      echo "正在開啟瀏覽器..."
      open_dev_server
      break
    fi

    if ! kill -0 "$dev_pid" >/dev/null 2>&1; then
      break
    fi

    sleep 1
  done
else
  echo "找不到 curl，無法自動確認伺服器狀態。"
  echo "請在 Vite 顯示啟動完成後手動開啟：$APP_URL"
fi

wait "$dev_pid"

echo ""
read "pause?伺服器已停止。按 Enter 關閉..."
