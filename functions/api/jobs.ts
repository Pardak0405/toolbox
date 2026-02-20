function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}

function safeJobId(id: string) {
  return id.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 80);
}

export async function onRequestPost({ request, env }: any) {
  const { CLOUD_RUN_CONVERTER_URL, TOOLBOX_SECRET } = env;
  if (!CLOUD_RUN_CONVERTER_URL || !TOOLBOX_SECRET) {
    return json({ ok: false, error: "CLOUD_RUN_CONVERTER_URL 또는 TOOLBOX_SECRET 누락" }, 500);
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: "JSON 바디가 필요합니다." }, 400);
  }

  const jobId = safeJobId(String(body?.jobId || ""));
  const inputKey = String(body?.inputKey || "");
  if (!jobId || !inputKey) {
    return json({ ok: false, error: "jobId, inputKey가 필요합니다." }, 400);
  }

  const outputKey = `out/${jobId}/result.pdf`;

  const resp = await fetch(`${String(CLOUD_RUN_CONVERTER_URL).replace(/\/$/, "")}/convert/pptx-to-pdf`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Toolbox-Secret": TOOLBOX_SECRET
    },
    body: JSON.stringify({ jobId, inputKey, outputKey })
  });

  const text = await resp.text();
  let payload: any = null;
  try {
    payload = JSON.parse(text);
  } catch {
    payload = { raw: text };
  }

  if (!resp.ok) {
    return json({ ok: false, error: payload?.error || "변환 서버 호출 실패", detail: payload }, resp.status);
  }

  return json({ ok: true, jobId, outputKey, converter: payload });
}
