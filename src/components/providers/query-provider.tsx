"use client";

import { useState } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { makeQueryClient } from "@/lib/query-client";

export function QueryProvider(props: Readonly<{ children: React.ReactNode }>) {
  const [queryClient] = useState(() => makeQueryClient());
  return <QueryClientProvider client={queryClient}>{props.children}</QueryClientProvider>;
}
