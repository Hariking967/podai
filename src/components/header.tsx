"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Button } from "./ui/button";
import { authClient } from "@/lib/auth-client";
import { User, LogOut } from "lucide-react";

export function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const { data: session } = authClient.useSession();

  // Hide header on auth routes
  if (pathname.startsWith("/auth")) {
    return null;
  }

  const handleLogout = async () => {
    await authClient.signOut({
      fetchOptions: {
        onSuccess: () => {
          router.push("/");
          router.refresh();
        },
      },
    });
  };

  return (
    <header className="fixed top-0 left-0 right-0 z-50 border-b border-white/5 bg-neutral-950/60 backdrop-blur-2xl shadow-xl">
      <div className="container mx-auto flex h-16 md:h-20 items-center justify-between px-6">
        {/* Logo Section */}
        <Link href="/" className="flex items-center gap-3 transition-opacity hover:opacity-80 group">
          {/* Using public/logo-nobg.png */}
          <img 
            src="/logo-nobg.png" 
            alt="XBase Logo" 
            className="h-10 w-10 object-contain drop-shadow-[0_0_8px_rgba(74,222,128,0.5)] group-hover:drop-shadow-[0_0_12px_rgba(74,222,128,0.8)] transition-all"
          />
          <span className="text-xl font-bold tracking-tight text-white group-hover:text-neon-green transition-colors">XBase</span>
        </Link>

        {/* Right Section */}
        <div className="flex items-center gap-4">
          {session ? (
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-3 bg-white/5 px-4 py-2.5 rounded-full border border-white/5">
                <div className="relative flex items-center justify-center w-8 h-8 rounded-full bg-neutral-800 border-2 border-neutral-700">
                    <User className="h-4 w-4 text-neutral-400" />
                    {/* Pulsing Online Indicator */}
                    <span className="absolute bottom-0 right-0 block h-2.5 w-2.5 rounded-full bg-neon-green ring-2 ring-neutral-900 shadow-[0_0_8px_rgba(57,255,20,1)]">
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-neon-green opacity-50"></span>
                    </span>
                </div>
                <div className="flex flex-col">
                    <span className="text-sm font-semibold text-white leading-tight">{session.user.name || "User"}</span>
                    <span className="text-[10px] text-neon-green uppercase tracking-wider font-semibold">Online</span>
                </div>
              </div>
              
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={handleLogout}
                className="h-10 w-10 text-neutral-400 hover:text-white hover:bg-red-500/20 hover:border hover:border-red-500/50 hover:shadow-[0_0_15px_rgba(239,68,68,0.3)] transition-all duration-300 rounded-xl"
                title="Logout"
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-4">
              <Link href="/auth/sign-in">
                <Button variant="ghost" size="sm" className="text-gray-400 hover:text-white hover:bg-white/5">
                  Login
                </Button>
              </Link>
              <Link href="/auth/sign-up">
                <Button size="sm" className="bg-neon-green text-black hover:bg-neon-green/90 shadow-[0_0_10px_rgba(74,222,128,0.3)] hover:shadow-[0_0_15px_rgba(74,222,128,0.6)] transition-all font-semibold">
                  Sign Up
                </Button>
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
