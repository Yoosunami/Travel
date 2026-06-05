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
            <button class="text-button" type="button" data-action="resource-optimize" data-prompt="${escapeHtml(item.prompt)}">用目前行程優化</button>
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

function setOptimizeStatus(message, tone = "neutral") {
  const status = document.querySelector("#optimizeStatus");
  status.textContent = message;
  status.className = `status-box ${tone}`;
}

function normalizeApiPayload(payload) {
  const imported = normalizeState({
    ...state,
    ...payload,
    days: payload.days,
    expenses: state.expenses,
  });

  if (!imported.days.length) throw new Error("API 回傳需要至少一筆有效行程。");
  return imported;
}

function applyOptimizedState(optimized) {
  state.tripName = optimized.tripName;
  state.travelers = optimized.travelers;
  state.budgetMode = optimized.budgetMode;
  state.budgetAmount = optimized.budgetAmount;
  state.days = optimized.days;
  saveState();
  renderAll();
}

async function autoOptimize(focus = "") {
  const buttons = document.querySelectorAll("#autoOptimize, #panelAutoOptimize, #heroAutoOptimize, [data-action='resource-optimize']");
  buttons.forEach((button) => {
    button.disabled = true;
  });
  setOptimizeStatus("正在透過 Cloudflare 呼叫 ChatGPT 優化行程...", "neutral");

  try {
    if (window.location.protocol === "file:") {
      throw new Error("目前是直接開啟 index.html，Cloudflare Function 不會在這種模式下啟動。請部署到 Cloudflare Pages，或用 Wrangler Pages Dev 本機預覽。");
    }

    const response = await fetch("/api/optimize-itinerary", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tripName: state.tripName,
        travelers: state.travelers,
        budgetMode: state.budgetMode,
        budgetAmount: state.budgetAmount,
        days: state.days,
        focus: clean(focus),
      }),
    });

    if (!response.ok) throw new Error(await apiErrorMessage(response));
    const payload = await response.json();
    const optimized = normalizeApiPayload(payload);
    applyOptimizedState(optimized);
    setOptimizeStatus(`已完成並套用 ${optimized.days.length} 天優化行程。`, "success");
  } catch (error) {
    setOptimizeStatus(error.message, "error");
  } finally {
    document.querySelectorAll("#autoOptimize, #panelAutoOptimize, #heroAutoOptimize, [data-action='resource-optimize']").forEach((button) => {
      button.disabled = false;
    });
  }
}

async function apiErrorMessage(response) {
  let detail = "";
  try {
    const payload = await response.json();
    detail = payload.error ? `原因：${payload.error}` : "";
  } catch {
    detail = "";
  }

  if (response.status === 404) {
    return "找不到 /api/optimize-itinerary。請確認 Cloudflare Pages 已部署 functions/api/optimize-itinerary.js。";
  }

  if (response.status === 403) {
    return `API 拒絕此來源。請確認 Cloudflare Pages 的 ALLOWED_ORIGIN 是否與目前網址一致。${detail}`;
  }

  if (response.status === 500) {
    return `Cloudflare Function 已啟動，但伺服器設定不完整。請確認 OPENAI_API_KEY 已設為 Secret。${detail}`;
  }

  return `API 暫時無法使用，HTTP ${response.status}。${detail}`;
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

  document.querySelector("#autoOptimize").addEventListener("click", () => autoOptimize());
  document.querySelector("#panelAutoOptimize").addEventListener("click", () => autoOptimize());
  document.querySelector("#heroAutoOptimize").addEventListener("click", () => autoOptimize());

  document.querySelector("#resourceGrid").addEventListener("click", (event) => {
    const button = event.target.closest("button[data-action='resource-optimize']");
    if (!button) return;
    autoOptimize(button.dataset.prompt || "");
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
