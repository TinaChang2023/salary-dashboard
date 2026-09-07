# 個人薪水分配管理 Dashboard — Setup Guide

一個私人使用的財務管理 Web App:每月輸入薪水後,依你設定的比例自動分成
「花費 / 儲蓄 / 投資」,並為每個用途指定帳戶、追蹤完成狀態與長期累積金額。

技術棧:HTML + CSS + Vanilla JS(前端)、Supabase(Auth + PostgreSQL + RLS)、
GitHub Pages(靜態託管)、Chart.js(趨勢圖)。全部可在 **免費方案** 上運作。

---

## 專案檔案結構

```
salary-dashboard/
├── index.html
├── css/
│   └── styles.css
├── js/
│   ├── supabase.js      ← 填入你的 Supabase URL / anon key
│   ├── app.js            ← 共用:icon、toast、modal、router
│   ├── auth.js            ← 登入 / 忘記密碼 / session
│   ├── accounts.js        ← 帳戶管理 CRUD
│   ├── salary.js          ← 新增薪水 / 薪水紀錄 / 編輯 / 刪除
│   ├── dashboard.js       ← Dashboard 本月總覽
│   ├── statistics.js      ← 統計 / 每月趨勢圖
│   └── settings.js        ← 分配比例設定
└── supabase/
    ├── schema.sql         ← 資料表 + 觸發器 + RPC function
    └── rls.sql             ← Row Level Security policies
```

---

## Step 1 — 建立 Supabase Project

1. 前往 [supabase.com](https://supabase.com) → 註冊 / 登入。
2. 點擊 **New Project**。
3. 選擇免費方案 Organization,輸入專案名稱(例如 `salary-dashboard`)。
4. 設定一組安全的 Database Password(妥善保存,之後用不到但要記得)。
5. 選擇離你最近的 Region(例如 Singapore / Northeast Asia)。
6. 點擊 **Create new project**,等待約 1-2 分鐘建立完成。

---

## Step 2 — 建立 Database Tables(執行 schema.sql)

1. 進入專案後,左側選單點擊 **SQL Editor**。
2. 點擊 **New query**。
3. 打開專案中的 `supabase/schema.sql`,複製全部內容貼上。
4. 點擊 **Run**。
5. 確認沒有錯誤訊息(應該顯示 Success)。

這一步會建立:`profiles`、`settings`、`accounts`、`salary_records`、
`salary_allocations` 五張表;一個 `validate_allocation_account` 輔助
function(檢查帳戶擁有者與用途權限);兩個 RPC function
(`create_salary_record`、`update_salary_record`,用來原子性地一次寫入
薪水紀錄與三筆分配,並在寫入前呼叫上述驗證);還有一個「新使用者註冊時
自動建立 profile + 預設 60/30/10 設定」的觸發器。

> `schema.sql` 必須先於 `rls.sql` 執行,因為 RLS policy 需要先有資料表才能建立。

---

## Step 3 — 執行 RLS SQL

1. 回到 **SQL Editor** → **New query**。
2. 打開 `supabase/rls.sql`,複製全部內容貼上。
3. 點擊 **Run**。

這一步會:
- 對五張表全部啟用 Row Level Security。
- 為每張表分別建立 SELECT / INSERT / UPDATE / DELETE 四種 policy(不是單一
  模糊的 `FOR ALL`),全部檢查 `auth.uid() = user_id`。
- 特別加強 `salary_allocations`:除了檢查 `user_id`,還會用 subquery 確認
  `salary_record_id` 與 `account_id` 都真的屬於目前登入的使用者,避免有人
  透過猜測或修改這些 id 讀取或掛載到別人的分配資料。
- 授權 `authenticated` 角色可以呼叫 `validate_allocation_account`、
  `create_salary_record`、`update_salary_record` 三個 function。

---

## Step 4 — 設定 Authentication

1. 左側選單 **Authentication** → **Providers**。
2. 確認 **Email** provider 是開啟的(預設就是開啟)。
3. **Authentication** → **URL Configuration**:
   - **Site URL**:填入你之後的 GitHub Pages 網址,例如
     `https://<你的帳號>.github.io/<repo名稱>/`
   - **Redirect URLs**:加入同一個網址(讓「忘記密碼」的重設連結能正確導回)。
4. 這是私人使用的 App,建議在 **Authentication** → **Users** 手動新增你自己
   的帳號(**Add user** → 輸入 email/password),而不要開放公開註冊頁面
   (本專案前端本來就沒有註冊表單,只有登入)。

---

## Step 5 — 取得 Supabase URL 與 anon public key

1. 左側選單 **Project Settings** → **API**。
2. 複製:
   - **Project URL**(例如 `https://xxxxx.supabase.co`)
   - **anon public** key(一長串字串)
3. **絕對不要**複製 `service_role` key 到前端 —— 那把 key 擁有繞過 RLS 的
   權限,一旦外洩等於你所有使用者的資料都會被看光。前端只使用
   `anon public` key,安全性由 RLS 把關。

---

## Step 6 — 填入 frontend config

打開 `js/supabase.js`,把預留位置換成你剛剛複製的值:

```js
const SUPABASE_URL = 'https://xxxxx.supabase.co';
const SUPABASE_ANON_KEY = 'ey....(你的 anon public key)';
```

存檔。

---

## Step 7 — 建立 GitHub Repository

1. 前往 GitHub → **New repository**。
2. Repository name 例如 `salary-dashboard`。
3. 建議設為 **Private**(雖然前端本來就不含機密金鑰,但這是私人財務工具,
   設為 Private 較保守)。
4. 建立完成。

---

## Step 8 — 上傳檔案

在本機專案資料夾內執行:

```bash
git init
git add .
git commit -m "Initial commit: salary dashboard V1"
git branch -M main
git remote add origin https://github.com/<你的帳號>/salary-dashboard.git
git push -u origin main
```

(或直接用 GitHub 網頁的 **Add file → Upload files** 上傳整個資料夾結構。)

> 提醒:`supabase/schema.sql` 與 `rls.sql` 不含任何金鑰,可以放心一起上傳,
> 方便日後回頭查閱資料庫結構。

---

## Step 9 — 啟用 GitHub Pages

1. Repository → **Settings** → **Pages**。
2. **Source** 選擇 `Deploy from a branch`。
3. **Branch** 選擇 `main`,資料夾選擇 `/ (root)`。
4. 點擊 **Save**。
5. 等待 1-2 分鐘,頁面會顯示你的網址,例如:
   `https://<你的帳號>.github.io/salary-dashboard/`
6. 回到 Supabase **Authentication → URL Configuration**,確認 Step 4 填入
   的網址跟這裡完全一致(含最後的 `/`)。

---

## Step 10 — 測試登入

1. 打開你的 GitHub Pages 網址。
2. 應該直接看到登入頁,**不會**看到任何 Dashboard 內容。
3. 用 Step 4 在 Supabase 手動建立的帳號登入。
4. 登入成功後應該會看到 Dashboard(此時應為「本月還沒有新增薪水」的空狀態)。

---

## Step 11 — 測試新增薪水

1. 先進入「帳戶管理」新增至少 3 個帳戶(可以是同一個帳戶但用途都勾選,
   或分別建立花費/儲蓄/投資用的帳戶,依你的規格範例:台新銀行/國泰世華/
   凱基證券)。
2. 回到 Dashboard,點擊「＋ 新增薪水」。
3. 輸入日期與金額,確認自動算出 60% / 30% / 10%(或你設定的比例)。
4. 為每個用途選擇帳戶 → 送出。
5. Dashboard 應該立即顯示三張卡片,金額與帳戶正確。

---

## Step 12 — 測試 RLS

最直接的驗證方式:

1. 在 Supabase **Authentication → Users** 建立第二個測試帳號。
2. 用第二個帳號登入你的網站,應該完全看不到第一個帳號的薪水/帳戶資料
   (因為是全新帳號,Dashboard 會是空的,這本身就是 RLS 生效的證明)。
3. 進階驗證(選用):在 Supabase **SQL Editor** 用
   `select * from salary_allocations;`(以你的 Supabase 帳號身份,擁有完整
   權限)可以看到全部資料屬於不同 `user_id`,證明資料確實有正確標記,且
   前端 anon key 只能透過 RLS 撈到 `auth.uid()` 對應的那一份。

---

## 測試 Checklist

- [ ] 1. 未登入時直接開網址 → 只看到登入頁,看不到 Dashboard / 任何資料
- [ ] 2. 登入後 → 看到自己的 Dashboard,月份標題正確
- [ ] 3. 新增薪水 → 送出成功並跳出「✓ 薪水紀錄已新增」
- [ ] 4. 60/30/10(或自訂比例)金額計算正確,三者加總 = 薪水總額
- [ ] 5. 每個用途都能各自指定一個帳戶
- [ ] 6. 勾選「已完成」→ 狀態變化,取消勾選 → 恢復「尚未完成」
- [ ] 7. 已完成的項目有正確記錄完成時間
- [ ] 8. 帳戶管理 → 新增帳戶成功
- [ ] 9. 帳戶管理 → 編輯帳戶(名稱/利率/備註等)成功
- [ ] 10. 帳戶管理 → 停用帳戶後,該帳戶不再出現在「新增薪水」的選項中
- [ ] 11. 停用的帳戶仍會顯示在過去已建立的薪水紀錄中(標示「已停用」)
- [ ] 12. 設定 → 修改分配比例(總和需 = 100 才能儲存)
- [ ] 13. 修改比例後,回頭查看舊的薪水紀錄,比例與金額仍是新增當時的快照,未被改變
- [ ] 14. 統計 → 切換開始/結束日期,累積金額正確更新
- [ ] 15. 統計 → 「依帳戶統計」金額正確,且標示為「累積分配」而非「帳戶餘額」
- [ ] 16. 薪水紀錄 → 刪除一筆紀錄(含二次確認),對應的 3 筆分配一併刪除
- [ ] 17. RLS → 第二個帳號登入後看不到第一個帳號的任何資料
- [ ] 18. 手機版(或縮小瀏覽器寬度)→ Dashboard 卡片單欄排列、底部導覽列正常、Modal 不超出畫面
- [ ] 19. 桌面版 → 側邊欄導覽正常、版面無跑版
- [ ] 20. 登出 → 導回登入頁,重新整理頁面也不會自動登入

---

## 已知的 V1 邊界(依你的規格,故意不做)

以下功能刻意不包含在 V1,如需要屬於未來版本:
消費記帳、信用卡管理、股票持倉、銀行 API 串接、自動計息/複利、
LINE Bot、通知推播、Excel 匯入、Notion 同步、多人共享、多幣別、預算管理、
分帳戶拆分(同一用途只能指定一個帳戶)。

## 安全性重點回顧

- 前端只使用 `anon public` key,Service Role Key 從未出現在任何檔案中。
- 所有個資表格皆有 `user_id` 並啟用 RLS,SELECT/INSERT/UPDATE/DELETE 分開設計。
- `salary_allocations` 額外用 subquery 檢查 `salary_record_id` 與
  `account_id` 的擁有者,防止跨帳號存取。
- 新增/編輯薪水透過 `create_salary_record` / `update_salary_record` 兩個
  RPC function 在單一交易中完成,避免部分寫入(例如只寫入薪水紀錄卻少了
  某一筆分配)的資料不一致風險。
- 這兩個 RPC function 在寫入前都會呼叫 `validate_allocation_account`,
  在資料庫層(而非只靠前端 `<select>` 選項)確認:(1) 帳戶屬於目前登入的
  使用者,且 (2) 該帳戶有開放對應的用途(花費帳戶需 `allow_expense = true`、
  儲蓄帳戶需 `allow_saving = true`、投資帳戶需 `allow_investment = true`)。
  任何一項不符合都會直接拋出例外、拒絕寫入。
