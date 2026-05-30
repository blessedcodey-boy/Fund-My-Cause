"use client";

import React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Navbar } from "@/components/layout/Navbar";
import { CampaignSelector } from "@/components/ui/CampaignSelector";
import { ComparisonTable } from "@/components/ui/ComparisonTable";
import { ComparisonChart } from "@/components/ui/ComparisonChart";
import { useComparison } from "@/context/ComparisonContext";
import { ALL_CAMPAIGNS } from "@/lib/campaigns";
import {
  Share2,
  X,
  ArrowLeft,
  GitCompare,
  BarChart3,
  Table2,
} from "lucide-react";
import { cn } from "@/lib/utils";

type ViewMode = "table" | "chart" | "both";

export default function ComparePage() {
  const { selected, clear, toggle } = useComparison();
  const router = useRouter();
  const [viewMode, setViewMode] = React.useState<ViewMode>("both");

  const campaigns = selected
    .map((id) => ALL_CAMPAIGNS.find((c) => c.id === id))
    .filter(Boolean) as typeof ALL_CAMPAIGNS;

  const handleShare = () => {
    const url = `${window.location.origin}/compare?ids=${selected.join(",")}`;
    navigator.clipboard.writeText(url).catch(() => {});
    alert("Comparison link copied to clipboard!");
  };

  if (campaigns.length === 0) {
    return (
      <main className="min-h-screen bg-[var(--color-background)] text-[var(--color-text-primary)]">
        <Navbar />
        <div className="max-w-4xl mx-auto px-6 py-24 text-center">
          <div className="mb-8">
            <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-[var(--color-surface)] border border-[var(--color-border)] flex items-center justify-center">
              <GitCompare
                size={32}
                className="text-[var(--color-text-muted)]"
              />
            </div>
            <h1 className="text-2xl font-bold mb-3 text-[var(--color-text-primary)]">
              Compare Campaigns
            </h1>
            <p className="text-[var(--color-text-muted)] mb-6 max-w-md mx-auto">
              Select up to 4 campaigns to compare their funding progress,
              goals, and performance side by side.
            </p>
          </div>

          {/* Inline campaign selector for empty state */}
          <div className="flex justify-center mb-6">
            <CampaignSelector />
          </div>

          <p className="text-sm text-[var(--color-text-muted)]">
            or{" "}
            <Link
              href="/campaigns"
              className="text-[var(--color-brand)] hover:text-[var(--color-brand-hover)] underline transition"
            >
              browse campaigns
            </Link>{" "}
            and use the compare checkbox
          </p>
        </div>
      </main>
    );
  }

  const VIEW_MODES: { label: string; value: ViewMode; icon: React.ReactNode }[] = [
    { label: "Both", value: "both", icon: null },
    { label: "Table", value: "table", icon: <Table2 size={14} /> },
    { label: "Chart", value: "chart", icon: <BarChart3 size={14} /> },
  ];

  return (
    <main className="min-h-screen bg-[var(--color-background)] text-[var(--color-text-primary)]">
      <Navbar />
      <div className="max-w-7xl mx-auto px-6 py-12">
        {/* Header */}
        <div className="flex items-center justify-between mb-8 flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.back()}
              aria-label="Go back"
              className="p-2 rounded-xl text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-elevated)] transition"
            >
              <ArrowLeft size={20} />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">
                Compare Campaigns
              </h1>
              <p className="text-sm text-[var(--color-text-muted)]">
                {campaigns.length} of 4 campaigns selected
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Campaign selector */}
            <CampaignSelector />

            {/* View mode toggle */}
            <div className="flex rounded-xl border border-[var(--color-border)] overflow-hidden">
              {VIEW_MODES.map((mode) => (
                <button
                  key={mode.value}
                  onClick={() => setViewMode(mode.value)}
                  aria-pressed={viewMode === mode.value}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-2 text-xs font-medium transition",
                    viewMode === mode.value
                      ? "bg-[var(--color-brand)] text-white"
                      : "bg-[var(--color-surface)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]",
                  )}
                >
                  {mode.icon}
                  {mode.label}
                </button>
              ))}
            </div>

            {/* Actions */}
            <button
              onClick={handleShare}
              aria-label="Share comparison"
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[var(--color-surface-elevated)] hover:bg-[var(--color-border-subtle)] text-sm text-[var(--color-text-secondary)] transition"
            >
              <Share2 size={14} /> Share
            </button>
            <button
              onClick={clear}
              aria-label="Clear all campaigns"
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[var(--color-surface-elevated)] hover:bg-[var(--color-border-subtle)] text-sm text-[var(--color-text-secondary)] transition"
            >
              <X size={14} /> Clear
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="space-y-8">
          {(viewMode === "table" || viewMode === "both") && (
            <ComparisonTable
              campaigns={campaigns}
              onRemove={(id) => toggle(id)}
            />
          )}

          {(viewMode === "chart" || viewMode === "both") && (
            <ComparisonChart campaigns={campaigns} />
          )}
        </div>

        {/* Footer hint */}
        <p className="text-xs text-[var(--color-text-muted)] mt-8 text-center">
          Select up to 4 campaigns from the{" "}
          <Link
            href="/campaigns"
            className="text-[var(--color-brand)] hover:underline"
          >
            campaigns page
          </Link>{" "}
          or use the &quot;Add Campaign&quot; button above to compare.
        </p>
      </div>
    </main>
  );
}
