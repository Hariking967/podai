"use client";

import { motion } from "framer-motion";
import { useState, useEffect, useRef } from "react";
import { ChatInterface } from "./chat-interface";
import { Button } from "@/components/ui/button";
import {
  Plus,
  Sparkles,
  Database,
  ChevronRight,
  ChevronLeft,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Link from "next/link";
import { useParams } from "next/navigation";
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

interface ProjectListItem {
  id: string;
  name: string;
  neonApiKey?: string | null;
  chatId?: string | null;
}

interface ChatListItem {
  role: "user" | "assistant";
  content: string;
  createdAt: string;
  data_location?: {
    fileName?: string;
    output?: {
      prints?: string;
      result?: {
        plot?: {
          type?: "line" | "bar";
          data?: Record<string, unknown>[];
          xKey?: string;
          yKey?: string;
        };
      };
      error?: { message: string; traceback: string } | null;
    };
  };
}

interface ChatResponse {
  chatId: string | null;
  messages: ChatListItem[];
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
  const currentProjectName = decodeURIComponent((params?.project as string) || "");
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  const { data: session } = authClient.useSession();
  const userId = session?.user?.id;
  const queryClient = useQueryClient();

  const { data: projects, refetch } = useQuery({
    queryKey: ["projects", userId],
    queryFn: () =>
      getJson<ProjectListItem[]>(
        `/api/project/get-all?userId=${encodeURIComponent(userId!)}`
      ),
    enabled: !!userId,
  });
  const projectList = (projects ?? []) as ProjectListItem[];

  const currentProject = projectList.find((p) => p.name === currentProjectName);
  const projectId = currentProject?.id;

  const { data: chatData, refetch: refetchChat } = useQuery({
    queryKey: ["chat", projectId],
    queryFn: () =>
      getJson<ChatResponse>(
        `/api/chat/get-chat?projectId=${encodeURIComponent(projectId!)}`
      ),
    enabled: !!projectId,
  });

  const { data: tableNames, isLoading: tablesLoading } = useQuery({
    queryKey: ["neon-tables", projectId],
    queryFn: () =>
      getJson<string[]>(
        `/api/neon/list-tables?projectId=${encodeURIComponent(projectId!)}`
      ),
    enabled: !!projectId,
  });
  const [selectedTable, setSelectedTable] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedTable && tableNames?.length) {
      setSelectedTable(tableNames[0]);
    }
  }, [selectedTable, tableNames]);

  const { data: tableRows, isLoading: tableRowsLoading } = useQuery({
    queryKey: ["table-data", projectId, selectedTable],
    queryFn: () =>
      getJson<Record<string, unknown>[]>(
        `/api/neon/get-table-data?projectId=${encodeURIComponent(
          projectId!
        )}&tableName=${encodeURIComponent(selectedTable || "")}&limit=200`
      ),
    enabled: !!projectId && !!selectedTable,
  });

  const createProject = useMutation({
    mutationFn: (payload: { name: string; neonApiKey?: string; userId: string }) =>
      postJson<{ project: ProjectListItem; chat: { id: string } }>(
        "/api/project/create",
        payload
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
      toast.error(err instanceof Error ? err.message : "Failed to create project");
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
    onSuccess: () => {
      refetchChat();
      queryClient.invalidateQueries({ queryKey: ["chat", projectId] });
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Failed to send message");
    },
  });

  const handleCreate = () => {
    if (!userId) return;
    createProject.mutate({
      name,
      neonApiKey: apiKey || undefined,
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

    return <div ref={cursorRef} className="pointer-events-none fixed inset-0 z-0 transition-colors duration-300" />;
  };

  return (
    <div className="h-screen w-full text-white pt-16 bg-[#0a0a0a] relative overflow-hidden">
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

      <div className="relative z-10 h-full flex overflow-hidden">
        <aside
          className={`bg-[#0f0f0f]/95 backdrop-blur-xl border-r border-gray-800/80 transition-all duration-300 ${
            isSidebarOpen ? "w-64" : "w-0"
          }`}
        >
          <div className={`h-full flex flex-col ${isSidebarOpen ? "opacity-100" : "opacity-0 pointer-events-none"} transition-opacity duration-200`}>
            <div className="flex items-center justify-between px-4 py-4 border-b border-gray-800/80">
              <h2 className="text-sm font-semibold uppercase tracking-widest text-neutral-400">Dashboard</h2>
              <Dialog open={open} onOpenChange={setOpen}>
                <DialogTrigger asChild>
                  <Button size="icon" className="h-9 w-9 rounded-lg bg-black/40 border border-gray-800 text-neutral-300 hover:text-white hover:border-neon-green/60 hover:shadow-[0_0_12px_rgba(74,222,128,0.35)] transition-all duration-300">
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
                          Neon API Key (Optional)
                        </Label>
                      </div>
                    </div>
                  </div>

                  <div className="p-6 pt-0 mt-2">
                    <Button
                      onClick={handleCreate}
                      disabled={createProject.isPending || !name}
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

            <div className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
              {projectList.map((project, i) => (
                <Link key={project.id} href={`/${project.name}`}>
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.04, type: "spring", stiffness: 280, damping: 24 }}
                    whileHover={{ y: -2 }}
                    className={`p-3 rounded-xl border transition-all duration-200 flex items-center justify-between group ${
                      currentProjectName === project.name
                        ? "border-neon-green/50 bg-neon-green/10 shadow-[0_0_20px_rgba(74,222,128,0.16)]"
                        : "border-gray-800 bg-[#121212] hover:border-neon-green/30 hover:bg-white/5"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 flex items-center justify-center rounded-lg ${
                        currentProjectName === project.name
                          ? "bg-neon-green/20 text-neon-green"
                          : "bg-white/5 text-neutral-500 group-hover:text-neon-green"
                      }`}>
                        <Database className="w-4 h-4" />
                      </div>
                      <span className="text-sm font-semibold text-zinc-200 truncate">
                        {project.name}
                      </span>
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
        </aside>

        <button
          type="button"
          onClick={() => setIsSidebarOpen((prev) => !prev)}
          className="absolute left-0 top-24 z-20 h-9 w-9 -translate-x-1/2 rounded-full border border-gray-800 bg-[#111111] text-neutral-300 hover:text-white hover:border-neon-green/50 transition-all duration-300 flex items-center justify-center"
          aria-label={isSidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
        >
          {isSidebarOpen ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </button>

        <main className="flex-1 overflow-y-auto bg-[#0a0a0a] border-r border-gray-800">
          <div className="h-full p-6">
            <div className="flex items-center justify-between mb-4 rounded-2xl border border-gray-800/80 bg-[#101010]/85 backdrop-blur-xl px-4 py-3">
              <div>
                <div className="text-xs uppercase tracking-widest text-neutral-500">Table Viewer</div>
                <div className="text-lg font-semibold text-zinc-100 mt-0.5">
                  {selectedTable ? `Table: ${selectedTable}` : "Select a table"}
                </div>
              </div>
              <div className="text-xs text-neutral-300 rounded-full bg-neon-green/15 border border-neon-green/25 px-3 py-1">
                {tableRows ? `${tableRows.length} rows loaded` : "0 rows"}
              </div>
            </div>

            {!projectId ? (
              <div className="h-[70vh] flex items-center justify-center text-neutral-500 text-sm border border-gray-800 rounded-2xl bg-[#111111]/85 backdrop-blur-xl">
                Select a project to view tables.
              </div>
            ) : (
              <div className="grid grid-cols-[220px_1fr] gap-4 h-[calc(100%-2.5rem)]">
                <div className="bg-[#111111]/90 border border-gray-800 rounded-2xl p-3 overflow-y-auto backdrop-blur-xl">
                  <div className="text-xs uppercase tracking-widest text-neutral-500 mb-3">Tables</div>
                  {tablesLoading && (
                    <div className="text-xs text-neutral-500">Loading tables...</div>
                  )}
                  {!tablesLoading && !tableNames?.length && (
                    <div className="text-xs text-neutral-500">No tables found.</div>
                  )}
                  <div className="flex flex-col gap-2">
                    {tableNames?.map((table) => (
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
                </div>

                <div className="bg-[#111111]/90 border border-gray-800 rounded-2xl p-4 overflow-hidden flex flex-col backdrop-blur-xl shadow-[0_12px_40px_rgba(0,0,0,0.35)]">
                  <div className="flex-1 overflow-auto">
                    {tableRowsLoading && (
                      <div className="text-xs text-neutral-500">Loading table data...</div>
                    )}
                    {!tableRowsLoading && selectedTable && tableRows?.length === 0 && (
                      <div className="text-xs text-neutral-500">No rows returned.</div>
                    )}
                    {!tableRowsLoading && tableRows && tableRows.length > 0 && (
                      <Table className="text-xs text-zinc-200">
                        <TableHeader>
                          <TableRow className="border-white/10">
                            {Object.keys(tableRows[0]).map((column) => (
                              <TableHead key={column} className="text-zinc-400">
                                {column}
                              </TableHead>
                            ))}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {tableRows.map((row, rowIndex) => (
                            <TableRow key={rowIndex} className="border-white/5">
                              {Object.values(row).map((value, cellIndex) => (
                                <TableCell key={cellIndex}>
                                  {value === null ? "null" : String(value)}
                                </TableCell>
                              ))}
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </main>

        <aside className="w-[400px] shrink-0 bg-[#111111] border-l border-gray-800">
          {currentProjectName && projectId ? (
            <ChatInterface 
              messages={(chatData?.messages as ChatListItem[]) || []}
              onSendMessage={handleSendMessage}
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
        </aside>
      </div>
    </div>
  );
}
