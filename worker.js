const API_PATHS = new Set(["/api/optimize-itinerary", "/api/optimize"]);

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(request, env) });
    }

    if (API_PATHS.has(url.pathname)) {
      if (request.method !== "POST") {
        return json(request, env, { error: "Method not allowed." }, 405);
      }

      return optimizeItinerary(request, env);
    }

    return env.ASSETS.fetch(request);
  },
};

async function optimizeItinerary(request, env) {
  const originError = validateOrigin(request, env);
  if (originError) return json(request, env, { error: originError }, 403);

  const contentLength = Number(request.headers.get("content-length") || 0);
  if (contentLength > 25000) {
    return json(request, env, { error: "Request body is too large." }, 413);
  }

  if (!env.OPENAI_API_KEY) {
    return json(request, env, { error: "OPENAI_API_KEY is not configured." }, 500);
  }

  let input;
  try {
    input = await request.json();
  } catch {
    return json(request, env, { error: "Invalid JSON request body." }, 400);
  }

  const safeInput = normalizeTravelPlan(input);
  if (!safeInput.days.length) {
    return json(request, env, { error: "At least one itinerary day is required." }, 400);
  }

  const openaiResponse = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: env.OPENAI_MODEL || "gpt-4.1-mini",
      instructions:
        "You are a careful travel-planning assistant. Return only valid JSON that matches the schema. Do not include markdown.",
      input: buildPrompt(safeInput),
      text: {
        format: {
          type: "json_schema",
          name: "optimized_travel_plan",
          strict: true,
          schema: travelPlanSchema(),
        },
      },
    }),
  });

  const data = await openaiResponse.json();
  if (!openaiResponse.ok) {
    return json(request, env, { error: data.error?.message || "OpenAI request failed." }, openaiResponse.status);
  }

  try {
    const outputText = data.output_text || extractOutputText(data);
    const optimized = normalizeTravelPlan(JSON.parse(outputText));
    return json(request, env, optimized, 200);
  } catch {
    return json(request, env, { error: "OpenAI returned an unreadable itinerary." }, 502);
  }
}

function travelPlanSchema() {
  return {
    type: "object",
    additionalProperties: false,
    required: ["tripName", "travelers", "budgetMode", "budgetAmount", "days"],
    properties: {
      tripName: { type: "string" },
      travelers: { type: "integer", minimum: 1, maximum: 20 },
      budgetMode: { type: "string", enum: ["total", "perPerson"] },
      budgetAmount: { type: "number", minimum: 0 },
      days: {
        type: "array",
        minItems: 1,
        maxItems: 60,
        items: {
          type: "object",
          additionalProperties: false,
          required: ["date", "title", "plan", "notes"],
          properties: {
            date: { type: "string" },
            title: { type: "string" },
            plan: { type: "string" },
            notes: { type: "string" },
          },
        },
      },
    },
  };
}

function buildPrompt(input) {
  return `Please optimize this travel plan for daily route flow, transport efficiency, food planning, outfit/photo time, budget realism, and backup plans.

${input.focus ? `Optimization focus: ${input.focus}` : ""}

Keep the user's preferences, but you may reorder activities. Do not add sensitive personal-data fields. Return JSON only.

Current travel data:
${JSON.stringify(input, null, 2)}`;
}

function normalizeTravelPlan(value) {
  const travelers = clampNumber(value.travelers, 1, 20, 2);
  const budgetMode = value.budgetMode === "perPerson" ? "perPerson" : "total";
  const budgetAmount = clampNumber(value.budgetAmount, 0, 99999999, 45000);
  const days = Array.isArray(value.days)
    ? value.days
        .slice(0, 60)
        .map((day) => ({
          date: validDate(day.date) ? day.date : "",
          title: clean(day.title).slice(0, 60) || "未命名行程",
          plan: clean(day.plan).slice(0, 1200),
          notes: clean(day.notes).slice(0, 500),
        }))
        .filter((day) => day.title && day.plan)
    : [];

  return {
    tripName: clean(value.tripName).slice(0, 60) || "Sumi Travel",
    travelers,
    budgetMode,
    budgetAmount,
    focus: clean(value.focus).slice(0, 300),
    days,
  };
}

function extractOutputText(data) {
  return (data.output || [])
    .flatMap((item) => item.content || [])
    .filter((content) => content.type === "output_text")
    .map((content) => content.text)
    .join("");
}

function json(request, env, body, status) {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders(request, env) });
}

function corsHeaders(request, env) {
  return {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "Access-Control-Allow-Origin": allowedOrigin(request, env),
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    Vary: "Origin",
  };
}

function validateOrigin(request, env) {
  const origin = request.headers.get("origin");
  if (!origin) return null;
  return origin === allowedOrigin(request, env) ? null : "Origin is not allowed.";
}

function allowedOrigin(request, env) {
  return env.ALLOWED_ORIGIN || new URL(request.url).origin;
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
