import { User } from "better-auth";
import { ProjectLayout } from "./project-layout";

interface HomeViewProps {
  user: User;
}

export default function HomeView({ user }: HomeViewProps) {
  return (
    <ProjectLayout />
  );
}
