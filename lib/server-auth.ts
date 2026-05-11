import type { User } from "@supabase/supabase-js";
import { isValidCompanyEmail } from "@/lib/auth-domain";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export class ApiAuthError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export async function requireValidUser(request: Request): Promise<User> {
  const token = bearerToken(request);

  if (!token) {
    throw new ApiAuthError("Sign in with your Valid.co Google account.", 401);
  }

  const supabase = getSupabaseAdmin();

  if (!supabase) {
    throw new ApiAuthError("Supabase is not configured.", 503);
  }

  const { data, error } = await supabase.auth.getUser(token);

  if (error || !data.user) {
    throw new ApiAuthError("Session expired. Sign in again.", 401);
  }

  if (!isValidCompanyEmail(data.user.email)) {
    throw new ApiAuthError("Only @valid.co accounts can use this app.", 403);
  }

  return data.user;
}

function bearerToken(request: Request) {
  const authorization = request.headers.get("authorization") || "";
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  return match?.[1] || "";
}
