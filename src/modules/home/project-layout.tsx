"use client";

import { motion } from "framer-motion";
import { useState, useEffect, useRef, useMemo } from "react";
import { ChatInterface } from "./chat-interface";
import { Button } from "@/components/ui/button";
import {
  Plus,
  Sparkles,
  Database,
  ChevronRight,
  Users,
  Code2,
  TerminalSquare,
  Play,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { authClient } from "@/lib/auth-client";
import { toast } from "sonner";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { ImperativePanelHandle } from "react-resizable-panels";

interface ProjectListItem {
  id: string;
  name: string;
  neonApiKey?: string | null;
  chatId?: string | null;
  hostName?: string | null;
  isOwner?: boolean;
  role?: "owner" | "editor" | "viewer";
}

interface ChatListItem {
  role: "user" | "assistant";
  content: string;
  createdAt: string;
  data_location?: {
    fileName?: string;
    bucket?: string;
    path?: string;
    imageFileName?: string;
    imageBucket?: string;
    imagePath?: string;
    output?: unknown;
  };
}

interface ChatResponse {
  chatId: string | null;
  chatName: string | null;
  messages: ChatListItem[];
}

interface AgentListResponse {
  activeChatId: string | null;
  agents: Array<{ id: string; name: string }>;
}

interface SqlExecutionResult {
  rows: Record<string, unknown>[];
  rowCount: number;
  fields: string[];
}

interface PythonExecutionResult {
  prints: string;
  result: unknown;
  error: { message: string; traceback?: string } | null;
}

const getJson = async <T,>(url: string): Promise<T> => {
  const response = await fetch(url, { method: "GET" });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data?.message || "Request failed");
  }
  return data as T;
};

const postJson = async <T,>(url: string, body: unknown): Promise<T> => {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data?.message || "Request failed");
  }
  return data as T;
};

export function ProjectLayout() {
  const params = useParams();
  const currentProjectName = decodeURIComponent(
    (params?.project as string) || "",
  );
  const [open, setOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [name, setName] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [optimisticUserMessage, setOptimisticUserMessage] =
    useState<ChatListItem | null>(null);
  const [quickAskOpen, setQuickAskOpen] = useState(false);
  const [quickAskText, setQuickAskText] = useState("");
  const [quickAskContext, setQuickAskContext] = useState<
    "tables" | "table" | null
  >(null);
  const dashboardPanelRef = useRef<ImperativePanelHandle>(null);
  const dashboardCloseTimer = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const [tableSearch, setTableSearch] = useState("");
  const [pythonDialogOpen, setPythonDialogOpen] = useState(false);
  const [sqlDialogOpen, setSqlDialogOpen] = useState(false);
  const [pythonCode, setPythonCode] = useState("");
  const [sqlQuery, setSqlQuery] = useState("");
  const [pythonOutput, setPythonOutput] =
    useState<PythonExecutionResult | null>(null);
  const [sqlOutput, setSqlOutput] = useState<SqlExecutionResult | null>(null);
  const [pythonRunError, setPythonRunError] = useState<string | null>(null);
  const [sqlRunError, setSqlRunError] = useState<string | null>(null);
  const [pythonRunning, setPythonRunning] = useState(false);
  const [sqlRunning, setSqlRunning] = useState(false);
  const [collaborateOpen, setCollaborateOpen] = useState(false);
  const [collaborateInput, setCollaborateInput] = useState("");
  const [collaborateBusy, setCollaborateBusy] = useState(false);
  const [connectOpen, setConnectOpen] = useState(false);
  const [apiKeys, setApiKeys] = useState<
    Array<{ id: string; apiKey: string; createdAt: string; isActive: boolean }>
  >([]);
  const [apiKeyBusy, setApiKeyBusy] = useState(false);
  const [apiKeyError, setApiKeyError] = useState<string | null>(null);

  const { data: session } = authClient.useSession();
  const userId = session?.user?.id;
  const queryClient = useQueryClient();

  const { data: projects, refetch } = useQuery({
    queryKey: ["projects", userId],
    queryFn: () =>
      getJson<ProjectListItem[]>(
        `/api/project/get-all?userId=${encodeURIComponent(userId!)}`,
      ),
    enabled: !!userId,
  });
  const projectList = (projects ?? []) as ProjectListItem[];

  const currentProject = projectList.find((p) => p.name === currentProjectName);
  const projectId = currentProject?.id;
  const pythonTemplate = useMemo(() => {
    const connectionString = currentProject?.neonApiKey?.trim();
    if (!connectionString) return "";
    const safeUrl = JSON.stringify(connectionString);
    return [
      "import psycopg2",
      "import pandas as pd",
      "",
      `DATABASE_URL = ${safeUrl}`,
      "",
      "conn = psycopg2.connect(DATABASE_URL)",
      "query = \"SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name;\"",
      "df = pd.read_sql(query, conn)",
      "print(df.head())",
      "",
      'result = df.to_dict(orient="records")',
      "conn.close()",
      "",
    ].join("\n");
  }, [currentProject?.neonApiKey]);

  const { data: chatData, refetch: refetchChat } = useQuery({
    queryKey: ["chat", projectId],
    queryFn: () =>
      getJson<ChatResponse>(
        `/api/chat/get-chat?projectId=${encodeURIComponent(projectId!)}`,
      ),
    enabled: !!projectId,
  });

  const { data: agentData, refetch: refetchAgents } = useQuery({
    queryKey: ["chat-agents", projectId],
    queryFn: () =>
      getJson<AgentListResponse>(
        `/api/chat/list-agents?projectId=${encodeURIComponent(projectId!)}`,
      ),
    enabled: !!projectId,
  });

  const { data: tableNames, isLoading: tablesLoading } = useQuery({
    queryKey: ["neon-tables", projectId],
    queryFn: () =>
      getJson<string[]>(
        `/api/neon/list-tables?projectId=${encodeURIComponent(projectId!)}`,
      ),
    enabled: !!projectId,
  });
  const [selectedTable, setSelectedTable] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedTable && tableNames?.length) {
      setSelectedTable(tableNames[0]);
    }
  }, [selectedTable, tableNames]);

  useEffect(() => {
    if (dashboardPanelRef.current) {
      dashboardPanelRef.current.collapse();
    }
  }, []);

  useEffect(() => {
    if (pythonDialogOpen && !pythonCode.trim() && pythonTemplate) {
      setPythonCode(pythonTemplate);
    }
  }, [pythonDialogOpen, pythonCode, pythonTemplate]);

  useEffect(() => {
    if (sqlDialogOpen && !sqlQuery.trim()) {
      const defaultQuery = selectedTable
        ? `SELECT * FROM "${selectedTable}" LIMIT 20;`
        : "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name;";
      setSqlQuery(defaultQuery);
    }
  }, [sqlDialogOpen, sqlQuery, selectedTable]);

  const { data: tableRows, isLoading: tableRowsLoading } = useQuery({
    queryKey: ["table-data", projectId, selectedTable],
    queryFn: () =>
      getJson<Record<string, unknown>[]>(
        `/api/neon/get-table-data?projectId=${encodeURIComponent(
          projectId!,
        )}&tableName=${encodeURIComponent(selectedTable || "")}&limit=200`,
      ),
    enabled: !!projectId && !!selectedTable,
  });

  const createProject = useMutation({
    mutationFn: (payload: {
      name: string;
      neonApiKey: string;
      userId: string;
    }) =>
      postJson<{ project: ProjectListItem; chat: { id: string } }>(
        "/api/project/create",
        payload,
      ),
    onSuccess: () => {
      toast.success("Project created!");
      setOpen(false);
      setName("");
      setApiKey("");
      refetch();
      queryClient.invalidateQueries({ queryKey: ["projects", userId] });
    },
    onError: (err) => {
      toast.error(
        err instanceof Error ? err.message : "Failed to create project",
      );
    },
  });

  const sendMessage = useMutation({
    mutationFn: (payload: { projectId: string; message: string }) =>
      postJson<{
        userMessage: { role: "user"; content: string; createdAt: string };
        aiMessage: {
          role: "assistant";
          content: string;
          createdAt: string;
          data_location?: ChatListItem["data_location"];
        };
      }>("/api/chat/send-message", payload),
    onMutate: (payload) => {
      setOptimisticUserMessage({
        role: "user",
        content: payload.message,
        createdAt: new Date().toISOString(),
      });
    },
    onSuccess: (data) => {
      // Keep optimistic message until the query updates
      refetchChat().then(() => {
        setOptimisticUserMessage(null);
      });
      queryClient.invalidateQueries({ queryKey: ["chat", projectId] });
    },
    onError: (err) => {
      setOptimisticUserMessage(null);
      toast.error(
        err instanceof Error ? err.message : "Failed to send message",
      );
    },
  });

  const deleteHistory = useMutation({
    mutationFn: (payload: { projectId: string }) =>
      postJson<{ chatId: string; deletedMessages: number }>(
        "/api/chat/delete-history",
        payload,
      ),
    onSuccess: () => {
      refetchChat();
      queryClient.invalidateQueries({ queryKey: ["chat", projectId] });
    },
    onError: (err) => {
      toast.error(
        err instanceof Error ? err.message : "Failed to delete history",
      );
    },
  });

  const createAgent = useMutation({
    mutationFn: (payload: { projectId: string; name: string }) =>
      postJson<{ chatId: string; chatName: string }>(
        "/api/chat/create-agent",
        payload,
      ),
    onSuccess: () => {
      refetchChat();
      refetchAgents();
      queryClient.invalidateQueries({ queryKey: ["chat", projectId] });
    },
    onError: (err) => {
      toast.error(
        err instanceof Error ? err.message : "Failed to create agent",
      );
    },
  });

  const setActiveAgent = useMutation({
    mutationFn: (payload: { projectId: string; chatId: string }) =>
      postJson<{ chatId: string }>("/api/chat/set-active", payload),
    onSuccess: () => {
      refetchChat();
      refetchAgents();
      queryClient.invalidateQueries({ queryKey: ["chat", projectId] });
    },
    onError: (err) => {
      toast.error(
        err instanceof Error ? err.message : "Failed to switch agent",
      );
    },
  });

  const renameAgent = useMutation({
    mutationFn: (payload: {
      projectId: string;
      chatId: string;
      name: string;
    }) =>
      postJson<{ chatId: string; chatName: string }>(
        "/api/chat/rename-agent",
        payload,
      ),
    onSuccess: () => {
      refetchChat();
      refetchAgents();
    },
    onError: (err) => {
      toast.error(
        err instanceof Error ? err.message : "Failed to rename agent",
      );
    },
  });

  const handleCreate = () => {
    if (!userId) return;
    const trimmedApiKey = apiKey.trim();
    createProject.mutate({
      name,
      neonApiKey: trimmedApiKey,
      userId,
    });
  };

  const handleSendMessage = (text: string) => {
    if (!projectId) return;
    sendMessage.mutate({
      projectId,
      message: text,
    });
  };

  const handleDeleteHistory = () => {
    if (!projectId) return;
    deleteHistory.mutate({ projectId });
  };

  const handleCreateAgent = (agentLabel: string) => {
    if (!projectId || !agentLabel.trim()) return;
    createAgent.mutate({ projectId, name: agentLabel.trim() });
  };

  const handleSelectAgent = (chatId: string) => {
    if (!projectId) return;
    setActiveAgent.mutate({ projectId, chatId });
  };

  const handleRenameAgent = (chatId: string, name: string) => {
    if (!projectId || !name.trim()) return;
    renameAgent.mutate({ projectId, chatId, name: name.trim() });
  };

  const handleDashboardEnter = () => {
    if (dashboardCloseTimer.current) {
      clearTimeout(dashboardCloseTimer.current);
      dashboardCloseTimer.current = null;
    }
    dashboardPanelRef.current?.expand();
  };

  const handleDashboardLeave = () => {
    if (dashboardCloseTimer.current) {
      clearTimeout(dashboardCloseTimer.current);
    }
    dashboardCloseTimer.current = setTimeout(() => {
      dashboardPanelRef.current?.collapse();
    }, 250);
  };

  const openQuickAsk = (context: "tables" | "table") => {
    setQuickAskContext(context);
    setQuickAskOpen(true);
  };

  const submitQuickAsk = () => {
    if (!quickAskText.trim()) return;
    const contextPrefix =
      quickAskContext === "table" && selectedTable
        ? `Table: ${selectedTable}. `
        : quickAskContext === "tables"
          ? "Tables panel: "
          : "";
    handleSendMessage(`${contextPrefix}${quickAskText.trim()}`);
    setQuickAskText("");
    setQuickAskOpen(false);
  };

  const handleRunPython = async () => {
    if (!projectId || !pythonCode.trim()) return;
    setPythonRunning(true);
    setPythonRunError(null);
    setPythonOutput(null);
    try {
      const result = await postJson<PythonExecutionResult>(
        "/api/python/execute",
        {
          projectId,
          code: pythonCode,
        },
      );
      setPythonOutput(result);
    } catch (error) {
      setPythonRunError(
        error instanceof Error ? error.message : "Python execution failed",
      );
    } finally {
      setPythonRunning(false);
    }
  };

  const handleRunSql = async () => {
    if (!projectId || !sqlQuery.trim()) return;
    setSqlRunning(true);
    setSqlRunError(null);
    setSqlOutput(null);
    try {
      const result = await postJson<SqlExecutionResult>("/api/neon/run-sql", {
        projectId,
        query: sqlQuery,
      });
      setSqlOutput(result);
    } catch (error) {
      setSqlRunError(
        error instanceof Error ? error.message : "SQL execution failed",
      );
    } finally {
      setSqlRunning(false);
    }
  };

  const handleAddCollaborator = async () => {
    if (!projectId || !userId || !collaborateInput.trim()) return;
    setCollaborateBusy(true);
    try {
      await postJson<{ message: string }>("/api/project/add-collaborator", {
        projectId,
        ownerId: userId,
        identifier: collaborateInput.trim(),
      });
      toast.success("Collaborator added!");
      setCollaborateInput("");
      setCollaborateOpen(false);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to add collaborator",
      );
    } finally {
      setCollaborateBusy(false);
    }
  };

  const fetchApiKeys = async () => {
    if (!projectId) return;
    setApiKeyError(null);
    setApiKeyBusy(true);
    try {
      const response = await fetch(
        `/api/project/api-keys?projectId=${encodeURIComponent(projectId)}`,
      );
      const payload = await response.json();
      if (!response.ok || payload?.success === false) {
        throw new Error(payload?.error || "Failed to fetch keys");
      }
      setApiKeys(payload.data ?? []);
    } catch (error) {
      setApiKeyError(
        error instanceof Error ? error.message : "Failed to fetch keys",
      );
    } finally {
      setApiKeyBusy(false);
    }
  };

  const handleCreateApiKey = async () => {
    if (!projectId) return;
    setApiKeyError(null);
    setApiKeyBusy(true);
    try {
      const response = await fetch("/api/project/create-api-key", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId }),
      });
      const payload = await response.json();
      if (!response.ok || payload?.success === false) {
        throw new Error(payload?.error || "Failed to create key");
      }
      setApiKeys((prev) => [payload.data, ...prev]);
    } catch (error) {
      setApiKeyError(
        error instanceof Error ? error.message : "Failed to create key",
      );
    } finally {
      setApiKeyBusy(false);
    }
  };

  const displayedMessages = optimisticUserMessage
    ? [...((chatData?.messages as ChatListItem[]) || []), optimisticUserMessage]
    : (chatData?.messages as ChatListItem[]) || [];

  const filteredTables = (tableNames ?? []).filter((table) =>
    table.toLowerCase().includes(tableSearch.trim().toLowerCase()),
  );

  const renderRowsTable = (
    rows: Record<string, unknown>[],
    fields?: string[],
  ) => {
    if (!rows.length) return null;
    const headers = fields?.length ? fields : Object.keys(rows[0]);
    return (
      <div className="rounded-md border border-white/10 bg-black/25">
        <Table className="text-xs text-zinc-200">
          <TableHeader>
            <TableRow className="border-white/10">
              {headers.map((header) => (
                <TableHead
                  key={header}
                  className="text-zinc-200 bg-black/40 border-b border-white/10"
                >
                  {header}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row, rowIndex) => (
              <TableRow key={rowIndex} className="border-white/5">
                {headers.map((header) => (
                  <TableCell key={header} className="text-zinc-100">
                    {row[header] === null || row[header] === undefined
                      ? "-"
                      : String(row[header])}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    );
  };

  const renderPythonOutput = () => {
    if (!pythonOutput) return null;
    const result = pythonOutput.result as Record<string, unknown> | null;
    const imageBase64 =
      result && typeof result === "object"
        ? (result.image_base64 as string | undefined) ||
          (result.imageBase64 as string | undefined)
        : undefined;
    const imageMime =
      result && typeof result === "object"
        ? (result.image_mime as string | undefined) ||
          (result.imageMime as string | undefined) ||
          "image/png"
        : "image/png";
    const rows =
      result && typeof result === "object" && Array.isArray(result.rows)
        ? (result.rows as Record<string, unknown>[])
        : null;
    const fields =
      result && typeof result === "object" && Array.isArray(result.fields)
        ? (result.fields as string[])
        : undefined;

    return (
      <div className="space-y-3">
        {pythonOutput.prints && (
          <pre className="text-xs whitespace-pre-wrap text-emerald-200 bg-black/40 border border-white/10 rounded-md p-3">
            {pythonOutput.prints}
          </pre>
        )}
        {pythonOutput.error && (
          <div className="text-xs text-red-300 bg-red-500/10 border border-red-500/30 rounded-md p-3">
            {pythonOutput.error.message}
          </div>
        )}
        {rows && renderRowsTable(rows, fields)}
        {imageBase64 && (
          <div className="border border-white/10 rounded-md overflow-hidden">
            <img
              src={`data:${imageMime};base64,${imageBase64}`}
              alt="Python output"
              className="w-full h-auto"
            />
          </div>
        )}
        {!rows && !imageBase64 && pythonOutput.result !== undefined && (
          <pre className="text-xs whitespace-pre-wrap text-zinc-200 bg-black/30 border border-white/10 rounded-md p-3">
            {JSON.stringify(pythonOutput.result, null, 2)}
          </pre>
        )}
      </div>
    );
  };

  const CursorBackground = () => {
    const cursorRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
      const handleMouseMove = (e: MouseEvent) => {
        if (cursorRef.current) {
          cursorRef.current.style.background = `radial-gradient(600px circle at ${e.clientX}px ${e.clientY}px, rgba(74,222,128,0.07), transparent 40%)`;
        }
      };

      window.addEventListener("mousemove", handleMouseMove);
      return () => window.removeEventListener("mousemove", handleMouseMove);
    }, []);

    return (
      <div
        ref={cursorRef}
        className="pointer-events-none fixed inset-0 z-0 transition-colors duration-300"
      />
    );
  };

  return (
    <div className="h-screen w-full text-white pt-20 bg-[#0a0a0a] relative overflow-hidden">
      <div
        className="absolute inset-0 z-0 opacity-45"
        style={{
          background:
            "radial-gradient(circle at 8% 10%, rgba(74, 222, 128, 0.14), transparent 32%), radial-gradient(circle at 84% 18%, rgba(20, 184, 166, 0.1), transparent 28%), radial-gradient(circle at 50% 120%, rgba(34, 197, 94, 0.08), transparent 45%)",
        }}
      />
      <div
        className="absolute inset-0 z-0 opacity-30"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)",
          backgroundSize: "30px 30px",
        }}
      />
      <CursorBackground />

      <ResizablePanelGroup
        direction="horizontal"
        className="relative z-10 h-full w-full"
      >
        <ResizablePanel
          ref={dashboardPanelRef}
          defaultSize={20}
          minSize={12}
          maxSize={32}
          collapsible
          collapsedSize={3}
          onCollapse={() => setIsCollapsed(true)}
          onExpand={() => setIsCollapsed(false)}
          className="group relative bg-[#0f0f0f]/95 backdrop-blur-xl border-r border-gray-800/80 transition-all duration-300"
          onMouseEnter={handleDashboardEnter}
          onMouseLeave={handleDashboardLeave}
        >
          {/* Collapsed state indicator */}
          <div
            className={`absolute inset-0 flex flex-col items-center justify-center transition-opacity duration-300 z-10 ${
              isCollapsed ? "opacity-100" : "opacity-0 pointer-events-none"
            }`}
          >
            <span className="[writing-mode:vertical-lr] rotate-180 text-sm font-bold tracking-widest text-neutral-500 group-hover:text-neon-green transition-colors">
              DASHBOARD
            </span>
          </div>

          <div
            className={`h-full min-w-[240px] flex flex-col transition-opacity duration-150 ${
              isCollapsed ? "opacity-0 pointer-events-none" : "opacity-100"
            }`}
          >
            <div className="flex items-center justify-between px-4 py-4 border-b border-gray-800/80">
              <h2 className="text-sm font-semibold uppercase tracking-widest text-neutral-400">
                Dashboard
              </h2>
              <Dialog open={open} onOpenChange={setOpen}>
                <DialogTrigger asChild>
                  <Button
                    size="icon"
                    className="h-9 w-9 rounded-lg bg-black/40 border border-gray-800 text-neutral-300 hover:text-white hover:border-neon-green/60 hover:shadow-[0_0_12px_rgba(74,222,128,0.35)] transition-all duration-300"
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </DialogTrigger>
                <DialogContent className="bg-[#0b0b0b] border-gray-800 text-white sm:max-w-md shadow-2xl p-0 overflow-hidden rounded-2xl">
                  <div className="h-1 w-full bg-gradient-to-r from-transparent via-neon-green to-transparent opacity-50 absolute top-0 left-0" />
                  <div className="p-6">
                    <DialogHeader className="mb-6">
                      <DialogTitle className="text-2xl font-bold text-white flex items-center gap-2">
                        <Sparkles className="h-5 w-5 text-neon-green" />
                        New Project
                      </DialogTitle>
                    </DialogHeader>

                    <div className="space-y-6">
                      <div className="relative group">
                        <Input
                          id="name"
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          placeholder=" "
                          className="peer bg-[#111111] border-gray-800 focus:border-neon-green focus:ring-1 focus:ring-neon-green/50 text-white h-12 pt-4 pb-2 px-4 transition-all rounded-xl"
                        />
                        <Label
                          htmlFor="name"
                          className="absolute left-4 top-4 text-neutral-500 text-sm transition-all peer-focus:-top-2 peer-focus:text-xs peer-focus:text-neon-green peer-focus:bg-[#0b0b0b] peer-focus:px-1 peer-[:not(:placeholder-shown)]:-top-2 peer-[:not(:placeholder-shown)]:text-xs peer-[:not(:placeholder-shown)]:bg-[#0b0b0b] peer-[:not(:placeholder-shown)]:px-1 cursor-text"
                        >
                          Project Name
                        </Label>
                      </div>

                      <div className="relative group">
                        <Input
                          id="apikey"
                          value={apiKey}
                          onChange={(e) => setApiKey(e.target.value)}
                          placeholder=" "
                          type="password"
                          className="peer bg-[#111111] border-gray-800 focus:border-neon-green focus:ring-1 focus:ring-neon-green/50 text-white h-12 pt-4 pb-2 px-4 transition-all rounded-xl"
                        />
                        <Label
                          htmlFor="apikey"
                          className="absolute left-4 top-4 text-neutral-500 text-sm transition-all peer-focus:-top-2 peer-focus:text-xs peer-focus:text-neon-green peer-focus:bg-[#0b0b0b] peer-focus:px-1 peer-[:not(:placeholder-shown)]:-top-2 peer-[:not(:placeholder-shown)]:text-xs peer-[:not(:placeholder-shown)]:bg-[#0b0b0b] peer-[:not(:placeholder-shown)]:px-1 cursor-text"
                        >
                          Neon Connection String
                        </Label>
                      </div>
                    </div>
                  </div>

                  <div className="p-6 pt-0 mt-2">
                    <Button
                      onClick={handleCreate}
                      disabled={
                        createProject.isPending ||
                        !name.trim() ||
                        !apiKey.trim()
                      }
                      className="w-full h-12 neon-btn hover:bg-neon-green/95 font-bold text-base rounded-xl transition-all disabled:opacity-50 disabled:hover:shadow-none relative overflow-hidden group"
                    >
                      {createProject.isPending ? (
                        <span className="flex items-center gap-2">
                          <div className="w-4 h-4 rounded-full border-2 border-black/20 border-t-black animate-spin" />
                          Creating...
                        </span>
                      ) : (
                        <>
                          <span className="relative z-10">Launch Project</span>
                          <div className="absolute inset-0 bg-white/25 -translate-x-full group-hover:animate-neon-shimmer z-0" />
                        </>
                      )}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>

            <div className="flex-1 overflow-y-auto p-2 space-y-3 neon-scrollbar">
              {projectList.map((project, i) => (
                <Link key={project.id} href={`/${project.name}`}>
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{
                      delay: i * 0.04,
                      type: "spring",
                      stiffness: 280,
                      damping: 24,
                    }}
                    whileHover={{ y: -2 }}
                    className={`p-3 rounded-xl border transition-all duration-200 flex items-center justify-between group ${
                      currentProjectName === project.name
                        ? "border-neon-green/50 bg-neon-green/10 shadow-[0_0_20px_rgba(74,222,128,0.16)]"
                        : "border-gray-800 bg-[#121212] hover:border-neon-green/30 hover:bg-white/5"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-8 h-8 flex items-center justify-center rounded-lg ${
                          currentProjectName === project.name
                            ? "bg-neon-green/20 text-neon-green"
                            : "bg-white/5 text-neutral-500 group-hover:text-neon-green"
                        }`}
                      >
                        <Database className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <span className="text-sm font-semibold text-zinc-200 truncate block">
                          {project.name}
                        </span>
                        {project.hostName && (
                          <span className="text-[11px] text-neutral-500 block truncate">
                            Host: {project.hostName}
                          </span>
                        )}
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-neutral-600 group-hover:text-neon-green" />
                  </motion.div>
                </Link>
              ))}
              {!projectList.length && (
                <div className="text-center text-neutral-600 py-8 text-sm">
                  No projects yet.
                </div>
              )}
            </div>
          </div>
        </ResizablePanel>
        <ResizableHandle
          withHandle
          className="bg-transparent hover:bg-neon-green/15 transition-colors"
        />

        <ResizablePanel
          defaultSize={50}
          minSize={30}
          className="bg-gradient-to-b from-[#2b2100]/80 via-[#120c00]/90 to-[#0a0a0a] border-r border-[#3a2a12]"
        >
          <main className="h-full overflow-y-auto neon-scrollbar p-4">
            <div className="flex items-center justify-between mb-4 border border-[#5a4318]/70 bg-gradient-to-r from-[#3a2a00]/70 via-[#1a1200]/80 to-[#0f0f0f]/85 backdrop-blur-xl px-4 py-3">
              <div className="flex items-center gap-4">
                <div>
                  <div className="text-xs uppercase tracking-widest text-neutral-500">
                    Project
                  </div>
                  <div className="text-lg font-semibold text-zinc-100 mt-0.5">
                    {currentProjectName || "Select a project"}
                  </div>
                  {currentProject?.hostName && (
                    <div className="text-xs text-neutral-400 mt-1">
                      Host: {currentProject.hostName}
                    </div>
                  )}
                </div>
                {currentProject?.isOwner && (
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => setCollaborateOpen(true)}
                      className="h-9 px-3 rounded-full border border-neon-green/40 bg-black/30 text-neon-green hover:bg-neon-green/10"
                    >
                      <Users className="h-4 w-4 mr-2" />
                      Collaborate
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => {
                        setConnectOpen(true);
                        fetchApiKeys();
                      }}
                      className="h-9 px-3 rounded-full border border-blue-500/40 bg-black/30 text-blue-300 hover:bg-blue-500/10"
                    >
                      Connect
                    </Button>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-3">
                <div className="text-xs text-neutral-300 rounded-full bg-neon-green/15 border border-neon-green/25 px-3 py-1">
                  {tableRows ? `${tableRows.length} rows loaded` : "0 rows"}
                </div>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => setPythonDialogOpen(true)}
                  className="h-9 px-3 rounded-full border border-[#5a4318]/70 bg-black/30 text-[#facc15] hover:bg-[#facc15]/10"
                >
                  <Code2 className="h-4 w-4 mr-2" />
                  Python
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => setSqlDialogOpen(true)}
                  className="h-9 px-3 rounded-full border border-[#5a4318]/70 bg-black/30 text-[#38bdf8] hover:bg-[#38bdf8]/10"
                >
                  <TerminalSquare className="h-4 w-4 mr-2" />
                  SQL
                </Button>
              </div>
            </div>

            {!projectId ? (
              <div className="flex items-center justify-center text-neutral-500 text-sm border border-gray-800 bg-[#111111]/85 backdrop-blur-xl py-20">
                Select a project to view tables.
              </div>
            ) : (
              <ResizablePanelGroup
                direction="horizontal"
                className="min-h-[400px] max-h-[calc(100vh-300px)]"
              >
                <ResizablePanel defaultSize={24} minSize={16} maxSize={38}>
                  <div className="h-full bg-gradient-to-b from-[#3b2a00]/75 via-[#1b1300]/85 to-[#101010]/90 border border-[#5a4318]/70 p-2 overflow-y-auto backdrop-blur-xl neon-scrollbar">
                    <div className="text-xs uppercase tracking-widest text-neutral-500 mb-3">
                      Tables
                    </div>
                    <div className="mb-3">
                      <Input
                        value={tableSearch}
                        onChange={(e) => setTableSearch(e.target.value)}
                        placeholder="Search tables..."
                        className="h-9 bg-black/40 border-gray-800 text-xs text-zinc-200 placeholder:text-neutral-500"
                      />
                    </div>
                    {tablesLoading && (
                      <div className="text-xs text-neutral-500">
                        Loading tables...
                      </div>
                    )}
                    {!tablesLoading && !tableNames?.length && (
                      <div className="text-xs text-neutral-500">
                        No tables found.
                      </div>
                    )}
                    {!tablesLoading &&
                      tableNames?.length &&
                      !filteredTables.length && (
                        <div className="text-xs text-neutral-500">
                          No tables match your search.
                        </div>
                      )}
                    <div className="flex flex-col gap-2">
                      {filteredTables.map((table) => (
                        <button
                          key={table}
                          type="button"
                          onClick={() => setSelectedTable(table)}
                          className={`text-left px-3 py-2 rounded-lg text-sm transition-all ${
                            selectedTable === table
                              ? "neon-outline-btn"
                              : "bg-black/40 text-neutral-300 hover:bg-white/10"
                          }`}
                        >
                          {table}
                        </button>
                      ))}
                    </div>
                    <div className="mt-4 flex justify-end">
                      <Button
                        type="button"
                        size="icon"
                        onClick={() => openQuickAsk("tables")}
                        className="h-9 w-9 rounded-full border border-neon-green/40 bg-black/40 text-neon-green hover:bg-neon-green/10 hover:shadow-[0_0_12px_rgba(74,222,128,0.35)]"
                      >
                        <Sparkles className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </ResizablePanel>
                <ResizableHandle
                  withHandle
                  className="bg-transparent hover:bg-neon-green/15 transition-colors"
                />

                <ResizablePanel defaultSize={76} minSize={45}>
                  <div className="h-full bg-gradient-to-br from-[#e5e7eb]/10 via-[#9ca3af]/10 to-[#6b7280]/10 border border-[#8b8f94]/40 p-2 flex flex-col backdrop-blur-xl shadow-[0_12px_40px_rgba(0,0,0,0.35)]">
                    <div className="overflow-auto neon-scrollbar max-h-[calc(100vh-350px)]">
                      {tableRowsLoading && (
                        <div className="text-xs text-neutral-500">
                          Loading table data...
                        </div>
                      )}
                      {!tableRowsLoading &&
                        selectedTable &&
                        tableRows?.length === 0 && (
                          <div className="text-xs text-neutral-500">
                            No rows returned.
                          </div>
                        )}
                      {!tableRowsLoading &&
                        tableRows &&
                        tableRows.length > 0 && (
                          <div className="rounded-md border border-white/10 bg-black/20 p-2">
                            <Table className="text-xs text-zinc-200">
                              <TableHeader>
                                <TableRow className="border-white/10">
                                  {Object.keys(tableRows[0]).map((column) => (
                                    <TableHead
                                      key={column}
                                      className="text-zinc-200 font-semibold bg-black/40 border-b border-white/10 uppercase tracking-wider text-[11px]"
                                    >
                                      {column}
                                    </TableHead>
                                  ))}
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {tableRows.map((row, rowIndex) => (
                                  <TableRow
                                    key={rowIndex}
                                    className="border-white/5 even:bg-white/5"
                                  >
                                    {Object.values(row).map(
                                      (value, cellIndex) => (
                                        <TableCell key={cellIndex}>
                                          {value === null
                                            ? "null"
                                            : String(value)}
                                        </TableCell>
                                      ),
                                    )}
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        )}
                    </div>
                    <div className="mt-4 flex justify-end">
                      <Button
                        type="button"
                        size="icon"
                        onClick={() => openQuickAsk("table")}
                        className="h-9 w-9 rounded-full border border-neon-green/40 bg-black/40 text-neon-green hover:bg-neon-green/10 hover:shadow-[0_0_12px_rgba(74,222,128,0.35)]"
                      >
                        <Sparkles className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </ResizablePanel>
              </ResizablePanelGroup>
            )}
          </main>
        </ResizablePanel>
        <ResizableHandle
          withHandle
          className="bg-transparent hover:bg-neon-green/15 transition-colors"
        />

        <ResizablePanel
          defaultSize={30}
          minSize={22}
          maxSize={42}
          className="bg-gradient-to-b from-[#0b1f33] via-[#0a1527] to-[#080f1c] border-l border-[#1e2b3a]"
        >
          {currentProjectName && projectId ? (
            <ChatInterface
              messages={displayedMessages}
              onSendMessage={handleSendMessage}
              onDeleteHistory={handleDeleteHistory}
              onCreateAgent={handleCreateAgent}
              agentName={chatData?.chatName ?? "Default"}
              agents={agentData?.agents ?? []}
              activeChatId={agentData?.activeChatId ?? chatData?.chatId ?? null}
              onSelectAgent={handleSelectAgent}
              onRenameAgent={handleRenameAgent}
              isDeleting={deleteHistory.isPending}
              isCreatingAgent={createAgent.isPending}
              isPending={sendMessage.isPending}
            />
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-neutral-500 relative">
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-72 h-72 bg-neon-green/5 border border-neon-green/10 rounded-full blur-3xl opacity-50 pointer-events-none animate-soft-pulse" />
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.5, ease: "easeOut" }}
                className="glass-panel-soft p-6 rounded-full mb-6 relative group shadow-2xl"
              >
                <div className="absolute inset-0 bg-neon-green/20 blur-xl rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
                <Sparkles className="h-12 w-12 text-neon-green drop-shadow-[0_0_20px_rgba(57,255,20,0.6)] animate-pulse relative z-10 group-hover:scale-110 transition-transform duration-500" />
              </motion.div>
              <motion.h3
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.2, duration: 0.5 }}
                className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-zinc-100 to-zinc-500 mb-3 tracking-tight"
              >
                Workspace Ready
              </motion.h3>
              <motion.p
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.3, duration: 0.5 }}
                className="max-w-sm text-center text-neutral-400 text-sm"
              >
                Select a project to start the AI assistant session.
              </motion.p>
            </div>
          )}
        </ResizablePanel>
      </ResizablePanelGroup>

      <Dialog open={collaborateOpen} onOpenChange={setCollaborateOpen}>
        <DialogContent className="glass-panel border border-white/10 text-white sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold flex items-center gap-2">
              <Users className="h-4 w-4 text-neon-green" />
              Add collaborator
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="collaborator">Email or username</Label>
              <Input
                id="collaborator"
                value={collaborateInput}
                onChange={(e) => setCollaborateInput(e.target.value)}
                placeholder="name@example.com"
                className="bg-black/40 border-white/10 text-white"
              />
            </div>
            <div className="flex justify-end">
              <Button
                onClick={handleAddCollaborator}
                disabled={collaborateBusy || !collaborateInput.trim()}
                className="h-10 px-4 rounded-lg neon-btn"
              >
                {collaborateBusy ? "Adding..." : "Add"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={connectOpen} onOpenChange={setConnectOpen}>
        <DialogContent className="glass-panel border border-white/10 text-white sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold">
              Connect API
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="text-xs text-neutral-400">
              Use the API key with <code>x-api-key</code> to call
              <code>
                {" "}
                {typeof window !== "undefined"
                  ? `${window.location.origin}/api/external/run`
                  : "/api/external/run"}
              </code>
              .
            </div>
            {apiKeyError && (
              <div className="text-xs text-red-300 bg-red-500/10 border border-red-500/30 rounded-md p-3">
                {apiKeyError}
              </div>
            )}
            <div className="flex justify-end">
              <Button
                onClick={handleCreateApiKey}
                disabled={apiKeyBusy}
                className="h-10 px-4 rounded-lg bg-blue-500/20 border border-blue-500/40 text-blue-200 hover:bg-blue-500/30"
              >
                {apiKeyBusy ? "Generating..." : "Generate key"}
              </Button>
            </div>
            <div className="space-y-2">
              {apiKeys.length === 0 && (
                <div className="text-xs text-neutral-500">No keys yet.</div>
              )}
              {apiKeys.map((key) => (
                <div
                  key={key.id}
                  className="rounded-md border border-white/10 bg-black/40 p-3 text-xs"
                >
                  <div className="text-neutral-400">API Key</div>
                  <div className="text-zinc-100 break-all mt-1">
                    {key.apiKey}
                  </div>
                  <div className="text-neutral-500 mt-2">
                    {key.isActive ? "Active" : "Inactive"} •{" "}
                    {new Date(key.createdAt).toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={pythonDialogOpen} onOpenChange={setPythonDialogOpen}>
        <DialogContent className="glass-panel border border-white/10 text-white sm:max-w-6xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold flex items-center gap-2">
              <Code2 className="h-4 w-4 text-[#facc15]" />
              Python workspace
            </DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="text-xs uppercase tracking-widest text-neutral-500">
                Code
              </div>
              <Textarea
                value={pythonCode}
                onChange={(e) => setPythonCode(e.target.value)}
                className="min-h-[360px] bg-black/50 border-white/10 text-zinc-100 font-mono text-xs"
              />
              <div className="flex justify-end">
                <Button
                  onClick={handleRunPython}
                  disabled={pythonRunning || !pythonCode.trim()}
                  className="h-10 px-4 rounded-lg bg-[#facc15]/20 border border-[#facc15]/40 text-[#facc15] hover:bg-[#facc15]/30"
                >
                  <Play className="h-4 w-4 mr-2" />
                  {pythonRunning ? "Running..." : "Run"}
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <div className="text-xs uppercase tracking-widest text-neutral-500">
                Output
              </div>
              <div className="min-h-[360px] max-h-[520px] overflow-auto bg-black/40 border border-white/10 rounded-md p-3">
                {pythonRunError && (
                  <div className="text-xs text-red-300 bg-red-500/10 border border-red-500/30 rounded-md p-3 mb-3">
                    {pythonRunError}
                  </div>
                )}
                {renderPythonOutput()}
                {!pythonRunError && !pythonOutput && (
                  <div className="text-xs text-neutral-500">
                    Run the script to see output.
                  </div>
                )}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={sqlDialogOpen} onOpenChange={setSqlDialogOpen}>
        <DialogContent className="glass-panel border border-white/10 text-white sm:max-w-6xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold flex items-center gap-2">
              <TerminalSquare className="h-4 w-4 text-[#38bdf8]" />
              SQL workspace
            </DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="text-xs uppercase tracking-widest text-neutral-500">
                Query
              </div>
              <Textarea
                value={sqlQuery}
                onChange={(e) => setSqlQuery(e.target.value)}
                className="min-h-[240px] bg-black/50 border-white/10 text-zinc-100 font-mono text-xs"
              />
              <div className="flex justify-end">
                <Button
                  onClick={handleRunSql}
                  disabled={sqlRunning || !sqlQuery.trim()}
                  className="h-10 px-4 rounded-lg bg-[#38bdf8]/20 border border-[#38bdf8]/40 text-[#38bdf8] hover:bg-[#38bdf8]/30"
                >
                  <Play className="h-4 w-4 mr-2" />
                  {sqlRunning ? "Running..." : "Run"}
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <div className="text-xs uppercase tracking-widest text-neutral-500">
                Output
              </div>
              <div className="min-h-[240px] max-h-[520px] overflow-auto bg-black/40 border border-white/10 rounded-md p-3">
                {sqlRunError && (
                  <div className="text-xs text-red-300 bg-red-500/10 border border-red-500/30 rounded-md p-3 mb-3">
                    {sqlRunError}
                  </div>
                )}
                {sqlOutput && (
                  <div className="space-y-3">
                    <div className="text-xs text-neutral-400">
                      {sqlOutput.rowCount} rows
                    </div>
                    {renderRowsTable(sqlOutput.rows, sqlOutput.fields)}
                  </div>
                )}
                {!sqlRunError && !sqlOutput && (
                  <div className="text-xs text-neutral-500">
                    Run a query to see results.
                  </div>
                )}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={quickAskOpen} onOpenChange={setQuickAskOpen}>
        <DialogContent className="bg-[#0b0b0b] border-gray-800 text-white sm:max-w-lg shadow-2xl p-0 overflow-hidden rounded-2xl">
          <div className="h-1 w-full bg-gradient-to-r from-transparent via-neon-green to-transparent opacity-50 absolute top-0 left-0" />
          <div className="p-6">
            <DialogHeader className="mb-4">
              <DialogTitle className="text-2xl font-bold text-white flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-neon-green" />
                What do you need to change?
              </DialogTitle>
            </DialogHeader>
            <Textarea
              value={quickAskText}
              onChange={(e) => setQuickAskText(e.target.value)}
              placeholder="Describe what you want to change or analyze..."
              className="min-h-[140px] bg-[#111111] border-gray-800 focus:border-neon-green focus:ring-1 focus:ring-neon-green/50 text-white"
            />
          </div>
          <div className="p-6 pt-0">
            <Button
              onClick={submitQuickAsk}
              disabled={!quickAskText.trim()}
              className="w-full h-12 neon-btn hover:bg-neon-green/95 font-bold text-base rounded-xl transition-all disabled:opacity-50 disabled:hover:shadow-none"
            >
              Send to Agent
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
