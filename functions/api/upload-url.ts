import { AwsClient } from "aws4fetch";

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function safeFilename(name: string) {
  return name
    .replace(/[^\w.\- ]+/g, "_")
    .replace(/\s+/g, "_")
    .slice(0, 120);
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

  const filename = String(body?.filename || "");
  const contentType = String(
    body?.contentType ||
      "application/vnd.openxmlformats-officedocument.presentationml.presentation"
  );

  if (!filename.toLowerCase().endsWith(".pptx")) {
    return json({ ok: false, error: ".pptx 파일만 지원합니다." }, 400);
  }

  const jobId = crypto.randomUUID();
  const key = `in/${jobId}/${safeFilename(filename)}`;

  const endpoint = `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;
  const objectUrl = `${endpoint}/${R2_BUCKET_NAME}/${key}`;

  const aws = new AwsClient({
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
    region: "auto",
    service: "s3",
  });

  // PUT 업로드용 presigned URL 생성
  const signed = await aws.sign(objectUrl, {
    method: "PUT",
    headers: { "Content-Type": contentType },
  });

  return json({
    ok: true,
    jobId,
    key,
    uploadUrl: signed.url,
    headers: { "Content-Type": contentType },
    method: "PUT",
  });
}
