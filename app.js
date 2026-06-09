const storageKey = "sumi-travel-desk-v6";
const syncTokenKey = "sumi-travel-sync-token";
const previousStorageKeys = ["sumi-travel-desk-v4", "sumi-travel-desk-v3", "sumi-travel-desk-v2", "sumi-travel-desk-v1"];

const resources = [
  {
    key: "all",
    title: "整合",
    icon: "ALL",
    tone: "all",
    description: "一次檢查機票、住宿、飲食、交通，但用精簡清單輸出。",
    links: [["ChatGPT", "https://chatgpt.com/"]],
  },
  {
    key: "flight",
    title: "機票",
    icon: "AIR",
    tone: "flight",
    description: "只用第一天與最後一天判斷抵達、離開、行李與轉機風險。",
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
    description: "依每日活動範圍挑住宿區域，檢查交通時間與取消政策。",
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
    description: "依每天行程順序檢查轉乘、票券、尖峰與雨天備案。",
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
  localUpdatedAt: new Date().toISOString(),
  cloudUpdatedAt: "",
};

let editingDayIndex = null;
let feedbackDraft = null;
let appState = loadAppState();
let state = activeTrip();
const formatter = new Intl.NumberFormat("zh-TW");

function loadAppState() {
  try {
    const parsed = JSON.parse(localStorage.getItem(storageKey));
    if (parsed) return normalizeAppState(parsed);
  } catch {
    // Ignore invalid state.
  }

  for (const key of previousStorageKeys) {
    try {
      const parsed = JSON.parse(localStorage.getItem(key));
      if (parsed) return singleTripToAppState(normalizeState(migrateOldState(parsed)));
    } catch {
      // Ignore invalid legacy state.
    }
  }

  return singleTripToAppState(normalizeState(defaultState));
}

function normalizeAppState(value) {
  if (!Array.isArray(value.trips)) return singleTripToAppState(normalizeState(value));

  const trips = value.trips.map(normalizeTrip).filter(Boolean);
  const fallback = singleTripToAppState(normalizeState(defaultState));
  if (!trips.length) return fallback;

  const activeTripId = trips.some((trip) => trip.id === value.activeTripId) ? value.activeTripId : trips[0].id;
  return {
    activeTripId,
    trips,
    localUpdatedAt: value.localUpdatedAt || new Date().toISOString(),
    cloudUpdatedAt: value.cloudUpdatedAt || "",
  };
}

function singleTripToAppState(trip) {
  const normalized = normalizeTrip({ id: createId(), ...trip });
  return {
    activeTripId: normalized.id,
    trips: [normalized],
    localUpdatedAt: trip.localUpdatedAt || new Date().toISOString(),
    cloudUpdatedAt: trip.cloudUpdatedAt || "",
  };
}

function normalizeTrip(value) {
  if (!value) return null;
  return {
    id: clean(value.id) || createId(),
    tripName: clean(value.tripName).slice(0, 60) || "未命名旅行",
    startDate: validDate(value.startDate) ? value.startDate : "",
    travelers: clampNumber(value.travelers, 1, 20, defaultState.travelers),
    budgetMode: value.budgetMode === "perPerson" ? "perPerson" : "total",
    budgetAmount: clampNumber(value.budgetAmount, 0, 99999999, defaultState.budgetAmount),
    days: normalizeDays(value.days),
    expenses: Array.isArray(value.expenses) ? value.expenses.slice(0, 500) : [],
    undoDays: Array.isArray(value.undoDays) ? normalizeDays(value.undoDays) : null,
  };
}

function activeTrip() {
  return appState.trips.find((trip) => trip.id === appState.activeTripId) || appState.trips[0];
}

function setActiveTrip(id) {
  if (!appState.trips.some((trip) => trip.id === id)) return;
  appState.activeTripId = id;
  state = activeTrip();
  editingDayIndex = null;
  feedbackDraft = null;
  saveState({ keepTimestamp: true });
  resetDayForm();
  renderAll();
}

function createId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `trip-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function migrateOldState(oldState) {
  if (Array.isArray(oldState.days)) return oldState;
  const oldPlans = Array.isArray(oldState.plans) ? oldState.plans : [];
  const grouped = oldPlans.reduce((days, item) => {
    const date = item.date || "";
    const key = date || "undated";
    if (!days[key]) days[key] = { date, title: date ? `${date} 行程` : "未定日期行程", plan: "", notes: "" };
    days[key].plan += `${item.slot || "時段"} / ${item.title || ""}${item.note ? ` - ${item.note}` : ""}\n`;
    return days;
  }, {});
  return { ...oldState, days: Object.values(grouped) };
}

function normalizeState(value) {
  return {
    ...defaultState,
    ...value,
    travelers: clampNumber(value.travelers, 1, 20, defaultState.travelers),
    budgetMode: value.budgetMode === "perPerson" ? "perPerson" : "total",
    budgetAmount: clampNumber(value.budgetAmount, 0, 99999999, defaultState.budgetAmount),
    days: normalizeDays(value.days),
    expenses: Array.isArray(value.expenses) ? value.expenses.slice(0, 500) : [],
    undoDays: Array.isArray(value.undoDays) ? normalizeDays(value.undoDays) : null,
    localUpdatedAt: value.localUpdatedAt || new Date().toISOString(),
    cloudUpdatedAt: value.cloudUpdatedAt || "",
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

function saveState(options = {}) {
  appState.trips = appState.trips.map((trip) => (trip.id === state.id ? state : trip));
  if (!options.keepTimestamp) appState.localUpdatedAt = new Date().toISOString();
  localStorage.setItem(storageKey, JSON.stringify(appState));
  renderSyncStatus();
}

function cloudPayload() {
  return {
    version: 2,
    activeTripId: appState.activeTripId,
    trips: appState.trips,
    localUpdatedAt: appState.localUpdatedAt,
  };
}

function applyCloudPayload(payload, updatedAt) {
  const next = normalizeAppState({ ...payload, cloudUpdatedAt: updatedAt || payload.updatedAt || "" });
  appState = next;
  state = activeTrip();
  saveState({ keepTimestamp: true });
  renderAll();
}

function createBlankTrip(name = "新的旅行計畫") {
  return normalizeTrip({
    id: createId(),
    tripName: name,
    startDate: "",
    travelers: state?.travelers || 2,
    budgetMode: state?.budgetMode || "total",
    budgetAmount: state?.budgetAmount || 45000,
    days: [],
    expenses: [],
    undoDays: null,
  });
}

function addTrip() {
  const name = clean(prompt("請輸入新旅遊計畫名稱", "新的旅行計畫"));
  if (!name) return;
  const trip = createBlankTrip(name);
  appState.trips.push(trip);
  appState.activeTripId = trip.id;
  state = activeTrip();
  saveState();
  resetDayForm();
  renderAll();
}

function renameTrip() {
  const name = clean(prompt("請輸入新的旅遊計畫名稱", state.tripName));
  if (!name) return;
  state.tripName = name.slice(0, 60);
  saveState();
  renderAll();
}

function deleteTrip() {
  if (appState.trips.length <= 1) {
    alert("至少需要保留一個旅遊計畫。");
    return;
  }
  if (!confirm(`確定刪除「${state.tripName}」嗎？此操作只會刪除此裝置目前資料，按上傳後才會同步到雲端。`)) return;
  appState.trips = appState.trips.filter((trip) => trip.id !== state.id);
  appState.activeTripId = appState.trips[0].id;
  state = activeTrip();
  saveState();
  resetDayForm();
  renderAll();
}

function clampNumber(value, min, max, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, number));
}

function validDate(value) {
  return value === "" || /^\d{4}-\d{2}-\d{2}$/.test(String(value || ""));
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

function currency(value) {
  return `TWD ${formatter.format(Math.round(Number(value) || 0))}`;
}

function formatTime(value) {
  if (!value) return "尚未同步";
  try {
    return new Date(value).toLocaleString("zh-TW", { hour12: false });
  } catch {
    return value;
  }
}

function budgetSummary() {
  const travelers = Math.max(1, Number(state.travelers) || 1);
  const amount = Math.max(0, Number(state.budgetAmount) || 0);
  const total = state.budgetMode === "perPerson" ? amount * travelers : amount;
  const perPerson = total / travelers;
  const days = Math.max(1, state.days.length || 1);
  return { travelers, days, total, perPerson, perDay: total / days };
}

function itineraryText() {
  if (!state.days.length) return "尚未建立行程。";
  return state.days
    .map((day, index) => `Day ${index + 1} ${day.date || "未定日期"} ${day.title}\n${day.plan}\n備註：${day.notes || "無"}`)
    .join("\n\n");
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
  const items = first === last ? [{ day: first, label: "第一天 / 最後一天" }] : [{ day: first, label: "第一天" }, { day: last, label: "最後一天" }];
  return items
    .map(({ day, label }) => `${label} ${day.date || "未定日期"} ${day.title}\n${day.plan}${day.notes ? `\n備註：${day.notes}` : ""}`)
    .join("\n\n");
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

旅行名稱：${state.tripName}
旅行人數：${summary.travelers}
總預算：${currency(summary.total)}
每人預算：${currency(summary.perPerson)}

目前行程：
${itineraryText()}`;
}

function resourcePrompt(resource) {
  const summary = budgetSummary();
  const basics = `旅行名稱：${state.tripName}\n旅行人數：${summary.travelers}\n總預算：${currency(summary.total)}\n每人預算：${currency(summary.perPerson)}`;
  const prompts = {
    flight: `請只針對「機票」協助我規劃，不要重排行程。\n\n行程資料使用規則：機票只需要參考第一天與最後一天。\n\n請輸出：\n1. 建議抵達與離開時間帶\n2. 轉機、行李、退改規則注意事項\n3. 不適合太早或太晚航班的行程原因\n4. Google Flights / Skyscanner 搜尋條件\n\n${basics}\n\n第一天與最後一天：\n${edgeItineraryText()}`,
    stay: `請只針對「住宿」協助我規劃，不要重排行程。\n\n請依每天主要活動區域判斷住宿區域，輸出住宿區域排序、優缺點、交通時間、取消政策與 Booking / Agoda 篩選條件。\n\n${basics}\n\n每日行程：\n${fullItineraryText()}`,
    food: `請只針對「飲食」協助我規劃，不要重排行程。\n\n請依每天活動區域安排早餐、午餐、咖啡、晚餐區域，列出訂位、排隊風險、預算分配、備案餐廳類型與搜尋關鍵字。\n\n${basics}\n\n每日行程：\n${fullItineraryText()}`,
    transit: `請只針對「交通」協助我規劃，不要重排行程。\n\n請依每天行程順序檢查主要移動路線、可能轉乘、票券或 IC 卡策略、尖峰時間、雨天與行李移動風險。\n\n${basics}\n\n每日行程：\n${fullItineraryText()}`,
    all: `請依序針對「機票、住宿、飲食、交通」協助我檢查旅行規劃，但不要重排行程，也不要輸出完整每日行程。\n\n機票只參考第一天與最後一天；住宿、飲食、交通可參考全部行程。最後請列出最多 8 項優先處理清單。\n\n${basics}\n\n第一天與最後一天：\n${edgeItineraryText()}\n\n全部每日行程：\n${fullItineraryText()}`,
  };
  return prompts[resource.key] || chatPrompt();
}

function renderBasics() {
  renderTripSelector();
  document.querySelector("#tripName").value = state.tripName;
  document.querySelector("#travelers").value = state.travelers;
  document.querySelector("#startDate").value = state.startDate;
  document.querySelector("#tripNamePreview").textContent = state.tripName;
  document.querySelector("#budgetPreview").textContent = currency(budgetSummary().total);
  document.querySelector("#expensePeople").value = state.travelers;
}

function renderTripSelector() {
  const selector = document.querySelector("#tripSelector");
  selector.innerHTML = appState.trips
    .map((trip) => `<option value="${escapeHtml(trip.id)}">${escapeHtml(trip.tripName)}</option>`)
    .join("");
  selector.value = appState.activeTripId;
}

function renderSyncStatus() {
  const token = localStorage.getItem(syncTokenKey) || "";
  const syncInput = document.querySelector("#syncToken");
  if (syncInput && syncInput.value !== token) syncInput.value = token;
  const mode = document.querySelector("#syncMode");
  if (mode) mode.textContent = token ? "Cloud" : "Local";
  const local = document.querySelector("#localUpdatedAt");
  if (local) local.textContent = formatTime(appState.localUpdatedAt);
  const cloud = document.querySelector("#cloudUpdatedAt");
  if (cloud) cloud.textContent = formatTime(appState.cloudUpdatedAt);
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
            <button class="text-button" type="button" data-action="prepare-resource-prompt" data-resource-key="${item.key}">產生提問</button>
            ${item.links.map(([label, href]) => `<a href="${href}" target="_blank" rel="noopener noreferrer">${label}</a>`).join("")}
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
  const breakdown = [["機票", 0.35], ["住宿", 0.3], ["飲食", 0.2], ["交通與彈性", 0.15]];
  document.querySelector("#budgetBreakdown").innerHTML = breakdown
    .map(([label, ratio]) => {
      const total = summary.total * ratio;
      return `<li><strong>${label}</strong><span class="meta">建議總額 ${currency(total)}，每人約 ${currency(total / summary.travelers)}</span></li>`;
    })
    .join("");
}

function renderExpenses() {
  const list = document.querySelector("#expenseList");
  const total = state.expenses.reduce((sum, item) => sum + Number(item.amount), 0);
  list.innerHTML = state.expenses.length
    ? state.expenses
        .map((item) => `<li><strong>${escapeHtml(item.title)}</strong><span class="meta">${escapeHtml(item.payer)} 先付 ${currency(item.amount)}，每人 ${currency(item.amount / item.people)}</span></li>`)
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
  renderSyncStatus();
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

function setSyncStatus(message, tone = "neutral") {
  const status = document.querySelector("#syncStatus");
  status.textContent = message;
  status.className = `status-box ${tone}`;
}

function preparePrompt(focus = "") {
  const prompt = focus && typeof focus === "object" ? resourcePrompt(focus) : chatPrompt(focus);
  document.querySelector("#promptText").value = prompt;
  setFeedbackStatus("已產生提問內容。請確認後複製到 ChatGPT。", "success");
  return prompt;
}

async function copyPrompt() {
  const prompt = document.querySelector("#promptText").value.trim();
  if (!prompt) {
    setFeedbackStatus("請先產生提問內容，再按複製。", "error");
    return;
  }
  try {
    await navigator.clipboard.writeText(prompt);
    setFeedbackStatus("已複製提問內容。", "success");
  } catch {
    document.querySelector("#promptText").focus();
    document.querySelector("#promptText").select();
    setFeedbackStatus("瀏覽器不允許自動複製，請手動複製上方內容。", "error");
  }
}

function openChatGPT() {
  setFeedbackStatus("ChatGPT 已開啟。請手動貼上你複製的提問內容。", "success");
  window.open("https://chatgpt.com/", "_blank", "noopener,noreferrer");
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
  return { date, title, plan: plan.join("\n"), notes: notes.join("\n") };
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
  setFeedbackStatus("已套用 ChatGPT 優化結果。", "success");
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

function syncHeaders() {
  const token = localStorage.getItem(syncTokenKey) || "";
  return { "Content-Type": "application/json", "X-Sync-Token": token };
}

async function pullCloud() {
  try {
    const response = await fetch("/api/trip", { headers: syncHeaders() });
    if (!response.ok) throw new Error(await syncError(response));
    const payload = await response.json();
    if (!payload.data) {
      setSyncStatus("雲端還沒有資料。你可以先上傳目前本機資料。", "neutral");
      return;
    }
    applyCloudPayload(payload.data, payload.updatedAt);
    setSyncStatus("已從雲端下載並套用。", "success");
  } catch (error) {
    setSyncStatus(error.message, "error");
  }
}

async function pushCloud() {
  try {
    const response = await fetch("/api/trip", {
      method: "PUT",
      headers: syncHeaders(),
      body: JSON.stringify({ data: cloudPayload(), clientUpdatedAt: appState.localUpdatedAt }),
    });
    if (!response.ok) throw new Error(await syncError(response));
    const payload = await response.json();
    appState.cloudUpdatedAt = payload.updatedAt || new Date().toISOString();
    saveState({ keepTimestamp: true });
    renderSyncStatus();
    setSyncStatus("已上傳到雲端。手機或電腦可按下載同步。", "success");
  } catch (error) {
    setSyncStatus(error.message, "error");
  }
}

async function syncError(response) {
  try {
    const payload = await response.json();
    if (payload.error) return payload.error;
  } catch {
    // Ignore body parse errors.
  }
  if (response.status === 401) return "同步密碼錯誤或尚未設定。";
  if (response.status === 404) return "找不到同步 API。請確認已部署 Cloudflare Worker。";
  return `同步失敗，HTTP ${response.status}`;
}

function bindEvents() {
  document.querySelector("#tripSelector").addEventListener("change", (event) => {
    setActiveTrip(event.target.value);
  });
  document.querySelector("#newTrip").addEventListener("click", addTrip);
  document.querySelector("#renameTrip").addEventListener("click", renameTrip);
  document.querySelector("#deleteTrip").addEventListener("click", deleteTrip);

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

  document.querySelector("#saveSyncToken").addEventListener("click", () => {
    localStorage.setItem(syncTokenKey, document.querySelector("#syncToken").value.trim());
    renderSyncStatus();
    setSyncStatus("同步密碼已儲存在此裝置。", "success");
  });
  document.querySelector("#pullCloud").addEventListener("click", pullCloud);
  document.querySelector("#pushCloud").addEventListener("click", pushCloud);

  document.querySelector("#dayForm").addEventListener("submit", (event) => {
    event.preventDefault();
    const day = {
      date: document.querySelector("#dayDate").value,
      title: clean(document.querySelector("#dayTitle").value),
      plan: clean(document.querySelector("#dayPlan").value),
      notes: clean(document.querySelector("#dayNotes").value),
    };
    if (!day.title || !day.plan) return;
    if (editingDayIndex === null) state.days.push(day);
    else state.days[editingDayIndex] = day;
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
  document.querySelector("#copyPrompt").addEventListener("click", copyPrompt);
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
