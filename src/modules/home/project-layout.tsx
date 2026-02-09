"use client";

import { motion } from "framer-motion";

import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { useState } from "react";
import { ChatInterface } from "./chat-interface";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";

import { api } from "@/trpc/client";
import { authClient } from "@/lib/auth-client";
import { toast } from "sonner";

export function ProjectLayout() {
  const [messages, setMessages] = useState<any[]>([]);
  const params = useParams();
  const router = useRouter();
  const currentProjectName = decodeURIComponent((params?.project as string) || "");
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [apiKey, setApiKey] = useState("");

  const { data: session } = authClient.useSession();
  const userId = session?.user?.id;

  const { data: projects, refetch } = api.project.getAll.useQuery(
    { userId: userId! },
    { enabled: !!userId }
  );

  const createProject = api.project.create.useMutation({
    onSuccess: () => {
      toast.success("Project created!");
      setOpen(false);
      setName("");
      setApiKey("");
      refetch();
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to create project");
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
    setMessages(prev => [...prev, { role: "user", content: text, createdAt: new Date().toISOString() }]);
    // Simulate AI response for now
    setTimeout(() => {
        setMessages(prev => [...prev, { role: "assistant", content: "I am a mock AI response.", createdAt: new Date().toISOString() }]);
    }, 1000);
  };

  return (
    <div className="h-screen w-full text-white pt-20">
      <ResizablePanelGroup direction="horizontal">
        {/* Left Panel: Project List */}
        <ResizablePanel defaultSize={75} minSize={30} className="bg-[#0a0a0a] border-r border-white/5">
          <div className="h-full p-8 md:p-12">
            <div className="flex items-center justify-between mb-12 max-w-4xl mx-auto">
              <h2 className="text-3xl font-semibold text-white tracking-tight">Projects</h2>
               <Dialog open={open} onOpenChange={setOpen}>
                <DialogTrigger asChild>
                  <Button className="bg-neon-green text-black hover:bg-neon-green/90 font-medium px-6">
                    <Plus className="mr-2 h-4 w-4" />
                    New Project
                  </Button>
                </DialogTrigger>
                <DialogContent className="bg-[#0a0a0a] border-white/10 text-white sm:max-w-md">
                  <DialogHeader>
                    <DialogTitle className="text-white">Create New Project</DialogTitle>
                  </DialogHeader>
                  <div className="grid gap-6 py-4">
                    <div className="grid gap-2">
                      <Label htmlFor="name" className="text-neutral-400">Project Name</Label>
                      <Input 
                        id="name" 
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="My Awesome Project" 
                        className="bg-white/5 border-white/10 focus:border-white/20 text-white placeholder:text-neutral-600" 
                      />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="apikey" className="text-neutral-400">Neon API Key</Label>
                         <Input 
                            id="apikey" 
                            value={apiKey}
                            onChange={(e) => setApiKey(e.target.value)}
                            placeholder="postgres://..." 
                            className="bg-white/5 border-white/10 focus:border-white/20 text-white placeholder:text-neutral-600" 
                         />
                    </div>
                  </div>
                   <Button 
                    onClick={handleCreate} 
                    disabled={createProject.isPending || !name}
                    className="w-full bg-white text-black hover:bg-neutral-200 font-medium"
                   >
                    {createProject.isPending ? "Creating..." : "Create Project"}
                  </Button>
                </DialogContent>
              </Dialog>
            </div>

            <div className="flex flex-col space-y-4 max-w-4xl mx-auto">
              {projects?.map((project: any) => (
                <Link key={project.id} href={`/${project.name}`}>
                    <motion.div 
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.2 }}
                        className={`p-6 rounded-lg border transition-all duration-200 flex items-center justify-between group
                             ${currentProjectName === project.name 
                                ? "border-white/20 bg-white/5" 
                                : "border-white/5 bg-transparent hover:bg-white/5 hover:border-white/10"
                             }`}
                    >
                        <div>
                            <h3 className={`font-medium text-lg mb-1 ${currentProjectName === project.name ? "text-white" : "text-neutral-300 group-hover:text-white"}`}>
                                {project.name}
                            </h3>
                            <p className="text-sm text-neutral-500 group-hover:text-neutral-400 transition-colors">
                                {new Date(project.createdAt).toLocaleDateString()}
                            </p>
                        </div>
                        <div className="text-sm text-neutral-600 group-hover:text-neutral-500">
                             Open
                        </div>
                    </motion.div>
                </Link>
              ))}
              
              {!projects?.length && (
                 <div className="text-center text-neutral-500 py-12">
                    No projects found. Create one to get started!
                 </div>
              )}
            </div>
          </div>
        </ResizablePanel>

        <ResizableHandle withHandle className="bg-white/5 w-px hover:bg-white/10 transition-colors" />

        {/* Right Panel: Chat */}
        <ResizablePanel defaultSize={25} minSize={20} maxSize={50} className="bg-[#0a0a0a]">
            {/* We might want to style the chat interface to match the minimal look as well, leaving it for now but ensuring background matches */}
            <ChatInterface 
                messages={messages} 
                onSendMessage={handleSendMessage}
            />
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}
