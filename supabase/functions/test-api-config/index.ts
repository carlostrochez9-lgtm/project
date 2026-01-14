import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    // Get the authorization header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create Supabase client
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: {
          headers: { Authorization: authHeader },
        },
      }
    );

    // Verify user is authenticated
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if user is admin
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    if (!profile || profile.role !== "admin") {
      return new Response(
        JSON.stringify({ error: "Admin access required" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if API key is present
    const geminiApiKey = Deno.env.get("GOOGLE_API_KEY");
    
    const diagnostics: any = {
      timestamp: new Date().toISOString(),
      apiKeyPresent: !!geminiApiKey,
      apiKeyLength: geminiApiKey?.length || 0,
      checks: [],
    };

    // Check 1: API key exists
    if (!geminiApiKey) {
      diagnostics.checks.push({
        name: "API Key Configuration",
        status: "failed",
        message: "GOOGLE_API_KEY is not configured in Supabase Edge Function secrets",
        action: "Add GOOGLE_API_KEY to your Supabase Edge Function secrets",
        helpUrl: "https://aistudio.google.com/app/apikey",
      });

      return new Response(
        JSON.stringify({
          success: false,
          diagnostics,
          summary: "API key not configured",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    diagnostics.checks.push({
      name: "API Key Configuration",
      status: "passed",
      message: "GOOGLE_API_KEY is present",
    });

    // Check 2: Test API key with a simple request
    try {
      const testResponse = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiApiKey}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  {
                    text: "Say 'Configuration test successful' if you can read this.",
                  },
                ],
              },
            ],
            generationConfig: {
              temperature: 0.1,
              maxOutputTokens: 50,
            },
          }),
        }
      );

      if (!testResponse.ok) {
        const errorText = await testResponse.text();
        let errorMessage = `API returned status ${testResponse.status}`;
        let action = "Check your API key configuration";
        let helpUrl = "https://console.cloud.google.com/apis/credentials";

        try {
          const errorJson = JSON.parse(errorText);
          if (errorJson.error?.message) {
            const apiError = errorJson.error.message;

            if (apiError.includes("API_KEY_INVALID") || apiError.includes("API key not valid")) {
              errorMessage = "API key is invalid";
              action = "Verify your API key at Google AI Studio";
              helpUrl = "https://aistudio.google.com/app/apikey";
            } else if (apiError.includes("quota") || apiError.includes("RESOURCE_EXHAUSTED")) {
              errorMessage = "API quota exceeded";
              action = "Check your Google Cloud billing and quotas";
              helpUrl = "https://console.cloud.google.com/billing";
            } else if (apiError.includes("permission") || apiError.includes("PERMISSION_DENIED")) {
              errorMessage = "API permission denied";
              action = "Enable the Generative Language API in your Google Cloud project";
              helpUrl = "https://console.cloud.google.com/apis/library/generativelanguage.googleapis.com";
            } else {
              errorMessage = apiError;
            }
          }
        } catch (e) {
          // Error parsing, use default message
        }

        diagnostics.checks.push({
          name: "API Key Validation",
          status: "failed",
          message: errorMessage,
          action,
          helpUrl,
          details: errorText.substring(0, 200),
        });

        return new Response(
          JSON.stringify({
            success: false,
            diagnostics,
            summary: "API key validation failed",
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const testData = await testResponse.json();
      
      // Check if we got a valid response
      if (testData.candidates && testData.candidates.length > 0) {
        diagnostics.checks.push({
          name: "API Key Validation",
          status: "passed",
          message: "Successfully connected to Google AI",
          details: "API key is valid and working correctly",
        });

        // Check 3: Test model access
        diagnostics.checks.push({
          name: "Model Access",
          status: "passed",
          message: "gemini-1.5-flash model is accessible",
        });

        return new Response(
          JSON.stringify({
            success: true,
            diagnostics,
            summary: "All checks passed - API is configured correctly",
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      } else {
        diagnostics.checks.push({
          name: "API Response",
          status: "warning",
          message: "API responded but did not return expected data format",
          details: JSON.stringify(testData).substring(0, 200),
        });

        return new Response(
          JSON.stringify({
            success: false,
            diagnostics,
            summary: "API configuration issue detected",
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    } catch (apiError) {
      diagnostics.checks.push({
        name: "API Connection",
        status: "failed",
        message: "Failed to connect to Google AI API",
        details: String(apiError),
        action: "Check your network connection and API key",
      });

      return new Response(
        JSON.stringify({
          success: false,
          diagnostics,
          summary: "Cannot connect to Google AI API",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  } catch (error) {
    console.error("Error in test-api-config function:", error);
    return new Response(
      JSON.stringify({ 
        success: false,
        error: "Internal server error", 
        details: String(error) 
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});