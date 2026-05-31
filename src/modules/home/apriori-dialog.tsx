"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { GitBranch, Loader2, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface AssociationRule {
  antecedents: string[];
  consequents: string[];
  support: number;
  confidence: number;
  lift: number;
}

interface FrequentItemset {
  itemset: string[];
  support: number;
}

interface AprioriResult {
  frequent_itemsets: FrequentItemset[];
  rules: AssociationRule[];
  metrics: {
    n_transactions: number;
    n_items: number;
    n_frequent_itemsets: number;
    n_rules: number;
    message?: string;
  };
}

interface AprioriDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  projectId: string;
  rows: Record<string, unknown>[];
  columns: string[];
}

export function AprioriDialog({
  open,
  onOpenChange,
  projectId,
  rows,
  columns,
}: AprioriDialogProps) {
  const [selectedColumns, setSelectedColumns] = useState<string[]>([]);
  const [minSupport, setMinSupport] = useState(0.1);
  const [minConfidence, setMinConfidence] = useState(0.5);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AprioriResult | null>(null);
  const [activeTab, setActiveTab] = useState<"rules" | "itemsets">("rules");

  const toggleColumn = (col: string) => {
    setSelectedColumns((prev) =>
      prev.includes(col) ? prev.filter((c) => c !== col) : [...prev, col],
    );
  };

  const handleRun = async () => {
    if (selectedColumns.length < 2) {
      toast.error("Select at least 2 columns");
      return;
    }
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/apriori", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          rows,
          columns: selectedColumns,
          minSupport,
          minConfidence,
          minLift: 1.0,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Apriori failed");
      setResult(data);
      toast.success(`Found ${data.metrics.n_rules} association rules`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Apriori failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#0b0b0b] border-gray-800 text-white sm:max-w-3xl shadow-2xl p-0 overflow-hidden rounded-2xl max-h-[85vh] flex flex-col">
        <div className="h-1 w-full bg-gradient-to-r from-transparent via-purple-400 to-transparent opacity-50 absolute top-0 left-0" />
        <div className="p-6 overflow-y-auto flex-1">
          <DialogHeader className="mb-5">
            <DialogTitle className="text-xl font-bold text-white flex items-center gap-2">
              <GitBranch className="h-5 w-5 text-purple-400" />
              Association Mining (Apriori)
            </DialogTitle>
            <p className="text-sm text-zinc-400 mt-1">
              Discover patterns and associations between values in your data.
            </p>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-zinc-400 mb-2 block">
                Select Columns ({selectedColumns.length} selected)
              </label>
              <div className="bg-black/20 border border-white/10 rounded-lg p-3 max-h-48 overflow-y-auto space-y-1.5">
                {columns.map((col) => (
                  <label
                    key={col}
                    className="flex items-center gap-2 cursor-pointer hover:bg-white/5 rounded px-1 py-0.5"
                  >
                    <input
                      type="checkbox"
                      checked={selectedColumns.includes(col)}
                      onChange={() => toggleColumn(col)}
                      className="rounded border-gray-600 bg-black/40 text-purple-400 focus:ring-purple-400/20"
                    />
                    <span className="text-xs text-zinc-300 truncate">{col}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs text-zinc-400 mb-2 block">
                  Min Support:{" "}
                  <span className="text-white font-mono">
                    {minSupport.toFixed(2)}
                  </span>
                </label>
                <Slider
                  value={[minSupport]}
                  onValueChange={([v]) => setMinSupport(v)}
                  min={0.01}
                  max={0.9}
                  step={0.01}
                  className="w-full"
                />
                <p className="text-xs text-zinc-600 mt-1">
                  Fraction of rows that must contain the itemset
                </p>
              </div>
              <div>
                <label className="text-xs text-zinc-400 mb-2 block">
                  Min Confidence:{" "}
                  <span className="text-white font-mono">
                    {minConfidence.toFixed(2)}
                  </span>
                </label>
                <Slider
                  value={[minConfidence]}
                  onValueChange={([v]) => setMinConfidence(v)}
                  min={0.01}
                  max={1.0}
                  step={0.01}
                  className="w-full"
                />
                <p className="text-xs text-zinc-600 mt-1">
                  How often the rule is correct
                </p>
              </div>

              <Button
                onClick={handleRun}
                disabled={loading || selectedColumns.length < 2}
                className="w-full bg-purple-500/10 border border-purple-500/40 text-purple-300 hover:bg-purple-500/20 hover:border-purple-400/60"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />
                    Mining...
                  </>
                ) : (
                  <>
                    <GitBranch className="h-3.5 w-3.5 mr-2" />
                    Run Apriori
                  </>
                )}
              </Button>
            </div>
          </div>

          {result && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-4 space-y-3"
            >
              <div className="grid grid-cols-4 gap-2">
                {[
                  { label: "Transactions", value: result.metrics.n_transactions },
                  { label: "Items", value: result.metrics.n_items },
                  { label: "Itemsets", value: result.metrics.n_frequent_itemsets },
                  { label: "Rules", value: result.metrics.n_rules, accent: true },
                ].map((m) => (
                  <div
                    key={m.label}
                    className="bg-black/30 border border-white/10 rounded-lg p-2.5 text-center"
                  >
                    <div
                      className={`text-lg font-bold ${m.accent ? "text-purple-400" : "text-white"}`}
                    >
                      {m.value}
                    </div>
                    <div className="text-xs text-zinc-500">{m.label}</div>
                  </div>
                ))}
              </div>

              {result.metrics.message && (
                <p className="text-xs text-yellow-400 bg-yellow-400/10 border border-yellow-400/20 rounded-lg p-2.5">
                  {result.metrics.message}
                </p>
              )}

              <div className="flex gap-2">
                {(["rules", "itemsets"] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`text-xs px-3 py-1.5 rounded-lg border transition-colors capitalize ${
                      activeTab === tab
                        ? "bg-purple-500/20 border-purple-500/40 text-purple-300"
                        : "bg-black/20 border-white/10 text-zinc-400 hover:border-white/20"
                    }`}
                  >
                    {tab}
                  </button>
                ))}
              </div>

              {activeTab === "rules" && result.rules.length > 0 && (
                <div className="border border-white/10 rounded-lg overflow-hidden max-h-64 overflow-y-auto">
                  <Table className="text-xs">
                    <TableHeader>
                      <TableRow className="border-white/10">
                        <TableHead className="text-zinc-400 bg-black/40">If</TableHead>
                        <TableHead className="text-zinc-400 bg-black/40 w-6"></TableHead>
                        <TableHead className="text-zinc-400 bg-black/40">Then</TableHead>
                        <TableHead className="text-zinc-400 bg-black/40">Supp.</TableHead>
                        <TableHead className="text-zinc-400 bg-black/40">Conf.</TableHead>
                        <TableHead className="text-zinc-400 bg-black/40">Lift</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {result.rules.map((rule, i) => (
                        <TableRow key={i} className="border-white/5">
                          <TableCell className="text-zinc-200">
                            {rule.antecedents.join(", ")}
                          </TableCell>
                          <TableCell>
                            <ArrowRight className="h-3 w-3 text-zinc-600" />
                          </TableCell>
                          <TableCell className="text-purple-300">
                            {rule.consequents.join(", ")}
                          </TableCell>
                          <TableCell className="text-zinc-400 font-mono">
                            {(rule.support * 100).toFixed(1)}%
                          </TableCell>
                          <TableCell className="text-zinc-400 font-mono">
                            {(rule.confidence * 100).toFixed(1)}%
                          </TableCell>
                          <TableCell
                            className="font-mono"
                            style={{
                              color:
                                rule.lift > 2
                                  ? "#4ade80"
                                  : rule.lift > 1.5
                                    ? "#fbbf24"
                                    : "#9ca3af",
                            }}
                          >
                            {rule.lift.toFixed(2)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}

              {activeTab === "itemsets" && result.frequent_itemsets.length > 0 && (
                <div className="max-h-64 overflow-y-auto space-y-1.5">
                  {result.frequent_itemsets.slice(0, 30).map((is, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between bg-black/20 border border-white/5 rounded-lg px-3 py-2"
                    >
                      <div className="flex flex-wrap gap-1">
                        {is.itemset.map((item) => (
                          <Badge
                            key={item}
                            variant="outline"
                            className="text-xs border-gray-700 text-zinc-300"
                          >
                            {item}
                          </Badge>
                        ))}
                      </div>
                      <span className="text-xs text-zinc-500 font-mono ml-2">
                        {(is.support * 100).toFixed(1)}%
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
