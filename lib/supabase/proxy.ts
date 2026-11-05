import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "./database.types";

/** Renova a sessão (cookies) a cada requisição e repassa o path para os Server Components. */
export async function updateSession(request: NextRequest): Promise<NextResponse> {
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-pathname", request.nextUrl.pathname + request.nextUrl.search);
  let response = NextResponse.next({ request: { headers: requestHeaders } });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll(toSet) {
          toSet.forEach(({ name, value }) => request.cookies.set(name, value));
          // Os Server Components precisam ver os cookies já renovados.
          requestHeaders.set("cookie", request.headers.get("cookie") ?? "");
          response = NextResponse.next({ request: { headers: requestHeaders } });
          toSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    },
  );

  const { data } = await supabase.auth.getUser();

  // Já logado: /login não troca de conta por cima da sessão atual (Sair primeiro).
  if (data.user && request.nextUrl.pathname === "/login") {
    const home = request.nextUrl.clone();
    home.pathname = "/";
    home.search = "";
    const redirect = NextResponse.redirect(home);
    response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
    return redirect;
  }
  return response;
}
