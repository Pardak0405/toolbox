import { BRAND } from "@/config/brand";

export default function PrivacyPage() {
  return (
    <div className="py-10">
      <section className="rounded-3xl bg-white p-8 shadow-soft">
        <h1 className="font-display text-3xl">Privacy</h1>
        <div className="mt-4 space-y-4 text-sm text-muted">
          <p>
            {BRAND.name}의 기본 처리 모드는 브라우저 내부 처리입니다. 사용자가
            업로드한 파일은 서버로 전송되지 않으며, 브라우저 세션에서만 사용됩니다.
          </p>
          <p>
            사용자가 명시적으로 로컬 엔진 기능을 사용할 때만 로컬 PC의
            127.0.0.1 엔진으로 파일이 전달됩니다. 이 경우에도 외부 서버 업로드는
            발생하지 않습니다.
          </p>
          <p>
            사이트는 서비스 운영에 필요한 최소한의 기술 정보(오류 로그, 성능
            지표)를 수집할 수 있으며, 문서 원본 내용 자체를 수집하거나 판매하지
            않습니다.
          </p>
          <p>
            광고는 사용자 경험을 방해하지 않는 제한된 영역에서만 노출되며, 광고
            정책 및 브라우저 설정에 따라 개인화 여부가 달라질 수 있습니다.
          </p>
        </div>
      </section>
    </div>
  );
}
