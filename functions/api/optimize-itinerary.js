const jsonHeaders = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store",
};

export async function onRequestOptions(context) {
  return new Response(null, { status: 204, headers: corsHeaders(context.request, context.env) });
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const originError = validateOrigin(request, env);
  if (originError) return json(context, { error: originError }, 403);

  const contentLength = Number(request.headers.get("content-length") || 0);
  if (contentLength > 25000) {
    return json(context, { error: "Request body is too large." }, 413);
  }

  if (!env.OPENAI_API_KEY) {
    return json(context, { error: "OPENAI_API_KEY is not configured." }, 500);
  }

  let input;
  try {
    input = await request.json();
  } catch {
    return json(context, { error: "Invalid JSON request body." }, 400);
  }

  const safeInput = normalizeRequest(input);
  if (!safeInput.days.length) {
    return json(context, { error: "At least one itinerary day is required." }, 400);
  }

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: env.OPENAI_MODEL || "gpt-5.5",
      instructions:
        "You are a careful travel-planning assistant. Return only valid JSON. Do not include markdown or explanatory text.",
      input: buildPrompt(safeInput),
      text: {
        format: {
          type: "json_schema",
          name: "optimized_travel_plan",
          strict: true,
          schema: {
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
          },
        },
      },
    }),
  });

  const data = await response.json();
  if (!response.ok) {
    return json(context, { error: data.error?.message || "OpenAI request failed." }, response.status);
  }

  try {
    const outputText = data.output_text || extractOutputText(data);
    const optimized = JSON.parse(outputText);
    return json(context, normalizeRequest(optimized), 200);
  } catch {
    return json(context, { error: "OpenAI returned an unreadable itinerary." }, 502);
  }
}

function json(context, body, status) {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders(context.request, context.env) });
}

function corsHeaders(request, env) {
  return {
    ...jsonHeaders,
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

function normalizeRequest(value) {
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
    days,
  };
}

function buildPrompt(input) {
  return `請優化以下旅行規劃，重點是每日動線、交通效率、美食安排、穿搭拍照時間、預算合理性與備案。

請保留使用者原本偏好，但可以重排每日活動。不要加入敏感個資欄位。

目前資料：
${JSON.stringify(input, null, 2)}`;
}

function extractOutputText(data) {
  return (data.output || [])
    .flatMap((item) => item.content || [])
    .filter((content) => content.type === "output_text")
    .map((content) => content.text)
    .join("");
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
