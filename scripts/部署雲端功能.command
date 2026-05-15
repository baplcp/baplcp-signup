#!/bin/zsh

set -u

cd "$(dirname "$0")/.." || exit 1

PROJECT_ID="rkmxoqopptyuqhbeswqo"
FUNCTION_NAME="notify-registration-open"

echo ""
echo "BAPLCP 報名系統 - 部署雲端功能"
echo "目前資料夾：$(pwd)"
echo ""

# 檢查 Homebrew
if ! command -v brew >/dev/null 2>&1; then
  echo "找不到 Homebrew。請先到 https://brew.sh 安裝 Homebrew，再重新執行。"
  echo ""
  read "pause?按 Enter 關閉..."
  exit 1
fi

# 檢查 Supabase CLI，沒有就自動安裝
if ! command -v supabase >/dev/null 2>&1; then
  echo "找不到 Supabase CLI，正在透過 Homebrew 安裝..."
  echo ""
  if ! brew install supabase/tap/supabase; then
    echo ""
    echo "安裝 Supabase CLI 失敗。請確認網路連線後再試。"
    echo ""
    read "pause?按 Enter 關閉..."
    exit 1
  fi
  echo ""
  echo "Supabase CLI 安裝完成。"
  echo ""
fi

echo "Supabase CLI 版本：$(supabase --version)"
echo ""

# 登入 Supabase（已登入的話會直接跳過）
echo "確認 Supabase 登入狀態..."
if ! supabase projects list >/dev/null 2>&1; then
  echo ""
  echo "尚未登入 Supabase，即將開啟瀏覽器進行登入..."
  echo ""
  if ! supabase login; then
    echo ""
    echo "登入失敗。請確認網路連線後再試。"
    echo ""
    read "pause?按 Enter 關閉..."
    exit 1
  fi
fi

echo ""
echo "正在部署 $FUNCTION_NAME..."
echo ""

if ! supabase functions deploy "$FUNCTION_NAME" --project-ref "$PROJECT_ID" --no-verify-jwt; then
  echo ""
  echo "部署失敗。請確認上方錯誤訊息。"
  echo ""
  read "pause?按 Enter 關閉..."
  exit 1
fi

echo ""
echo "完成。$FUNCTION_NAME 已成功部署到 Supabase。"
echo ""
read "pause?按 Enter 關閉..."
