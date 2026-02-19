export default function FaqPage() {
  return (
    <div className="py-10">
      <section className="rounded-3xl bg-white p-8 shadow-soft">
        <h1 className="font-display text-3xl">FAQ</h1>
        <div className="mt-4 space-y-3">
          {[
            "Is DocForge free?",
            "Do you store my files?",
            "How do I use the local engine?"
          ].map((question) => (
            <details key={question} className="rounded-2xl border border-line bg-fog p-4">
              <summary className="cursor-pointer text-sm font-semibold">
                {question}
              </summary>
              <p className="mt-2 text-sm text-muted">
                Browser mode keeps files in your session only. Local engine is
                optional for high-fidelity conversions.
              </p>
            </details>
          ))}
        </div>
      </section>
    </div>
  );
}
