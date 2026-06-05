# Sumi Travel Desk

Sumi 的專屬旅行規劃網頁，涵蓋整天行程編輯、ChatGPT 手動回饋、機票、住宿、飲食、交通、預算規劃與旅伴分帳。

## 特色

- 純靜態網站，不需要 OpenAI API 額度。
- 行程以「一天」為單位新增、編輯、刪除。
- 可把目前行程帶到 ChatGPT 優化，再把自然語言結果貼回網站。
- 貼回結果會先轉成行程草稿並預覽，確認後才套用。
- 套用 ChatGPT 結果後可以復原到前一次行程。
- 分帳、預算與行程資料先存在瀏覽器 `localStorage`。
- 外部連結保留 `rel="noopener noreferrer"`。
- `index.html` 內含基本 Content Security Policy。

## 本機開啟

直接用瀏覽器開啟 `index.html` 即可。

## Cloudflare 部署

這版不需要 Worker，也不需要環境變數或 Secret。

部署到 Cloudflare Pages 時：

1. 將此資料夾推到 GitHub 儲存庫。
2. 到 Cloudflare Pages 建立新專案並連接該儲存庫。
3. Framework preset 選 `None`。
4. Build command 留空。
5. Output directory 填 `/`。

## ChatGPT 回饋格式

網站會優先辨識這種格式：

```text
Day 1：抵達與散步
上午 / 抵達機場
下午 / 入住與附近散步
晚上 / 晚餐
備註：保留交通彈性

Day 2：選品店與美食
上午 / 早餐與逛街
下午 / 咖啡與街拍
晚上 / 預約餐廳
備註：同一區域集中安排
```

也可使用「第 1 天：...」格式。若 ChatGPT 回覆格式不明，網站會保留成一筆完整草稿，不會清空原本行程。

## 資安注意

- 不要把護照、信用卡、訂房編號、身分證字號等敏感資訊貼到 ChatGPT。
- 此版本沒有 API key，也不會把任何 OpenAI Secret 放到前端。
- 外部服務資訊仍需自行確認，尤其是航班價格、退改規則、住宿取消政策與交通時刻。
