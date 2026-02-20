const LOCAL_ENGINE_URL = "http://127.0.0.1:34781";
const SESSION_STORAGE_KEY = "toolbox_local_engine_token";
let sessionPromise: Promise<string> | null = null;

function createRandomToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

async function registerLocalSessionToken(token: string) {
  const response = await fetch(`${LOCAL_ENGINE_URL}/api/session/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token })
  });
  if (!response.ok) {
    throw new Error(await response.text());
  }
}

export async function getOrCreateLocalSessionToken() {
  if (typeof window === "undefined") {
    throw new Error("Local session token is only available in browser context.");
  }
  if (!sessionPromise) {
    sessionPromise = (async () => {
      const stored = window.sessionStorage.getItem(SESSION_STORAGE_KEY);
      if (stored) return stored;
      const token = createRandomToken();
      await registerLocalSessionToken(token);
      window.sessionStorage.setItem(SESSION_STORAGE_KEY, token);
      return token;
    })();
  }
  return sessionPromise;
}

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

  const response = await fetch(`${LOCAL_ENGINE_URL}/api/convert`, {
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
