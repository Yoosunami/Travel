# Sumi Travel Desk

Sumi 的專屬旅行規劃網頁，支援整天行程、ChatGPT 手動回饋、預算、分帳，以及 Cloudflare D1 跨裝置同步。

## 功能

- 電腦與手機可共用同一份旅行資料。
- 可同時建立多個旅遊計畫，並在同一頁切換。
- 行程以「一天」為單位新增、編輯、刪除。
- ChatGPT 採手動提問與貼回，不需要 OpenAI API 額度。
- 同步資料包含所有旅遊計畫、目前選取計畫、行程、預算、人數、旅伴名單與分帳紀錄。
- 同步密碼透過 Cloudflare Secret 設定，不寫進前端檔案。

## 本機使用

直接開啟 `index.html` 可使用本機版本。同步功能需要部署到 Cloudflare Workers 並綁定 D1。

## Cloudflare D1 設定

建立資料庫：

```bash
npx wrangler d1 create travel-db
```

把產生的 `database_id` 填入 `wrangler.jsonc`。

建立資料表：

```bash
npx wrangler d1 execute travel-db --file=schema.sql
```

設定同步密碼：

```bash
npx wrangler secret put SYNC_SECRET
```

部署：

```bash
npx wrangler deploy
```

## 手機與電腦同步方式

1. 在 Cloudflare 部署完成後，用手機與電腦開同一個網址。
2. 在「同步」區輸入同一組同步密碼。
3. 先在有最新資料的裝置按「上傳到雲端」。
4. 另一台裝置按「從雲端下載」。
5. 多個旅遊計畫會一起同步。

## 旅伴分帳

1. 在旅遊基本資料填入旅伴名單，例如 `Sumi, Alex`。
2. 每筆支出填入付款人與實際分帳對象；系統會平均拆分該筆款項。
3. 「結算摘要」會顯示每位旅伴的淨額：應收代表其他人應付款給他，應付代表需要補款。

舊的分帳紀錄仍會保留，但因沒有具名分帳對象，不會納入淨額結算；如需要可重新新增該筆紀錄。

## 資安注意

- 同步密碼請不要使用常用密碼。
- 若網站是私人使用，建議再搭配 Cloudflare Access。
- 不要把護照、信用卡、訂房編號、身分證字號等敏感資料放進行程。
