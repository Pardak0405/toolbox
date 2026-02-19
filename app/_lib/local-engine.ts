export async function callLocalEngine({
  toolId,
  options,
  files,
  token
}: {
  toolId: string;
  options: Record<string, unknown>;
  files: File[];
  token: string;
}) {
  const formData = new FormData();
  formData.append("toolId", toolId);
  formData.append("options", JSON.stringify(options));
  files.forEach((file) => formData.append("files", file));

  const response = await fetch("http://127.0.0.1:34781/api/convert", {
    method: "POST",
    headers: {
      "x-session-token": token
    },
    body: formData
  });

  if (!response.ok) {
    throw new Error(await response.text());
  }

  return await response.blob();
}
