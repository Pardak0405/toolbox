import { BRAND } from "@/config/brand";

export default function ContactPage() {
  return (
    <div className="py-10">
      <section className="rounded-3xl bg-white p-8 shadow-soft">
        <h1 className="font-display text-3xl">Contact</h1>
        <p className="mt-4 text-sm text-muted">
          Reach us at {BRAND.supportEmail} for partnership or support.
        </p>
      </section>
    </div>
  );
}
