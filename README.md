# 🎓 Feng Chia Messenger (逢甲校園論壇)

這是一個專為逢甲大學學生設計的「校園生活匿名/實名論壇」，擁有類似 Dcard 的高質感介面與看板分類功能。專案採用前後端分離架構開發，並完美支援自動化部署至 Azure App Service。

## ✨ 核心功能 (Features)

* 📋 **多元看板分類**：內建「校園閒聊、逢甲美食、課程討論、租屋資訊、二手交易、社團活動」等專屬看板。
* 🔍 **模糊搜尋**：支援透過關鍵字快速尋找相關文章標題與內容。
* 🔥 **貼文動態排序**：支援依照「最新發布」或「熱門程度 (按讚與留言數)」來排序貼文。
* 🔐 **會員與權限系統**：
  * 使用 JWT 實作安全的登入/註冊機制。
  * **全站管理員 (Admin)**：擁有專屬後台，可查看網站流量統計、管理全站使用者，並能刪除全站違規貼文。
  * **看板版主 (Moderator)**：各看板專屬版主，可刪除其管轄範圍內的違規貼文。
* 💬 **即時互動 (WebSockets)**：當有新貼文、新留言或貼文被刪除時，畫面會即時更新，無需重新整理網頁。
* ❤️ **互動功能**：支援貼文按讚、收藏，以及上傳圖片功能。
* 📄 **匯出 PDF**：支援將單篇貼文內容快速匯出成 PDF 檔案。
* 🛡️ **資安防護 (Rate Limiting)**：內建全域防護罩、防暴力破解登入限制，以及防洗版機制，保護伺服器不被惡意癱瘓。

---

## 🛠️ 技術架構 (Tech Stack)

### 前端 (Frontend)
* **框架**: Vue 3 + Vite
* **樣式**: Vanilla CSS (現代化 Glassmorphism 毛玻璃設計)
* **圖示庫**: Lucide Vue Next
* **網路請求**: Axios
* **PDF 套件**: pdf-lib

### 後端 (Backend)
* **框架**: Node.js + Express
* **資料庫**: Azure SQL Database (使用 `mssql` 套件，支援 T-SQL)
* **即時通訊**: `ws` (WebSocket)
* **身分驗證**: `jsonwebtoken` (JWT), `bcryptjs`
* **資安防護**: `express-rate-limit`, `helmet`
* **檔案上傳**: `multer`

---

## 🚀 本地端開發指南 (Local Development)

本專案分為 `client` (前端) 與 `server` (後端)，請開啟兩個終端機分別執行。

### 1. 啟動後端伺服器 (Port 3000)
請先在 `server` 目錄下建立 `.env` 檔案，填寫 Azure SQL 資料庫連線資訊：
```env
DB_USER=你的帳號
DB_PASSWORD=你的密碼
DB_SERVER=你的伺服器.database.windows.net
DB_NAME=你的資料庫名稱
```
接著執行：
```bash
cd server
npm install
npm run dev
```

> **小撇步**：第一次連線成功後，可以另外開一個終端機執行 `npm run seed` 來匯入假資料！

### 2. 啟動前端開發伺服器 (Port 5173)
```bash
cd client
npm install
npm run dev
```
啟動後，請在瀏覽器開啟 `http://localhost:5173` 即可看到畫面。

---

## 🛡️ 權限與版主管理教學

後端提供了一支方便的腳本，讓你能在終端機直接指派帳號的權限。
請先進入後端資料夾：`cd server`

* **設定全站管理員**：
  ```bash
  node manageRole.js admin <你的帳號名稱>
  ```
* **設定特定看板版主** (需提供看板 ID，例如校園閒聊為 1)：
  ```bash
  node manageRole.js mod <帳號名稱> <看板ID>
  ```
* **移除看板版主**：
  ```bash
  node manageRole.js unmod <帳號名稱> <看板ID>
  ```
*(設定完成後，請將該帳號登出再重新登入，即可看見新權限功能)*

---

## ☁️ 部署 (Deployment)

本專案已設定好 **GitHub Actions CI/CD pipeline** (`.github/workflows/main_webfinalproject.yml`)。
只要將程式碼 Push 到 GitHub `main` 分支，GitHub Actions 就會自動進行編譯，並無縫部署到 Azure App Service (Linux) 雲端主機上。

> **⚠️ 注意事項**：
> 由於程式碼中不包含 `.env` 密碼檔，請務必在 Azure App Service 的「環境變數 (Environment variables)」設定中，手動加入 `DB_USER`、`DB_PASSWORD`、`DB_SERVER` 與 `DB_NAME` 才能成功連線資料庫！並且別忘了在 SQL 伺服器的防火牆中勾選「允許 Azure 服務和資源存取此伺服器」。
