/// <reference lib="webworker" />

self.onmessage = async (event) => {
  const { type, payload } = event.data || {};
  if (type !== "estimate") return;

  try {
    const bytes = payload?.bytes;
    const size = bytes?.byteLength || 0;
    self.postMessage({ type: "estimated", payload: { bytes: size } });
  } catch (error) {
    self.postMessage({
      type: "error",
      payload: { message: error instanceof Error ? error.message : "Estimation failed" }
    });
  }
};
