import { AwsClient } from "aws4fetch";

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}

export async function onRequestPost({ request, env }: any) {
  const { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME } = env;
  if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_BUCKET_NAME) {
    return json({ ok: false, error: "환경 변수(R2_*)가 설정되지 않았습니다." }, 500);
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: "JSON 바디가 필요합니다." }, 400);
  }

  const outputKey = String(body?.outputKey || "");
  if (!outputKey.startsWith("out/")) {
    return json({ ok: false, error: "outputKey는 out/ 경로여야 합니다." }, 400);
  }

  const endpoint = `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;
  const objectUrl = `${endpoint}/${R2_BUCKET_NAME}/${outputKey}`;

  const aws = new AwsClient({
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
    region: "auto",
    service: "s3"
  });

  const signed = await aws.sign(objectUrl, { method: "GET" });

  return json({
    ok: true,
    method: "GET",
    downloadUrl: signed.url,
    outputKey
  });
}
