import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

const PISTON_ENDPOINTS = [
  "https://emkc.org/api/v2/piston/execute",
  "https://piston.e-z.host/api/v2/execute",
];

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();

    const { language, version, files, stdin, args, compile_timeout, run_timeout } = body;

    if (!language || !files || !Array.isArray(files) || files.length === 0) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: language, files" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const payload = JSON.stringify({
      language,
      version,
      files,
      stdin: stdin || "",
      args: args || [],
      compile_timeout: compile_timeout || 10000,
      run_timeout: run_timeout || 5000,
    });

    let lastError: string = "";

    for (const endpoint of PISTON_ENDPOINTS) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 15000);

        const response = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: payload,
          signal: controller.signal,
        });

        clearTimeout(timeout);

        if (response.ok) {
          const result = await response.json();
          return new Response(JSON.stringify(result), {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        lastError = `${endpoint} returned ${response.status}`;
      } catch (e: unknown) {
        const errMsg = e instanceof Error ? e.message : String(e);
        lastError = `${endpoint} failed: ${errMsg}`;
      }
    }

    return new Response(
      JSON.stringify({
        error: "All execution endpoints failed",
        detail: lastError,
        run: {
          stdout: "",
          stderr: `Code execution service temporarily unavailable. Last error: ${lastError}`,
          code: 1,
          signal: null,
          output: `Code execution service temporarily unavailable. Last error: ${lastError}`,
        },
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (e: unknown) {
    const errMsg = e instanceof Error ? e.message : String(e);
    return new Response(
      JSON.stringify({ error: "Internal server error", detail: errMsg }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
