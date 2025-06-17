// supabase/functions/analyze/index.ts
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
const corsHeaders = {
    "Access-Control-Allow-Origin": "*", // Allow all origins for development
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers":
      "authorization, content-type, apikey, supabase-auth-token, x-client-info",
  };

// Grab the OpenAI API key from the environment variables
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
if (!OPENAI_API_KEY) console.warn("OPENAI_API_KEY not set in Vault");

// The interface definition remains the same, used for type safety
interface Suggestion {
  type: 'spelling' | 'grammar' | 'style' | 'clarity' | 'tone';
  originalText: string;
  suggestion: string;
  explanation: string;
  startIndex: number;
  endIndex: number;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // The key is accessed from environment variables, which Vercel and Supabase both set.
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) {
      throw new Error("Missing OPENAI_API_KEY environment variable.");
    }

    const { text, tone } = await req.json()
    if (!text) {
      throw new Error('No text provided');
    }

    // Enhanced prompt to include all suggestion types
    const user_prompt = `
      Analyze the following text for writing improvements. Look for:
      1. Spelling mistakes (type: 'spelling')
      2. Grammar errors (type: 'grammar') 
      3. Style improvements (type: 'style')
      4. Clarity issues (type: 'clarity')
      5. Tone adjustments (type: 'tone') - consider the target tone: ${tone || 'neutral'}

      For each issue found, provide:
      - The exact text segment with the issue
      - A suggested replacement
      - A brief explanation
      - Precise character start and end indices

      Text to analyze:
      ---
      ${text}
      ---
    `;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: user_prompt }],
        temperature: 0.1,
        tools: [
          {
            type: 'function',
            function: {
              name: 'report_analysis_results',
              description: 'Reports the analysis of a given text.',
              parameters: {
                type: 'object',
                properties: {
                  suggestions: {
                    type: 'array',
                    description: 'A list of suggestions for the text.',
                    items: {
                      type: 'object',
                      properties: {
                        type: {
                          type: 'string',
                          enum: ['spelling', 'grammar', 'style', 'clarity', 'tone'],
                          description: 'The type of issue found.',
                        },
                        originalText: {
                          type: 'string',
                          description: 'The exact text segment with the issue.',
                        },
                        suggestion: {
                          type: 'string',
                          description: 'The suggested replacement text.',
                        },
                        explanation: {
                          type: 'string',
                          description: 'A brief explanation of the suggestion.',
                        },
                        startIndex: {
                          type: 'number',
                          description: 'The starting character index of the original text.',
                        },
                        endIndex: {
                          type: 'number',
                          description: 'The ending character index of the original text.',
                        },
                      },
                      required: ['type', 'originalText', 'suggestion', 'explanation', 'startIndex', 'endIndex'],
                    },
                  },
                },
                required: ['suggestions'],
              },
            },
          },
        ],
        tool_choice: { "type": "function", "function": { "name": "report_analysis_results" } },
      }),
    })

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`OpenAI API error: ${response.status} ${errorBody}`);
    }

    const gptResponse = await response.json();
    const toolCall = gptResponse.choices[0].message.tool_calls[0];

    let suggestions: Suggestion[] = [];

    if (toolCall && toolCall.function.name === 'report_analysis_results') {
      const toolArgs = JSON.parse(toolCall.function.arguments);
      suggestions = toolArgs.suggestions || [];
    }

    return new Response(JSON.stringify(suggestions), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})