export const BRAND = {
  name: "toolbox",
  slogan: "업로드 없이 빠르게, 내 PC에서 처리하는 문서 툴킷",
  domain: "추후 입력",
  supportEmail: "support@toolbox.local"
};

export function getBrandOrigin() {
  const raw = BRAND.domain.trim();
  if (raw.startsWith("http://") || raw.startsWith("https://")) {
    return raw;
  }
  return "https://example.local";
}
