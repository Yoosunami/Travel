const storageKey = "sumi-travel-desk-v3";
const previousStorageKeys = ["sumi-travel-desk-v2", "sumi-travel-desk-v1"];

const resources = [
  {
    title: "機票",
    icon: "AIR",
    tone: "flight",
    description: "用目前行程判斷抵達/離開時間、行李限制、轉機風險與航班價格。",
    prompt: "請根據我的旅行行程，建議機票搜尋策略、理想抵達離開時間、轉機與行李風險。",
    links: [
      ["Google Flights", "https://www.google.com/travel/flights"],
      ["Skyscanner", "https://www.skyscanner.com.tw/"],
    ],
  },
  {
    title: "住宿",
    icon: "BED",
    tone: "stay",
    description: "依每日活動範圍挑住宿區域，檢查交通時間、取消政策與稅費。",
    prompt: "請根據我的每日行程，建議最適合住宿區域、房型條件、交通動線與取消政策注意事項。",
    links: [
      ["Booking", "https://www.booking.com/"],
      ["Agoda", "https://www.agoda.com/"],
    ],
  },
  {
    title: "飲食",
    icon: "EAT",
    tone: "food",
    description: "根據每天所在區域安排餐廳、咖啡、訂位與排隊備案。",
    prompt: "請根據我的每日行程，優化餐廳與咖啡安排，包含訂位、排隊風險、預算與備案。",
    links: [
      ["Google Maps", "https://www.google.com/maps"],
      ["Tabelog", "https://tabelog.com/"],
    ],
  },
  {
    title: "交通",
    icon: "GO",
    tone: "transit",
    description: "用行程順序檢查交通票券、轉乘時間、尖峰風險與雨天方案。",
    prompt: "請根據我的每日行程，優化交通路線、票券選擇、轉乘時間、尖峰風險與備案。",
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
};

let editingDayIndex = null;
let pendingImport = null;
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
    .map((day, index) => {
      return `Day ${index + 1} ${day.date || "未定日期"} ${day.title}\n${day.plan}\n備註：${day.notes || "無"}`;
    })
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

function importSchemaPrompt() {
  return `請優化我的旅行規劃，並且只回傳一個可被 JSON.parse 解析的 JSON 物件，不要 Markdown，不要說明文字。

JSON 格式必須是：
{
  "tripName": "旅行名稱，可省略",
  "travelers": 2,
  "budgetMode": "total",
  "budgetAmount": 45000,
  "days": [
    {
      "date": "YYYY-MM-DD 或空字串",
      "title": "當日主題",
      "plan": "整天行程，用換行分隔，例如 上午 / ...\\n下午 / ...\\n晚上 / ...",
      "notes": "交通、訂位、風險與備案"
    }
  ]
}

限制：
- days 最多 60 天。
- 不要包含護照、信用卡、訂房編號等敏感資料。
- 如果日期未知，date 請用空字串。
- budgetMode 只能是 "total" 或 "perPerson"。`;
}

function chatLink(prompt) {
  const summary = budgetSummary();
  const fullPrompt = `${prompt}

${importSchemaPrompt()}

目前資料：
旅行名稱：${state.tripName}
旅行人數：${summary.travelers}
總預算：${currency(summary.total)}
每人預算：${currency(summary.perPerson)}
目前行程：
${itineraryText()}`;
  return `https://chatgpt.com/?q=${encodeURIComponent(fullPrompt)}`;
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
              <div class="day-card-head">
                <div>
                  <span class="pill">Day ${index + 1}</span>
                  <strong>${escapeHtml(day.date || "未定日期")} · ${escapeHtml(day.title)}</strong>
                </div>
                <div class="row-actions">
                  <button class="small-button" type="button" data-action="edit-day" data-index="${index}">編輯</button>
                  <button class="small-button danger" type="button" data-action="delete-day" data-index="${index}">刪除</button>
                </div>
              </div>
              <p class="day-plan">${nl2br(day.plan)}</p>
              <span class="meta">${escapeHtml(day.notes || "尚無備註")}</span>
            </li>
          `,
        )
        .join("")
    : `<li><span class="meta">還沒有行程。先用左側輸入一天完整安排。</span></li>`;

  document.querySelector("#chatPromptLink").href = chatLink(
    "請重新優化這趟旅行的每日行程，保留穿搭拍照、美食、交通效率，並列出風險與備案。",
  );
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
            <a href="${chatLink(item.prompt)}" target="_blank" rel="noopener noreferrer">用目前行程優化</a>
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

function renderAll() {
  renderBasics();
  renderDays();
  renderResources();
  renderBudget();
  renderExpenses();
}

function resetDayForm() {
  editingDayIndex = null;
  document.querySelector("#dayForm").reset();
  document.querySelector("#saveDayButton").textContent = "新增這一天";
  document.querySelector("#cancelEditDay").classList.add("hidden");
}

function setImportStatus(message, tone = "neutral") {
  const status = document.querySelector("#importStatus");
  status.textContent = message;
  status.className = `status-box ${tone}`;
}

function extractJson(text) {
  const raw = clean(text);
  if (!raw) throw new Error("請先貼上 ChatGPT 回覆。");

  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1].trim() : raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1);
  if (!candidate || !candidate.startsWith("{")) throw new Error("找不到 JSON 物件。請要求 ChatGPT 只回傳 JSON。");
  return JSON.parse(candidate);
}

function normalizeImportPayload(payload) {
  const imported = normalizeState({
    ...state,
    ...payload,
    days: payload.days,
    expenses: state.expenses,
  });

  if (!imported.days.length) throw new Error("JSON 裡需要至少一筆有效 days 行程。");
  return imported;
}

function previewImport() {
  try {
    const payload = extractJson(document.querySelector("#importJson").value);
    pendingImport = normalizeImportPayload(payload);
    document.querySelector("#applyImport").disabled = false;
    setImportStatus(`格式正確：將匯入 ${pendingImport.days.length} 天行程。確認後可套用。`, "success");
  } catch (error) {
    pendingImport = null;
    document.querySelector("#applyImport").disabled = true;
    setImportStatus(error.message, "error");
  }
}

function applyImport() {
  if (!pendingImport) return;
  state.tripName = pendingImport.tripName;
  state.travelers = pendingImport.travelers;
  state.budgetMode = pendingImport.budgetMode;
  state.budgetAmount = pendingImport.budgetAmount;
  state.days = pendingImport.days;
  saveState();
  pendingImport = null;
  document.querySelector("#applyImport").disabled = true;
  setImportStatus("已套用 ChatGPT 優化結果。", "success");
  renderAll();
}

async function autoOptimize() {
  const button = document.querySelector("#autoOptimize");
  button.disabled = true;
  setImportStatus("正在嘗試呼叫 Cloudflare Worker API...", "neutral");

  try {
    const response = await fetch("/api/optimize-itinerary", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tripName: state.tripName,
        travelers: state.travelers,
        budgetMode: state.budgetMode,
        budgetAmount: state.budgetAmount,
        days: state.days,
      }),
    });

    if (!response.ok) throw new Error("API 尚未部署或暫時無法使用。");
    const payload = await response.json();
    pendingImport = normalizeImportPayload(payload);
    document.querySelector("#importJson").value = JSON.stringify(payload, null, 2);
    document.querySelector("#applyImport").disabled = false;
    setImportStatus(`API 已回傳 ${pendingImport.days.length} 天行程，確認後可套用。`, "success");
  } catch (error) {
    setImportStatus(`${error.message} 目前可先用 ChatGPT 連結產生 JSON，再貼回匯入。`, "error");
  } finally {
    button.disabled = false;
  }
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

  document.querySelector("#copyJsonPrompt").addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(importSchemaPrompt());
      setImportStatus("已複製 JSON 格式要求，可貼到 ChatGPT。", "success");
    } catch {
      document.querySelector("#importJson").value = importSchemaPrompt();
      setImportStatus("瀏覽器不允許自動複製，已把格式要求放進文字框，可手動複製。", "neutral");
    }
  });

  document.querySelector("#previewImport").addEventListener("click", previewImport);
  document.querySelector("#applyImport").addEventListener("click", applyImport);
  document.querySelector("#autoOptimize").addEventListener("click", autoOptimize);

  document.querySelector("#importJson").addEventListener("input", () => {
    pendingImport = null;
    document.querySelector("#applyImport").disabled = true;
    setImportStatus("內容已變更，請重新檢查。");
  });

  document.querySelector("#clearDays").addEventListener("click", () => {
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
