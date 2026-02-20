import { BRAND } from "@/config/brand";

export default function AboutPage() {
  return (
    <div className="py-10">
      <section className="rounded-3xl bg-white p-8 shadow-soft">
        <h1 className="font-display text-3xl">About {BRAND.name}</h1>
        <p className="mt-4 text-sm text-muted">{BRAND.slogan}</p>
        <div className="mt-6 space-y-4 text-sm text-muted">
          <p>
            {BRAND.name}는 PDF 정리, 변환, 보안 작업을 빠르게 처리할 수 있도록
            만든 문서 도구 웹앱입니다. 단순 기능 제공을 넘어서 각 툴 페이지에서
            “언제 쓰는지”, “어떻게 쓰는지”, “결과가 기대와 다를 때 어떻게
            해결하는지”를 함께 안내하는 것을 운영 원칙으로 삼고 있습니다.
          </p>
          <p>
            사이트는 카테고리 탐색, 검색, 관련 툴 추천 중심으로 설계되어 반복적인
            문서 업무를 짧은 단계로 줄이는 데 초점을 둡니다. 기능은 지속적으로
            개선하되, 사용자 경험과 콘텐츠 신뢰도를 함께 관리합니다.
          </p>
          <p>
            문의/제휴 제안/오류 신고는 {BRAND.supportEmail}로 받습니다. 접수된
            이슈는 재현 가능 여부와 영향 범위를 기준으로 우선순위를 정해 순차
            반영합니다.
          </p>
        </div>
      </section>
    </div>
  );
}
