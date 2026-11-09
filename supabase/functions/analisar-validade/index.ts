import { withSupabase } from "npm:@supabase/server@1";
import { createHandler, createRateLimiter, getAuthenticatedUserId } from "./core.ts";

const limiter = createRateLimiter({ maxRequests: 5, windowMs: 60_000 });

Deno.serve(withSupabase({ auth: "user" }, async (request, context) => {
  const userId = getAuthenticatedUserId(context);
  const handle = createHandler({
    getUserId: () => userId,
    geminiApiKey: Deno.env.get("GEMINI_API_KEY"),
    limiter,
  });
  return handle(request);
}));
