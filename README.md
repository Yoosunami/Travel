# Sumi Travel Desk

Sumi 的專屬旅行規劃網頁第一版，涵蓋整天行程編輯、機票、住宿、飲食、交通、預算規劃、旅伴分帳與動態資訊優化。

## 特色

- 靜態網站，適合部署到 Cloudflare Pages。
- 不使用第三方前端套件、追蹤器或 Cookie。
- 行程以「一天」為單位新增、編輯、刪除，避免逐格輸入日期與時段。
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

## 資安注意

- 不要把 OpenAI API key 或任何私人 token 寫進前端檔案。
- 若未來要串接即時 API，請放在 Cloudflare Workers 後端代理，並把金鑰存在 Cloudflare Secrets。
- 外部連結使用 `rel="noopener noreferrer"`，避免新分頁取得原頁面控制權。
