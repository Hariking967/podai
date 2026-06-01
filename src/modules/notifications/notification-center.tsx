"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Bell, BellDot, Check, CheckCheck, UserPlus, GitCommit } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

interface Notification {
  id: string;
  type: "invitation" | "commit";
  title: string;
  body: string;
  data: Record<string, unknown>;
  read: boolean;
  createdAt: string;
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export function NotificationCenter({
  userId,
  projectId,
}: {
  userId: string;
  projectId: string;
}) {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();
  const router = useRouter();

  const { data } = useQuery<{ data: Notification[] }>({
    queryKey: ["notifications", userId],
    queryFn: async () => {
      const res = await fetch("/api/notifications");
      return res.json();
    },
    refetchInterval: 30000,
  });

  const notifs = data?.data ?? [];
  const unread = notifs.filter((n) => !n.read).length;

  const markRead = useMutation({
    mutationFn: async (id?: string) => {
      await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["notifications", userId] }),
  });

  const acceptInvite = useMutation({
    mutationFn: async (token: string) => {
      const res = await fetch("/api/project/accept-invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      return data as { projectId: string };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["notifications", userId] });
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      toast.success("Joined project!");
      setOpen(false);
      router.push(`/${encodeURIComponent(data.projectId)}/tables`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const declineInvite = useMutation({
    mutationFn: async (token: string) => {
      await fetch("/api/project/decline-invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications", userId] });
      toast("Invitation declined");
    },
  });

  const handleToggle = () => {
    setOpen((o) => !o);
    if (!open && unread > 0) markRead.mutate(undefined);
  };

  // Suppress unused variable warning for projectId (kept for API compatibility)
  void projectId;

  return (
    <div className="relative">
      <button
        onClick={handleToggle}
        className="relative h-8 w-8 flex items-center justify-center rounded-lg text-gray-500 hover:text-white hover:bg-white/5 transition-colors"
        title="Notifications"
      >
        {unread > 0 ? (
          <BellDot className="h-4 w-4 text-green-400" />
        ) : (
          <Bell className="h-4 w-4" />
        )}
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 h-4 w-4 bg-green-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <>
          <div
            className="fixed inset-0 z-30"
            onClick={() => setOpen(false)}
          />
          <div className="absolute right-0 top-10 w-80 bg-[#111] border border-gray-800 rounded-xl shadow-2xl z-40 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
              <span className="text-sm font-semibold">Notifications</span>
              {unread > 0 && (
                <button
                  onClick={() => markRead.mutate(undefined)}
                  className="text-xs text-gray-500 hover:text-white flex items-center gap-1"
                >
                  <CheckCheck className="h-3.5 w-3.5" />
                  Mark all read
                </button>
              )}
            </div>
            <div className="max-h-96 overflow-y-auto divide-y divide-gray-800/40">
              {notifs.length === 0 ? (
                <div className="px-4 py-8 text-center text-gray-500 text-sm">
                  <Bell className="h-6 w-6 mx-auto mb-2 opacity-30" />
                  No notifications
                </div>
              ) : (
                notifs.map((n) => (
                  <div
                    key={n.id}
                    className={`px-4 py-3 ${!n.read ? "bg-green-500/5" : ""}`}
                  >
                    <div className="flex items-start gap-2">
                      <div className="shrink-0 mt-0.5">
                        {n.type === "invitation" ? (
                          <UserPlus className="h-4 w-4 text-green-400" />
                        ) : (
                          <GitCommit className="h-4 w-4 text-amber-400" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-white">{n.title}</p>
                        <p className="text-xs text-gray-400 mt-0.5">{n.body}</p>
                        <p className="text-xs text-gray-600 mt-1">
                          {timeAgo(n.createdAt)}
                        </p>
                        {n.type === "invitation" && !!n.data?.token && (
                          <div className="flex gap-2 mt-2">
                            <button
                              onClick={() =>
                                acceptInvite.mutate(n.data.token as string)
                              }
                              disabled={acceptInvite.isPending}
                              className="text-xs px-3 py-1 rounded bg-green-500/20 text-green-400 border border-green-500/30 hover:bg-green-500/30 transition-colors"
                            >
                              Accept
                            </button>
                            <button
                              onClick={() =>
                                declineInvite.mutate(n.data.token as string)
                              }
                              disabled={declineInvite.isPending}
                              className="text-xs px-3 py-1 rounded bg-gray-800 text-gray-400 hover:text-white transition-colors"
                            >
                              Decline
                            </button>
                          </div>
                        )}
                      </div>
                      {!n.read && (
                        <button
                          onClick={() => markRead.mutate(n.id)}
                          className="shrink-0 text-gray-600 hover:text-white"
                        >
                          <Check className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
