# BAPLCP 排球報名系統

## 專案定位

這是 BAPLCP 的排球活動與報名 Web 應用。使用者可從 LINE LIFF、外部瀏覽器 OAuth 或直接活動連結進入，瀏覽活動與賽季、完成單次或季報名、查看名單；主揪則可建立與管理活動、名單、繳費、冷氣與賽季退款。

前端為 Vue 單頁應用，靜態站點部署至 GitHub Pages。Supabase 提供公開讀取、資料庫 RPC、RLS 與 Edge Functions；所有具規則或權限的寫入均在 Edge Function／資料庫交易中執行。

## 技術與執行環境

- Vue `3.5`、Vue Router `5`、Pinia `4`，以 JavaScript 撰寫前端。
- Vite `8` 與 `@vitejs/plugin-vue`；`vite-plugin-vue-devtools` 僅供開發使用。
- 樣式是專案自有 CSS 設計系統（`src/assets/styles/`），不是 Tailwind。
- UI 基元可使用 `reka-ui`；現有對話框優先沿用 `AccessibleDialog.vue`、`ConfirmDialog.vue` 與共用 CSS class。
- LINE 身份整合使用 LIFF `2.31`；非 LINE WebView 走 LINE OAuth code exchange。
- Supabase JS `2`：瀏覽器 anon client、PostgreSQL/RLS/RPC，以及 Deno Edge Functions。
- Edge Functions 以 TypeScript 與 Deno 執行，輸入驗證使用 Zod `4`。
- Prettier 是唯一已設定的格式化工具；沒有 lint、typecheck 或前端測試 script。

Node 版本由 CI 使用 Node 24；依賴鎖定於 `package-lock.json`。

## 目錄與責任邊界

- `src/views/`：路由頁面，組合頁面流程與頁面級狀態。
  - `home/`、`activities/`、`seasons/` 是公開頁面。
  - `admin/activities/` 管理活動／活動表單；`admin/seasons/refunds/` 管理賽季退款。
- `src/components/`：依功能分資料夾的呈現元件。元件應接收 props、發出事件，避免直接承擔跨頁資料讀寫。
- `src/composables/`：可重用的資料載入、表單、報名與管理互動邏輯。複雜 view 不要持續膨脹，先檢查是否能延續現有 composable。
- `src/services/`：Supabase 查詢、RPC、Edge Function 呼叫與資料 hydration。
  - `activityService.js`：活動、活動日期與活動頁 RPC。
  - `registrationService.js`：報名、來賓、季報假／回歸、名單訂閱與統計。
  - `edgeFunctionClient.js`：統一附加 LINE access token 呼叫受保護的 Function。
  - `memberProfileService.js`：會員同步與性別更新。
- `src/stores/liff.js`：全站 LIFF／OAuth 初始化、LINE profile、會員角色、性別與季報資格的唯一共享狀態來源。
- `src/utils/`：Supabase client、LINE OAuth 與台灣日期工具。需要台灣民用日期／時區邏輯時優先使用既有 `taiwanDate.js`，不要直接以 UTC 日期字串替代。
- `src/assets/styles/`：`tokens.css`、`base.css`、`layout.css`、`components.css` 依序由 `src/assets/style.css` 載入。新增樣式優先沿用既有 token 與元件 class。
- `supabase/functions/`：Deno Edge Functions；共用驗證、CORS、LINE profile 與日期／費用邏輯放在 `_shared/`。
- `supabase/migrations/`：schema、RLS、trigger、RPC 的唯一版本化來源。不可直接手改線上 schema 取代 migration。
- `supabase/SCHEMA.md`：前端和 Edge Function 使用的資料庫契約；修改資料模型前必讀，並與 migration 同步更新。
- `scripts/`：面向 macOS 使用者的本機啟動、雲端 Function 部署、遠端資料更新與手動上線腳本。

## 前端慣例

- 使用 `~` 作為 `src/` 別名，例如 `import { supabase } from '~/utils/supabase'`。
- 匯入排序與程式格式遵循現有 Prettier：單引號、無分號、尾隨逗號、箭頭函式單一參數不加括號。
- 路由 view 採 lazy import；只有首頁為靜態 import。`App.vue` 將 `ActivitiesListPage` 保留在 `KeepAlive`，以維持活動列表的狀態與捲動位置。
- `views` 負責編排，`composables` 處理狀態／流程，`services` 處理遠端資料。不要在呈現元件堆疊 Supabase 呼叫、資料正規化與跨頁狀態。
- 服務層已將正規化關聯資料 hydrate 成前端所需形狀。修改活動日期、來賓或季報狀態時，先追蹤 service 與對應 Edge Function／RPC，避免再次採用已移除的 legacy collection 欄位。
- 介面以手機、LINE 內建瀏覽器與觸控操作為優先；修改 UI 時確認窄螢幕、可讀性、焦點與 dialog 的無障礙行為。
- 外部資料、route params、RPC／Function 回應與使用者輸入都要先驗證／容錯。不可把權限或名額判斷只留在前端。

## 路由與導覽

Router 位於 `src/router/index.js`，採 `createWebHashHistory()`；Vite production base 為 `/baplcp-signup/`。

| 路徑 | 名稱 | 用途 |
| --- | --- | --- |
| `/` | `home` | 首頁 |
| `/activities` | `activities` | 活動列表 |
| `/activities/:id/:activityDateId?` | `activity` | 指定活動／場次的報名與名單頁 |
| `/seasons` | `seasons` | 賽季列表 |
| `/admin/activities` | `admin-activities` | 主揪活動管理 |
| `/admin/activities/new` | `admin-activity-create` | 建立活動 |
| `/admin/activities/:id/edit` | `admin-activity-edit` | 編輯活動 |
| `/admin/seasons/refunds` | `admin-season-refunds` | 賽季退款列表 |
| `/admin/seasons/refunds/:id` | `admin-season-refund` | 單一賽季退款管理 |

管理路由以 `meta.requiresOrganizer` 保護。守衛會先初始化 `liffStore`，只允許 `role === 'organizer'` 進入。新增需受保護頁面時，沿用這個 route meta，不要只在畫面上隱藏入口。

路由會儲存應用內來源頁，供返回導覽使用；對 router state 的行為有影響的修改，必須檢查從活動詳情返回列表及 OAuth 回跳的情境。

## LINE 身份與會員

應用啟動時由 `src/main.js` 初始化 `useLiffStore()`。store 同時處理：

- LINE 內 LIFF 登入與 profile 取得。
- 外部瀏覽器的 OAuth callback、暫存 session 與原路由還原。
- 以 `member-profile` Edge Function 同步會員資料，取得 `role`、`gender` 與 `isSeason`。
- 首次未填性別使用者的全域提示；更新仍應透過 store 的 `updateGender()`。

角色為 `member`、`organizer`、`engineer`。前端角色僅用於體驗與路由；生產環境的主揪權限必須由 Edge Function 和資料庫授權再次確認。

## Supabase、資料模型與寫入規則

以 `supabase/SCHEMA.md` 與最新 migration 為準，不要由 UI 欄位或舊程式碼反推 schema。

- 瀏覽器使用 anon key，僅做 RLS 允許的讀取、realtime 訂閱與公開 RPC。
- `activities`、`registrations`、`members` 與正規化參與資料的寫入不可由 browser client 直接執行。
- `activity_dates` 是活動日期的 canonical 資料；退役日期保留紀錄以維持歷史報名關聯。
- `registrations` 的每列代表一位會員的自我報名；`registration_guests` 為獨立的來賓參與資料；`season_registration_date_statuses` 記錄季報成員各場的請假／回歸狀態。
- 報名、候補、名額、取消、來賓與繳費會牽涉交易與併發規則。優先使用既有 Edge Function action／RPC，切勿在前端模擬寫入流程。
- schema、RLS、trigger 或 RPC 的變更必須新建遞增 migration，並同步更新 `SCHEMA.md`、前端 service、Edge Function 和必要測試。

### Edge Functions

- `activity-admin`：驗證主揪身份後建立、更新、刪除活動；資料庫 RPC 負責原子寫入與正式環境的授權。
- `registration-action`：處理一般報名、季報請假／回歸／取消，以及主揪的付款、移除成員與冷氣操作。一般報名透過 `save_registration_action_v1` 在單一交易中完成。
- `member-profile`：驗證 LINE token、同步會員 profile／角色，並更新性別。
- `line-token`：交換外部瀏覽器 OAuth code。
- `notify-registration-open`、`notify-activity-reminder`：依資料庫候選 RPC 發送 LINE 通知。

Function 以 service role key 執行，但不得因此略過驗證。輸入驗證使用 `_shared/input-validation.ts` 的 schema，受保護 action 必須驗證 LINE token 與主揪資格。`ALLOW_DEV_ADMIN=true` 僅限本機 Function 環境與 localhost，不可放進前端 `.env` 或正式環境。

## 環境設定與機密

前端啟動時要求以下 Vite 變數：

```env
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_LIFF_ID=
VITE_LINE_OAUTH_CLIENT_ID=
VITE_LINE_OAUTH_REDIRECT_URI=
```

不要提交實際 token、Supabase service role key、LINE channel secret 或環境檔內容。Edge Function 的 `SUPABASE_SERVICE_ROLE_KEY` 只存在於 Supabase Function secrets／本機 Function 環境。

## 常用指令與驗證

```bash
npm run dev          # Vite development mode
npm run format       # 依 .prettierrc 格式化整個 repository（會改檔）
npm run build        # production build
npm run build:dev    # development-mode build
```

- 本專案沒有 `test`、`lint` 或 `typecheck` npm script。不要假設它們存在。
- Edge Function 單元測試使用 Deno，例如 `deno test supabase/functions/_shared/input-validation.test.ts`；對應到變更的單一測試檔優先於整包執行。
- 一般前端／文件修改不需要執行 build。若需驗證，採最小相關檢查；執行全量格式化或 build 前先說明原因。
- 使用 `npm run format` 前須明確知道它會重寫整個 repo；只改少量 JS／Vue 時，優先格式化相關檔案。

## 部署與 Git

- GitHub Actions `.github/workflows/deploy.yml` 會在 `main`、`dev` 推送或手動觸發時，分別 checkout 兩個分支、安裝依賴、build production 與 development site，部署到 GitHub Pages 的 production 與 `/dev/` 路徑。
- 本機 `scripts/手動推上線.command` 會互動式 commit、rebase 與 push；沒有使用者明確要求，不得執行它、`git push` 或部署。
- `scripts/部署正式環境雲端功能.command` 與 `scripts/部署測試環境雲端功能.command` 會部署所有六個 Edge Functions。資料庫 migration 與 Functions 有相依時，先確認部署順序與目標環境。
- 保留使用者既有的未提交變更；避免 `git reset --hard`、大量覆寫或無關的格式化。

## 協作回覆

- 一律使用繁體中文回覆。
- 修改前先閱讀相關 view、composable、service、Function 與 schema；只做完成任務所需的最小變更。
- 完成時交代修改內容、行為影響、驗證結果與任何安全／資料庫注意事項。
- 發現文件、schema 與程式不一致時，先以當前程式與最新 migration 為證據，再同步修正文件。
