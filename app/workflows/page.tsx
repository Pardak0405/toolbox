"use client";

import { useState } from "react";
import { allTools } from "@/tools/registry";

export default function WorkflowsPage() {
  const [steps, setSteps] = useState<string[]>([]);
  const [name, setName] = useState("My workflow");

  return (
    <div className="py-10">
      <section className="rounded-3xl bg-white p-8 shadow-soft">
        <h1 className="font-display text-3xl">Workflows</h1>
        <p className="mt-3 text-sm text-muted">
          Chain multiple tools together and share the workflow with your team.
        </p>
        <div className="mt-6 grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <div>
            <label className="text-sm font-semibold">Workflow name</label>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="mt-2 w-full rounded-lg border border-line px-3 py-2 text-sm"
            />
            <div className="mt-4 grid grid-cols-2 gap-3">
              {allTools.map((tool) => (
                <button
                  key={tool.id}
                  onClick={() => setSteps((prev) => [...prev, tool.title])}
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
                <p className="text-sm text-muted">Select tools to add steps.</p>
              ) : (
                steps.map((step, index) => (
                  <li key={`${step}-${index}`}>{index + 1}. {step}</li>
                ))
              )}
            </ol>
            <button
              onClick={() => setSteps([])}
              className="mt-4 rounded-full border border-line px-4 py-2 text-xs"
            >
              Clear workflow
            </button>
            <div className="mt-6 rounded-xl border border-line bg-white p-3 text-xs text-muted">
              Shareable link (preview):
              <p className="mt-1 font-mono">https://docforge.local/workflows/{name.toLowerCase().replace(/\s+/g, "-")}</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
