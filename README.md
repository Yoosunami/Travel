# Sumi Travel Desk

Sumi 的專屬旅行規劃網頁，涵蓋整天行程編輯、Cloudflare + ChatGPT 一鍵優化、機票、住宿、飲食、交通、預算規劃與旅伴分帳。

## 特色

- 行程以「一天」為單位新增、編輯、刪除。
- 一鍵優化透過 Cloudflare Pages Function 呼叫 OpenAI，完成後直接套用到行程。
- API key 只放在 Cloudflare Secret，不會寫進前端檔案。
- 分帳、預算與行程資料先存在瀏覽器 `localStorage`。
- 外部 OTA 與地圖連結保留 `rel="noopener noreferrer"`。
- `index.html` 內含基本 Content Security Policy。

## 本機開啟

直接用瀏覽器開啟 `index.html` 可以測試一般頁面、行程、預算與分帳。

但「一鍵優化」需要 Cloudflare Function，所以直接開 `index.html` 時無法使用。要測試一鍵優化，請使用 Cloudflare Pages 部署後的網址，或用 Wrangler Pages Dev 本機預覽。

## Cloudflare Workers 部署

如果你的 Cloudflare Deploy command 是 `npx wrangler deploy`，請使用這條路線。

1. 將此資料夾推到 GitHub 儲存庫。
2. Cloudflare 會讀取 `wrangler.jsonc`。
3. `worker.js` 會同時提供靜態網站與 API。
4. 前端會呼叫 `/api/optimize-itinerary`。
5. `worker.js` 也支援 `/api/optimize` 作為相容路徑。

`wrangler.jsonc` 的核心設定：

```jsonc
{
  "name": "travel",
  "main": "worker.js",
  "compatibility_date": "2026-06-05",
  "assets": {
    "directory": "."
  }
}
```

## Cloudflare Pages Functions 備用部署

如果你改用 Cloudflare Pages 的一般部署方式，也保留了 `functions/api/optimize-itinerary.js`。Pages 會自動掛載它為 `/api/optimize-itinerary`。

## OpenAI API 設定

若要啟用「一鍵優化」，請在 Cloudflare Pages 的環境變數設定：

- `OPENAI_API_KEY`：OpenAI API key，必填，請設為 Secret。
- `OPENAI_MODEL`：選填，預設為 `gpt-4.1-mini`。
- `ALLOWED_ORIGIN`：選填，正式網域上線後建議填入你的網站來源，例如 `https://travel.example.com`。

不要把 API key 寫進 `app.js` 或任何前端檔案。

## 資安注意

- 若網站是私人使用，建議在 Cloudflare 啟用 Access 或等效保護，避免公開 API 被濫用而消耗額度。
- 不要把護照、信用卡、訂房編號、身分證字號等敏感資訊送進行程優化。
- 一鍵優化 API 已限制來源、請求大小，並在伺服器端清理欄位。
