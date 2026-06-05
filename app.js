const storageKey = "sumi-travel-desk-v4";
const previousStorageKeys = ["sumi-travel-desk-v3", "sumi-travel-desk-v2", "sumi-travel-desk-v1"];

const resources = [
  {
    key: "all",
    title: "整合",
    icon: "ALL",
    tone: "all",
    description: "一次檢查機票、住宿、飲食、交通，但仍保留精簡輸出。",
    links: [["ChatGPT", "https://chatgpt.com/"]],
  },
  {
    key: "flight",
    title: "機票",
    icon: "AIR",
    tone: "flight",
    description: "用目前行程判斷抵達/離開時間、行李限制、轉機風險與航班價格。",
    links: [
      ["Google Flights", "https://www.google.com/travel/flights"],
      ["Skyscanner", "https://www.skyscanner.com.tw/"],
    ],
  },
  {
    key: "stay",
    title: "住宿",
    icon: "BED",
    tone: "stay",
    description: "依每日活動範圍挑住宿區域，檢查交通時間、取消政策與稅費。",
    links: [
      ["Booking", "https://www.booking.com/"],
      ["Agoda", "https://www.agoda.com/"],
    ],
  },
  {
    key: "food",
    title: "飲食",
    icon: "EAT",
    tone: "food",
    description: "根據每天所在區域安排餐廳、咖啡、訂位與排隊備案。",
    links: [
      ["Google Maps", "https://www.google.com/maps"],
      ["Tabelog", "https://tabelog.com/"],
    ],
  },
  {
    key: "transit",
    title: "交通",
    icon: "GO",
    tone: "transit",
    description: "用行程順序檢查交通票券、轉乘時間、尖峰風險與雨天方案。",
    links: [
      ["Rome2Rio", "https://www.rome2rio.com/"],
      ["Google Maps", "https://www.google.com/maps"],
    ],
  },
];

const defaultState = {
  tripName: "Tokyo fit & food run",
  startDate: "",
  travelers: 2,
  budgetMode: "total",
  budgetAmount: 45000,
  expenses: [],
  days: [
    {
      date: "",
      title: "抵達與住宿確認",
      plan: "上午 / 抵達機場，確認交通卡與行李動線\n下午 / 前往住宿，附近散步與補給\n晚上 / 輕鬆晚餐，早點休息",
      notes: "第一天避免排太滿，保留班機延誤與入住時間彈性。",
    },
    {
      date: "",
      title: "選品店、美食與街拍",
      plan: "上午 / 早餐後前往主要逛街區\n下午 / 選品店、咖啡與街拍點\n晚上 / 預約餐廳或備案餐廳",
      notes: "同一區域集中安排，減少交通時間。",
    },
  ],
  undoDays: null,
};

let editingDayIndex = null;
let feedbackDraft = null;
const state = loadState();
const formatter = new Intl.NumberFormat("zh-TW");

function loadState() {
  try {
    const parsed = JSON.parse(localStorage.getItem(storageKey));
    if (parsed) return normalizeState(parsed);
  } catch {
    // Ignore invalid local state.
  }

  for (const key of previousStorageKeys) {
    try {
      const parsed = JSON.parse(localStorage.getItem(key));
      if (parsed) return normalizeState(migrateOldState(parsed));
    } catch {
      // Ignore invalid legacy state.
    }
  }

  return normalizeState(defaultState);
}

function migrateOldState(oldState) {
  if (Array.isArray(oldState.days)) return oldState;

  const oldPlans = Array.isArray(oldState.plans) ? oldState.plans : [];
  const grouped = oldPlans.reduce((days, item) => {
    const date = item.date || "";
    const key = date || "undated";
    if (!days[key]) {
      days[key] = { date, title: date ? `${date} 行程` : "未定日期行程", plan: "", notes: "" };
    }
    days[key].plan += `${item.slot || "時段"} / ${item.title || ""}${item.note ? ` - ${item.note}` : ""}\n`;
    return days;
  }, {});

  return {
    ...oldState,
    travelers: Number(oldState.travelers) || 2,
    budgetMode: oldState.budgetMode || "total",
    budgetAmount: Number(oldState.budgetAmount || oldState.tripBudget) || 45000,
    days: Object.values(grouped),
  };
}

function normalizeState(value) {
  return {
    ...defaultState,
    ...value,
    travelers: clampNumber(value.travelers, 1, 20, defaultState.travelers),
    budgetMode: value.budgetMode === "perPerson" ? "perPerson" : "total",
    budgetAmount: clampNumber(value.budgetAmount, 0, 99999999, defaultState.budgetAmount),
    days: normalizeDays(value.days),
    expenses: Array.isArray(value.expenses) ? value.expenses : [],
    undoDays: Array.isArray(value.undoDays) ? normalizeDays(value.undoDays) : null,
  };
}

function normalizeDays(days) {
  if (!Array.isArray(days)) return defaultState.days;
  return days
    .slice(0, 60)
    .map((day) => ({
      date: validDate(day.date) ? day.date : "",
      title: clean(day.title).slice(0, 60) || "未命名行程",
      plan: clean(day.plan).slice(0, 1200),
      notes: clean(day.notes).slice(0, 500),
    }))
    .filter((day) => day.title && day.plan);
}

function clampNumber(value, min, max, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, number));
}

function validDate(value) {
  return value === "" || /^\d{4}-\d{2}-\d{2}$/.test(String(value || ""));
}

function saveState() {
  localStorage.setItem(storageKey, JSON.stringify(state));
}

function currency(value) {
  return `TWD ${formatter.format(Math.round(Number(value) || 0))}`;
}

function clean(value) {
  return String(value || "").trim();
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function nl2br(value) {
  return escapeHtml(value).replaceAll("\n", "<br />");
}

function itineraryText() {
  if (!state.days.length) return "尚未建立行程。";
  return state.days
    .map((day, index) => `Day ${index + 1} ${day.date || "未定日期"} ${day.title}\n${day.plan}\n備註：${day.notes || "無"}`)
    .join("\n\n");
}

function budgetSummary() {
  const travelers = Math.max(1, Number(state.travelers) || 1);
  const amount = Math.max(0, Number(state.budgetAmount) || 0);
  const total = state.budgetMode === "perPerson" ? amount * travelers : amount;
  const perPerson = total / travelers;
  const days = Math.max(1, state.days.length || 1);
  return { travelers, days, total, perPerson, perDay: total / days };
}

function chatPrompt(focus = "") {
  const summary = budgetSummary();
  return `請幫我優化這趟旅行行程，重點是動線效率、美食安排、穿搭拍照時間、交通備案與預算合理性。

${focus ? `這次請特別聚焦：${focus}\n` : ""}請用以下格式回覆，方便我貼回旅行網頁：

Day 1：當日主題
上午 / ...
下午 / ...
晚上 / ...
備註：...

Day 2：當日主題
上午 / ...
下午 / ...
晚上 / ...
備註：...

旅行名稱：${state.tripName}
旅行人數：${summary.travelers}
總預算：${currency(summary.total)}
每人預算：${currency(summary.perPerson)}

目前行程：
${itineraryText()}`;
}

function resourcePrompt(resource) {
  const summary = budgetSummary();
  const tripBasics = `旅行名稱：${state.tripName}
旅行人數：${summary.travelers}
總預算：${currency(summary.total)}
每人預算：${currency(summary.perPerson)}`;

  const prompts = {
    flight: `請只針對「機票」協助我規劃，不要重排行程。

行程資料使用規則：
- 機票只需要參考第一天與最後一天。
- 不需要分析中間每天的景點。

請輸出：
1. 建議抵達與離開時間帶
2. 搜尋機票時要注意的轉機、行李、退改規則
3. 哪幾天行程不適合太早或太晚航班
4. Google Flights / Skyscanner 搜尋關鍵條件

${tripBasics}

第一天與最後一天行程：
${edgeItineraryText()}`,
    stay: `請只針對「住宿」協助我規劃，不要重排行程。

行程資料使用規則：
- 請依每天主要活動區域判斷住宿區域。
- 不需要改寫每日行程。

請輸出：
1. 建議住宿區域排序
2. 每個區域的優缺點與適合天數
3. 交通時間與晚歸安全性注意
4. Booking / Agoda 篩選條件，例如取消政策、房型、交通距離

${tripBasics}

每日行程：
${fullItineraryText()}`,
    food: `請只針對「飲食」協助我規劃，不要重排行程。

行程資料使用規則：
- 請依每天活動區域安排用餐區域。
- 不需要重排景點，只補餐飲策略。

請輸出：
1. 每一天適合安排早餐、午餐、咖啡、晚餐的區域
2. 需要訂位或容易排隊的時段
3. 預算分配與備案餐廳類型
4. Google Maps / Tabelog 搜尋關鍵字

${tripBasics}

每日行程：
${fullItineraryText()}`,
    transit: `請只針對「交通」協助我規劃，不要重排行程。

行程資料使用規則：
- 請依每天行程順序檢查交通動線。
- 不需要重排行程，只指出風險與備案。

請輸出：
1. 每天主要移動路線與可能轉乘
2. 建議交通票券或 IC 卡使用策略
3. 尖峰時間、雨天、行李移動風險
4. Google Maps / Rome2Rio 查詢時要確認的項目

${tripBasics}

每日行程：
${fullItineraryText()}`,
    all: `請依序針對「機票、住宿、飲食、交通」協助我檢查旅行規劃，但不要重排行程，也不要輸出完整每日行程。

行程資料使用規則：
- 機票只參考第一天與最後一天。
- 住宿、飲食、交通可參考全部每日行程。
- 回答要精簡，重點列出需要我執行的檢查項目。

請用精簡格式輸出：
1. 機票：建議抵達/離開時間、轉機與行李注意
2. 住宿：建議住宿區域、交通距離、取消政策
3. 飲食：每天適合用餐區域、訂位與排隊風險
4. 交通：每日移動風險、票券、尖峰與雨天備案
5. 優先處理清單：最多 8 項

${tripBasics}

第一天與最後一天：
${edgeItineraryText()}

全部每日行程：
${fullItineraryText()}`,
  };

  return prompts[resource.key] || chatPrompt();
}

function fullItineraryText() {
  if (!state.days.length) return "尚未建立行程。";
  return state.days
    .map((day, index) => `Day ${index + 1} ${day.date || "未定日期"} ${day.title}\n${day.plan}${day.notes ? `\n備註：${day.notes}` : ""}`)
    .join("\n\n");
}

function edgeItineraryText() {
  if (!state.days.length) return "尚未建立行程。";
  const first = state.days[0];
  const last = state.days[state.days.length - 1];
  const items =
    first === last
      ? [{ day: first, label: "第一天 / 最後一天" }]
      : [
          { day: first, label: "第一天" },
          { day: last, label: "最後一天" },
        ];
  return items
    .map(({ day, label }) => `${label} ${day.date || "未定日期"} ${day.title}\n${day.plan}${day.notes ? `\n備註：${day.notes}` : ""}`)
    .join("\n\n");
}

function renderBasics() {
  document.querySelector("#tripName").value = state.tripName;
  document.querySelector("#travelers").value = state.travelers;
  document.querySelector("#startDate").value = state.startDate;
  document.querySelector("#tripNamePreview").textContent = state.tripName;
  document.querySelector("#budgetPreview").textContent = currency(budgetSummary().total);
  document.querySelector("#expensePeople").value = state.travelers;
}

function renderDays() {
  const list = document.querySelector("#dayList");
  list.innerHTML = state.days.length
    ? state.days
        .map(
          (day, index) => `
            <li class="day-card">
              <details>
                <summary class="day-summary">
                  <div>
                    <span class="pill">Day ${index + 1}</span>
                    <strong>${escapeHtml(day.date || "未定日期")} · ${escapeHtml(day.title)}</strong>
                    <span class="meta">${escapeHtml(dayPreview(day))}</span>
                  </div>
                </summary>
                <div class="day-card-body">
                  <p class="day-plan">${nl2br(day.plan)}</p>
                  <span class="meta">${escapeHtml(day.notes || "尚無備註")}</span>
                </div>
                <div class="row-actions">
                  <button class="small-button" type="button" data-action="edit-day" data-index="${index}">編輯</button>
                  <button class="small-button danger" type="button" data-action="delete-day" data-index="${index}">刪除</button>
                </div>
              </details>
            </li>
          `,
        )
        .join("")
    : `<li><span class="meta">還沒有行程。先用左側輸入一天完整安排。</span></li>`;

}

function renderResources() {
  const grid = document.querySelector("#resourceGrid");
  grid.innerHTML = resources
    .map(
      (item) => `
        <article class="resource-card ${item.tone}">
          <div>
            <span class="resource-icon" aria-hidden="true">${item.icon}</span>
            <h3>${item.title}</h3>
            <p>${item.description}</p>
          </div>
          <div class="link-list">
            <button class="text-button" type="button" data-action="prepare-resource-prompt" data-resource-key="${item.key}">
              產生提問
            </button>
            ${item.links
              .map(([label, href]) => `<a href="${href}" target="_blank" rel="noopener noreferrer">${label}</a>`)
              .join("")}
          </div>
        </article>
      `,
    )
    .join("");
}

function renderBudget() {
  const summary = budgetSummary();
  document.querySelector("#budgetMode").value = state.budgetMode;
  document.querySelector("#budgetAmount").value = state.budgetAmount;
  document.querySelector("#budgetDays").textContent = `${summary.days} 天`;
  document.querySelector("#budgetTotal").textContent = currency(summary.total);
  document.querySelector("#budgetPerPerson").textContent = currency(summary.perPerson);
  document.querySelector("#budgetPerDay").textContent = currency(summary.perDay);

  const breakdown = [
    ["機票", 0.35],
    ["住宿", 0.3],
    ["飲食", 0.2],
    ["交通與彈性", 0.15],
  ];

  document.querySelector("#budgetBreakdown").innerHTML = breakdown
    .map(([label, ratio]) => {
      const total = summary.total * ratio;
      return `
        <li>
          <strong>${label}</strong>
          <span class="meta">建議總額 ${currency(total)}，每人約 ${currency(total / summary.travelers)}</span>
        </li>
      `;
    })
    .join("");
}

function renderExpenses() {
  const list = document.querySelector("#expenseList");
  const total = state.expenses.reduce((sum, item) => sum + Number(item.amount), 0);
  list.innerHTML = state.expenses.length
    ? state.expenses
        .map(
          (item) => `
            <li>
              <strong>${escapeHtml(item.title)}</strong>
              <span class="meta">${escapeHtml(item.payer)} 先付 ${currency(item.amount)}，每人 ${currency(item.amount / item.people)}</span>
            </li>
          `,
        )
        .join("")
    : `<li><span class="meta">還沒有分帳紀錄。</span></li>`;
  document.querySelector("#expenseTotal").textContent = currency(total);
}

function renderFeedbackPreview() {
  const list = document.querySelector("#feedbackPreviewList");
  list.innerHTML = feedbackDraft
    ? feedbackDraft
        .map(
          (day, index) => `
            <li class="day-card">
              <details>
                <summary class="day-summary">
                  <div>
                    <span class="pill">Draft ${index + 1}</span>
                    <strong>${escapeHtml(day.date || "未定日期")} · ${escapeHtml(day.title)}</strong>
                    <span class="meta">${escapeHtml(dayPreview(day))}</span>
                  </div>
                </summary>
                <div class="day-card-body">
                  <p class="day-plan">${nl2br(day.plan)}</p>
                  <span class="meta">${escapeHtml(day.notes || "尚無備註")}</span>
                </div>
              </details>
            </li>
          `,
        )
        .join("")
    : "";
  document.querySelector("#applyFeedback").disabled = !feedbackDraft;
  document.querySelector("#undoFeedback").disabled = !state.undoDays;
}

function renderAll() {
  renderBasics();
  renderDays();
  renderResources();
  renderBudget();
  renderExpenses();
  renderFeedbackPreview();
}

function dayPreview(day) {
  return clean(day.plan).split("\n").find(Boolean) || day.notes || "尚無行程內容";
}

function resetDayForm() {
  editingDayIndex = null;
  document.querySelector("#dayForm").reset();
  document.querySelector("#saveDayButton").textContent = "新增這一天";
  document.querySelector("#cancelEditDay").classList.add("hidden");
}

function setFeedbackStatus(message, tone = "neutral") {
  const status = document.querySelector("#feedbackStatus");
  status.textContent = message;
  status.className = `status-box ${tone}`;
}

function preparePrompt(focus = "") {
  const prompt = focus && typeof focus === "object" ? resourcePrompt(focus) : chatPrompt(focus);
  document.querySelector("#promptText").value = prompt;
  setFeedbackStatus("已產生提問內容。請複製後貼到 ChatGPT，再把優化結果貼回下方。", "success");
  return prompt;
}

async function copyPrompt(focus = "") {
  const prompt = currentPromptText();
  if (!prompt) {
    setFeedbackStatus("請先產生提問內容，再按複製。", "error");
    return;
  }
  try {
    await navigator.clipboard.writeText(prompt);
    setFeedbackStatus("已複製提問內容。ChatGPT 開啟後請貼上送出。", "success");
  } catch {
    document.querySelector("#promptText").focus();
    document.querySelector("#promptText").select();
    setFeedbackStatus("瀏覽器不允許自動複製，請手動選取上方提問內容並複製。", "error");
  }
}

function currentPromptText() {
  return document.querySelector("#promptText").value.trim();
}

async function openChatGPT() {
  setFeedbackStatus("ChatGPT 已開啟臨時聊天。請手動貼上你複製的提問內容。", "success");
  window.open("https://chatgpt.com/?temporary-chat=true", "_blank", "noopener,noreferrer");
}

function parseFeedbackText(rawText) {
  const text = clean(rawText).replace(/\r\n/g, "\n");
  if (!text) throw new Error("請先貼上 ChatGPT 優化後的行程。");

  const lines = text.split("\n").map((line) => line.trim()).filter(Boolean);
  const blocks = [];
  let current = null;

  for (const line of lines) {
    const heading = parseDayHeading(line);
    if (heading) {
      if (current) blocks.push(current);
      current = { title: heading.title || `第 ${heading.index} 天`, lines: [] };
      continue;
    }

    if (!current) current = { title: "ChatGPT 優化行程", lines: [] };
    current.lines.push(line);
  }

  if (current) blocks.push(current);
  return normalizeDays(blocks.map(blockToDay));
}

function parseDayHeading(line) {
  const normalized = line.replace(/^[-*#\s]+/, "");
  const dayMatch = normalized.match(/^(?:day|d)\s*(\d+)\s*[:：.\-、]?\s*(.*)$/i);
  if (dayMatch) return { index: Number(dayMatch[1]), title: clean(dayMatch[2]) };

  const zhMatch = normalized.match(/^第\s*([一二三四五六七八九十\d]+)\s*天\s*[:：.\-、]?\s*(.*)$/);
  if (zhMatch) return { index: zhNumber(zhMatch[1]), title: clean(zhMatch[2]) };

  return null;
}

function zhNumber(value) {
  if (/^\d+$/.test(value)) return Number(value);
  const map = { 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9, 十: 10 };
  if (value === "十") return 10;
  if (value.startsWith("十")) return 10 + (map[value[1]] || 0);
  if (value.includes("十")) {
    const [tens, ones] = value.split("十");
    return (map[tens] || 1) * 10 + (map[ones] || 0);
  }
  return map[value] || 1;
}

function blockToDay(block) {
  const date = findDate([block.title, ...block.lines].join(" "));
  const notes = [];
  const plan = [];
  let title = block.title.replace(/^\d{4}-\d{2}-\d{2}\s*/, "").replace(/^[:：.\-、\s]+/, "");

  for (const line of block.lines) {
    if (/^(備註|note|notes|提醒|風險|備案)\s*[:：]/i.test(line)) {
      notes.push(line.replace(/^(備註|note|notes|提醒|風險|備案)\s*[:：]\s*/i, ""));
    } else {
      plan.push(line);
    }
  }

  if (!plan.length) plan.push(...block.lines);
  if (!title || title === "ChatGPT 優化行程") title = plan[0]?.slice(0, 28) || "ChatGPT 優化行程";

  return {
    date,
    title,
    plan: plan.join("\n"),
    notes: notes.join("\n"),
  };
}

function findDate(value) {
  const match = String(value || "").match(/\d{4}-\d{2}-\d{2}/);
  return match ? match[0] : "";
}

function previewFeedback() {
  try {
    feedbackDraft = parseFeedbackText(document.querySelector("#feedbackText").value);
    if (!feedbackDraft.length) throw new Error("無法辨識有效行程，請保留 Day 1 / Day 2 或第 1 天段落。");
    setFeedbackStatus(`已轉成 ${feedbackDraft.length} 天行程草稿。請確認預覽後再套用。`, "success");
  } catch (error) {
    feedbackDraft = null;
    setFeedbackStatus(error.message, "error");
  }
  renderFeedbackPreview();
}

function applyFeedback() {
  if (!feedbackDraft) return;
  state.undoDays = state.days.map((day) => ({ ...day }));
  state.days = feedbackDraft.map((day) => ({ ...day }));
  feedbackDraft = null;
  saveState();
  setFeedbackStatus("已套用 ChatGPT 優化結果。若不滿意，可按復原上次套用。", "success");
  renderAll();
}

function undoFeedback() {
  if (!state.undoDays) return;
  state.days = state.undoDays.map((day) => ({ ...day }));
  state.undoDays = null;
  saveState();
  setFeedbackStatus("已復原到套用前的行程。", "success");
  renderAll();
}

function bindEvents() {
  ["tripName", "travelers", "startDate"].forEach((id) => {
    document.querySelector(`#${id}`).addEventListener("input", (event) => {
      state[id] = id === "travelers" ? clampNumber(event.target.value, 1, 20, 1) : event.target.value;
      saveState();
      renderAll();
    });
  });

  ["budgetMode", "budgetAmount"].forEach((id) => {
    document.querySelector(`#${id}`).addEventListener("input", (event) => {
      state[id] = id === "budgetAmount" ? clampNumber(event.target.value, 0, 99999999, 0) : event.target.value;
      saveState();
      renderAll();
    });
  });

  document.querySelector("#dayForm").addEventListener("submit", (event) => {
    event.preventDefault();
    const day = {
      date: document.querySelector("#dayDate").value,
      title: clean(document.querySelector("#dayTitle").value),
      plan: clean(document.querySelector("#dayPlan").value),
      notes: clean(document.querySelector("#dayNotes").value),
    };
    if (!day.title || !day.plan) return;

    if (editingDayIndex === null) {
      state.days.push(day);
    } else {
      state.days[editingDayIndex] = day;
    }

    state.days.sort((a, b) => (a.date || "9999").localeCompare(b.date || "9999", "zh-Hant"));
    saveState();
    resetDayForm();
    renderAll();
  });

  document.querySelector("#cancelEditDay").addEventListener("click", resetDayForm);

  document.querySelector("#dayList").addEventListener("click", (event) => {
    const button = event.target.closest("button[data-action]");
    if (!button) return;
    const index = Number(button.dataset.index);
    const action = button.dataset.action;

    if (action === "edit-day") {
      const day = state.days[index];
      editingDayIndex = index;
      document.querySelector("#dayDate").value = day.date;
      document.querySelector("#dayTitle").value = day.title;
      document.querySelector("#dayPlan").value = day.plan;
      document.querySelector("#dayNotes").value = day.notes;
      document.querySelector("#saveDayButton").textContent = "儲存修改";
      document.querySelector("#cancelEditDay").classList.remove("hidden");
      document.querySelector("#dayTitle").focus();
    }

    if (action === "delete-day") {
      state.days.splice(index, 1);
      saveState();
      resetDayForm();
      renderAll();
    }
  });

  document.querySelector("#expenseForm").addEventListener("submit", (event) => {
    event.preventDefault();
    const title = clean(document.querySelector("#expenseTitle").value);
    const payer = clean(document.querySelector("#expensePayer").value);
    const amount = Number(document.querySelector("#expenseAmount").value);
    const people = Number(document.querySelector("#expensePeople").value);
    if (!title || !payer || amount <= 0 || people <= 0) return;

    state.expenses.unshift({ title, payer, amount, people });
    saveState();
    event.target.reset();
    document.querySelector("#expensePeople").value = state.travelers;
    renderExpenses();
  });

  document.querySelector("#previewFeedback").addEventListener("click", previewFeedback);
  document.querySelector("#applyFeedback").addEventListener("click", applyFeedback);
  document.querySelector("#undoFeedback").addEventListener("click", undoFeedback);
  document.querySelector("#preparePrompt").addEventListener("click", () => preparePrompt());
  document.querySelector("#copyPrompt").addEventListener("click", () => copyPrompt());
  document.querySelector("#openChatGPT").addEventListener("click", openChatGPT);
  document.querySelector("#panelOptimizeLink").addEventListener("click", () => preparePrompt());
  document.querySelector("#feedbackText").addEventListener("input", () => {
    feedbackDraft = null;
    setFeedbackStatus("內容已變更，請重新轉成行程草稿。");
    renderFeedbackPreview();
  });

  document.querySelector("#resourceGrid").addEventListener("click", (event) => {
    const button = event.target.closest("button[data-action='prepare-resource-prompt']");
    if (!button) return;
    const resource = resources.find((item) => item.key === button.dataset.resourceKey);
    preparePrompt(resource || "");
  });

  document.querySelector("#clearDays").addEventListener("click", () => {
    state.undoDays = state.days.map((day) => ({ ...day }));
    state.days = [];
    saveState();
    resetDayForm();
    renderAll();
  });

  document.querySelector("#clearExpenses").addEventListener("click", () => {
    state.expenses = [];
    saveState();
    renderExpenses();
  });
}

renderAll();
bindEvents();
