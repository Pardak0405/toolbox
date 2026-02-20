"use client";

import { ToolOptionField } from "@/tools/registry";
import { sanitizeText } from "@/lib/sanitize";

export default function OptionsPanel({
  schema,
  options,
  onChange
}: {
  schema: ToolOptionField[];
  options: Record<string, unknown>;
  onChange: (next: Record<string, unknown>) => void;
}) {
  return (
    <div className="rounded-2xl border border-line bg-white p-5">
      <h4 className="font-semibold">Options</h4>
      <div className="mt-4 space-y-4">
        {schema.map((field) => {
          const value = options[field.id] ?? field.defaultValue;
          switch (field.type) {
            case "select":
              return (
                <label key={field.id} className="block text-sm">
                  <span className="font-medium">{field.label}</span>
                  <select
                    className="mt-2 w-full rounded-lg border border-line px-3 py-2"
                    value={String(value)}
                    onChange={(event) =>
                      onChange({ ...options, [field.id]: event.target.value })
                    }
                  >
                    {field.options?.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  {field.help ? (
                    <p className="mt-1 text-xs text-muted">{field.help}</p>
                  ) : null}
                </label>
              );
            case "checkbox":
              return (
                <label key={field.id} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={Boolean(value)}
                    onChange={(event) =>
                      onChange({ ...options, [field.id]: event.target.checked })
                    }
                  />
                  <span>{field.label}</span>
                </label>
              );
            case "number":
              return (
                <label key={field.id} className="block text-sm">
                  <span className="font-medium">{field.label}</span>
                  <input
                    type="number"
                    className="mt-2 w-full rounded-lg border border-line px-3 py-2"
                    min={field.min}
                    max={field.max}
                    step={field.step}
                    value={Number(value)}
                    onChange={(event) =>
                      onChange({
                        ...options,
                        [field.id]: Number(event.target.value)
                      })
                    }
                  />
                  {field.help ? (
                    <p className="mt-1 text-xs text-muted">{field.help}</p>
                  ) : null}
                </label>
              );
            case "color":
              return (
                <label key={field.id} className="block text-sm">
                  <span className="font-medium">{field.label}</span>
                  <input
                    type="color"
                    className="mt-2 h-10 w-full rounded-lg border border-line"
                    value={String(value)}
                    onChange={(event) =>
                      onChange({ ...options, [field.id]: sanitizeText(event.target.value, 160) })
                    }
                  />
                </label>
              );
            default:
              return (
                <label key={field.id} className="block text-sm">
                  <span className="font-medium">{field.label}</span>
                  <input
                    type="text"
                    className="mt-2 w-full rounded-lg border border-line px-3 py-2"
                    placeholder={field.placeholder}
                    value={String(value ?? "")}
                    onChange={(event) =>
                      onChange({
                        ...options,
                        [field.id]: sanitizeText(event.target.value, 500)
                      })
                    }
                  />
                  {field.help ? (
                    <p className="mt-1 text-xs text-muted">{field.help}</p>
                  ) : null}
                </label>
              );
          }
        })}
      </div>
    </div>
  );
}
