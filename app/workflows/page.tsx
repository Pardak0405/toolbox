"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { allTools } from "@/tools/registry";
import { BRAND } from "@/config/brand";
import { sanitizeText } from "@/lib/sanitize";
import {
  validateToolOptionsWithZod,
  workflowQuerySchema
} from "@/lib/validation";

const STORAGE_KEY = "toolbox-workflow";

function encodeSteps(steps: string[]) {
  const payload = JSON.stringify(steps);
  return btoa(unescape(encodeURIComponent(payload)));
}

function decodeSteps(value: string) {
  try {
    const decoded = decodeURIComponent(escape(atob(value)));
    const parsed = JSON.parse(decoded);
    const validated = validateToolOptionsWithZod(workflowQuerySchema, {
      steps: parsed
    });
    if (!validated.ok) return [];
    return validated.data.steps;
  } catch {
    return [];
  }
}

export default function WorkflowsPage() {
  const [steps, setSteps] = useState<string[]>([]);
  const [name, setName] = useState("My workflow");
  const [message, setMessage] = useState("");
  const [origin, setOrigin] = useState("");

  useEffect(() => {
    setOrigin(window.location.origin);
    const params = new URLSearchParams(window.location.search);
    const rawName = params.get("name");
    const encoded = params.get("steps");
    if (rawName || encoded) {
      const steps = encoded ? decodeSteps(encoded) : [];
      const validated = validateToolOptionsWithZod(workflowQuerySchema, {
        name: rawName ?? undefined,
        steps
      });
      if (validated.ok) {
        if (validated.data.name) setName(validated.data.name);
        setSteps(validated.data.steps);
      } else {
        setName("My workflow");
        setSteps([]);
      }
      return;
    }

    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (!saved) return;
    try {
      const parsed = JSON.parse(saved) as { name?: string; steps?: string[] };
      if (parsed.name) setName(sanitizeText(parsed.name, 80));
      if (Array.isArray(parsed.steps)) setSteps(parsed.steps);
    } catch {
      // Ignore invalid local storage payloads.
    }
  }, []);

  const shareUrl = useMemo(() => {
    if (!origin) return "";
    const params = new URLSearchParams();
    params.set("name", name);
    params.set("steps", encodeSteps(steps));
    const query = params.toString();
    return `${origin}/workflows?${query}`;
  }, [name, steps, origin]);

  const runPath = useMemo(() => {
    if (steps.length === 0) return "/";
    return `/${steps[0]}`;
  }, [steps]);

  const addStep = (slug: string) => {
    setSteps((prev) => [...prev, slug]);
    setMessage("");
  };

  const removeStep = (index: number) => {
    setSteps((prev) => prev.filter((_, current) => current !== index));
  };

  const saveWorkflow = () => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ name: sanitizeText(name, 80), steps })
    );
    setMessage("워크플로우가 브라우저에 저장되었습니다.");
  };

  const copyShareLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setMessage("공유 링크를 복사했습니다.");
    } catch {
      setMessage("클립보드 접근에 실패했습니다. 링크를 수동 복사해 주세요.");
    }
  };

  return (
    <div className="py-10">
      <section className="rounded-3xl bg-white p-8 shadow-soft">
        <h1 className="font-display text-3xl">Workflows</h1>
        <p className="mt-3 text-sm text-muted">
          {BRAND.slogan} 워크플로우를 단계별로 저장하고 공유하세요.
        </p>
        <div className="mt-6 grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <div>
            <label className="text-sm font-semibold">Workflow name</label>
            <input
              value={name}
              onChange={(event) => setName(sanitizeText(event.target.value, 80))}
              className="mt-2 w-full rounded-lg border border-line px-3 py-2 text-sm"
            />
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {allTools.map((tool) => (
                <button
                  key={tool.id}
                  onClick={() => addStep(tool.slug)}
                  className="rounded-xl border border-line bg-fog px-3 py-2 text-left text-xs"
                >
                  <p className="font-semibold">{tool.title}</p>
                  <p className="text-muted">{tool.category}</p>
                </button>
              ))}
            </div>
          </div>
          <div className="rounded-2xl border border-line bg-fog p-4">
            <h4 className="font-semibold">Workflow steps</h4>
            <ol className="mt-3 space-y-2 text-sm">
              {steps.length === 0 ? (
                <p className="text-sm text-muted">단계를 추가해 주세요.</p>
              ) : (
                steps.map((step, index) => (
                  <li key={`${step}-${index}`} className="flex items-center justify-between gap-3">
                    <span>{index + 1}. {step}</span>
                    <button
                      type="button"
                      className="rounded border border-line px-2 py-1 text-xs"
                      onClick={() => removeStep(index)}
                    >
                      삭제
                    </button>
                  </li>
                ))
              )}
            </ol>
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                onClick={saveWorkflow}
                className="rounded-full border border-line px-4 py-2 text-xs"
              >
                Save
              </button>
              <button
                onClick={copyShareLink}
                disabled={steps.length === 0 || !shareUrl}
                className="rounded-full border border-line px-4 py-2 text-xs disabled:opacity-50"
              >
                Copy share link
              </button>
              <Link
                href={runPath}
                className="rounded-full bg-ember px-4 py-2 text-xs font-semibold text-white"
              >
                Run first step
              </Link>
              <button
                onClick={() => {
                  setSteps([]);
                  setMessage("");
                }}
                className="rounded-full border border-line px-4 py-2 text-xs"
              >
                Clear
              </button>
            </div>
            <div className="mt-6 rounded-xl border border-line bg-white p-3 text-xs text-muted break-all">
              Shareable link:
              <p className="mt-1 font-mono">{steps.length > 0 ? shareUrl : "단계 추가 후 링크 생성"}</p>
            </div>
            {message ? <p className="mt-3 text-xs text-emerald-700">{message}</p> : null}
          </div>
        </div>
      </section>
    </div>
  );
}
