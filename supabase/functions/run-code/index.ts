import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

const JUDGE0_LANGUAGE_IDS: Record<string, number> = {
  php: 68,
  "c++": 54,
  cpp: 54,
  python: 71,
  csharp: 51,
};

async function executeWithPiston(
  language: string,
  version: string,
  sourceCode: string,
  stdin: string
): Promise<{
  success: boolean;
  result?: Record<string, unknown>;
  error?: string;
}> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    const response = await fetch("https://emkc.org/api/v2/piston/execute", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        language,
        version,
        files: [{ content: sourceCode }],
        stdin: stdin || "",
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      const errText = await response.text().catch(() => "");
      return {
        success: false,
        error: `Piston returned ${response.status}: ${errText}`,
      };
    }

    const result = await response.json();

    if (typeof result !== "object" || result === null) {
      return { success: false, error: "Piston returned invalid response" };
    }

    const run = result.run;
    const compile = result.compile;

    const normalizedResult: Record<string, unknown> = {};

    if (compile) {
      normalizedResult.compile = {
        stdout: typeof compile.stdout === "string" ? compile.stdout : "",
        stderr: typeof compile.stderr === "string" ? compile.stderr : "",
        output: typeof compile.output === "string" ? compile.output : "",
        code: typeof compile.code === "number" ? compile.code : 0,
        signal: compile.signal ?? null,
      };
    }

    if (run) {
      normalizedResult.run = {
        stdout: typeof run.stdout === "string" ? run.stdout : "",
        stderr: typeof run.stderr === "string" ? run.stderr : "",
        output: typeof run.output === "string" ? run.output : "",
        code: typeof run.code === "number" ? run.code : 0,
        signal: run.signal ?? null,
      };
    }

    if (!run && !compile) {
      normalizedResult.run = {
        stdout: "",
        stderr: "No output from execution engine",
        output: "",
        code: 1,
        signal: null,
      };
    }

    return { success: true, result: normalizedResult };
  } catch (e: unknown) {
    const errMsg = e instanceof Error ? e.message : String(e);
    if (errMsg.includes("abort")) {
      return { success: false, error: "Piston request timed out (15s)" };
    }
    return { success: false, error: `Piston request failed: ${errMsg}` };
  }
}

async function executeWithJudge0(
  language: string,
  sourceCode: string,
  stdin: string
): Promise<{
  success: boolean;
  result?: Record<string, unknown>;
  error?: string;
}> {
  const languageId = JUDGE0_LANGUAGE_IDS[language];
  if (!languageId) {
    return {
      success: false,
      error: `Unsupported language for Judge0: ${language}`,
    };
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);

    const createResponse = await fetch(
      "https://ce.judge0.com/submissions/?base64_encoded=false&wait=true",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          language_id: languageId,
          source_code: sourceCode,
          stdin: stdin || "",
          cpu_time_limit: 5,
          wall_time_limit: 10,
          memory_limit: 128000,
        }),
        signal: controller.signal,
      }
    );

    clearTimeout(timeout);

    if (!createResponse.ok) {
      const errText = await createResponse.text().catch(() => "");
      return {
        success: false,
        error: `Judge0 returned ${createResponse.status}: ${errText}`,
      };
    }

    const submission = await createResponse.json();
    const statusId = submission.status?.id;

    if (statusId === 6) {
      return {
        success: true,
        result: {
          compile: {
            stderr: submission.compile_output || "Compilation Error",
            stdout: "",
            output: submission.compile_output || "Compilation Error",
            code: 1,
            signal: null,
          },
          run: null,
        },
      };
    }

    if (statusId === 5) {
      return {
        success: true,
        result: {
          run: {
            stdout: "",
            stderr: "Time Limit Exceeded",
            output: "Time Limit Exceeded",
            code: 1,
            signal: "SIGKILL",
          },
        },
      };
    }

    if (statusId >= 7 && statusId <= 12) {
      return {
        success: true,
        result: {
          run: {
            stdout: submission.stdout || "",
            stderr:
              submission.stderr ||
              submission.message ||
              `Runtime Error (${submission.status?.description || "unknown"})`,
            output:
              submission.stderr ||
              submission.message ||
              submission.stdout ||
              "",
            code: submission.exit_code ?? 1,
            signal: submission.exit_signal
              ? String(submission.exit_signal)
              : null,
          },
        },
      };
    }

    if (statusId === 3 || statusId === 4) {
      return {
        success: true,
        result: {
          run: {
            stdout: submission.stdout || "",
            stderr: submission.stderr || "",
            output: submission.stdout || submission.stderr || "",
            code: submission.exit_code ?? 0,
            signal: null,
          },
        },
      };
    }

    return {
      success: true,
      result: {
        run: {
          stdout: submission.stdout || "",
          stderr: submission.stderr || "",
          output: submission.stdout || submission.stderr || "(No output)",
          code: submission.exit_code ?? 0,
          signal: null,
        },
      },
    };
  } catch (e: unknown) {
    const errMsg = e instanceof Error ? e.message : String(e);
    return { success: false, error: `Judge0 request failed: ${errMsg}` };
  }
}

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
    const { language, version, files, stdin } = body;

    if (!language || !files || !Array.isArray(files) || files.length === 0) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: language, files" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const sourceCode = files[0]?.content || "";
    const inputData = stdin || "";

    const pistonResult = await executeWithPiston(
      language,
      version || "3.10.0",
      sourceCode,
      inputData
    );

    if (pistonResult.success && pistonResult.result) {
      return new Response(JSON.stringify(pistonResult.result), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const judge0Result = await executeWithJudge0(
      language,
      sourceCode,
      inputData
    );

    if (judge0Result.success && judge0Result.result) {
      return new Response(JSON.stringify(judge0Result.result), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({
        run: {
          stdout: "",
          stderr: `Semua layanan eksekusi kode sedang tidak tersedia.\nPiston: ${pistonResult.error || "failed"}\nJudge0: ${judge0Result.error || "failed"}`,
          code: 1,
          signal: null,
          output: "Semua layanan eksekusi kode sedang tidak tersedia.",
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
      JSON.stringify({
        error: "Internal server error",
        detail: errMsg,
        run: {
          stdout: "",
          stderr: `Server error: ${errMsg}`,
          code: 1,
          signal: null,
          output: `Server error: ${errMsg}`,
        },
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
