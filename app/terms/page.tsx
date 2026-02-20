import { BRAND } from "@/config/brand";

export default function TermsPage() {
  return (
    <div className="py-10">
      <section className="rounded-3xl bg-white p-8 shadow-soft">
        <h1 className="font-display text-3xl">Terms</h1>
        <div className="mt-4 space-y-4 text-sm text-muted">
          <p>
            {BRAND.name}를 사용하면, 업로드한 파일에 대한 적법한 처리 권한이
            본인에게 있음을 확인한 것으로 간주합니다.
          </p>
          <p>
            사용자는 불법 콘텐츠, 타인의 권리를 침해하는 자료, 악성코드가 포함된
            파일을 서비스에 사용해서는 안 됩니다.
          </p>
          <p>
            브라우저 및 로컬 환경의 제약으로 인해 일부 변환은 결과 품질 차이가
            발생할 수 있습니다. 중요한 문서는 결과 검수 후 배포하는 것을 권장합니다.
          </p>
          <p>
            서비스 안정성을 위해 파일 크기/개수/처리 시간 제한이 적용될 수 있으며,
            제한 초과 시 처리가 중단될 수 있습니다.
          </p>
        </div>
      </section>
    </div>
  );
}
