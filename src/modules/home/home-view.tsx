"use client";

import { User } from "better-auth";
import dynamic from "next/dynamic";

const ProjectLayout = dynamic(
  () => import("./project-layout").then((mod) => mod.ProjectLayout),
  { ssr: false },
);

interface HomeViewProps {
  user: User;
}

export default function HomeView({ user }: HomeViewProps) {
  return <ProjectLayout />;
}
