"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Zap, Copy, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface OptimizerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  query: string;
}

interface OptimizationResult {
  suggestions: string[];
  estimatedImprovement: string;
  rewrittenQuery: string | null;
  explainJson: Record<string, unknown>;
}

export function QueryOptimizerDialog({
  open,
  onOpenChange,
  projectId,
  query,
}: OptimizerDialogProps) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<OptimizationResult | null>(null);

  const handleOptimize = async () => {
    if (!query.trim()) {
      toast.error("Please enter a query first");
      return;
    }

    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/query/optimize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, query }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Optimization failed");

      setResult(data);
      toast.success("Optimization analysis complete");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Optimization failed");
    } finally {
      setLoading(false);
    }
  };

  const handleCopyQuery = () => {
    if (result?.rewrittenQuery) {
      navigator.clipboard.writeText(result.rewrittenQuery);
      toast.success("Optimized query copied");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#0b0b0b] border-gray-800 text-white sm:max-w-2xl rounded-2xl">
        <div className="h-1 w-full bg-gradient-to-r from-transparent via-yellow-400 to-transparent opacity-50 absolute top-0 left-0" />
        <div className="p-6">
          <DialogHeader className="mb-4">
            <DialogTitle className="flex items-center gap-2 text-xl">
              <Zap className="h-5 w-5 text-yellow-400" />
              Query Optimizer
            </DialogTitle>
            <p className="text-sm text-zinc-400 mt-2">
              AI analysis of your query performance with optimization suggestions
            </p>
          </DialogHeader>

          <div className="space-y-4">
            {/* Query display */}
            <div className="bg-black/30 border border-white/10 rounded-lg p-3">
              <p className="text-xs text-zinc-400 mb-1">Current Query</p>
              <pre className="text-xs text-zinc-300 font-mono overflow-x-auto whitespace-pre-wrap">
                {query.slice(0, 200)}
              </pre>
            </div>

            {/* Results */}
            {result && (
              <div className="space-y-3 bg-black/20 border border-yellow-500/20 rounded-lg p-3">
                {/* Improvement estimate */}
                <div>
                  <p className="text-xs text-zinc-400 mb-2">Estimated Improvement</p>
                  <div className="bg-yellow-500/10 border border-yellow-500/30 rounded px-3 py-2">
                    <p className="text-sm font-mono text-yellow-300">
                      {result.estimatedImprovement}
                    </p>
                  </div>
                </div>

                {/* Suggestions */}
                {result.suggestions.length > 0 && (
                  <div>
                    <p className="text-xs text-zinc-400 mb-2">Recommendations</p>
                    <ul className="space-y-1">
                      {result.suggestions.map((s, i) => (
                        <li key={i} className="text-xs text-zinc-300 flex gap-2">
                          <span className="text-yellow-400">•</span> {s}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Rewritten query */}
                {result.rewrittenQuery && (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs text-zinc-400">Rewritten Query</p>
                      <Button
                        size="sm"
                        onClick={handleCopyQuery}
                        className="h-6 text-xs bg-black/40 border border-gray-700 hover:border-yellow-400/40"
                      >
                        <Copy className="h-3 w-3 mr-1" /> Copy
                      </Button>
                    </div>
                    <pre className="text-xs text-yellow-300 font-mono bg-black/40 p-2 rounded overflow-x-auto">
                      {result.rewrittenQuery}
                    </pre>
                  </div>
                )}
              </div>
            )}

            {/* Action button */}
            <Button
              onClick={handleOptimize}
              disabled={loading || !query}
              className="w-full bg-yellow-500/10 border border-yellow-500/40 text-yellow-300 hover:bg-yellow-500/20"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Analyzing...
                </>
              ) : (
                <>
                  <Zap className="h-4 w-4 mr-2" /> Optimize Query
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
