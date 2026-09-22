#!/bin/zsh

set -u

cd "$(dirname "$0")/.." || exit 1

pause_and_exit() {
  local exit_code="${1:-0}"
  echo ""
  read "pause?按 Enter 關閉..."
  exit "$exit_code"
}

fail() {
  echo "$1"
  pause_and_exit 1
}

# 只允許推到測試環境；正式環境資料庫請依上線流程手動處理。
DEV_PROJECT_REF="jloqqjshyyfmwdmtbctg"
PROD_PROJECT_REF="rkmxoqopptyuqhbeswqo"

if [ "$DEV_PROJECT_REF" = "$PROD_PROJECT_REF" ]; then
  fail "腳本設定錯誤：測試環境 project ref 與正式環境相同，已停止。"
fi

echo ""
echo "BAPLCP 報名系統 - 更新測試環境資料庫"
echo "目前資料夾：$(pwd)"
echo "目前分支：$(git branch --show-current 2>/dev/null)"
echo "目標環境：測試環境"
echo "Supabase project ref：$DEV_PROJECT_REF"
echo ""

if ! command -v supabase >/dev/null 2>&1; then
  fail "找不到 Supabase CLI。請先執行一次「部署測試環境雲端功能.command」自動安裝，或手動安裝後再試。"
fi

echo "Supabase CLI 版本：$(supabase --version)"
echo ""

# 登入 Supabase（已登入的話會直接跳過）
echo "確認 Supabase 登入狀態..."
if ! supabase projects list >/dev/null 2>&1; then
  echo ""
  echo "尚未登入 Supabase，即將開啟瀏覽器進行登入..."
  echo ""
  supabase login || fail "登入失敗。請確認網路連線後再試。"
fi

echo ""
echo "1/2 連結測試環境專案..."
if ! supabase link --project-ref "$DEV_PROJECT_REF"; then
  fail "連結測試環境失敗。請確認資料庫密碼與網路連線。"
fi

echo ""
echo "2/2 套用資料庫更新（會先列出待套用的 migration，確認後輸入 Y）..."
if ! supabase db push; then
  fail "套用資料庫更新失敗。請確認上方錯誤訊息。"
fi

echo ""
echo "完成。測試環境資料庫已更新。"
echo "提醒：Supabase CLI 目前連結在測試環境，之後要對正式環境操作前請重新 link。"
pause_and_exit 0
