#!/bin/zsh

set -u

TARGET_LABEL="${1:-}"
ENV_FILE_NAME="${2:-}"

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

if [ -z "$TARGET_LABEL" ] || [ -z "$ENV_FILE_NAME" ]; then
  fail "部署腳本設定錯誤：缺少目標環境或環境設定檔。"
fi

ENV_FILE="$(pwd)/$ENV_FILE_NAME"

if [ ! -f "$ENV_FILE" ]; then
  fail "找不到環境設定檔：$ENV_FILE_NAME"
fi

PROJECT_REF="$(
  awk -F= '
    /^[[:space:]]*#/ || /^[[:space:]]*$/ { next }
    {
      key = $1
      sub(/^[[:space:]]+/, "", key)
      sub(/[[:space:]]+$/, "", key)
      if (key == "SUPABASE_PROJECT_REF") {
        sub(/^[^=]*=/, "")
        sub(/^[[:space:]]+/, "")
        sub(/[[:space:]]+$/, "")
        sub(/\r$/, "")
        print
        exit
      }
    }
  ' "$ENV_FILE"
)"

if [ -z "$PROJECT_REF" ]; then
  fail "$ENV_FILE_NAME 缺少 SUPABASE_PROJECT_REF。"
fi

if [[ ! "$PROJECT_REF" =~ ^[a-z0-9]+$ ]]; then
  fail "$ENV_FILE_NAME 的 SUPABASE_PROJECT_REF 格式不正確：$PROJECT_REF"
fi

FUNCTIONS=(
  "activity-admin"
  "registration-action"
  "member-profile"
  "line-token"
  "notify-registration-open"
  "notify-activity-reminder"
)

echo ""
echo "BAPLCP 報名系統 - 部署雲端功能"
echo "目前資料夾：$(pwd)"
echo "目標環境：$TARGET_LABEL"
echo "環境設定檔：$ENV_FILE_NAME"
echo "Supabase project ref：$PROJECT_REF"
echo ""

# 檢查 Homebrew
if ! command -v brew >/dev/null 2>&1; then
  echo "找不到 Homebrew。請先到 https://brew.sh 安裝 Homebrew，再重新執行。"
  pause_and_exit 1
fi

# 檢查 Supabase CLI，沒有就自動安裝
if ! command -v supabase >/dev/null 2>&1; then
  echo "找不到 Supabase CLI，正在透過 Homebrew 安裝..."
  echo ""
  if ! brew install supabase/tap/supabase; then
    echo ""
    echo "安裝 Supabase CLI 失敗。請確認網路連線後再試。"
    pause_and_exit 1
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
    pause_and_exit 1
  fi
fi

echo ""
FAILED=()

for FUNCTION_NAME in "${FUNCTIONS[@]}"; do
  echo "正在部署 $FUNCTION_NAME..."
  if supabase functions deploy "$FUNCTION_NAME" --project-ref "$PROJECT_REF" --no-verify-jwt; then
    echo "✓ $FUNCTION_NAME 部署成功"
  else
    echo "✗ $FUNCTION_NAME 部署失敗"
    FAILED+=("$FUNCTION_NAME")
  fi
  echo ""
done

if [ ${#FAILED[@]} -eq 0 ]; then
  echo "完成。所有雲端功能已成功部署到 $TARGET_LABEL。"
else
  echo "以下功能部署失敗，請確認錯誤訊息後重試："
  for name in "${FAILED[@]}"; do
    echo "  - $name"
  done
fi

pause_and_exit 0
