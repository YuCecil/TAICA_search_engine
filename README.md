# TAICA 課程連結查詢系統

快速查詢 TAICA 各校課程連結的工具，支援批量複製、鏡像/衛星篩選，適合大學行政人員日常使用。

## 架構

```
前端 (GitHub Pages)          後端 (Google Apps Script)
index.html              →    code.js
Vue.js 3 + Tailwind CSS      讀取 Google Sheets 資料
```

## 功能

- **課程瀏覽**：依課程類型（鏡像 / 衛星 / 混合）篩選，側欄快速切換
- **學校搜尋**：輸入學校名稱關鍵字，台／臺自動通用
- **卡片模式**：一覽各校連結（名單資料夾、分頁連結、COOL 衛星課程）
- **批量複製模式**：表格視圖，可多選學校後一鍵複製所有連結
  - 混合課程可依鏡像 / 衛星篩選
  - 支援 Shift 點擊連續選取
  - 支援全選核取方塊
- **常用資源**：側欄快捷連結，內容從 Google Sheets「常用資源」工作表讀取
- **sessionStorage 快取**：同一瀏覽器 session 內第二次開啟不需重新呼叫 API

## 部署步驟

### 1. 後端：部署 GAS Web App

1. 開啟 [Google Apps Script](https://script.google.com)，將 `code.js` 的內容貼入綁定至目標試算表的專案
2. 點選「部署」→「新增部署項目」→ 類型選「**網路應用程式**」
3. 設定：
   - **以...身分執行**：我（指令碼擁有者）
   - **誰可以存取**：任何人
4. 點選「部署」，複製產生的 URL（格式為 `https://script.google.com/macros/s/.../exec`）

> 每次修改 `code.js` 後需重新部署（「管理部署項目」→「編輯」→ 版本選「新版本」）。

### 2. 前端：填入 API URL

在 `index.html` 找到以下這行（約在 `<script>` 區塊開頭）：

```javascript
const GAS_URL = 'YOUR_GAS_DEPLOY_URL';
```

改成剛才複製的 URL：

```javascript
const GAS_URL = 'https://script.google.com/macros/s/你的ID/exec';
```

### 3. 前端：發布至 GitHub Pages

1. 建立 GitHub repository（可設為 Public 或 Private）
2. 將 `index.html` 推送到 `main` branch
3. 至 repo **Settings → Pages → Source**，選擇 `main` branch 的根目錄
4. 幾分鐘後，網站上線於 `https://你的帳號.github.io/repo名稱/`

## Google Sheets 格式

### 課程工作表（`鏡_課程名稱`、`衛_課程名稱`、`混_課程名稱`）

| 列 | 內容 |
|----|------|
| 1  | A=名單總表名稱, B=名單總表 URL |
| 2  | A=COOL 主導課程名稱, B=COOL URL |
| 3–4 | 表頭（保留） |
| 5 起 | 學校資料（欄位依類型而異，見下方） |

**鏡像課程**（各列）：A=學校名稱, B=名單資料夾, C=分頁連結

**衛星課程**（各列）：A=學校名稱, B=COOL 衛星課程, C=名單資料夾, D=分頁連結

**混合課程**（各列）：A=鏡像學校, B=名單資料夾, C=分頁連結, E=衛星學校, F=COOL, G=名單資料夾, H=分頁連結

### 常用資源工作表

工作表名稱必須為「**常用資源**」（不需含 `_`）。

| 欄 | 內容 | 範例 |
|----|------|------|
| A  | 連結名稱 | 學生名單總表 |
| B  | URL | https://docs.google.com/... |
| C  | Font Awesome icon class | `fa-solid fa-table` |
| D  | Tailwind 文字色 class | `text-indigo-600` |

Row 1 為標頭列，資料從 Row 2 開始。

## 技術細節

| 項目 | 說明 |
|------|------|
| 前端框架 | Vue.js 3 (CDN, Composition API) |
| CSS | Tailwind CSS (CDN) + 自訂 CSS 變數 |
| 字型 | DM Serif Display · Noto Sans TC · IBM Plex Mono |
| 圖示 | Font Awesome 6 |
| 後端 | Google Apps Script，綁定 Google Sheets |
| 快取（後端）| GAS CacheService，30 分鐘 |
| 快取（前端）| sessionStorage，key: `taica_v1` |
| CORS | GAS ContentService 原生支援，無需額外設定 |

## 後端開課學校對應表

`code.js` 中的 `HOST_SCHOOL_MAP` 定義各課程的主辦學校，影響 `isHost` 標記與衛星課程的 COOL 連結是否 disabled。如需新增課程，請同步更新此 Map。

```javascript
var HOST_SCHOOL_MAP = {
    '智慧製造執行系統': '國立成功大學',
    '大型語言模型與資訊安全系統': '國立臺灣科技大學',
    // ...
};
```

## 注意事項

- GAS Web App 的 URL 為公開連結（Anyone），請勿在試算表中存放敏感資料
- 快取期間修改試算表後，需等最多 30 分鐘才會反映（或重新部署觸發快取清除）
- sessionStorage 快取僅在同一瀏覽器 session 有效，關閉分頁後自動清除
