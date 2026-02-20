const LOCAL_ENGINE_URL = "http://127.0.0.1:34781";

export async function callLocalEngine({
  toolId,
  options,
  files,
  signal
}: {
  toolId: string;
  options: Record<string, unknown>;
  files: File[];
  signal?: AbortSignal;
}) {
  const formData = new FormData();
  formData.append("toolId", toolId);
  formData.append("options", JSON.stringify(options));
  files.forEach((file) => formData.append("files", file));

  const response = await fetch(`${LOCAL_ENGINE_URL}/api/convert`, {
    method: "POST",
    signal,
    body: formData
  });

  if (!response.ok) {
    throw new Error(await response.text());
  }

  return await response.blob();
}
