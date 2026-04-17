#!/bin/zsh

set -u

cd "$(dirname "$0")" || exit 1

REMOTE="origin"
BRANCH="main"
SITE_URL="https://baplcp.github.io/baplcp-signup/"

echo ""
echo "BAPLCP 報名系統 - 手動推上線"
echo "目前資料夾：$(pwd)"
echo ""

if ! command -v git >/dev/null 2>&1; then
  echo "找不到 git。請先安裝 Git，或改用 GitHub Desktop 上傳。"
  echo ""
  read "pause?按 Enter 關閉..."
  exit 1
fi

if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "這個資料夾不是 Git 專案，無法推上線。"
  echo ""
  read "pause?按 Enter 關閉..."
  exit 1
fi

if [ -z "$(git status --porcelain)" ]; then
  echo "目前沒有任何檔案變更，不需要上線。"
  echo ""
  read "pause?按 Enter 關閉..."
  exit 0
fi

echo "即將上線的檔案："
git status --short
echo ""

read "answer?確定要把以上變更推上線嗎？輸入 y 後按 Enter："
if [ "$answer" != "y" ] && [ "$answer" != "Y" ]; then
  echo ""
  echo "已取消，沒有推上線。"
  echo ""
  read "pause?按 Enter 關閉..."
  exit 0
fi

echo ""
echo "1/4 加入變更..."
git add -A

echo ""
echo "2/4 建立上線紀錄..."
commit_message="手動上線 $(date '+%Y-%m-%d %H:%M:%S')"
if ! git commit -m "$commit_message"; then
  echo ""
  echo "建立上線紀錄失敗。請確認上方錯誤訊息。"
  echo ""
  read "pause?按 Enter 關閉..."
  exit 1
fi

echo ""
echo "3/4 同步 GitHub 最新版本..."
if ! git pull --rebase "$REMOTE" "$BRANCH"; then
  echo ""
  echo "同步失敗。通常是 GitHub 上也有人改過同一段內容，需要先解衝突。"
  echo ""
  read "pause?按 Enter 關閉..."
  exit 1
fi

echo ""
echo "4/4 推上 GitHub Pages..."
if ! git push "$REMOTE" "$BRANCH"; then
  echo ""
  echo "推上線失敗。請確認 GitHub 登入權限或網路連線。"
  echo ""
  read "pause?按 Enter 關閉..."
  exit 1
fi

echo ""
echo "完成。GitHub Pages 通常會在 1 到 3 分鐘內更新："
echo "$SITE_URL"
echo ""
read "pause?按 Enter 關閉..."
