import { createClient } from "@supabase/supabase-js";
import type { User } from "@supabase/supabase-js";

type RequestAuth = { user: User; status: 200 } | { user: null; status: 401 | 503 };

export async function getRequestUser(request: Request): Promise<RequestAuth> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");

  if (!url || !key) return { user: null, status: 503 as const };
  if (!token) return { user: null, status: 401 as const };

  const supabase = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return { user: null, status: 401 };
  return { user: data.user, status: 200 };
}

export function unauthorized(status: 401 | 503) {
  return Response.json(
    { error: status === 503 ? "Authentication is not configured." : "Please sign in to play Zordle." },
    { status },
  );
}
