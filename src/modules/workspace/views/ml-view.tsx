"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { authClient } from "@/lib/auth-client";
import { Brain, Network } from "lucide-react";
import { SmartFillDialog } from "@/modules/home/smart-fill-dialog";
import { AprioriDialog } from "@/modules/home/apriori-dialog";

const getJson = async <T,>(url: string): Promise<T> => {
  const res = await fetch(url);
  const data = await res.json();
  if (!res.ok) throw new Error(data?.message || "Failed");
  return data as T;
};

// ---------- SmartFillSection ----------

interface SmartFillSectionProps {
  projectId: string;
  rows: Record<string, unknown>[];
  columns: string[];
  tableName: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

function SmartFillSection({
  projectId,
  rows,
  columns,
  tableName,
  open,
  onOpenChange,
}: SmartFillSectionProps) {
  return (
    <div className="bg-[#111] border border-gray-800 rounded-xl p-6">
      <div className="flex items-start gap-3 mb-4">
        <Brain className="h-5 w-5 text-green-400 mt-0.5 shrink-0" />
        <div>
          <h2 className="text-white font-semibold text-sm mb-1">Smart Fill — AI Prediction</h2>
          <p className="text-gray-400 text-xs leading-relaxed">
            Select a column that contains missing values. XBase trains a machine-learning model
            using all other columns as features and predicts the unknown values — then lets you
            apply them with a single SQL statement.
          </p>
        </div>
      </div>
      <button
        onClick={() => onOpenChange(true)}
        disabled={columns.length === 0}
        className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-green-500/10 border border-green-500/30 text-green-400 hover:bg-green-500/20 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
      >
        <Brain className="h-4 w-4" />
        Open Smart Fill
      </button>
      <SmartFillDialog
        open={open}
        onOpenChange={onOpenChange}
        projectId={projectId}
        rows={rows}
        columns={columns}
        tableName={tableName}
      />
    </div>
  );
}

// ---------- AprioriSection ----------

interface AprioriSectionProps {
  projectId: string;
  rows: Record<string, unknown>[];
  columns: string[];
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

function AprioriSection({
  projectId,
  rows,
  columns,
  open,
  onOpenChange,
}: AprioriSectionProps) {
  return (
    <div className="bg-[#111] border border-gray-800 rounded-xl p-6">
      <div className="flex items-start gap-3 mb-4">
        <Network className="h-5 w-5 text-purple-400 mt-0.5 shrink-0" />
        <div>
          <h2 className="text-white font-semibold text-sm mb-1">Association Mining (Apriori)</h2>
          <p className="text-gray-400 text-xs leading-relaxed">
            Discover patterns and co-occurrences in your data. Select columns to mine, tune
            minimum support and confidence thresholds, and explore the resulting association
            rules and frequent itemsets.
          </p>
        </div>
      </div>
      <button
        onClick={() => onOpenChange(true)}
        disabled={columns.length === 0}
        className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-purple-500/10 border border-purple-500/30 text-purple-400 hover:bg-purple-500/20 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
      >
        <Network className="h-4 w-4" />
        Open Association Mining
      </button>
      <AprioriDialog
        open={open}
        onOpenChange={onOpenChange}
        projectId={projectId}
        rows={rows}
        columns={columns}
      />
    </div>
  );
}

// ---------- MlView ----------

export default function MlView() {
  const params = useParams();
  const projectName = decodeURIComponent((params?.project as string) || "");
  const { data: session } = authClient.useSession();
  const userId = session?.user?.id;
  const [activeTab, setActiveTab] = useState<"smartfill" | "apriori">("smartfill");
  const [smartFillOpen, setSmartFillOpen] = useState(false);
  const [aprioriOpen, setAprioriOpen] = useState(false);
  const [selectedTable, setSelectedTable] = useState<string | null>(null);

  const { data: projects = [] } = useQuery<
    Array<{ id: string; name: string; neonApiKey?: string | null; role?: string }>
  >({
    queryKey: ["projects", userId],
    queryFn: () =>
      getJson(`/api/project/get-all?userId=${encodeURIComponent(userId!)}`),
    enabled: !!userId,
  });

  const project = (
    projects as Array<{ id: string; name: string; neonApiKey?: string | null; role?: string }>
  ).find((p) => p.name === projectName);
  const projectId = project?.id;

  const { data: tableNames = [] } = useQuery<string[]>({
    queryKey: ["neon-tables", projectId],
    queryFn: () =>
      getJson(`/api/neon/list-tables?projectId=${encodeURIComponent(projectId!)}`),
    enabled: !!projectId,
  });

  const { data: rawTableData } = useQuery<Record<string, unknown>[]>({
    queryKey: ["table-data-ml", projectId, selectedTable],
    queryFn: () =>
      getJson(
        `/api/neon/get-table-data?projectId=${encodeURIComponent(
          projectId!
        )}&tableName=${encodeURIComponent(selectedTable!)}&limit=500`
      ),
    enabled: !!projectId && !!selectedTable,
  });

  // Derive fields from first row keys
  const tableFields =
    rawTableData && rawTableData.length > 0 ? Object.keys(rawTableData[0]) : [];

  return (
    <div className="max-w-3xl mx-auto p-6">
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setActiveTab("smartfill")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            activeTab === "smartfill"
              ? "bg-green-500/10 text-green-400 border border-green-500/30"
              : "text-gray-500 hover:text-white border border-gray-800"
          }`}
        >
          <Brain className="h-4 w-4" />
          Smart Fill
        </button>
        <button
          onClick={() => setActiveTab("apriori")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            activeTab === "apriori"
              ? "bg-purple-500/10 text-purple-400 border border-purple-500/30"
              : "text-gray-500 hover:text-white border border-gray-800"
          }`}
        >
          <Network className="h-4 w-4" />
          Association Mining
        </button>
      </div>

      {(tableNames as string[]).length > 0 && (
        <div className="mb-4">
          <label className="text-xs text-gray-400 mb-1 block">Select Table</label>
          <select
            value={selectedTable ?? ""}
            onChange={(e) => setSelectedTable(e.target.value || null)}
            className="bg-black/40 border border-gray-700 text-white text-sm rounded px-3 py-2 w-full max-w-xs"
          >
            <option value="">-- choose table --</option>
            {(tableNames as string[]).map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
      )}

      {!projectId ? (
        <p className="text-gray-500 text-sm">Loading project...</p>
      ) : !selectedTable ? (
        <p className="text-gray-500 text-sm">Select a table above to continue</p>
      ) : activeTab === "smartfill" ? (
        <SmartFillSection
          projectId={projectId}
          rows={rawTableData ?? []}
          columns={tableFields}
          tableName={selectedTable}
          open={smartFillOpen}
          onOpenChange={setSmartFillOpen}
        />
      ) : (
        <AprioriSection
          projectId={projectId}
          rows={rawTableData ?? []}
          columns={tableFields}
          open={aprioriOpen}
          onOpenChange={setAprioriOpen}
        />
      )}
    </div>
  );
}
