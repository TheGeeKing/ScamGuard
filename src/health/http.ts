import type { HealthStatus } from "../application";

export function createHealthHandler(
  health: () => HealthStatus,
): (request: Request) => Response {
  return (request) => {
    if (new URL(request.url).pathname !== "/health") {
      return new Response("Not Found", { status: 404 });
    }

    return Response.json(health());
  };
}

export function startHealthServer(
  bind: { hostname: string; port: number },
  health: () => HealthStatus,
): ReturnType<typeof Bun.serve> {
  return Bun.serve({ ...bind, fetch: createHealthHandler(health) });
}
