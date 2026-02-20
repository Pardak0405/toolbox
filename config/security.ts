export const SECURITY_ALLOWLIST = {
  adScript: [
    "https://pagead2.googlesyndication.com",
    "https://googleads.g.doubleclick.net",
    "https://tpc.googlesyndication.com"
  ],
  adConnect: [
    "https://pagead2.googlesyndication.com",
    "https://googleads.g.doubleclick.net",
    "https://ep1.adtrafficquality.google"
  ],
  assets: ["'self'", "blob:", "data:"]
};

export const FILE_LIMITS = {
  defaultSoftBytes: 512 * 1024 * 1024,
  defaultHardBytes: 1024 * 1024 * 1024,
  maxFilesPerRun: 200,
  maxPdfPagesForOcr: 25,
  maxPdfPagesHard: 300,
  ocrTimeoutMsPerPage: 45_000
};

export function buildCsp(isDev: boolean) {
  const scriptSrc = [
    "'self'",
    ...SECURITY_ALLOWLIST.adScript,
    ...(isDev ? ["'unsafe-eval'", "'unsafe-inline'"] : [])
  ];

  const styleSrc = ["'self'", "'unsafe-inline'"];
  const imgSrc = ["'self'", "blob:", "data:", ...SECURITY_ALLOWLIST.adScript];
  const connectSrc = ["'self'", "http://127.0.0.1:34781", ...SECURITY_ALLOWLIST.adConnect];
  const frameSrc = ["'self'", ...SECURITY_ALLOWLIST.adScript];

  return [
    "default-src 'self'",
    `script-src ${scriptSrc.join(" ")}`,
    `style-src ${styleSrc.join(" ")}`,
    `img-src ${imgSrc.join(" ")}`,
    `connect-src ${connectSrc.join(" ")}`,
    "font-src 'self' data:",
    `frame-src ${frameSrc.join(" ")}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "upgrade-insecure-requests"
  ].join("; ");
}

export function buildSecurityHeaders(isDev: boolean) {
  const isProd = !isDev;
  const headers = [
    { key: "Content-Security-Policy", value: buildCsp(isDev) },
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    {
      key: "Permissions-Policy",
      value: "camera=(self), microphone=(), geolocation=(), payment=(), usb=()"
    },
    { key: "X-Frame-Options", value: "DENY" },
    { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
    { key: "Cross-Origin-Resource-Policy", value: "same-site" },
    { key: "Cross-Origin-Embedder-Policy", value: "unsafe-none" }
  ];

  if (isProd) {
    headers.push({
      key: "Strict-Transport-Security",
      value: "max-age=31536000; includeSubDomains; preload"
    });
  }

  return headers;
}
