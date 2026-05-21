# BAPLCP 排球報名系統

## 專案定位

BAPLCP 排球報名系統是提供排球活動建立、活動清單、報名、名單查詢與報名管理的 Web 專案。主要使用情境是 LINE 群組內的活動參與者透過 LIFF 或活動連結進入頁面，在手機上查看球局資訊、完成報名、確認候補或補上狀態。

專案已從早期單純報名頁面擴充為 Vue 3 應用，包含前台活動瀏覽、報名流程、會員身份、主揪活動建立與名單管理。後端資料與寫入規則由 Supabase、RLS、migration 與 Edge Functions 共同維護。

開發時請以「可讀性、可維護性、既有架構一致性」為優先。功能能正常運作只是最低要求；程式碼應該讓下一位維護者能快速理解資料來源、狀態流向與修改範圍。

---

## 技術架構

- 前端：Vue 3、Vue Router、Pinia、JavaScript
- 建置工具：Vite
- 樣式：Tailwind CSS 4 與專案既有 CSS
- LINE 整合：LINE LIFF 與 LINE token 驗證
- 後端：Supabase Database、RLS、Edge Functions
- 部署：GitHub Pages，透過 GitHub Actions build/deploy

### 主要目錄

- `src/views/`：頁面層，負責組合流程與頁面級狀態。
- `src/components/`：可重用 UI 元件，依功能區分資料夾。
- `src/composables/`：頁面或功能的狀態邏輯、資料轉換與互動流程。
- `src/services/`：與 Supabase、Edge Functions 或外部服務溝通的服務層。
- `src/stores/`：Pinia store，目前包含 LIFF 使用者與會員身份狀態。
- `src/utils/`：通用工具與 Supabase client。
- `src/config/`：環境設定。
- `supabase/functions/`：Supabase Edge Functions。
- `supabase/migrations/`：資料庫結構、RLS、trigger 與權限變更。
- `supabase/SCHEMA.md`：前端與 Edge Functions 依賴的資料庫契約。
- `scripts/`：本機開發、雲端功能部署、資料更新與手動上線腳本。
- `docs/`：設計或 UI 參考文件。

---

## 目前主要功能

- 首頁與導覽入口
- 活動列表與賽季列表
- 目前活動報名頁
- 報名、取消、部分取消、重新加入等報名操作
- 候補、正取、繳費與名單狀態顯示
- 主揪建立活動
- 主揪管理活動與名單
- LINE 使用者身份同步
- 會員角色控管
- 報名開放與活動提醒相關 Edge Functions

---

## 前端資料流與分工

前端應維持清楚的責任分層：

- `views` 負責頁面組裝、路由進入後的流程與高層狀態。
- `components` 負責畫面呈現與局部互動，不應直接承擔跨頁資料流程。
- `composables` 負責可重用的頁面邏輯、表單狀態、資料整理與互動狀態。
- `services` 負責 API/Edge Function/Supabase 呼叫與錯誤包裝。
- `stores` 負責跨頁共享狀態，例如 LIFF 初始化結果、LINE profile 與會員角色。

新增或修改功能時，請先判斷邏輯應該放在哪一層。不要把 API 呼叫、資料轉換、UI 狀態與 DOM 呈現全部塞進單一元件。

---

## 路由與權限

路由定義在 `src/router/index.js`，使用 `createWebHashHistory()`，Vite base 為 `/baplcp-signup/`。

目前主要路由：

- `/`：首頁
- `/group-list`：活動列表
- `/season-list`：賽季列表
- `/active-activity`：活動報名頁
- `/create-activity`：建立活動，需 `organizer`
- `/manage-activities`：管理活動，需 `organizer`

需要主揪權限的頁面使用 route meta：`requiresOrganizer: true`。進入前會初始化 `liffStore` 並檢查 `liffStore.role`。

---

## LINE LIFF 與會員身份

LIFF 與會員身份狀態集中在 `src/stores/liff.js`，透過 Pinia store 使用。

```js
import { useLiffStore } from '~/stores/liff'

const liffStore = useLiffStore()
const isOrganizer = computed(() => liffStore.role === 'organizer')
const isEngineer = computed(() => liffStore.role === 'engineer')
```

角色來源為 Supabase `members` 表，透過 `member-profile` Edge Function 同步 LINE profile。新使用者預設為 `member`，管理者可直接在 Supabase Table Editor 調整 `role`。

角色：

- `organizer`：主揪，可進入建立與管理活動頁。
- `engineer`：工程師身份，目前主要供辨識與後續工具權限使用。
- `member`：一般會員。

---

## Supabase 與資料庫契約

Supabase schema、RLS、trigger、migration 與 Edge Function 寫入規則以 `supabase/SCHEMA.md` 和 `supabase/migrations/` 為準。不要只根據前端欄位名稱推測資料表結構。

重要原則：

- Browser client 使用 anon key，原則上只做讀取。
- `activities`、`registrations`、`members` 的寫入需透過 Edge Functions。
- 寫入類操作需經 LINE token 或本機開發模式允許的身份驗證。
- 涉及報名規則、名額、候補、取消或繳費欄位時，需同時確認 migration、Edge Function 與前端顯示邏輯。
- 資料庫結構或權限變更應新增 migration，不應只改線上資料表。

目前主要 Edge Functions：

- `activity-admin`：主揪活動建立、更新、刪除。
- `registration-action`：報名、取消與主揪名單操作。
- `member-profile`：LINE 驗證與會員 profile/role 同步。
- `line-token`：LINE token 相關處理。
- `notify-registration-open`：報名開放通知。
- `notify-activity-reminder`：活動提醒通知。

---

## 路徑別名

Vite 設定的別名為 `~`，對應 `src/`。import 時使用 `~/`。

```js
import { supabase } from '~/utils/supabase'
import { useLiffStore } from '~/stores/liff'
```

---

## 開發與維護原則

請優先遵守以下原則：

- 以可讀性與可維護性優先，避免為了少幾行程式犧牲清楚的命名與分層。
- 優先沿用既有檔案結構、命名習慣與資料流。
- 每次修改保持範圍集中，避免順手重構無關頁面。
- 元件只承擔合理大小的 UI 責任；複雜狀態與資料轉換應移到 composable 或 service。
- 命名要能表達使用情境與資料意義，避免模糊縮寫。
- 對外部資料、Edge Function 回傳、使用者輸入與可空欄位保持防禦性處理。
- 涉及報名規則或權限的邏輯，需讓條件判斷可讀，必要時補上簡短註解。
- 不要複製貼上大段相似邏輯；若重複代表同一個概念，應抽成 helper、composable 或元件。
- UI 修改需優先確認手機尺寸、LINE 內建瀏覽器情境與文字可讀性。
- 修改資料欄位時，要同步檢查 schema、service、composable、view 與 Edge Function。

---

## 驗證原則

遵守專案工作規則：

- 不要自動執行 `npm run build`。
- 不要在任務結尾自動跑 build，除非使用者明確要求。
- 優先執行最小且相關的驗證，例如特定測試、lint、typecheck 或格式檢查。
- 執行昂貴或耗時指令前，先說明為什麼需要。
- 文件修改通常不需要跑測試；若改到程式碼，再依影響範圍選擇最小驗證。

---

## 部署方式

- GitHub Actions：`.github/workflows/deploy.yml` 會 build 並部署到 GitHub Pages。
- 手動上線腳本：`scripts/手動推上線.command`。
- 雲端功能部署腳本：`scripts/部署雲端功能.command`。
- 遠端資料更新腳本：`scripts/更新遠端資料.command`。
- 不應由 Claude/Codex 自動執行 `git push`，除非使用者明確要求。

---

## 回覆與協作規則

- 一律使用繁體中文回覆。
- 修改完成後，清楚說明改了哪些地方與是否有執行驗證。
- 不要自動推送 git。
- 不要覆蓋使用者未要求修改的變更。
- 若發現現有文件、schema 或程式碼互相矛盾，先指出矛盾並以目前專案檔案為依據更新。
