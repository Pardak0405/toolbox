import Link from "next/link";
import { BadgeInfo, Laptop, Shield, Zap } from "lucide-react";

const trustCards = [
  {
    title: "파일 업로드 최소화",
    body: "기본 모드에서는 파일이 서버로 전송되지 않고 브라우저에서 처리됩니다. 네트워크 탭에서 외부 업로드 요청이 없는지 직접 확인할 수 있어요.",
    icon: Shield
  },
  {
    title: "빠르고 간단한 3단계",
    body: "파일 선택 → 옵션 설정 → 다운로드. 회원가입 없이 바로 사용할 수 있도록 흐름을 단순하게 유지했습니다.",
    icon: Zap
  },
  {
    title: "설치 없이 작동",
    body: "대부분의 도구는 설치 없이 실행됩니다. (일부 고급 변환 기능은 품질을 위해 선택적 ‘로컬 엔진’ 모드를 제공할 수 있습니다.)",
    icon: Laptop
  },
  {
    title: "광고 운영 원칙",
    body: "광고는 사이트 운영을 위한 최소 범위로만 노출합니다. 변환 과정과 결과 다운로드를 방해하지 않는 위치에 배치합니다.",
    icon: BadgeInfo
  }
];

const quickLinks = [
  { label: "JPG를 PDF로 변환", href: "/jpg-to-pdf" },
  { label: "PDF를 JPG로 변환", href: "/pdf-to-jpg" },
  { label: "PDF 합치기", href: "/merge-pdf" },
  { label: "PDF 분할하기", href: "/split-pdf" },
  { label: "PDF 압축하기", href: "/compress-pdf" },
  { label: "PDF 회전", href: "/rotate-pdf" },
  { label: "페이지 번호 추가", href: "/page-numbers" },
  { label: "워터마크 추가", href: "/watermark-pdf" }
];

const faqs = [
  {
    q: "정말 업로드 없이 되나요?",
    a: "기본 모드에서는 브라우저에서 처리됩니다. 단, 일부 고급 변환 기능은 품질 향상을 위해 선택적으로 로컬 엔진 모드를 안내할 수 있습니다."
  },
  {
    q: "무료인가요?",
    a: "네. 핵심 기능은 무료로 제공하며, 광고를 통해 운영됩니다."
  },
  {
    q: "모바일에서도 되나요?",
    a: "가능합니다. 다만 파일 용량이 큰 경우 데스크톱 환경을 권장합니다."
  }
];

export default function HomeTrustSeoSection() {
  return (
    <section className="mt-12 rounded-3xl bg-fog px-6 py-10 md:px-10" aria-labelledby="home-trust-title">
      <div className="mx-auto max-w-5xl space-y-8">
        <div className="space-y-3">
          <h2 id="home-trust-title" className="font-display text-2xl md:text-3xl">
            업로드 없이, 내 PC에서 처리되는 문서 툴킷
          </h2>
          <p className="text-sm text-muted md:text-base">
            AllToolbox는 파일을 서버에 올리지 않고(기본 모드), 브라우저에서 바로 변환·편집을 수행하는 무료 문서 도구 모음입니다. 민감한 문서도 안심하고 처리할 수 있도록, 가능한 기능은 사용자의 기기에서 실행되도록 설계했습니다.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {trustCards.map((card) => {
            const Icon = card.icon;
            return (
              <article key={card.title} className="rounded-2xl bg-white p-6 shadow-soft">
                <div className="flex items-center gap-3">
                  <span className="rounded-xl bg-ember/10 p-2 text-emberDark" aria-hidden="true">
                    <Icon className="h-5 w-5" />
                  </span>
                  <h3 className="text-base font-semibold">{card.title}</h3>
                </div>
                <p className="mt-3 text-sm text-muted">{card.body}</p>
              </article>
            );
          })}
        </div>

        <div>
          <h3 className="text-base font-semibold">자주 찾는 도구</h3>
          <div className="mt-3 flex flex-wrap gap-2">
            {quickLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="rounded-full border border-line bg-white px-3 py-1 text-xs font-medium text-ink hover:border-ember"
              >
                {link.label}
              </Link>
            ))}
          </div>
        </div>

        <div className="grid gap-3">
          <h3 className="text-base font-semibold">홈 FAQ</h3>
          {faqs.map((item) => (
            <div key={item.q} className="rounded-2xl border border-line bg-white p-4">
              <p className="text-sm font-semibold">Q. {item.q}</p>
              <p className="mt-2 text-sm text-muted">A. {item.a}</p>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <Link
            href="/"
            className="btn-primary rounded-full px-6 py-2 text-sm font-semibold"
          >
            도구 전체 보기
          </Link>
          <Link href="/jpg-to-pdf" className="text-sm font-semibold text-emberDark">
            가장 인기있는 변환: JPG → PDF
          </Link>
        </div>
      </div>
    </section>
  );
}
