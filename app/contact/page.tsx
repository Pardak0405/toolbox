import { BRAND } from "@/config/brand";

export default function ContactPage() {
  return (
    <div className="py-10">
      <section className="rounded-3xl bg-white p-8 shadow-soft">
        <h1 className="font-display text-3xl">Contact</h1>
        <div className="mt-4 space-y-4 text-sm text-muted">
          <p>
            기술 문의, 버그 신고, 제휴 제안은 아래 이메일로 보내주세요.
          </p>
          <p>
            <span className="font-semibold text-slate-800">Support Email:</span>{" "}
            {BRAND.supportEmail}
          </p>
          <p>
            문의 시 사용한 툴 주소(예: /merge-pdf), 브라우저 정보, 오류 메시지를
            함께 보내주시면 처리 속도가 빨라집니다.
          </p>
          <p>
            파일 원본 전달이 필요한 경우에도 민감정보는 사전 마스킹을 권장합니다.
          </p>
        </div>
      </section>
    </div>
  );
}
