export const BRAND = {
  name: "toolbox",
  slogan: "업로드 없이 빠르게, 내 PC에서 처리하는 문서 변환기",
  domain: "https://toolbox.pgwcoding1.workers.dev",
  supportEmail: "pgwcoding1@gmail.com"
};

export function getBrandOrigin() {
  const raw = BRAND.domain.trim();
  if (raw.startsWith("http://") || raw.startsWith("https://")) {
    return raw;
  }
  return "https://example.local";
}
