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
    <header className="fixed top-0 left-0 right-0 z-50 border-y border-white/10 bg-neutral-900/60 backdrop-blur-2xl supports-[backdrop-filter]:bg-neutral-900/40 shadow-lg">
      <div className="container mx-auto flex h-20 items-center justify-between px-6">
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
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 text-sm text-gray-400">
                <User className="h-4 w-4 text-neon-green" />
                <span className="text-gray-200"><span className="text-neon-green">{session.user.name || "User"}</span></span>
              </div>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={handleLogout}
                className="text-gray-400 hover:text-white hover:bg-white/5 border border-transparent hover:border-white/10"
              >
                <LogOut className="mr-2 h-4 w-4" />
                Logout
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
