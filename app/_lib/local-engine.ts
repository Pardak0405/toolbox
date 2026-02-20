const LOCAL_ENGINE_URL = "http://127.0.0.1:34781";
const SESSION_STORAGE_KEY = "toolbox_local_engine_pairing_key";
let pairingKeyPromise: Promise<string> | null = null;

export async function getOrCreateLocalSessionToken() {
  if (typeof window === "undefined") {
    throw new Error("Local pairing key is only available in browser context.");
  }
  if (!pairingKeyPromise) {
    pairingKeyPromise = (async () => {
      const stored = window.sessionStorage.getItem(SESSION_STORAGE_KEY);
      if (stored) return stored;
      const key = window.prompt(
        "로컬 엔진 페어링 키를 입력하세요.\n기본 경로: ~/.toolbox-local-engine/pairing.key"
      );
      const normalized = String(key || "").trim();
      if (!normalized) {
        throw new Error("Pairing key is required.");
      }
      window.sessionStorage.setItem(SESSION_STORAGE_KEY, normalized);
      return normalized;
    })();
  }
  return pairingKeyPromise;
}

export async function callLocalEngine({
  toolId,
  options,
  files,
  token,
  signal
}: {
  toolId: string;
  options: Record<string, unknown>;
  files: File[];
  token: string;
  signal?: AbortSignal;
}) {
  const formData = new FormData();
  formData.append("toolId", toolId);
  formData.append("options", JSON.stringify(options));
  files.forEach((file) => formData.append("files", file));

  const response = await fetch(`${LOCAL_ENGINE_URL}/api/convert`, {
    method: "POST",
    headers: {
      "x-toolbox-pairing-key": token
    },
    signal,
    body: formData
  });

  if (!response.ok) {
    throw new Error(await response.text());
  }

  return await response.blob();
}
