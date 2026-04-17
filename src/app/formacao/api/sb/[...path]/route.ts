import { type NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SUPABASE_URL = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/$/, "");

// Headers we forward from the client to Supabase. Anything else (host,
// cf-*, x-forwarded-*) is stripped so Cloudflare in front of Supabase
// doesn't see Railway's Fastly edge + allos.org.br's Cloudflare edge
// and reject the request with "DNS points to prohibited IP".
const FORWARD_HEADERS = new Set([
  "authorization",
  "apikey",
  "content-type",
  "accept",
  "accept-language",
  "x-client-info",
  "x-supabase-api-version",
  "prefer",
  "range",
  "if-match",
  "if-none-match",
  "if-modified-since",
]);

async function proxy(request: NextRequest, path: string[]) {
  if (!SUPABASE_URL) {
    return NextResponse.json(
      { error: "SUPABASE_URL not configured" },
      { status: 500 }
    );
  }

  const targetUrl = `${SUPABASE_URL}/${path.join("/")}${request.nextUrl.search}`;

  const forwardHeaders = new Headers();
  request.headers.forEach((value, key) => {
    if (FORWARD_HEADERS.has(key.toLowerCase())) {
      forwardHeaders.set(key, value);
    }
  });

  const init: RequestInit = {
    method: request.method,
    headers: forwardHeaders,
    redirect: "manual",
  };

  if (!["GET", "HEAD"].includes(request.method)) {
    init.body = await request.arrayBuffer();
  }

  const upstream = await fetch(targetUrl, init);

  const responseHeaders = new Headers();
  upstream.headers.forEach((value, key) => {
    const lower = key.toLowerCase();
    // Strip hop-by-hop and cookie-domain headers that shouldn't cross origins.
    if (
      lower === "set-cookie" ||
      lower === "transfer-encoding" ||
      lower === "connection" ||
      lower === "content-encoding" ||
      lower === "content-length"
    ) {
      return;
    }
    responseHeaders.set(key, value);
  });

  // Ensure browser can read the response when called same-origin.
  responseHeaders.set("Cache-Control", "no-store");

  return new NextResponse(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: responseHeaders,
  });
}

type Ctx = { params: Promise<{ path: string[] }> };

export async function GET(req: NextRequest, ctx: Ctx) {
  return proxy(req, (await ctx.params).path);
}
export async function POST(req: NextRequest, ctx: Ctx) {
  return proxy(req, (await ctx.params).path);
}
export async function PUT(req: NextRequest, ctx: Ctx) {
  return proxy(req, (await ctx.params).path);
}
export async function PATCH(req: NextRequest, ctx: Ctx) {
  return proxy(req, (await ctx.params).path);
}
export async function DELETE(req: NextRequest, ctx: Ctx) {
  return proxy(req, (await ctx.params).path);
}
export async function OPTIONS(req: NextRequest, ctx: Ctx) {
  return proxy(req, (await ctx.params).path);
}
export async function HEAD(req: NextRequest, ctx: Ctx) {
  return proxy(req, (await ctx.params).path);
}
