# XBase Workspace Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the single-page project workspace with a sidebar-navigated multi-section workspace, add invitation-based collaboration with notifications, and enforce strict viewer read-only restrictions.

**Architecture:** Keep all existing API routes intact. Add `/dashboard` for project selection and `/[project]/layout.tsx` sidebar shell wrapping 7 section pages. Add `notifications` and `projectInvitations` DB tables. Viewer restrictions enforced in AI system prompt and route guards.

**Tech Stack:** Next.js 15 App Router, Drizzle ORM + Neon PostgreSQL, Better Auth, TanStack Query, Tailwind CSS 4, shadcn/ui, Lucide icons

---

## File Map

**Create:**
- `src/app/dashboard/page.tsx` — project selection page
- `src/app/[project]/layout.tsx` — workspace shell (sidebar + header)
- `src/app/[project]/tables/page.tsx`
- `src/app/[project]/visualisation/page.tsx`
- `src/app/[project]/ml/page.tsx`
- `src/app/[project]/xai/page.tsx`
- `src/app/[project]/history/page.tsx`
- `src/app/[project]/apis/page.tsx`
- `src/app/[project]/contributors/page.tsx`
- `src/modules/workspace/workspace-shell.tsx`
- `src/modules/workspace/sidebar.tsx`
- `src/modules/workspace/workspace-header.tsx`
- `src/modules/workspace/views/tables-view.tsx`
- `src/modules/workspace/views/visualisation-view.tsx`
- `src/modules/workspace/views/ml-view.tsx`
- `src/modules/workspace/views/xai-view.tsx`
- `src/modules/workspace/views/history-view.tsx`
- `src/modules/workspace/views/apis-view.tsx`
- `src/modules/workspace/views/contributors-view.tsx`
- `src/modules/notifications/notification-center.tsx`
- `src/app/api/notifications/route.ts`
- `src/app/api/project/invite/route.ts`
- `src/app/api/project/accept-invite/route.ts`
- `src/app/api/project/decline-invite/route.ts`
- `src/app/api/project/contributors/route.ts`

**Modify:**
- `src/db/schema.ts` — add notifications, projectInvitations, commitMessage on queryHistory
- `src/app/page.tsx` — redirect logged-in users to /dashboard
- `src/app/[project]/page.tsx` — redirect to /[project]/tables
- `src/lib/ai-agent.ts` — add viewer restrictions + role param
- `src/app/api/chat/send-message/route.ts` — pass role to runAgent
- `src/app/api/chat/send-message-stream/route.ts` — pass role to runAgent

---

### Task 1: DB Schema Extensions

**Files:**
- Modify: `src/db/schema.ts`

- [ ] **Step 1: Add new enums and tables to schema**

Open `src/db/schema.ts` and add after the existing `projectApiKeys` table:

```typescript
export const invitationStatus = pgEnum("invitation_status", [
  "pending",
  "accepted",
  "declined",
]);

export const notificationType = pgEnum("notification_type", [
  "invitation",
  "commit",
]);

export const projectInvitations = pgTable("project_invitations", {
  id: text("id").primaryKey(),
  projectId: text("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  invitedByUserId: text("invited_by_user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  invitedEmail: text("invited_email").notNull(),
  role: collaboratorRole("role").notNull().default("viewer"),
  token: text("token").notNull().unique(),
  status: invitationStatus("status").notNull().default("pending"),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at")
    .$defaultFn(() => new Date())
    .notNull(),
});

export const notifications = pgTable("notifications", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  type: notificationType("type").notNull(),
  title: text("title").notNull(),
  body: text("body").notNull(),
  data: jsonb("data").$type<Record<string, unknown>>().default({}),
  read: boolean("read").notNull().default(false),
  createdAt: timestamp("created_at")
    .$defaultFn(() => new Date())
    .notNull(),
});
```

- [ ] **Step 2: Add commitMessage to queryHistory**

In the same file, find the `queryHistory` table definition and add `commitMessage`:

```typescript
export const queryHistory = pgTable("query_history", {
  id: text("id").primaryKey(),
  projectId: text("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  query: text("query").notNull(),
  type: executionType("type").notNull(),
  commitMessage: text("commit_message"),   // ADD THIS LINE
  createdAt: timestamp("created_at")
    .$defaultFn(() => new Date())
    .notNull(),
});
```

- [ ] **Step 3: Push schema to Neon**

```powershell
cd c:\HARI\ETAIH\xbase-app
npx drizzle-kit push
```

Expected: prompts to create 2 new tables and 1 new column. Accept all.

- [ ] **Step 4: Commit**

```powershell
git add src/db/schema.ts
git commit -m "feat: add notifications, projectInvitations tables and commitMessage to queryHistory"
```

---

### Task 2: Redirect Routing Updates

**Files:**
- Modify: `src/app/page.tsx`
- Modify: `src/app/[project]/page.tsx`

- [ ] **Step 1: Update root page to redirect logged-in users**

Replace `src/app/page.tsx` entirely:

```typescript
import LandingPage from '@/modules/landing/landing-page';
import { auth } from '@/lib/auth';
import { headers } from "next/headers";
import { redirect } from "next/navigation";

export default async function Home() {
  const session = await auth.api.getSession({
    headers: await headers()
  });

  if (session) {
    redirect('/dashboard');
  }

  return <LandingPage />;
}
```

- [ ] **Step 2: Update project index page to redirect to /tables**

Replace `src/app/[project]/page.tsx` entirely:

```typescript
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

interface Props {
  params: Promise<{ project: string }>;
}

export default async function ProjectPage({ params }: Props) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect('/');

  const { project } = await params;
  redirect(`/${project}/tables`);
}
```

- [ ] **Step 3: Commit**

```powershell
git add src/app/page.tsx src/app/[project]/page.tsx
git commit -m "feat: redirect root to /dashboard and /[project] to /[project]/tables"
```

---

### Task 3: Dashboard Page (Project Selection)

**Files:**
- Create: `src/app/dashboard/page.tsx`
- Create: `src/modules/dashboard/dashboard-view.tsx`

- [ ] **Step 1: Create dashboard page (server component)**

Create `src/app/dashboard/page.tsx`:

```typescript
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import DashboardView from "@/modules/dashboard/dashboard-view";

export default async function DashboardPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect('/');

  return <DashboardView user={session.user} />;
}
```

- [ ] **Step 2: Create DashboardView client component**

Create `src/modules/dashboard/dashboard-view.tsx`:

```typescript
"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Plus, Database, LogOut, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { User } from "better-auth";

interface Project {
  id: string;
  name: string;
  neonApiKey?: string | null;
  hostName?: string | null;
  isOwner?: boolean;
  role?: "owner" | "editor" | "viewer";
  createdAt: string;
}

const getJson = async <T,>(url: string): Promise<T> => {
  const res = await fetch(url);
  const data = await res.json();
  if (!res.ok) throw new Error(data?.message || "Request failed");
  return data as T;
};

const postJson = async <T,>(url: string, body: unknown): Promise<T> => {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.message || "Request failed");
  return data as T;
};

export default function DashboardView({ user }: { user: User }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [apiKey, setApiKey] = useState("");

  const { data: projects = [] } = useQuery({
    queryKey: ["projects", user.id],
    queryFn: () =>
      getJson<Project[]>(`/api/project/get-all?userId=${encodeURIComponent(user.id)}`),
  });

  const createProject = useMutation({
    mutationFn: () => postJson("/api/project/create", { name, neonApiKey: apiKey }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      setOpen(false);
      setName("");
      setApiKey("");
      toast.success("Project created");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const roleColor = (role?: string) => {
    if (role === "owner") return "text-green-400";
    if (role === "editor") return "text-blue-400";
    return "text-gray-400";
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      {/* Header */}
      <div className="border-b border-gray-800/60 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Sparkles className="h-5 w-5 text-green-400" />
          <span className="font-semibold text-lg">XBase</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-400">{user.email}</span>
          <Button
            variant="ghost"
            size="sm"
            className="text-gray-400 hover:text-white"
            onClick={() => authClient.signOut().then(() => router.push("/"))}
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-5xl mx-auto px-6 py-10">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold">Your Projects</h1>
            <p className="text-gray-400 text-sm mt-1">
              Select a project to open the workspace
            </p>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="bg-green-500/10 border border-green-500/30 text-green-400 hover:bg-green-500/20 hover:border-green-500/50">
                <Plus className="h-4 w-4 mr-2" />
                New Project
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-[#111] border-gray-800 text-white">
              <DialogHeader>
                <DialogTitle>Create New Project</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 mt-2">
                <div>
                  <Label className="text-gray-300">Project Name</Label>
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="my-database"
                    className="mt-1 bg-black/40 border-gray-700 text-white"
                  />
                </div>
                <div>
                  <Label className="text-gray-300">Neon Connection String</Label>
                  <Textarea
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="postgresql://user:pass@host/db"
                    rows={3}
                    className="mt-1 bg-black/40 border-gray-700 text-white text-xs font-mono"
                  />
                </div>
                <Button
                  onClick={() => createProject.mutate()}
                  disabled={!name.trim() || !apiKey.trim() || createProject.isPending}
                  className="w-full bg-green-500/20 border border-green-500/40 text-green-400 hover:bg-green-500/30"
                >
                  {createProject.isPending ? "Creating..." : "Create Project"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {projects.length === 0 ? (
          <div className="text-center py-20 text-gray-500">
            <Database className="h-12 w-12 mx-auto mb-4 opacity-30" />
            <p className="text-lg">No projects yet</p>
            <p className="text-sm mt-1">Create your first project to get started</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {projects.map((p) => (
              <button
                key={p.id}
                onClick={() => router.push(`/${encodeURIComponent(p.name)}/tables`)}
                className="text-left p-5 rounded-xl bg-[#111] border border-gray-800 hover:border-green-500/40 hover:bg-[#141414] transition-all group"
              >
                <div className="flex items-start justify-between mb-3">
                  <Database className="h-5 w-5 text-green-400 group-hover:text-green-300" />
                  <span className={`text-xs font-medium capitalize ${roleColor(p.role)}`}>
                    {p.role ?? "viewer"}
                  </span>
                </div>
                <p className="font-semibold text-white truncate">{p.name}</p>
                {p.hostName && !p.isOwner && (
                  <p className="text-xs text-gray-500 mt-1">by {p.hostName}</p>
                )}
                <p className="text-xs text-gray-600 mt-2">
                  {new Date(p.createdAt).toLocaleDateString()}
                </p>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```powershell
git add src/app/dashboard/page.tsx src/modules/dashboard/dashboard-view.tsx
git commit -m "feat: add /dashboard project selection page"
```

---

### Task 4: Workspace Shell (Sidebar + Header + Layout)

**Files:**
- Create: `src/app/[project]/layout.tsx`
- Create: `src/modules/workspace/workspace-shell.tsx`
- Create: `src/modules/workspace/sidebar.tsx`
- Create: `src/modules/workspace/workspace-header.tsx`

- [ ] **Step 1: Create workspace layout (server component)**

Create `src/app/[project]/layout.tsx`:

```typescript
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { WorkspaceShell } from "@/modules/workspace/workspace-shell";

interface Props {
  children: React.ReactNode;
  params: Promise<{ project: string }>;
}

export default async function WorkspaceLayout({ children, params }: Props) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect('/');

  const { project } = await params;

  return (
    <WorkspaceShell
      projectName={decodeURIComponent(project)}
      user={session.user}
    >
      {children}
    </WorkspaceShell>
  );
}
```

- [ ] **Step 2: Create WorkspaceShell client component**

Create `src/modules/workspace/workspace-shell.tsx`:

```typescript
"use client";

import { User } from "better-auth";
import { Sidebar } from "./sidebar";
import { WorkspaceHeader } from "./workspace-header";

interface Props {
  projectName: string;
  user: User;
  children: React.ReactNode;
}

export function WorkspaceShell({ projectName, user, children }: Props) {
  return (
    <div className="flex h-screen bg-[#0a0a0a] text-white overflow-hidden">
      <Sidebar projectName={projectName} />
      <div className="flex-1 flex flex-col min-w-0">
        <WorkspaceHeader projectName={projectName} user={user} />
        <main className="flex-1 overflow-hidden">
          {children}
        </main>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Create Sidebar component**

Create `src/modules/workspace/sidebar.tsx`:

```typescript
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Database,
  BarChart2,
  Brain,
  Sparkles,
  History,
  Key,
  Users,
  ChevronLeft,
  Layers,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";

interface SidebarProps {
  projectName: string;
}

const sections = [
  { label: "Tables", icon: Database, path: "tables" },
  { label: "Visualisation", icon: BarChart2, path: "visualisation" },
  { label: "ML & SmartFill", icon: Brain, path: "ml" },
  { label: "XAI", icon: Sparkles, path: "xai" },
  { label: "History", icon: History, path: "history" },
  { label: "APIs", icon: Key, path: "apis" },
  { label: "Contributors", icon: Users, path: "contributors" },
];

export function Sidebar({ projectName }: SidebarProps) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const base = `/${encodeURIComponent(projectName)}`;

  return (
    <aside
      className={cn(
        "flex flex-col bg-[#0f0f0f] border-r border-gray-800/60 transition-all duration-200 shrink-0",
        collapsed ? "w-14" : "w-52"
      )}
    >
      {/* Logo / project name */}
      <div className="flex items-center gap-2 px-3 py-4 border-b border-gray-800/60 h-14">
        <Layers className="h-5 w-5 text-green-400 shrink-0" />
        {!collapsed && (
          <span className="text-sm font-semibold truncate text-white">
            {projectName}
          </span>
        )}
      </div>

      {/* Nav items */}
      <nav className="flex-1 py-3 space-y-0.5 px-2">
        {sections.map(({ label, icon: Icon, path }) => {
          const href = `${base}/${path}`;
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link
              key={path}
              href={href}
              className={cn(
                "flex items-center gap-3 px-2 py-2 rounded-lg text-sm transition-all",
                active
                  ? "bg-green-500/10 text-green-400 border border-green-500/20"
                  : "text-gray-400 hover:text-white hover:bg-white/5"
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {!collapsed && <span>{label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Collapse toggle */}
      <div className="px-2 py-3 border-t border-gray-800/60">
        <button
          onClick={() => setCollapsed((c) => !c)}
          className="flex items-center gap-2 px-2 py-2 rounded-lg text-gray-500 hover:text-white hover:bg-white/5 w-full text-sm transition-all"
        >
          <ChevronLeft
            className={cn(
              "h-4 w-4 shrink-0 transition-transform",
              collapsed && "rotate-180"
            )}
          />
          {!collapsed && <span>Collapse</span>}
        </button>
      </div>
    </aside>
  );
}
```

- [ ] **Step 4: Create WorkspaceHeader component**

Create `src/modules/workspace/workspace-header.tsx`:

```typescript
"use client";

import { User } from "better-auth";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { LogOut, Home } from "lucide-react";
import { NotificationCenter } from "@/modules/notifications/notification-center";
import { useQuery } from "@tanstack/react-query";

interface Props {
  projectName: string;
  user: User;
}

interface Project {
  id: string;
  name: string;
  role?: string;
}

export function WorkspaceHeader({ projectName, user }: Props) {
  const router = useRouter();

  const { data: projects = [] } = useQuery<Project[]>({
    queryKey: ["projects", user.id],
    queryFn: async () => {
      const res = await fetch(`/api/project/get-all?userId=${encodeURIComponent(user.id)}`);
      return res.json();
    },
  });

  const project = projects.find((p) => p.name === projectName);

  return (
    <header className="h-14 border-b border-gray-800/60 flex items-center justify-between px-4 bg-[#0f0f0f] shrink-0">
      <div className="flex items-center gap-2">
        <button
          onClick={() => router.push("/dashboard")}
          className="text-gray-500 hover:text-white transition-colors"
          title="Back to projects"
        >
          <Home className="h-4 w-4" />
        </button>
        <span className="text-gray-600">/</span>
        <span className="text-sm text-gray-300 font-medium">{projectName}</span>
        {project?.role && (
          <span className="text-xs px-2 py-0.5 rounded-full bg-gray-800 text-gray-400 capitalize">
            {project.role}
          </span>
        )}
      </div>

      <div className="flex items-center gap-2">
        {project?.id && (
          <NotificationCenter userId={user.id} projectId={project.id} />
        )}
        <span className="text-xs text-gray-500 hidden sm:block">{user.email}</span>
        <Button
          variant="ghost"
          size="sm"
          className="text-gray-500 hover:text-white h-8 w-8 p-0"
          onClick={() => authClient.signOut().then(() => router.push("/"))}
          title="Sign out"
        >
          <LogOut className="h-3.5 w-3.5" />
        </Button>
      </div>
    </header>
  );
}
```

- [ ] **Step 5: Create section page stubs**

Create each section page as a thin wrapper. Create `src/app/[project]/tables/page.tsx`:

```typescript
import TablesView from "@/modules/workspace/views/tables-view";

export default function TablesPage() {
  return <TablesView />;
}
```

Create `src/app/[project]/visualisation/page.tsx`:
```typescript
import VisualisationView from "@/modules/workspace/views/visualisation-view";
export default function VisualisationPage() { return <VisualisationView />; }
```

Create `src/app/[project]/ml/page.tsx`:
```typescript
import MlView from "@/modules/workspace/views/ml-view";
export default function MlPage() { return <MlView />; }
```

Create `src/app/[project]/xai/page.tsx`:
```typescript
import XaiView from "@/modules/workspace/views/xai-view";
export default function XaiPage() { return <XaiView />; }
```

Create `src/app/[project]/history/page.tsx`:
```typescript
import HistoryView from "@/modules/workspace/views/history-view";
export default function HistoryPage() { return <HistoryView />; }
```

Create `src/app/[project]/apis/page.tsx`:
```typescript
import ApisView from "@/modules/workspace/views/apis-view";
export default function ApisPage() { return <ApisView />; }
```

Create `src/app/[project]/contributors/page.tsx`:
```typescript
import ContributorsView from "@/modules/workspace/views/contributors-view";
export default function ContributorsPage() { return <ContributorsView />; }
```

Also create a placeholder `src/modules/notifications/notification-center.tsx` so the header compiles:

```typescript
"use client";
export function NotificationCenter({ userId, projectId }: { userId: string; projectId: string }) {
  return null; // implemented in Task 11
}
```

- [ ] **Step 6: Type-check**

```powershell
cd c:\HARI\ETAIH\xbase-app
npx tsc --noEmit 2>&1 | Select-Object -First 40
```

Fix any type errors before proceeding.

- [ ] **Step 7: Commit**

```powershell
git add src/app/[project]/layout.tsx src/app/[project]/tables src/app/[project]/visualisation src/app/[project]/ml src/app/[project]/xai src/app/[project]/history src/app/[project]/apis src/app/[project]/contributors src/modules/workspace src/modules/notifications
git commit -m "feat: workspace shell with sidebar, header, and section page stubs"
```

---

### Task 5: Tables View

**Files:**
- Create: `src/modules/workspace/views/tables-view.tsx`

This view replicates the SQL editor, Python editor, table list, and data viewer from the old `project-layout.tsx`. Read `src/modules/home/project-layout.tsx` for the exact logic.

- [ ] **Step 1: Create tables-view.tsx**

Create `src/modules/workspace/views/tables-view.tsx`:

```typescript
"use client";

import { useState, useEffect, useMemo } from "react";
import { useParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
  if (!res.ok) throw new Error(data?.message || "Failed");
  return data as T;
};

const postJson = async <T,>(url: string, body: unknown): Promise<T> => {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.message || "Failed");
  return data as T;
};

export default function TablesView() {
  const params = useParams();
  const projectName = decodeURIComponent((params?.project as string) || "");
  const { data: session } = authClient.useSession();
  const userId = session?.user?.id;

  const { data: projects = [] } = useQuery<Array<{ id: string; name: string; neonApiKey?: string | null; role?: string }>>({
    queryKey: ["projects", userId],
    queryFn: () => getJson(`/api/project/get-all?userId=${encodeURIComponent(userId!)}`),
    enabled: !!userId,
  });

  const currentProject = projects.find((p) => p.name === projectName);
  const projectId = currentProject?.id;
  const isViewer = currentProject?.role === "viewer";

  const { data: tableNames = [], isLoading: tablesLoading } = useQuery<string[]>({
    queryKey: ["neon-tables", projectId],
    queryFn: () => getJson(`/api/neon/list-tables?projectId=${encodeURIComponent(projectId!)}`),
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
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 100;

  useEffect(() => {
    if (!selectedTable && tableNames.length) setSelectedTable(tableNames[0]);
  }, [tableNames, selectedTable]);

  const { data: tableData } = useQuery<{ rows: Record<string, unknown>[]; fields: string[] }>({
    queryKey: ["table-data", projectId, selectedTable, page],
    queryFn: () =>
      getJson(
        `/api/neon/get-table-data?projectId=${encodeURIComponent(projectId!)}&tableName=${encodeURIComponent(selectedTable!)}&limit=${PAGE_SIZE}&offset=${page * PAGE_SIZE}`
      ),
    enabled: !!projectId && !!selectedTable,
  });

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
  }, [pythonTemplate]);

  const runSql = async () => {
    if (!projectId || !sqlQuery.trim()) return;
    if (isViewer) { toast.error("Viewers cannot run SQL queries"); return; }
    setSqlRunning(true);
    try {
      const result = await postJson<SqlResult>("/api/neon/run-sql", { projectId, query: sqlQuery });
      setSqlOutput(result);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "SQL error");
    } finally {
      setSqlRunning(false);
    }
  };

  const runPython = async () => {
    if (!projectId || !pythonCode.trim()) return;
    if (isViewer) { toast.error("Viewers cannot run Python code"); return; }
    setPythonRunning(true);
    try {
      const result = await postJson<PythonResult>("/api/python/execute", { projectId, code: pythonCode });
      setPythonOutput(result);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Python error");
    } finally {
      setPythonRunning(false);
    }
  };

  const filteredTables = tableNames.filter((t) =>
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
          {selectedTable && tableData ? (
            <Table>
              <TableHeader>
                <TableRow className="border-gray-800">
                  {tableData.fields.map((f) => (
                    <TableHead key={f} className="text-gray-400 text-xs whitespace-nowrap">
                      {f}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {tableData.rows.map((row, i) => (
                  <TableRow key={i} className="border-gray-800/40 hover:bg-white/2">
                    {tableData.fields.map((f) => (
                      <TableCell key={f} className="text-xs text-gray-300 whitespace-nowrap max-w-xs truncate">
                        {row[f] === null ? (
                          <span className="text-gray-600 italic">null</span>
                        ) : String(row[f])}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="flex items-center justify-center h-full text-gray-500 text-sm">
              {selectedTable ? "Loading data..." : "Select a table"}
            </div>
          )}
        </div>

        {/* Editor area */}
        <div className="h-64 flex flex-col border-t border-gray-800/40">
          {/* Tab bar */}
          <div className="flex items-center border-b border-gray-800/40 px-3 gap-1 bg-[#0f0f0f]">
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
                ? (sqlRunning ? "Running..." : "Run SQL")
                : (pythonRunning ? "Running..." : "Run Python")}
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
            <div className="w-72 overflow-auto text-xs font-mono p-2 text-gray-300 bg-black/20">
              {activeEditor === "sql" && sqlOutput && (
                <div>
                  <p className="text-green-400 mb-1">{sqlOutput.rowCount} rows</p>
                  <pre className="text-gray-400 overflow-auto">{JSON.stringify(sqlOutput.rows.slice(0, 5), null, 2)}</pre>
                </div>
              )}
              {activeEditor === "python" && pythonOutput && (
                <div>
                  {pythonOutput.error ? (
                    <p className="text-red-400">{pythonOutput.error.message}</p>
                  ) : (
                    <>
                      {pythonOutput.prints && <pre className="text-gray-300">{pythonOutput.prints}</pre>}
                      <pre className="text-green-400">{JSON.stringify(pythonOutput.result, null, 2)?.slice(0, 500)}</pre>
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
```

- [ ] **Step 2: Type-check**

```powershell
npx tsc --noEmit 2>&1 | Select-Object -First 30
```

- [ ] **Step 3: Commit**

```powershell
git add src/modules/workspace/views/tables-view.tsx
git commit -m "feat: tables view with SQL/Python editors and data viewer"
```

---

### Task 6: XAI View (AI Chatbot)

**Files:**
- Create: `src/modules/workspace/views/xai-view.tsx`

The XAI view wraps the existing `ChatInterface` component. Read `src/modules/home/chat-interface.tsx` to understand its props.

- [ ] **Step 1: Check ChatInterface props**

Read `src/modules/home/chat-interface.tsx` lines 1–80 to find the exported component signature.

- [ ] **Step 2: Create xai-view.tsx**

Create `src/modules/workspace/views/xai-view.tsx`. The ChatInterface needs `projectId` and `neonApiKey`. Fetch project data from the URL params + projects API:

```typescript
"use client";

import dynamic from "next/dynamic";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { authClient } from "@/lib/auth-client";

const ChatInterface = dynamic(
  () => import("@/modules/home/chat-interface").then((m) => m.ChatInterface),
  { ssr: false }
);

const getJson = async <T,>(url: string): Promise<T> => {
  const res = await fetch(url);
  const data = await res.json();
  if (!res.ok) throw new Error(data?.message || "Failed");
  return data as T;
};

export default function XaiView() {
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

  const project = projects.find((p) => p.name === projectName);

  if (!project) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500">
        Loading project...
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <ChatInterface
        projectId={project.id}
        neonApiKey={project.neonApiKey ?? ""}
        projectRole={project.role ?? "viewer"}
      />
    </div>
  );
}
```

- [ ] **Step 3: Add projectRole prop to ChatInterface**

Read `src/modules/home/chat-interface.tsx` lines 1–60, find the props interface and add `projectRole?: string` to it. The component itself doesn't need to use it yet — it will be passed down to the AI agent in Task 13.

- [ ] **Step 4: Type-check and commit**

```powershell
npx tsc --noEmit 2>&1 | Select-Object -First 30
git add src/modules/workspace/views/xai-view.tsx src/modules/home/chat-interface.tsx
git commit -m "feat: xai view wrapping existing ChatInterface"
```

---

### Task 7: History View with Commit Messages

**Files:**
- Create: `src/modules/workspace/views/history-view.tsx`
- Modify: `src/app/api/execution/history/route.ts`

- [ ] **Step 1: Update history API to return commitMessage**

The existing route at `src/app/api/execution/history/route.ts` already returns all queryHistory columns. Since we added `commitMessage` to the schema, it will now be included automatically. No change needed.

- [ ] **Step 2: Add a save-with-commit API route**

Create `src/app/api/history/save/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { queryHistory } from "@/db/schema";
import { nanoid } from "nanoid";
import { getProjectRole, getSessionUserId, hasWriteAccess } from "@/lib/project-permissions";

const SaveSchema = z.object({
  projectId: z.string().min(1),
  query: z.string().min(1),
  type: z.enum(["sql", "python"]),
  commitMessage: z.string().min(1).max(200),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const input = SaveSchema.parse(body);
    const userId = await getSessionUserId();
    if (!userId) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    const role = await getProjectRole(input.projectId, userId);
    if (!hasWriteAccess(role)) return NextResponse.json({ message: "Read-only access" }, { status: 403 });
    await db.insert(queryHistory).values({
      id: nanoid(),
      projectId: input.projectId,
      userId,
      query: input.query,
      type: input.type,
      commitMessage: input.commitMessage,
    });
    return NextResponse.json({ message: "Saved" });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ message: "Invalid payload" }, { status: 400 });
    return NextResponse.json({ message: "Internal error" }, { status: 500 });
  }
}
```

- [ ] **Step 3: Create history-view.tsx**

Create `src/modules/workspace/views/history-view.tsx`:

```typescript
"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Copy, GitCommit, Code2, TerminalSquare, Search } from "lucide-react";
import { toast } from "sonner";

interface HistoryRow {
  id: string;
  query: string;
  type: "sql" | "python";
  commitMessage?: string | null;
  createdAt: string;
}

const getJson = async <T,>(url: string): Promise<T> => {
  const res = await fetch(url);
  const data = await res.json();
  if (!res.ok) throw new Error(data?.message || "Failed");
  return data as T;
};

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function HistoryView() {
  const params = useParams();
  const projectName = decodeURIComponent((params?.project as string) || "");
  const { data: session } = authClient.useSession();
  const userId = session?.user?.id;
  const [filter, setFilter] = useState<"all" | "sql" | "python">("all");
  const [search, setSearch] = useState("");
  const [saveOpen, setSaveOpen] = useState(false);
  const [saveCode, setSaveCode] = useState("");
  const [saveType, setSaveType] = useState<"sql" | "python">("sql");
  const [commitMsg, setCommitMsg] = useState("");
  const [saving, setSaving] = useState(false);

  const { data: projects = [] } = useQuery<Array<{ id: string; name: string; role?: string }>>({
    queryKey: ["projects", userId],
    queryFn: async () => {
      const res = await fetch(`/api/project/get-all?userId=${encodeURIComponent(userId!)}`);
      return res.json();
    },
    enabled: !!userId,
  });

  const project = projects.find((p) => p.name === projectName);
  const projectId = project?.id;
  const isViewer = project?.role === "viewer";

  const { data: historyData, refetch } = useQuery<{ data: HistoryRow[] }>({
    queryKey: ["history", projectId],
    queryFn: () => getJson(`/api/execution/history?projectId=${encodeURIComponent(projectId!)}&limit=100`),
    enabled: !!projectId,
  });

  const rows = historyData?.data ?? [];
  const filtered = rows.filter((r) => {
    if (filter !== "all" && r.type !== filter) return false;
    if (search && !r.query.toLowerCase().includes(search.toLowerCase()) &&
        !r.commitMessage?.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const handleSave = async () => {
    if (!projectId || !commitMsg.trim() || !saveCode.trim()) return;
    setSaving(true);
    try {
      await fetch("/api/history/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, query: saveCode, type: saveType, commitMessage: commitMsg }),
      });
      toast.success("Saved to history");
      setSaveOpen(false);
      setCommitMsg("");
      setSaveCode("");
      refetch();
    } catch {
      toast.error("Save failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col h-full p-4 gap-4">
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-2 top-2 h-3.5 w-3.5 text-gray-500" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search history..."
            className="pl-7 h-8 text-sm bg-black/40 border-gray-700 text-white"
          />
        </div>
        <div className="flex gap-1">
          {(["all", "sql", "python"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1 rounded text-xs capitalize transition-colors ${
                filter === f
                  ? "bg-green-500/20 text-green-400 border border-green-500/30"
                  : "text-gray-500 hover:text-white"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
        {!isViewer && (
          <Button
            size="sm"
            onClick={() => setSaveOpen(true)}
            className="ml-auto h-8 text-xs bg-amber-500/10 border border-amber-500/30 text-amber-400 hover:bg-amber-500/20"
          >
            <GitCommit className="h-3.5 w-3.5 mr-1" />
            Save with Commit
          </Button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto space-y-2">
        {filtered.length === 0 ? (
          <p className="text-gray-500 text-sm text-center py-10">No history yet</p>
        ) : (
          filtered.map((row) => (
            <div
              key={row.id}
              className="bg-[#111] border border-gray-800/60 rounded-lg p-3 group"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  {row.type === "sql" ? (
                    <Code2 className="h-3.5 w-3.5 text-blue-400 shrink-0" />
                  ) : (
                    <TerminalSquare className="h-3.5 w-3.5 text-purple-400 shrink-0" />
                  )}
                  <Badge
                    variant="outline"
                    className={`text-xs border-0 ${row.type === "sql" ? "bg-blue-500/10 text-blue-400" : "bg-purple-500/10 text-purple-400"}`}
                  >
                    {row.type.toUpperCase()}
                  </Badge>
                  {row.commitMessage && (
                    <span className="text-xs text-amber-400 flex items-center gap-1">
                      <GitCommit className="h-3 w-3" />
                      {row.commitMessage}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-600">{timeAgo(row.createdAt)}</span>
                  <button
                    onClick={() => { navigator.clipboard.writeText(row.query); toast.success("Copied"); }}
                    className="opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Copy className="h-3.5 w-3.5 text-gray-500 hover:text-white" />
                  </button>
                </div>
              </div>
              <pre className="mt-2 text-xs text-gray-400 font-mono overflow-x-auto whitespace-pre-wrap line-clamp-3">
                {row.query}
              </pre>
            </div>
          ))
        )}
      </div>

      {/* Save with commit dialog */}
      <Dialog open={saveOpen} onOpenChange={setSaveOpen}>
        <DialogContent className="bg-[#111] border-gray-800 text-white">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <GitCommit className="h-4 w-4 text-amber-400" />
              Save to History
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mt-2">
            <div className="flex gap-2">
              {(["sql", "python"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setSaveType(t)}
                  className={`px-3 py-1 rounded text-xs uppercase transition-colors ${
                    saveType === t
                      ? "bg-green-500/20 text-green-400 border border-green-500/30"
                      : "text-gray-500 border border-gray-800"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
            <textarea
              value={saveCode}
              onChange={(e) => setSaveCode(e.target.value)}
              placeholder={saveType === "sql" ? "SELECT ..." : "import pandas as pd\n..."}
              rows={5}
              className="w-full bg-black/40 border border-gray-700 rounded text-xs font-mono text-white p-2 resize-none focus:outline-none focus:border-gray-600"
            />
            <Input
              value={commitMsg}
              onChange={(e) => setCommitMsg(e.target.value)}
              placeholder="Commit message (e.g. 'Fixed revenue calc')"
              className="bg-black/40 border-gray-700 text-white"
            />
            <Button
              onClick={handleSave}
              disabled={saving || !commitMsg.trim() || !saveCode.trim()}
              className="w-full bg-amber-500/10 border border-amber-500/30 text-amber-400 hover:bg-amber-500/20"
            >
              {saving ? "Saving..." : "Save"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
```

- [ ] **Step 4: Type-check and commit**

```powershell
npx tsc --noEmit 2>&1 | Select-Object -First 30
git add src/modules/workspace/views/history-view.tsx src/app/api/history/save/route.ts
git commit -m "feat: history view with commit messages"
```

---

### Task 8: APIs View

**Files:**
- Create: `src/modules/workspace/views/apis-view.tsx`
- Create: `src/app/api/project/revoke-api-key/route.ts`

- [ ] **Step 1: Create revoke API key route**

Create `src/app/api/project/revoke-api-key/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { projectApiKeys } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { getProjectRole, getSessionUserId } from "@/lib/project-permissions";

const RevokeSchema = z.object({ keyId: z.string().min(1), projectId: z.string().min(1) });

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const input = RevokeSchema.parse(body);
    const userId = await getSessionUserId();
    if (!userId) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    const role = await getProjectRole(input.projectId, userId);
    if (role !== "owner") return NextResponse.json({ message: "Owner only" }, { status: 403 });
    await db.delete(projectApiKeys).where(
      and(eq(projectApiKeys.id, input.keyId), eq(projectApiKeys.projectId, input.projectId))
    );
    return NextResponse.json({ message: "Revoked" });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ message: "Invalid" }, { status: 400 });
    return NextResponse.json({ message: "Internal error" }, { status: 500 });
  }
}
```

- [ ] **Step 2: Create apis-view.tsx**

Create `src/modules/workspace/views/apis-view.tsx`:

```typescript
"use client";

import { useParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Copy, Plus, Trash2, Key } from "lucide-react";

interface ApiKey {
  id: string;
  apiKey: string;
  createdAt: string;
  isActive: boolean;
}

const postJson = async <T,>(url: string, body: unknown): Promise<T> => {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.message || "Failed");
  return data as T;
};

export default function ApisView() {
  const params = useParams();
  const projectName = decodeURIComponent((params?.project as string) || "");
  const { data: session } = authClient.useSession();
  const userId = session?.user?.id;
  const queryClient = useQueryClient();

  const { data: projects = [] } = useQuery<Array<{ id: string; name: string; role?: string }>>({
    queryKey: ["projects", userId],
    queryFn: async () => { const res = await fetch(`/api/project/get-all?userId=${encodeURIComponent(userId!)}`); return res.json(); },
    enabled: !!userId,
  });

  const project = projects.find((p) => p.name === projectName);
  const projectId = project?.id;
  const isOwner = project?.role === "owner";

  const { data: keysData } = useQuery<{ data: ApiKey[] }>({
    queryKey: ["api-keys", projectId],
    queryFn: async () => { const res = await fetch(`/api/project/api-keys?projectId=${encodeURIComponent(projectId!)}`); return res.json(); },
    enabled: !!projectId && isOwner,
  });

  const keys = keysData?.data ?? [];

  const createKey = useMutation({
    mutationFn: () => postJson("/api/project/create-api-key", { projectId }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["api-keys"] }); toast.success("API key created"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const revokeKey = useMutation({
    mutationFn: (keyId: string) => postJson("/api/project/revoke-api-key", { keyId, projectId }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["api-keys"] }); toast.success("Key revoked"); },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!isOwner) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center text-gray-500">
          <Key className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p>Only the project owner can manage API keys</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold">API Keys</h2>
          <p className="text-sm text-gray-400 mt-0.5">Keys for the external /api/external/run endpoint</p>
        </div>
        <Button
          onClick={() => createKey.mutate()}
          disabled={createKey.isPending}
          className="bg-green-500/10 border border-green-500/30 text-green-400 hover:bg-green-500/20"
        >
          <Plus className="h-4 w-4 mr-2" />
          {createKey.isPending ? "Creating..." : "New Key"}
        </Button>
      </div>

      {keys.length === 0 ? (
        <div className="text-center py-10 text-gray-500 border border-dashed border-gray-800 rounded-xl">
          <Key className="h-8 w-8 mx-auto mb-2 opacity-30" />
          <p className="text-sm">No API keys yet</p>
        </div>
      ) : (
        <div className="space-y-3">
          {keys.map((k) => (
            <div key={k.id} className="flex items-center gap-3 bg-[#111] border border-gray-800 rounded-lg p-3">
              <Key className="h-4 w-4 text-gray-500 shrink-0" />
              <code className="flex-1 text-xs font-mono text-gray-300 truncate">
                {k.apiKey.slice(0, 12)}...{k.apiKey.slice(-8)}
              </code>
              <span className="text-xs text-gray-600">
                {new Date(k.createdAt).toLocaleDateString()}
              </span>
              <button
                onClick={() => { navigator.clipboard.writeText(k.apiKey); toast.success("Copied"); }}
                className="text-gray-500 hover:text-white transition-colors"
              >
                <Copy className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => revokeKey.mutate(k.id)}
                disabled={revokeKey.isPending}
                className="text-gray-500 hover:text-red-400 transition-colors"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Type-check and commit**

```powershell
npx tsc --noEmit 2>&1 | Select-Object -First 30
git add src/modules/workspace/views/apis-view.tsx src/app/api/project/revoke-api-key/route.ts
git commit -m "feat: apis view with create/revoke API key management"
```

---

### Task 9: ML & SmartFill View

**Files:**
- Create: `src/modules/workspace/views/ml-view.tsx`

This view embeds the SmartFill and Apriori dialogs' content inline (not as dialogs). Read `src/modules/home/smart-fill-dialog.tsx` and `src/modules/home/apriori-dialog.tsx` to understand their logic, then extract it.

- [ ] **Step 1: Create ml-view.tsx**

Create `src/modules/workspace/views/ml-view.tsx`:

```typescript
"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { authClient } from "@/lib/auth-client";
import { SmartFillDialog } from "@/modules/home/smart-fill-dialog";
import { AprioriDialog } from "@/modules/home/apriori-dialog";
import { Brain, Network } from "lucide-react";

const getJson = async <T,>(url: string): Promise<T> => {
  const res = await fetch(url);
  const data = await res.json();
  if (!res.ok) throw new Error(data?.message || "Failed");
  return data as T;
};

export default function MlView() {
  const params = useParams();
  const projectName = decodeURIComponent((params?.project as string) || "");
  const { data: session } = authClient.useSession();
  const userId = session?.user?.id;
  const [activeTab, setActiveTab] = useState<"smartfill" | "apriori">("smartfill");
  const [smartFillOpen, setSmartFillOpen] = useState(false);
  const [aprioriOpen, setAprioriOpen] = useState(false);
  const [selectedTable, setSelectedTable] = useState<string | null>(null);

  const { data: projects = [] } = useQuery<Array<{ id: string; name: string; neonApiKey?: string | null; role?: string }>>({
    queryKey: ["projects", userId],
    queryFn: () => getJson(`/api/project/get-all?userId=${encodeURIComponent(userId!)}`),
    enabled: !!userId,
  });

  const project = projects.find((p) => p.name === projectName);
  const projectId = project?.id;

  const { data: tableNames = [] } = useQuery<string[]>({
    queryKey: ["neon-tables", projectId],
    queryFn: () => getJson(`/api/neon/list-tables?projectId=${encodeURIComponent(projectId!)}`),
    enabled: !!projectId,
  });

  const { data: tableData } = useQuery<{ rows: Record<string, unknown>[]; fields: string[] }>({
    queryKey: ["table-data-ml", projectId, selectedTable],
    queryFn: () => getJson(`/api/neon/get-table-data?projectId=${encodeURIComponent(projectId!)}&tableName=${encodeURIComponent(selectedTable!)}&limit=500`),
    enabled: !!projectId && !!selectedTable,
  });

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

      {/* Table selector */}
      {tableNames.length > 0 && (
        <div className="mb-4">
          <label className="text-xs text-gray-400 mb-1 block">Select Table</label>
          <select
            value={selectedTable ?? ""}
            onChange={(e) => setSelectedTable(e.target.value)}
            className="bg-black/40 border border-gray-700 text-white text-sm rounded px-3 py-2 w-full max-w-xs"
          >
            <option value="">-- choose table --</option>
            {tableNames.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>
      )}

      {!projectId ? (
        <p className="text-gray-500 text-sm">Loading project...</p>
      ) : !selectedTable ? (
        <p className="text-gray-500 text-sm">Select a table above to continue</p>
      ) : activeTab === "smartfill" ? (
        <>
          <p className="text-sm text-gray-400 mb-4">
            Predict missing values in a column using RandomForest trained on other columns.
          </p>
          <button
            onClick={() => setSmartFillOpen(true)}
            className="px-4 py-2 rounded-lg bg-green-500/10 border border-green-500/30 text-green-400 text-sm hover:bg-green-500/20 transition-all"
          >
            Open Smart Fill
          </button>
          {smartFillOpen && tableData && (
            <SmartFillDialog
              open={smartFillOpen}
              onOpenChange={setSmartFillOpen}
              projectId={projectId}
              rows={tableData.rows}
              columns={tableData.fields}
              tableName={selectedTable}
            />
          )}
        </>
      ) : (
        <>
          <p className="text-sm text-gray-400 mb-4">
            Discover association rules using the Apriori algorithm.
          </p>
          <button
            onClick={() => setAprioriOpen(true)}
            className="px-4 py-2 rounded-lg bg-purple-500/10 border border-purple-500/30 text-purple-400 text-sm hover:bg-purple-500/20 transition-all"
          >
            Open Association Mining
          </button>
          {aprioriOpen && tableData && (
            <AprioriDialog
              open={aprioriOpen}
              onOpenChange={setAprioriOpen}
              projectId={projectId}
              rows={tableData.rows}
              columns={tableData.fields}
            />
          )}
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Type-check and commit**

```powershell
npx tsc --noEmit 2>&1 | Select-Object -First 30
git add src/modules/workspace/views/ml-view.tsx
git commit -m "feat: ml view with smart fill and apriori association mining"
```

---

### Task 10: Visualisation View

**Files:**
- Create: `src/modules/workspace/views/visualisation-view.tsx`

AI generates Python chart code → sends to backend → shows base64 image. Images stored in component state per session.

- [ ] **Step 1: Create visualisation-view.tsx**

Create `src/modules/workspace/views/visualisation-view.tsx`:

```typescript
"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sparkles, Download, Loader2, BarChart2 } from "lucide-react";
import { toast } from "sonner";
import OpenAI from "openai";

interface ChartEntry {
  id: string;
  prompt: string;
  code: string;
  imageBase64: string;
  createdAt: Date;
}

const postJson = async <T,>(url: string, body: unknown): Promise<T> => {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.message || "Failed");
  return data as T;
};

const getJson = async <T,>(url: string): Promise<T> => {
  const res = await fetch(url);
  const data = await res.json();
  if (!res.ok) throw new Error(data?.message || "Failed");
  return data as T;
};

export default function VisualisationView() {
  const params = useParams();
  const projectName = decodeURIComponent((params?.project as string) || "");
  const { data: session } = authClient.useSession();
  const userId = session?.user?.id;
  const [prompt, setPrompt] = useState("");
  const [generating, setGenerating] = useState(false);
  const [gallery, setGallery] = useState<ChartEntry[]>([]);
  const [selectedTable, setSelectedTable] = useState<string | null>(null);

  const { data: projects = [] } = useQuery<Array<{ id: string; name: string; neonApiKey?: string | null; role?: string }>>({
    queryKey: ["projects", userId],
    queryFn: () => getJson(`/api/project/get-all?userId=${encodeURIComponent(userId!)}`),
    enabled: !!userId,
  });

  const project = projects.find((p) => p.name === projectName);
  const projectId = project?.id;
  const isViewer = project?.role === "viewer";

  const { data: tableNames = [] } = useQuery<string[]>({
    queryKey: ["neon-tables", projectId],
    queryFn: () => getJson(`/api/neon/list-tables?projectId=${encodeURIComponent(projectId!)}`),
    enabled: !!projectId,
  });

  const generate = async () => {
    if (!projectId || !prompt.trim() || !selectedTable) {
      toast.error("Select a table and describe your chart");
      return;
    }
    if (isViewer) { toast.error("Viewers cannot generate charts"); return; }
    setGenerating(true);
    try {
      // Step 1: Ask AI to generate Python code
      const aiRes = await postJson<{ code: string }>("/api/visualisation/generate", {
        projectId,
        prompt,
        tableName: selectedTable,
      });

      // Step 2: Execute the generated code
      const execRes = await postJson<{ prints: string; result: unknown; error: { message: string } | null }>(
        "/api/python/execute",
        { projectId, code: aiRes.code }
      );

      if (execRes.error) {
        toast.error(execRes.error.message);
        return;
      }

      const result = execRes.result as Record<string, unknown>;
      const imageBase64 = result?.image_base64 as string;
      if (!imageBase64) {
        toast.error("No image generated. Make sure your chart uses matplotlib.");
        return;
      }

      setGallery((prev) => [
        {
          id: crypto.randomUUID(),
          prompt,
          code: aiRes.code,
          imageBase64,
          createdAt: new Date(),
        },
        ...prev,
      ]);
      setPrompt("");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Generation failed");
    } finally {
      setGenerating(false);
    }
  };

  const downloadImage = (entry: ChartEntry) => {
    const a = document.createElement("a");
    a.href = `data:image/png;base64,${entry.imageBase64}`;
    a.download = `chart-${Date.now()}.png`;
    a.click();
  };

  return (
    <div className="flex flex-col h-full">
      {/* Prompt bar */}
      <div className="border-b border-gray-800/60 p-4 bg-[#0f0f0f]">
        <div className="flex gap-2 max-w-3xl">
          <select
            value={selectedTable ?? ""}
            onChange={(e) => setSelectedTable(e.target.value || null)}
            className="bg-black/40 border border-gray-700 text-white text-sm rounded px-3 py-2 w-40 shrink-0"
          >
            <option value="">Table...</option>
            {tableNames.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <Input
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && generate()}
            placeholder="Describe your chart, e.g. 'Bar chart of sales by region'"
            className="flex-1 bg-black/40 border-gray-700 text-white"
            disabled={generating || isViewer}
          />
          <Button
            onClick={generate}
            disabled={generating || !prompt.trim() || !selectedTable || isViewer}
            className="bg-green-500/10 border border-green-500/30 text-green-400 hover:bg-green-500/20 shrink-0"
          >
            {generating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            <span className="ml-2">{generating ? "Generating..." : "Generate"}</span>
          </Button>
        </div>
      </div>

      {/* Gallery */}
      <div className="flex-1 overflow-y-auto p-4">
        {gallery.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-500">
            <BarChart2 className="h-12 w-12 mb-4 opacity-20" />
            <p className="text-sm">No charts yet. Describe a chart above to generate one.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {gallery.map((entry) => (
              <div key={entry.id} className="bg-[#111] border border-gray-800 rounded-xl overflow-hidden">
                <img
                  src={`data:image/png;base64,${entry.imageBase64}`}
                  alt={entry.prompt}
                  className="w-full"
                />
                <div className="p-3 flex items-center justify-between gap-2">
                  <p className="text-xs text-gray-400 flex-1 truncate">{entry.prompt}</p>
                  <button
                    onClick={() => downloadImage(entry)}
                    className="text-gray-500 hover:text-white transition-colors shrink-0"
                    title="Download PNG"
                  >
                    <Download className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create visualisation AI generation API route**

Create `src/app/api/visualisation/generate/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { z } from "zod";
import OpenAI from "openai";
import { db } from "@/db";
import { projects } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getProjectRole, getSessionUserId, hasWriteAccess } from "@/lib/project-permissions";

const GenerateSchema = z.object({
  projectId: z.string().min(1),
  prompt: z.string().min(1),
  tableName: z.string().min(1),
});

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const input = GenerateSchema.parse(body);
    const userId = await getSessionUserId();
    if (!userId) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    const role = await getProjectRole(input.projectId, userId);
    if (!hasWriteAccess(role)) return NextResponse.json({ message: "Read-only" }, { status: 403 });

    const project = await db.query.projects.findFirst({ where: eq(projects.id, input.projectId) });
    if (!project?.neonApiKey) return NextResponse.json({ message: "No DB connection" }, { status: 400 });

    const systemPrompt = `You are a Python data visualization expert. Generate Python code that:
1. Connects to the database using psycopg2 with the given DATABASE_URL
2. Queries the specified table
3. Creates a matplotlib chart based on the user's request
4. The last line MUST be: result = fig_to_base64(fig)
where fig is the matplotlib figure object.
5. Use fig_to_base64 which is already available in scope — do NOT import it.
6. DATABASE_URL is already available as a variable — do NOT define it.
7. Only return the Python code, no explanation.`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4.1-mini",
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: `Database connection string is available as DATABASE_URL variable.\nTable: ${input.tableName}\nChart request: ${input.prompt}`,
        },
      ],
      temperature: 0.2,
    });

    let code = completion.choices[0]?.message?.content ?? "";
    // Strip markdown code fences
    code = code.replace(/^```python\n?/, "").replace(/^```\n?/, "").replace(/\n?```$/, "").trim();

    // Prepend DATABASE_URL injection
    const fullCode = `DATABASE_URL = ${JSON.stringify(project.neonApiKey)}\n\n${code}`;

    return NextResponse.json({ code: fullCode });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ message: "Invalid" }, { status: 400 });
    const msg = error instanceof Error ? error.message : "Internal error";
    return NextResponse.json({ message: msg }, { status: 500 });
  }
}
```

- [ ] **Step 3: Type-check and commit**

```powershell
npx tsc --noEmit 2>&1 | Select-Object -First 30
git add src/modules/workspace/views/visualisation-view.tsx src/app/api/visualisation/generate/route.ts
git commit -m "feat: visualisation view with AI chart generation and download"
```

---

### Task 11: Contributors View + Invitation System

**Files:**
- Create: `src/modules/workspace/views/contributors-view.tsx`
- Create: `src/app/api/project/invite/route.ts`
- Create: `src/app/api/project/accept-invite/route.ts`
- Create: `src/app/api/project/decline-invite/route.ts`
- Create: `src/app/api/project/contributors/route.ts`

- [ ] **Step 1: Create GET contributors route**

Create `src/app/api/project/contributors/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { projectCollaborators, user, projectInvitations } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getProjectRole, getSessionUserId } from "@/lib/project-permissions";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const projectId = z.string().min(1).parse(url.searchParams.get("projectId"));
    const userId = await getSessionUserId();
    if (!userId) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    const role = await getProjectRole(projectId, userId);
    if (!role) return NextResponse.json({ message: "Forbidden" }, { status: 403 });

    const collabs = await db.query.projectCollaborators.findMany({
      where: eq(projectCollaborators.projectId, projectId),
    });

    const userIds = collabs.map((c) => c.userId);
    const users = userIds.length
      ? await db.query.user.findMany({ where: (u, { inArray }) => inArray(u.id, userIds) })
      : [];
    const userMap = new Map(users.map((u) => [u.id, u]));

    const pendingInvites = await db.query.projectInvitations.findMany({
      where: (inv, { and, eq }) => and(eq(inv.projectId, projectId), eq(inv.status, "pending")),
    });

    return NextResponse.json({
      collaborators: collabs.map((c) => ({
        ...c,
        name: userMap.get(c.userId)?.name ?? "Unknown",
        email: userMap.get(c.userId)?.email ?? "",
      })),
      pendingInvites,
    });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ message: "Invalid" }, { status: 400 });
    return NextResponse.json({ message: "Internal error" }, { status: 500 });
  }
}
```

- [ ] **Step 2: Create invite route**

Create `src/app/api/project/invite/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { projects, projectInvitations, notifications, user } from "@/db/schema";
import { eq, or } from "drizzle-orm";
import { nanoid } from "nanoid";
import { getProjectRole, getSessionUserId } from "@/lib/project-permissions";

const InviteSchema = z.object({
  projectId: z.string().min(1),
  email: z.string().email(),
  role: z.enum(["editor", "viewer"]),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const input = InviteSchema.parse(body);
    const inviterId = await getSessionUserId();
    if (!inviterId) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    const role = await getProjectRole(input.projectId, inviterId);
    if (role !== "owner") return NextResponse.json({ message: "Owner only" }, { status: 403 });

    const project = await db.query.projects.findFirst({ where: eq(projects.id, input.projectId) });
    const inviter = await db.query.user.findFirst({ where: eq(user.id, inviterId) });
    const invitee = await db.query.user.findFirst({ where: eq(user.email, input.email) });

    // Create invitation record
    const token = nanoid(32);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    await db.insert(projectInvitations).values({
      id: nanoid(),
      projectId: input.projectId,
      invitedByUserId: inviterId,
      invitedEmail: input.email,
      role: input.role,
      token,
      status: "pending",
      expiresAt,
    });

    // If the invitee already has an account, create a notification for them
    if (invitee) {
      await db.insert(notifications).values({
        id: nanoid(),
        userId: invitee.id,
        type: "invitation",
        title: `Invitation to join ${project?.name ?? "a project"}`,
        body: `${inviter?.name ?? inviter?.email ?? "Someone"} invited you to join "${project?.name}" as ${input.role}`,
        data: { token, projectId: input.projectId, role: input.role, projectName: project?.name },
        read: false,
      });
    }

    return NextResponse.json({ message: "Invitation sent", token });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ message: "Invalid" }, { status: 400 });
    const msg = error instanceof Error ? error.message : "Internal error";
    return NextResponse.json({ message: msg }, { status: 500 });
  }
}
```

- [ ] **Step 3: Create accept-invite route**

Create `src/app/api/project/accept-invite/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { projectInvitations, projectCollaborators, notifications } from "@/db/schema";
import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { getSessionUserId } from "@/lib/project-permissions";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { token } = z.object({ token: z.string().min(1) }).parse(body);
    const userId = await getSessionUserId();
    if (!userId) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

    const invitation = await db.query.projectInvitations.findFirst({
      where: eq(projectInvitations.token, token),
    });

    if (!invitation) return NextResponse.json({ message: "Invitation not found" }, { status: 404 });
    if (invitation.status !== "pending") return NextResponse.json({ message: "Invitation already used" }, { status: 400 });
    if (new Date() > invitation.expiresAt) return NextResponse.json({ message: "Invitation expired" }, { status: 400 });

    // Add to project collaborators
    await db.insert(projectCollaborators).values({
      projectId: invitation.projectId,
      userId,
      role: invitation.role,
    }).onConflictDoUpdate({
      target: [projectCollaborators.projectId, projectCollaborators.userId],
      set: { role: invitation.role },
    });

    // Mark invitation accepted
    await db.update(projectInvitations)
      .set({ status: "accepted" })
      .where(eq(projectInvitations.token, token));

    // Mark related notification as read
    await db.update(notifications)
      .set({ read: true })
      .where(eq(notifications.userId, userId));

    return NextResponse.json({ message: "Joined project", projectId: invitation.projectId });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ message: "Invalid" }, { status: 400 });
    return NextResponse.json({ message: "Internal error" }, { status: 500 });
  }
}
```

- [ ] **Step 4: Create decline-invite route**

Create `src/app/api/project/decline-invite/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { projectInvitations } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getSessionUserId } from "@/lib/project-permissions";

export async function POST(req: Request) {
  try {
    const { token } = z.object({ token: z.string().min(1) }).parse(await req.json());
    const userId = await getSessionUserId();
    if (!userId) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    await db.update(projectInvitations).set({ status: "declined" }).where(eq(projectInvitations.token, token));
    return NextResponse.json({ message: "Declined" });
  } catch {
    return NextResponse.json({ message: "Internal error" }, { status: 500 });
  }
}
```

- [ ] **Step 5: Create contributors-view.tsx**

Create `src/modules/workspace/views/contributors-view.tsx`:

```typescript
"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Users, Crown, Edit3, Eye, UserPlus, Clock, Trash2 } from "lucide-react";
import { toast } from "sonner";

interface Collaborator {
  projectId: string;
  userId: string;
  role: "owner" | "editor" | "viewer";
  name: string;
  email: string;
}

interface PendingInvite {
  id: string;
  invitedEmail: string;
  role: string;
  createdAt: string;
}

interface ContributorsData {
  collaborators: Collaborator[];
  pendingInvites: PendingInvite[];
}

const postJson = async <T,>(url: string, body: unknown): Promise<T> => {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.message || "Failed");
  return data as T;
};

const roleIcon = (role: string) => {
  if (role === "owner") return <Crown className="h-3.5 w-3.5 text-yellow-400" />;
  if (role === "editor") return <Edit3 className="h-3.5 w-3.5 text-blue-400" />;
  return <Eye className="h-3.5 w-3.5 text-gray-400" />;
};

const roleColor = (role: string) => {
  if (role === "owner") return "text-yellow-400 bg-yellow-500/10 border-yellow-500/20";
  if (role === "editor") return "text-blue-400 bg-blue-500/10 border-blue-500/20";
  return "text-gray-400 bg-gray-500/10 border-gray-500/20";
};

export default function ContributorsView() {
  const params = useParams();
  const projectName = decodeURIComponent((params?.project as string) || "");
  const { data: session } = authClient.useSession();
  const userId = session?.user?.id;
  const queryClient = useQueryClient();
  const [email, setEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"editor" | "viewer">("viewer");

  const { data: projects = [] } = useQuery<Array<{ id: string; name: string; role?: string }>>({
    queryKey: ["projects", userId],
    queryFn: async () => { const res = await fetch(`/api/project/get-all?userId=${encodeURIComponent(userId!)}`); return res.json(); },
    enabled: !!userId,
  });

  const project = projects.find((p) => p.name === projectName);
  const projectId = project?.id;
  const isOwner = project?.role === "owner";

  const { data: contribData } = useQuery<ContributorsData>({
    queryKey: ["contributors", projectId],
    queryFn: async () => { const res = await fetch(`/api/project/contributors?projectId=${encodeURIComponent(projectId!)}`); return res.json(); },
    enabled: !!projectId,
  });

  const invite = useMutation({
    mutationFn: () => postJson("/api/project/invite", { projectId, email, role: inviteRole }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contributors"] });
      setEmail("");
      toast.success(`Invitation sent to ${email}`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const collaborators = contribData?.collaborators ?? [];
  const pendingInvites = contribData?.pendingInvites ?? [];

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-8">
      {/* Current team */}
      <div>
        <h2 className="text-base font-semibold flex items-center gap-2 mb-4">
          <Users className="h-4 w-4 text-green-400" />
          Team Members
        </h2>
        {collaborators.length === 0 ? (
          <p className="text-sm text-gray-500">No members yet</p>
        ) : (
          <div className="space-y-2">
            {collaborators.map((c) => (
              <div key={c.userId} className="flex items-center gap-3 bg-[#111] border border-gray-800 rounded-lg p-3">
                <div className="w-8 h-8 rounded-full bg-gray-800 flex items-center justify-center text-xs text-gray-300 shrink-0">
                  {(c.name || c.email)[0]?.toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white truncate">{c.name || c.email}</p>
                  <p className="text-xs text-gray-500 truncate">{c.email}</p>
                </div>
                <span className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border capitalize ${roleColor(c.role)}`}>
                  {roleIcon(c.role)}
                  {c.role}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Invite section (owner only) */}
      {isOwner && (
        <div>
          <h2 className="text-base font-semibold flex items-center gap-2 mb-4">
            <UserPlus className="h-4 w-4 text-green-400" />
            Invite Member
          </h2>
          <div className="flex gap-2">
            <Input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="user@example.com"
              type="email"
              className="flex-1 bg-black/40 border-gray-700 text-white"
            />
            <select
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value as "editor" | "viewer")}
              className="bg-black/40 border border-gray-700 text-white text-sm rounded px-3"
            >
              <option value="viewer">Viewer</option>
              <option value="editor">Editor</option>
            </select>
            <Button
              onClick={() => invite.mutate()}
              disabled={!email.trim() || invite.isPending}
              className="bg-green-500/10 border border-green-500/30 text-green-400 hover:bg-green-500/20 shrink-0"
            >
              {invite.isPending ? "Sending..." : "Invite"}
            </Button>
          </div>
          <p className="text-xs text-gray-500 mt-2">
            <Eye className="h-3 w-3 inline mr-1" />
            <strong className="text-gray-400">Viewer</strong> — read-only, cannot run queries, edit, or modify data.
            &nbsp;&nbsp;
            <Edit3 className="h-3 w-3 inline mr-1" />
            <strong className="text-gray-400">Editor</strong> — full read/write access, can run SQL and Python.
          </p>
        </div>
      )}

      {/* Pending invitations */}
      {isOwner && pendingInvites.length > 0 && (
        <div>
          <h2 className="text-base font-semibold flex items-center gap-2 mb-4">
            <Clock className="h-4 w-4 text-amber-400" />
            Pending Invitations
          </h2>
          <div className="space-y-2">
            {pendingInvites.map((inv) => (
              <div key={inv.id} className="flex items-center gap-3 bg-[#111] border border-gray-800/60 rounded-lg p-3">
                <div className="flex-1">
                  <p className="text-sm text-gray-300">{inv.invitedEmail}</p>
                  <p className="text-xs text-gray-600">
                    {inv.role} · sent {new Date(inv.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <span className="text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full">
                  pending
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 6: Type-check and commit**

```powershell
npx tsc --noEmit 2>&1 | Select-Object -First 30
git add src/modules/workspace/views/contributors-view.tsx src/app/api/project/invite src/app/api/project/accept-invite src/app/api/project/decline-invite src/app/api/project/contributors
git commit -m "feat: contributors view with invitation system (invite, accept, decline)"
```

---

### Task 12: Notification Center

**Files:**
- Modify: `src/modules/notifications/notification-center.tsx` (replace placeholder)
- Create: `src/app/api/notifications/route.ts`

- [ ] **Step 1: Create notifications API route**

Create `src/app/api/notifications/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { notifications } from "@/db/schema";
import { desc, eq, and } from "drizzle-orm";
import { getSessionUserId } from "@/lib/project-permissions";

export async function GET() {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const rows = await db.query.notifications.findMany({
    where: eq(notifications.userId, userId),
    orderBy: [desc(notifications.createdAt)],
    limit: 30,
  });

  return NextResponse.json({ data: rows });
}

export async function PATCH(req: Request) {
  try {
    const userId = await getSessionUserId();
    if (!userId) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    const body = await req.json();
    const { id } = z.object({ id: z.string().optional() }).parse(body);

    if (id) {
      await db.update(notifications).set({ read: true }).where(
        and(eq(notifications.id, id), eq(notifications.userId, userId))
      );
    } else {
      await db.update(notifications).set({ read: true }).where(eq(notifications.userId, userId));
    }

    return NextResponse.json({ message: "Marked read" });
  } catch {
    return NextResponse.json({ message: "Internal error" }, { status: 500 });
  }
}
```

- [ ] **Step 2: Replace notification-center.tsx with full implementation**

Replace `src/modules/notifications/notification-center.tsx`:

```typescript
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

export function NotificationCenter({ userId, projectId }: { userId: string; projectId: string }) {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();
  const router = useRouter();

  const { data } = useQuery<{ data: Notification[] }>({
    queryKey: ["notifications", userId],
    queryFn: async () => { const res = await fetch("/api/notifications"); return res.json(); },
    refetchInterval: 30000,
  });

  const notifications = data?.data ?? [];
  const unread = notifications.filter((n) => !n.read).length;

  const markRead = useMutation({
    mutationFn: async (id?: string) => {
      await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications"] }),
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
      return data;
    },
    onSuccess: (data, token) => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      toast.success("Joined project!");
      setOpen(false);
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
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      toast("Invitation declined");
    },
  });

  return (
    <div className="relative">
      <button
        onClick={() => { setOpen((o) => !o); if (!open && unread > 0) markRead.mutate(undefined); }}
        className="relative h-8 w-8 flex items-center justify-center rounded-lg text-gray-500 hover:text-white hover:bg-white/5 transition-colors"
        title="Notifications"
      >
        {unread > 0 ? <BellDot className="h-4 w-4 text-green-400" /> : <Bell className="h-4 w-4" />}
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 h-4 w-4 bg-green-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
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
              {notifications.length === 0 ? (
                <div className="px-4 py-8 text-center text-gray-500 text-sm">
                  <Bell className="h-6 w-6 mx-auto mb-2 opacity-30" />
                  No notifications
                </div>
              ) : (
                notifications.map((n) => (
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
                        <p className="text-xs text-gray-600 mt-1">{timeAgo(n.createdAt)}</p>

                        {n.type === "invitation" && n.data?.token && (
                          <div className="flex gap-2 mt-2">
                            <button
                              onClick={() => acceptInvite.mutate(n.data.token as string)}
                              disabled={acceptInvite.isPending}
                              className="text-xs px-3 py-1 rounded bg-green-500/20 text-green-400 border border-green-500/30 hover:bg-green-500/30 transition-colors"
                            >
                              Accept
                            </button>
                            <button
                              onClick={() => declineInvite.mutate(n.data.token as string)}
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
```

- [ ] **Step 3: Type-check and commit**

```powershell
npx tsc --noEmit 2>&1 | Select-Object -First 30
git add src/modules/notifications/notification-center.tsx src/app/api/notifications/route.ts
git commit -m "feat: notification center with invitation accept/decline"
```

---

### Task 13: Viewer AI Restrictions

**Files:**
- Modify: `src/lib/ai-agent.ts`
- Modify: `src/app/api/chat/send-message/route.ts`
- Modify: `src/app/api/chat/send-message-stream/route.ts`

- [ ] **Step 1: Add role param to runAgent and buildSystemPrompt**

Read `src/lib/ai-agent.ts`. Find the `runAgent` function signature and `buildSystemPrompt` function.

Add `role?: string` to the `runAgent` input and pass it to `buildSystemPrompt`. In `buildSystemPrompt`, add this block at the START of the returned string if role is viewer:

```typescript
const viewerRestriction = role === "viewer" ? `
CRITICAL READ-ONLY MODE — VIEWER ACCESS:
You are operating on behalf of a VIEWER. Viewers have read-only access.
ABSOLUTE RULES — NEVER VIOLATE:
1. You MUST NOT execute INSERT, UPDATE, DELETE, DROP, TRUNCATE, ALTER, CREATE, GRANT, REVOKE, or any data-modifying SQL.
2. You MUST NOT run Python code that writes to, modifies, or deletes any database records.
3. If asked to modify data, respond: "You have viewer access. Viewers can only view data, not modify it. Ask the project owner to upgrade your role."
4. Only SELECT queries are permitted.
5. Python code may only READ data (pd.read_sql, SELECT queries) — no psycopg2 execute() with non-SELECT statements.
` : "";
```

Prepend `viewerRestriction` to the system prompt string.

Exact edit to `runAgent` signature in `src/lib/ai-agent.ts` — find:
```typescript
export async function runAgent({
  message,
  neonApiKey,
  history,
```
Add `role?: string` to the destructured params and the type.

- [ ] **Step 2: Pass role from chat stream route**

In `src/app/api/chat/send-message-stream/route.ts`, find where `runAgent` is called. Add the project role lookup and pass it:

```typescript
const role = await getProjectRole(input.projectId, sessionUserId);
// ...
const agentResult = await runAgent({
  message: input.message,
  neonApiKey: project.neonApiKey ?? "",
  history: chatMessages,
  role: role ?? "viewer",  // ADD THIS
});
```

Do the same for `src/app/api/chat/send-message/route.ts`.

- [ ] **Step 3: Type-check and commit**

```powershell
npx tsc --noEmit 2>&1 | Select-Object -First 30
git add src/lib/ai-agent.ts src/app/api/chat/send-message/route.ts src/app/api/chat/send-message-stream/route.ts
git commit -m "feat: strict viewer read-only restrictions in AI system prompt"
```

---

### Task 14: Final Cleanup and Verification

**Files:**
- Verify all section pages render without errors
- Verify navigation between sections works
- Verify dashboard redirect for logged-in users

- [ ] **Step 1: Full type-check**

```powershell
cd c:\HARI\ETAIH\xbase-app
npx tsc --noEmit 2>&1
```

Fix all type errors.

- [ ] **Step 2: Build check**

```powershell
npm run build 2>&1 | Select-Object -Last 30
```

Fix any build errors.

- [ ] **Step 3: Start dev server and verify**

```powershell
npm run dev
```

Verify manually:
- [ ] `/` redirects to `/dashboard` when logged in
- [ ] `/dashboard` shows project cards
- [ ] Clicking a project → navigates to `/[project]/tables`
- [ ] Sidebar shows all 7 sections with active state highlighting
- [ ] Each section loads without console errors
- [ ] Notification bell renders in header
- [ ] Inviting by email from Contributors tab creates notification

- [ ] **Step 4: Final commit**

```powershell
git add -A
git commit -m "feat: complete workspace redesign — sidebar navigation, dashboard, notifications, viewer restrictions"
```
