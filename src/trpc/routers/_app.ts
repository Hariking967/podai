import { z } from "zod";
import { baseProcedure, createTRPCRouter } from "../init";
import { projectRouter } from "./project-router";
import { chatRouter } from "./chat-router";
import { neonRouter } from "./neon-router";

export const appRouter = createTRPCRouter({
  project: projectRouter,
  chat: chatRouter,
  neon: neonRouter,
  hello: baseProcedure
    .input(
      z.object({
        text: z.string(),
      })
    )
    .query((opts) => {
      return {
        greeting: `hello ${opts.input.text}`,
      };
    }),
});
// export type definition of API
export type AppRouter = typeof appRouter;
