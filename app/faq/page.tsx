import { BRAND } from "@/config/brand";

export default function FaqPage() {
  const faqs = [
    {
      q: `${BRAND.name}는 무료인가요?`,
      a: "핵심 브라우저 기능은 무료로 제공합니다. 별도 설치 없이 주요 변환을 바로 실행할 수 있습니다."
    },
    {
      q: "파일이 서버로 업로드되나요?",
      a: "기본 모드에서는 업로드된 파일이 브라우저에서 처리됩니다. 서버 업로드는 기본 동작이 아닙니다."
    },
    {
      q: "대용량 파일은 어떻게 처리하나요?",
      a: "파일 용량이 크면 처리 시간이 길어질 수 있습니다. 페이지 범위를 나누거나 옵션을 조정해 단계적으로 처리하는 것을 권장합니다."
    },
    {
      q: "광고는 어디에 표시되나요?",
      a: "광고는 상단·사이드·푸터 등 고정 영역에만 표시하며, 도구 실행 버튼이나 핵심 입력 영역을 가리지 않습니다."
    },
    {
      q: "문서 변환 품질이 낮으면 어떻게 하나요?",
      a: "옵션(품질/해상도/페이지 범위)을 먼저 조정하고, 결과가 부족하면 해상도를 높이거나 페이지 범위를 줄여 재시도해 보세요."
    },
    {
      q: "문의는 어디로 보내나요?",
      a: `${BRAND.supportEmail}로 툴 주소, 브라우저 버전, 오류 메시지를 함께 보내주시면 빠르게 확인할 수 있습니다.`
    }
  ];

  return (
    <div className="py-10">
      <section className="rounded-3xl bg-white p-8 shadow-soft">
        <h1 className="font-display text-3xl">FAQ</h1>
        <p className="mt-3 text-sm text-muted">
          서비스 운영, 보안, 광고 정책과 관련해 자주 묻는 질문을 정리했습니다.
        </p>
        <div className="mt-4 space-y-3">
          {faqs.map((item) => (
            <details key={item.q} className="rounded-2xl border border-line bg-fog p-4">
              <summary className="cursor-pointer text-sm font-semibold">
                {item.q}
              </summary>
              <p className="mt-2 text-sm text-muted">{item.a}</p>
            </details>
          ))}
        </div>
      </section>
    </div>
  );
}
