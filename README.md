# Sumi Travel Desk

Sumi 的專屬旅行規劃網頁第一版，涵蓋整天行程編輯、機票、住宿、飲食、交通、預算規劃、旅伴分帳與動態資訊優化。

## 特色

- 靜態網站，適合部署到 Cloudflare Pages。
- 不使用第三方前端套件、追蹤器或 Cookie。
- 行程以「一天」為單位新增、編輯、刪除，避免逐格輸入日期與時段。
- ChatGPT 可輸出固定 JSON 格式，貼回網站後檢查並套用到行程。
- 已預留 Cloudflare Pages Functions API：`/api/optimize-itinerary`，部署並設定 `OPENAI_API_KEY` 後可嘗試一鍵優化。
- 分帳、預算與行程資料先存在瀏覽器 `localStorage`。
- 即時資訊會帶入目前行程與預算摘要，透過安全外連開啟 ChatGPT、Google Flights、Booking、Agoda、Google Maps 等服務。
- `index.html` 內含基本 Content Security Policy，降低外部資源與嵌入風險。

## 本機開啟

直接用瀏覽器開啟 `index.html` 即可。

## Cloudflare Pages 部署

1. 將此資料夾推到 GitHub 儲存庫。
2. 到 Cloudflare Pages 建立新專案並連接該儲存庫。
3. Framework preset 選 `None`。
4. Build command 留空。
5. Output directory 填 `/`。
6. 部署完成後，到 Cloudflare 的自訂網域與安全性頁面設定需要的網域、HTTPS 與存取政策。

## OpenAI API 設定

若要啟用「嘗試一鍵優化」，請在 Cloudflare Pages 的環境變數設定：

- `OPENAI_API_KEY`：OpenAI API key，必填，請設為 Secret。
- `OPENAI_MODEL`：選填，預設為 `gpt-5.5`。
- `ALLOWED_ORIGIN`：選填，正式網域上線後建議填入你的網站來源，例如 `https://travel.example.com`。

不要把 API key 寫進 `app.js` 或任何前端檔案。
若網站是私人使用，建議在 Cloudflare 啟用 Access 或等效保護，避免公開 API 被濫用而消耗額度。

## 資安注意

- 不要把 OpenAI API key 或任何私人 token 寫進前端檔案。
- 若未來要串接即時 API，請放在 Cloudflare Workers 後端代理，並把金鑰存在 Cloudflare Secrets。
- 外部連結使用 `rel="noopener noreferrer"`，避免新分頁取得原頁面控制權。
