interface WorkerEnvironment {
  ASSETS: {
    fetch(input: Request): Promise<Response>;
  };
}

export default {
  async fetch(
    request: Request,
    environment: WorkerEnvironment,
  ): Promise<Response> {
    const acceptsHtml = request.headers.get("accept")?.includes("text/html");
    if (request.method === "GET" && acceptsHtml) {
      const fallbackRequest = new Request(new URL("/", request.url), request);
      return environment.ASSETS.fetch(fallbackRequest);
    }
    return Response.json(
      { error: { code: "not_found", message: "Resource not found." } },
      { status: 404 },
    );
  },
};
