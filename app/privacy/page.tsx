import { BRAND } from "@/config/brand";

export default function PrivacyPage() {
  return (
    <div className="py-10">
      <section className="rounded-3xl bg-white p-8 shadow-soft">
        <h1 className="font-display text-3xl">Privacy</h1>
        <p className="mt-4 text-sm text-muted">
          {BRAND.name} processes files in your browser by default. Files are never
          uploaded unless you choose to use the local engine.
        </p>
      </section>
    </div>
  );
}
