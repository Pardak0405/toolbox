import { BRAND } from "@/config/brand";

export default function AboutPage() {
  return (
    <div className="py-10">
      <section className="rounded-3xl bg-white p-8 shadow-soft">
        <h1 className="font-display text-3xl">About {BRAND.name}</h1>
        <p className="mt-4 text-sm text-muted">
          {BRAND.name} is a modern document toolkit for fast, reliable file
          workflows. {BRAND.slogan}
        </p>
      </section>
    </div>
  );
}
