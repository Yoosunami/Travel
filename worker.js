const tripId = "sumi-default-trip";

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: jsonHeaders() });
    }

    if (url.pathname === "/api/trip") {
      return handleTrip(request, env);
    }

    return env.ASSETS.fetch(request);
  },
};

async function handleTrip(request, env) {
  if (!env.TRAVEL_DB) return json({ error: "D1 binding TRAVEL_DB is not configured." }, 500);

  const authError = authorize(request, env);
  if (authError) return json({ error: authError }, 401);

  if (request.method === "GET") {
    const row = await env.TRAVEL_DB.prepare("SELECT data, updated_at FROM trips WHERE id = ?").bind(tripId).first();
    if (!row) return json({ data: null, updatedAt: null }, 200);
    return json({ data: JSON.parse(row.data), updatedAt: row.updated_at }, 200);
  }

  if (request.method === "PUT") {
    let body;
    try {
      body = await request.json();
    } catch {
      return json({ error: "Invalid JSON body." }, 400);
    }

    const data = normalizeTrip(body.data);
    const updatedAt = new Date().toISOString();
    await env.TRAVEL_DB.prepare(
      "INSERT INTO trips (id, data, updated_at) VALUES (?, ?, ?) ON CONFLICT(id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at",
    )
      .bind(tripId, JSON.stringify(data), updatedAt)
      .run();

    return json({ ok: true, updatedAt }, 200);
  }

  return json({ error: "Method not allowed." }, 405);
}

function authorize(request, env) {
  if (!env.SYNC_SECRET) return null;
  const token = request.headers.get("X-Sync-Token") || "";
  return token === env.SYNC_SECRET ? null : "同步密碼錯誤。";
}

function normalizeTrip(value = {}) {
  return {
    tripName: clean(value.tripName).slice(0, 60) || "Sumi Travel",
    startDate: validDate(value.startDate) ? value.startDate : "",
    travelers: clampNumber(value.travelers, 1, 20, 1),
    budgetMode: value.budgetMode === "perPerson" ? "perPerson" : "total",
    budgetAmount: clampNumber(value.budgetAmount, 0, 99999999, 0),
    expenses: Array.isArray(value.expenses) ? value.expenses.slice(0, 500).map(normalizeExpense) : [],
    days: Array.isArray(value.days) ? value.days.slice(0, 60).map(normalizeDay).filter((day) => day.title && day.plan) : [],
    localUpdatedAt: clean(value.localUpdatedAt).slice(0, 40),
  };
}

function normalizeDay(day = {}) {
  return {
    date: validDate(day.date) ? day.date : "",
    title: clean(day.title).slice(0, 60) || "未命名行程",
    plan: clean(day.plan).slice(0, 1200),
    notes: clean(day.notes).slice(0, 500),
  };
}

function normalizeExpense(expense = {}) {
  return {
    title: clean(expense.title).slice(0, 40) || "未命名項目",
    payer: clean(expense.payer).slice(0, 24) || "Sumi",
    amount: clampNumber(expense.amount, 0, 99999999, 0),
    people: clampNumber(expense.people, 1, 20, 1),
  };
}

function validDate(value) {
  return value === "" || /^\d{4}-\d{2}-\d{2}$/.test(String(value || ""));
}

function clean(value) {
  return String(value || "").trim();
}

function clampNumber(value, min, max, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, number));
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: jsonHeaders() });
}

function jsonHeaders() {
  return {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, PUT, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Sync-Token",
  };
}
