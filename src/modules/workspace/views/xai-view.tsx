"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { authClient } from "@/lib/auth-client";
import dynamic from "next/dynamic";
import { toast } from "sonner";

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

interface SendMessageResponse {
  userMessage: { role: "user"; content: string; createdAt: string };
  aiMessage: {
    role: "assistant";
    content: string;
    createdAt: string;
    data_location?: ChatListItem["data_location"];
  };
}

interface AgentListResponse {
  activeChatId: string | null;
  agents: Array<{ id: string; name: string }>;
}

const ChatInterface = dynamic(
  () => import("@/modules/home/chat-interface").then((m) => m.ChatInterface),
  { ssr: false },
);

const getJson = async <T,>(url: string): Promise<T> => {
  const res = await fetch(url);
  const data = await res.json();
  if (!res.ok) throw new Error((data as { message?: string })?.message || "Failed");
  return data as T;
};

const postSseJson = async <T,>(
  url: string,
  body: unknown,
  handlers: {
    onDelta?: (text: string) => void;
    onStatus?: (message: string) => void;
  } = {},
): Promise<T> => {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorPayload = await response.json().catch(() => null);
    throw new Error((errorPayload as { message?: string })?.message || "Request failed");
  }

  if (!response.body) throw new Error("Missing response stream");

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let completePayload: T | null = null;

  const processEvent = (rawEvent: string) => {
    const lines = rawEvent.split("\n");
    let eventName = "message";
    const dataParts: string[] = [];

    for (const line of lines) {
      if (line.startsWith("event:")) eventName = line.slice(6).trim();
      else if (line.startsWith("data:")) dataParts.push(line.slice(5).trim());
    }

    const rawData = dataParts.join("\n");
    if (!rawData) return;

    const parsed = JSON.parse(rawData) as Record<string, unknown>;

    if (eventName === "delta") {
      const text = typeof parsed.text === "string" ? parsed.text : "";
      if (text) handlers.onDelta?.(text);
      return;
    }
    if (eventName === "status") {
      const message = typeof parsed.message === "string" ? parsed.message : "Working...";
      handlers.onStatus?.(message);
      return;
    }
    if (eventName === "error") {
      const message = typeof parsed.message === "string" ? parsed.message : "Streaming failed";
      throw new Error(message);
    }
    if (eventName === "complete") {
      completePayload = parsed as T;
    }
  };

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const events = buffer.split("\n\n");
    buffer = events.pop() ?? "";
    for (const evt of events) {
      if (!evt.trim()) continue;
      processEvent(evt);
    }
  }

  if (!completePayload) throw new Error("Stream ended before completion payload");
  return completePayload;
};

export default function XaiView() {
  const params = useParams();
  const projectName = decodeURIComponent((params?.project as string) || "");
  const { data: session } = authClient.useSession();
  const userId = session?.user?.id;
  const queryClient = useQueryClient();

  const [optimisticUserMessage, setOptimisticUserMessage] = useState<ChatListItem | null>(null);
  const [streamingAssistantMessage, setStreamingAssistantMessage] = useState<ChatListItem | null>(null);

  const { data: projects = [] } = useQuery<
    Array<{ id: string; name: string; neonApiKey?: string | null; role?: string }>
  >({
    queryKey: ["projects", userId],
    queryFn: () => getJson(`/api/project/get-all?userId=${encodeURIComponent(userId!)}`),
    enabled: !!userId,
  });

  const currentProject = (
    projects as Array<{ id: string; name: string; neonApiKey?: string | null; role?: string }>
  ).find((p) => p.name === projectName);
  const projectId = currentProject?.id;

  const { data: chatData, refetch: refetchChat } = useQuery<ChatResponse>({
    queryKey: ["chat", projectId],
    queryFn: () =>
      getJson(`/api/chat/get-chat?projectId=${encodeURIComponent(projectId!)}`),
    enabled: !!projectId,
  });

  const { data: agentData, refetch: refetchAgents } = useQuery<AgentListResponse>({
    queryKey: ["chat-agents", projectId],
    queryFn: () =>
      getJson(`/api/chat/list-agents?projectId=${encodeURIComponent(projectId!)}`),
    enabled: !!projectId,
  });

  const sendMessage = useMutation({
    mutationFn: (payload: { projectId: string; message: string }) =>
      postSseJson<SendMessageResponse>("/api/chat/send-message-stream", payload, {
        onStatus: (statusText) => {
          setStreamingAssistantMessage((current) => {
            if (current) return current;
            return { role: "assistant", content: statusText, createdAt: new Date().toISOString() };
          });
        },
        onDelta: (delta) => {
          setStreamingAssistantMessage((current) => ({
            role: "assistant",
            content: `${current?.content ?? ""}${delta}`,
            createdAt: current?.createdAt ?? new Date().toISOString(),
          }));
        },
      }),
    onMutate: (payload) => {
      setOptimisticUserMessage({
        role: "user",
        content: payload.message,
        createdAt: new Date().toISOString(),
      });
      setStreamingAssistantMessage(null);
    },
    onSuccess: () => {
      refetchChat().then(() => {
        setOptimisticUserMessage(null);
        setStreamingAssistantMessage(null);
      });
      queryClient.invalidateQueries({ queryKey: ["chat", projectId] });
    },
    onError: (err) => {
      setOptimisticUserMessage(null);
      setStreamingAssistantMessage(null);
      toast.error(err instanceof Error ? err.message : "Failed to send message");
    },
  });

  const deleteHistory = useMutation({
    mutationFn: (payload: { projectId: string }) =>
      fetch("/api/chat/delete-history", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }).then((r) => r.json()),
    onSuccess: () => {
      refetchChat();
      queryClient.invalidateQueries({ queryKey: ["chat", projectId] });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to delete history"),
  });

  const createAgent = useMutation({
    mutationFn: (payload: { projectId: string; name: string }) =>
      fetch("/api/chat/create-agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }).then((r) => r.json()),
    onSuccess: () => {
      refetchChat();
      refetchAgents();
      queryClient.invalidateQueries({ queryKey: ["chat", projectId] });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to create agent"),
  });

  const setActiveAgent = useMutation({
    mutationFn: (payload: { projectId: string; chatId: string }) =>
      fetch("/api/chat/set-active", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }).then((r) => r.json()),
    onSuccess: () => {
      refetchChat();
      refetchAgents();
      queryClient.invalidateQueries({ queryKey: ["chat", projectId] });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to switch agent"),
  });

  const renameAgent = useMutation({
    mutationFn: (payload: { projectId: string; chatId: string; name: string }) =>
      fetch("/api/chat/rename-agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }).then((r) => r.json()),
    onSuccess: () => {
      refetchChat();
      refetchAgents();
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to rename agent"),
  });

  const handleSendMessage = (text: string) => {
    if (!projectId) return;
    sendMessage.mutate({ projectId, message: text });
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

  const displayedMessages: ChatListItem[] = [
    ...((chatData?.messages as ChatListItem[]) ?? []),
    ...(optimisticUserMessage ? [optimisticUserMessage] : []),
    ...(streamingAssistantMessage ? [streamingAssistantMessage] : []),
  ];

  if (!userId || projects.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500 text-sm">
        Loading...
      </div>
    );
  }

  if (!projectId) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500 text-sm">
        Project not found. Select a project first.
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <ChatInterface
        messages={displayedMessages}
        onSendMessage={handleSendMessage}
        onDeleteHistory={handleDeleteHistory}
        onCreateAgent={handleCreateAgent}
        onSelectAgent={handleSelectAgent}
        onRenameAgent={handleRenameAgent}
        agentName={chatData?.chatName ?? "Default"}
        agents={agentData?.agents ?? []}
        activeChatId={agentData?.activeChatId ?? chatData?.chatId ?? null}
        isDeleting={deleteHistory.isPending}
        isCreatingAgent={createAgent.isPending}
        isPending={sendMessage.isPending}
      />
    </div>
  );
}
