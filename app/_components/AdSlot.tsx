"use client";

export default function AdSlot({
  slotId,
  className
}: {
  slotId: string;
  className?: string;
}) {
  const client = process.env.NEXT_PUBLIC_ADSENSE_CLIENT;
  const slotMap: Record<string, string | undefined> = {
    TOP: process.env.NEXT_PUBLIC_ADSENSE_SLOT_TOP,
    SIDE: process.env.NEXT_PUBLIC_ADSENSE_SLOT_SIDE,
    FOOTER: process.env.NEXT_PUBLIC_ADSENSE_SLOT_FOOTER
  };
  const slot = slotMap[slotId];

  if (!client || !slot) {
    return (
      <div
        className={`rounded-xl border border-dashed border-line bg-fog p-4 text-center text-xs text-muted ${
          className ?? ""
        }`}
      >
        Ad slot ({slotId})
      </div>
    );
  }

  return (
    <ins
      className={`adsbygoogle ${className ?? ""}`}
      style={{ display: "block" }}
      data-ad-client={client}
      data-ad-slot={slot}
      data-ad-format="auto"
      data-full-width-responsive="true"
    />
  );
}
