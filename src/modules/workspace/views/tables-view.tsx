"use client";

import { useState, useEffect, useMemo } from "react";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Play, Database, Code2, TerminalSquare, Search } from "lucide-react";
import { toast } from "sonner";

interface SqlResult {
  rows: Record<string, unknown>[];
  rowCount: number;
  fields: string[];
}

interface PythonResult {
  prints: string;
  result: unknown;
  error: { message: string; traceback?: string } | null;
}

const getJson = async <T,>(url: string): Promise<T> => {
  const res = await fetch(url);
  const data = await res.json();
  if (!res.ok) throw new Error((data as { message?: string })?.message || "Failed");
  return data as T;
};

const postJson = async <T,>(url: string, body: unknown): Promise<T> => {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error((data as { message?: string })?.message || "Failed");
  return data as T;
};

export default function TablesView() {
  const params = useParams();
  const projectName = decodeURIComponent((params?.project as string) || "");
  const { data: session } = authClient.useSession();
  const userId = session?.user?.id;

  const { data: projects = [] } = useQuery<
    Array<{ id: string; name: string; neonApiKey?: string | null; role?: string }>
  >({
    queryKey: ["projects", userId],
    queryFn: () =>
      getJson(`/api/project/get-all?userId=${encodeURIComponent(userId!)}`),
    enabled: !!userId,
  });

  const currentProject = (
    projects as Array<{ id: string; name: string; neonApiKey?: string | null; role?: string }>
  ).find((p) => p.name === projectName);
  const projectId = currentProject?.id;
  const isViewer = currentProject?.role === "viewer";

  const { data: tableNames = [], isLoading: tablesLoading } = useQuery<string[]>({
    queryKey: ["neon-tables", projectId],
    queryFn: () =>
      getJson(`/api/neon/list-tables?projectId=${encodeURIComponent(projectId!)}`),
    enabled: !!projectId,
  });

  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [tableSearch, setTableSearch] = useState("");
  const [sqlQuery, setSqlQuery] = useState("");
  const [pythonCode, setPythonCode] = useState("");
  const [sqlOutput, setSqlOutput] = useState<SqlResult | null>(null);
  const [pythonOutput, setPythonOutput] = useState<PythonResult | null>(null);
  const [sqlRunning, setSqlRunning] = useState(false);
  const [pythonRunning, setPythonRunning] = useState(false);
  const [activeEditor, setActiveEditor] = useState<"sql" | "python">("sql");

  useEffect(() => {
    if (!selectedTable && (tableNames as string[]).length) {
      setSelectedTable((tableNames as string[])[0]);
    }
  }, [tableNames, selectedTable]);

  // get-table-data returns a plain array of rows
  const { data: rawTableRows } = useQuery<Record<string, unknown>[]>({
    queryKey: ["table-data", projectId, selectedTable],
    queryFn: () =>
      getJson(
        `/api/neon/get-table-data?projectId=${encodeURIComponent(
          projectId!
        )}&tableName=${encodeURIComponent(selectedTable!)}&limit=100`
      ),
    enabled: !!projectId && !!selectedTable,
  });

  // Derive column names from the first row
  const tableFields = useMemo(
    () => (rawTableRows && rawTableRows.length > 0 ? Object.keys(rawTableRows[0]) : []),
    [rawTableRows]
  );

  const pythonTemplate = useMemo(() => {
    const cs = currentProject?.neonApiKey?.trim();
    if (!cs) return "";
    return [
      "import psycopg2, pandas as pd",
      `DATABASE_URL = ${JSON.stringify(cs)}`,
      "conn = psycopg2.connect(DATABASE_URL)",
      `df = pd.read_sql('SELECT * FROM ${selectedTable || "your_table"} LIMIT 100', conn)`,
      "print(df.head())",
      'result = df.to_dict(orient="records")',
      "conn.close()",
    ].join("\n");
  }, [currentProject?.neonApiKey, selectedTable]);

  useEffect(() => {
    if (pythonTemplate && !pythonCode) setPythonCode(pythonTemplate);
  }, [pythonTemplate, pythonCode]);

  const runSql = async () => {
    if (!projectId || !sqlQuery.trim()) return;
    if (isViewer) {
      toast.error("Viewers cannot run SQL queries");
      return;
    }
    setSqlRunning(true);
    try {
      const result = await postJson<SqlResult>("/api/neon/run-sql", {
        projectId,
        query: sqlQuery,
      });
      setSqlOutput(result);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "SQL error");
    } finally {
      setSqlRunning(false);
    }
  };

  const runPython = async () => {
    if (!projectId || !pythonCode.trim()) return;
    if (isViewer) {
      toast.error("Viewers cannot run Python code");
      return;
    }
    setPythonRunning(true);
    try {
      const result = await postJson<PythonResult>("/api/python/execute", {
        projectId,
        code: pythonCode,
      });
      setPythonOutput(result);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Python error");
    } finally {
      setPythonRunning(false);
    }
  };

  const filteredTables = (tableNames as string[]).filter((t) =>
    t.toLowerCase().includes(tableSearch.toLowerCase())
  );

  return (
    <div className="flex h-full">
      {/* Table list sidebar */}
      <div className="w-48 shrink-0 border-r border-gray-800/60 flex flex-col bg-[#0f0f0f]">
        <div className="p-2 border-b border-gray-800/40">
          <div className="relative">
            <Search className="absolute left-2 top-2 h-3.5 w-3.5 text-gray-500" />
            <Input
              value={tableSearch}
              onChange={(e) => setTableSearch(e.target.value)}
              placeholder="Filter tables..."
              className="pl-7 h-7 text-xs bg-black/40 border-gray-700 text-white"
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto py-1">
          {tablesLoading ? (
            <p className="text-xs text-gray-500 px-3 py-2">Loading...</p>
          ) : filteredTables.length === 0 ? (
            <p className="text-xs text-gray-500 px-3 py-2">No tables</p>
          ) : (
            filteredTables.map((t) => (
              <button
                key={t}
                onClick={() => setSelectedTable(t)}
                className={`w-full text-left px-3 py-1.5 text-xs transition-colors flex items-center gap-2 ${
                  selectedTable === t
                    ? "bg-green-500/10 text-green-400"
                    : "text-gray-400 hover:text-white hover:bg-white/5"
                }`}
              >
                <Database className="h-3 w-3 shrink-0" />
                <span className="truncate">{t}</span>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Main area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Data viewer */}
        <div className="flex-1 overflow-auto border-b border-gray-800/40 min-h-0">
          {selectedTable && rawTableRows ? (
            tableFields.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow className="border-gray-800">
                    {tableFields.map((f) => (
                      <TableHead
                        key={f}
                        className="text-gray-400 text-xs whitespace-nowrap"
                      >
                        {f}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rawTableRows.map((row, i) => (
                    <TableRow key={i} className="border-gray-800/40 hover:bg-white/[0.02]">
                      {tableFields.map((f) => (
                        <TableCell
                          key={f}
                          className="text-xs text-gray-300 whitespace-nowrap max-w-xs truncate"
                        >
                          {row[f] === null ? (
                            <span className="text-gray-600 italic">null</span>
                          ) : (
                            String(row[f])
                          )}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="flex items-center justify-center h-full text-gray-500 text-sm">
                Table is empty
              </div>
            )
          ) : (
            <div className="flex items-center justify-center h-full text-gray-500 text-sm">
              {selectedTable ? "Loading data..." : "Select a table"}
            </div>
          )}
        </div>

        {/* Editor area */}
        <div className="h-64 flex flex-col border-t border-gray-800/40 shrink-0">
          {/* Tab bar */}
          <div className="flex items-center border-b border-gray-800/40 px-3 gap-1 bg-[#0f0f0f] shrink-0">
            <button
              onClick={() => setActiveEditor("sql")}
              className={`flex items-center gap-1.5 px-3 py-2 text-xs border-b-2 transition-colors ${
                activeEditor === "sql"
                  ? "border-green-400 text-green-400"
                  : "border-transparent text-gray-500 hover:text-white"
              }`}
            >
              <Code2 className="h-3.5 w-3.5" />
              SQL
            </button>
            <button
              onClick={() => setActiveEditor("python")}
              className={`flex items-center gap-1.5 px-3 py-2 text-xs border-b-2 transition-colors ${
                activeEditor === "python"
                  ? "border-blue-400 text-blue-400"
                  : "border-transparent text-gray-500 hover:text-white"
              }`}
            >
              <TerminalSquare className="h-3.5 w-3.5" />
              Python
            </button>
            <div className="flex-1" />
            <Button
              size="sm"
              onClick={activeEditor === "sql" ? runSql : runPython}
              disabled={
                isViewer ||
                (activeEditor === "sql" ? sqlRunning : pythonRunning)
              }
              className="h-6 px-3 text-xs bg-green-500/10 border border-green-500/30 text-green-400 hover:bg-green-500/20"
            >
              <Play className="h-3 w-3 mr-1" />
              {activeEditor === "sql"
                ? sqlRunning
                  ? "Running..."
                  : "Run SQL"
                : pythonRunning
                ? "Running..."
                : "Run Python"}
            </Button>
          </div>

          <div className="flex flex-1 min-h-0">
            {/* Code editor */}
            <Textarea
              value={activeEditor === "sql" ? sqlQuery : pythonCode}
              onChange={(e) =>
                activeEditor === "sql"
                  ? setSqlQuery(e.target.value)
                  : setPythonCode(e.target.value)
              }
              placeholder={
                activeEditor === "sql"
                  ? "SELECT * FROM your_table LIMIT 100;"
                  : "# Write Python code here\nresult = {'data': []}"
              }
              className="flex-1 font-mono text-xs bg-black/40 border-0 border-r border-gray-800/40 text-white resize-none rounded-none focus-visible:ring-0 focus-visible:ring-offset-0"
            />

            {/* Output panel */}
            <div className="w-72 overflow-auto text-xs font-mono p-2 text-gray-300 bg-black/20 shrink-0">
              {activeEditor === "sql" && sqlOutput && (
                <div>
                  <p className="text-green-400 mb-1">{sqlOutput.rowCount} rows</p>
                  <pre className="text-gray-400 overflow-auto whitespace-pre-wrap">
                    {JSON.stringify(sqlOutput.rows.slice(0, 5), null, 2)}
                  </pre>
                </div>
              )}
              {activeEditor === "python" && pythonOutput && (
                <div>
                  {pythonOutput.error ? (
                    <p className="text-red-400">{pythonOutput.error.message}</p>
                  ) : (
                    <>
                      {pythonOutput.prints && (
                        <pre className="text-gray-300 whitespace-pre-wrap">
                          {pythonOutput.prints}
                        </pre>
                      )}
                      <pre className="text-green-400 whitespace-pre-wrap">
                        {JSON.stringify(pythonOutput.result, null, 2)?.slice(0, 500)}
                      </pre>
                    </>
                  )}
                </div>
              )}
              {!sqlOutput && !pythonOutput && (
                <span className="text-gray-600">Output appears here...</span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
