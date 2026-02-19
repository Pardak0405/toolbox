"use client";

import { X } from "lucide-react";

export default function ProgressModal({
  open,
  progress,
  status,
  onCancel
}: {
  open: boolean;
  progress: number;
  status: string;
  onCancel?: () => void;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-float">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">Processing</h3>
          {onCancel ? (
            <button onClick={onCancel} className="text-muted">
              <X className="h-5 w-5" />
            </button>
          ) : null}
        </div>
        <p className="mt-2 text-sm text-muted">{status}</p>
        <div className="mt-4 h-2 w-full rounded-full bg-fog">
          <div
            className="h-2 rounded-full bg-ember"
            style={{ width: `${progress}%` }}
          />
        </div>
        <p className="mt-2 text-xs text-muted">{progress}% complete</p>
      </div>
    </div>
  );
}
