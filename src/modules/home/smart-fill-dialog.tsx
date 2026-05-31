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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Loader2, TrendingUp } from "lucide-react";
import { toast } from "sonner";

interface Prediction {
  row_index: number;
  predicted_value: string | number;
}

interface SmartFillResult {
  predictions: Prediction[];
  filled_rows: Record<string, unknown>[];
  fields: string[];
  metrics: {
    n_missing: number;
    n_filled: number;
    n_training_rows: number;
    model_type: string;
    top_features: Array<{ feature: string; importance: number }>;
    message?: string;
  };
  model_type: string;
}

interface SmartFillDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  projectId: string;
  rows: Record<string, unknown>[];
  columns: string[];
  tableName: string;
}

export function SmartFillDialog({
  open,
  onOpenChange,
  projectId,
  rows,
  columns,
  tableName,
}: SmartFillDialogProps) {
  const [targetColumn, setTargetColumn] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SmartFillResult | null>(null);

  const handleRun = async () => {
    if (!targetColumn) {
      toast.error("Select a target column first");
      return;
    }
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/smart-fill", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, rows, targetColumn }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Smart fill failed");
      setResult(data);
      if (data.metrics?.n_filled > 0) {
        toast.success(`Predicted ${data.metrics.n_filled} missing values`);
      } else {
        toast.info(data.metrics?.message || "No missing values found");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Smart fill failed");
    } finally {
      setLoading(false);
    }
  };

  const handleCopySQL = () => {
    if (!result || result.predictions.length === 0) return;
    const lines = result.predictions
      .map((p) => {
        const val =
          typeof p.predicted_value === "string"
            ? `'${p.predicted_value.replace(/'/g, "''")}'`
            : p.predicted_value;
        return `  WHEN ctid = (SELECT ctid FROM "${tableName}" OFFSET ${p.row_index} LIMIT 1) THEN ${val}`;
      })
      .join("\n");
    const sql = `UPDATE "${tableName}" SET "${targetColumn}" = CASE\n${lines}\nEND\nWHERE "${targetColumn}" IS NULL;`;
    navigator.clipboard.writeText(sql);
    toast.success("SQL UPDATE copied to clipboard");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#0b0b0b] border-gray-800 text-white sm:max-w-2xl shadow-2xl p-0 overflow-hidden rounded-2xl">
        <div className="h-1 w-full bg-gradient-to-r from-transparent via-neon-green to-transparent opacity-50 absolute top-0 left-0" />
        <div className="p-6">
          <DialogHeader className="mb-5">
            <DialogTitle className="text-xl font-bold text-white flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-neon-green" />
              Smart Fill — AI Prediction
            </DialogTitle>
            <p className="text-sm text-zinc-400 mt-1">
              Select a column with missing values. XBase trains a model using
              all other columns to predict the unknown values.
            </p>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <label className="text-xs text-zinc-400 mb-1.5 block">
                Target Column (has missing values)
              </label>
              <Select value={targetColumn} onValueChange={setTargetColumn}>
                <SelectTrigger className="bg-black/40 border-gray-700 text-white">
                  <SelectValue placeholder="Select column to predict..." />
                </SelectTrigger>
                <SelectContent className="bg-[#111] border-gray-700 text-white">
                  {columns.map((col) => (
                    <SelectItem
                      key={col}
                      value={col}
                      className="hover:bg-white/5"
                    >
                      {col}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between">
              <p className="text-xs text-zinc-500">
                {rows.length} rows · {columns.length} features
              </p>
              <Button
                onClick={handleRun}
                disabled={loading || !targetColumn}
                className="bg-neon-green/10 border border-neon-green/40 text-neon-green hover:bg-neon-green/20 hover:border-neon-green/60"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />
                    Predicting...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-3.5 w-3.5 mr-2" />
                    Run Smart Fill
                  </>
                )}
              </Button>
            </div>

            {result && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-3"
              >
                <div className="grid grid-cols-3 gap-2">
                  <div className="bg-black/30 border border-white/10 rounded-lg p-3 text-center">
                    <div className="text-lg font-bold text-neon-green">
                      {result.metrics.n_filled}
                    </div>
                    <div className="text-xs text-zinc-400">Values Filled</div>
                  </div>
                  <div className="bg-black/30 border border-white/10 rounded-lg p-3 text-center">
                    <div className="text-lg font-bold text-white">
                      {result.metrics.n_training_rows}
                    </div>
                    <div className="text-xs text-zinc-400">Training Rows</div>
                  </div>
                  <div className="bg-black/30 border border-white/10 rounded-lg p-3 text-center">
                    <div className="text-sm font-bold text-blue-400 capitalize">
                      {result.model_type}
                    </div>
                    <div className="text-xs text-zinc-400">Model Type</div>
                  </div>
                </div>

                {result.metrics.top_features &&
                  result.metrics.top_features.length > 0 && (
                    <div className="bg-black/20 border border-white/10 rounded-lg p-3">
                      <div className="flex items-center gap-1.5 mb-2">
                        <TrendingUp className="h-3.5 w-3.5 text-zinc-400" />
                        <span className="text-xs text-zinc-400 font-medium">
                          Top Predictive Features
                        </span>
                      </div>
                      <div className="space-y-1.5">
                        {result.metrics.top_features.map((f) => (
                          <div key={f.feature} className="flex items-center gap-2">
                            <span className="text-xs text-zinc-300 w-24 truncate">
                              {f.feature}
                            </span>
                            <div className="flex-1 bg-white/5 rounded-full h-1.5">
                              <div
                                className="bg-neon-green/60 h-1.5 rounded-full"
                                style={{ width: `${f.importance * 100}%` }}
                              />
                            </div>
                            <span className="text-xs text-zinc-500">
                              {(f.importance * 100).toFixed(1)}%
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                {result.predictions.length > 0 && (
                  <div className="bg-black/20 border border-white/10 rounded-lg p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs text-zinc-400 font-medium">
                        Predicted Values Preview
                      </span>
                      <Button
                        size="sm"
                        onClick={handleCopySQL}
                        className="h-6 text-xs bg-black/40 border border-gray-700 text-zinc-300 hover:border-neon-green/40"
                      >
                        Copy SQL UPDATE
                      </Button>
                    </div>
                    <div className="max-h-36 overflow-y-auto space-y-1">
                      {result.predictions.slice(0, 20).map((p) => (
                        <div
                          key={p.row_index}
                          className="flex items-center gap-2 text-xs"
                        >
                          <Badge
                            variant="outline"
                            className="text-zinc-500 border-gray-700 text-xs py-0"
                          >
                            Row {p.row_index}
                          </Badge>
                          <span className="text-neon-green font-mono">
                            {String(p.predicted_value)}
                          </span>
                        </div>
                      ))}
                      {result.predictions.length > 20 && (
                        <p className="text-xs text-zinc-500">
                          ...and {result.predictions.length - 20} more
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </motion.div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
