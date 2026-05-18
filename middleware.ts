import { NextRequest, NextResponse } from "next/server";

const WWW_AUTHENTICATE = 'Basic realm="Fireflies Clone", charset="UTF-8"';

function timingSafeEqual(a: string, b: string): boolean {
  const len = Math.max(a.length, b.length);
  let diff = a.length ^ b.length;
  for (let i = 0; i < len; i++) {
    const ca = i < a.length ? a.charCodeAt(i) : 0;
    const cb = i < b.length ? b.charCodeAt(i) : 0;
    diff |= ca ^ cb;
  }
  return diff === 0;
}

function unauthorized(): NextResponse {
  return new NextResponse("Authentication required.", {
    status: 401,
    headers: { "WWW-Authenticate": WWW_AUTHENTICATE },
  });
}

export function middleware(request: NextRequest): NextResponse {
  const expectedUser = process.env.BASIC_AUTH_USER || "";
  const expectedPass = process.env.BASIC_AUTH_PASSWORD || "";

  // Gate is opt-in: when either credential is unset (or empty), pass through.
  // This keeps local dev friction-free while production sets both vars.
  if (!expectedUser || !expectedPass) {
    return NextResponse.next();
  }

  const header = request.headers.get("authorization");
  if (!header || !header.toLowerCase().startsWith("basic ")) {
    return unauthorized();
  }

  let decoded: string;
  try {
    decoded = atob(header.slice(6).trim());
  } catch {
    return unauthorized();
  }

  // Split on the FIRST colon — passwords may contain colons.
  const idx = decoded.indexOf(":");
  if (idx === -1) {
    return unauthorized();
  }

  const user = decoded.slice(0, idx);
  const pass = decoded.slice(idx + 1);

  const userOk = timingSafeEqual(user, expectedUser);
  const passOk = timingSafeEqual(pass, expectedPass);

  if (!(userOk && passOk)) {
    return unauthorized();
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|robots.txt).*)"],
};
