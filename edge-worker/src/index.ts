interface Env {
  ENVIRONMENT?: string;
  API_ORIGIN?: string;
}

function json(data: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(data, null, 2), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      ...(init?.headers || {}),
    },
    ...init,
  });
}

function text(body: string, init?: ResponseInit): Response {
  return new Response(body, {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      ...(init?.headers || {}),
    },
    ...init,
  });
}

async function handleProxy(request: Request, env: Env): Promise<Response> {
  if (!env.API_ORIGIN) {
    return json(
      {
        success: false,
        error: "API_ORIGIN is not configured.",
      },
      { status: 500 }
    );
  }

  const requestUrl = new URL(request.url);
  const upstreamUrl = new URL(requestUrl.pathname.replace(/^\/proxy/, "") || "/", env.API_ORIGIN);
  upstreamUrl.search = requestUrl.search;

  const upstreamRequest = new Request(upstreamUrl.toString(), {
    method: request.method,
    headers: request.headers,
    body: request.method === "GET" || request.method === "HEAD" ? undefined : request.body,
    redirect: "follow",
  });

  return fetch(upstreamRequest);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/" || url.pathname === "/health") {
      return json({
        success: true,
        worker: "re-view-all-edge-worker",
        environment: env.ENVIRONMENT || "development",
        timestamp: new Date().toISOString(),
      });
    }

    if (url.pathname === "/routes") {
      return json({
        routes: [
          { path: "/", description: "worker health payload" },
          { path: "/health", description: "worker health payload" },
          { path: "/routes", description: "worker route manifest" },
          { path: "/proxy/*", description: "forward request to API_ORIGIN" },
        ],
      });
    }

    if (url.pathname.startsWith("/proxy")) {
      return handleProxy(request, env);
    }

    return text("Not Found", { status: 404 });
  },
};
