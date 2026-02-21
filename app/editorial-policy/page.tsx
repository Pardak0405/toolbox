import { BRAND } from "@/config/brand";

export default function EditorialPolicyPage() {
  return (
    <div className="py-10">
      <section className="rounded-3xl bg-white p-8 shadow-soft">
        <h1 className="font-display text-3xl">콘텐츠 운영 원칙</h1>
        <p className="mt-4 text-sm text-muted">
          {BRAND.name}는 문서 처리 기능만 제공하는 도구 모음이 아니라, 사용자가
          실제로 문제를 해결할 수 있는 가이드형 콘텐츠를 함께 제공합니다. 각 툴
          페이지에는 기능 설명, 사용 방법, 주의사항, FAQ, 관련 작업 링크를
          포함해 단순 버튼형 페이지가 되지 않도록 운영합니다.
        </p>
        <div className="mt-6 space-y-4 text-sm text-muted">
          <p>
            1) 중복 콘텐츠를 피합니다. 카테고리/도구별로 목적과 사용 사례를 다르게
            작성하고, 같은 문구를 반복하지 않도록 주기적으로 점검합니다.
          </p>
          <p>
            2) 과장된 표현을 피합니다. 제공 가능한 기능 범위와 제한을 명확히
            표시하며, 브라우저 처리 범위와 제한을 명확히 안내합니다.
          </p>
          <p>
            3) 사용자 중심 탐색을 우선합니다. 홈에서 카테고리, 검색, 관련 툴
            추천으로 원하는 기능에 빠르게 접근할 수 있도록 설계합니다.
          </p>
          <p>
            4) 광고와 콘텐츠의 균형을 유지합니다. 광고는 상단/사이드/푸터의
            고정된 영역에만 배치하고, 핵심 기능 사용 흐름을 방해하지 않습니다.
          </p>
          <p>
            5) 정책 페이지를 상시 공개합니다. 개인정보 처리, 이용약관, 문의 채널,
            FAQ를 공개해 사용자 신뢰를 확보하고 투명한 운영을 지향합니다.
          </p>
        </div>
      </section>
    </div>
  );
}
