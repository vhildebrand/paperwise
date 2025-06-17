// supabase/functions/analyze/index.ts
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
const corsHeaders = {
    "Access-Control-Allow-Origin": "https://paperwise-five.vercel.app",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers":
      "authorization, content-type, apikey, supabase-auth-token",
  };

// Grab the OpenAI API key from the environment variables
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
if (!OPENAI_API_KEY) console.warn("OPENAI_API_KEY not set in Vault");


// Define the structure we expect from the AI
interface Suggestion {
  type: 'spelling' | 'grammar' | 'style';
  originalText: string;
  suggestion: string;
  explanation: string;
  startIndex: number;
  endIndex: number;
}

serve(async (req) => {
  // This is needed for the browser to call the function
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { text } = await req.json()
    if (!text) {
      throw new Error('No text provided');
    }

    const prompt = `
      You are an expert editor. Analyze the following text for spelling mistakes, grammar errors, and style improvements.
      For each issue you find, provide the original text, a suggested replacement, a brief explanation, the type of error (spelling, grammar, or style), and the start and end character indices of the original text.
      Your response MUST be a valid JSON array of objects. Do not include any other text or formatting. If there are no errors, return an empty array [].

      Example Response Format:
      [
        {
          "type": "spelling",
          "originalText": "recieve",
          "suggestion": "receive",
          "explanation": "Common spelling mistake.",
          "startIndex": 10,
          "endIndex": 17
        },
        {
          "type": "grammar",
          "originalText": "less documents",
          "suggestion": "fewer documents",
          "explanation": "'Fewer' is used for countable nouns like documents.",
          "startIndex": 50,
          "endIndex": 64
        }
      ]

      Here is the text to analyze:
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
        model: 'gpt-4.1-nano', // Use a model that supports JSON mode
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' }, // Enforce JSON output
        temperature: 0.2,
      }),
    })

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`OpenAI API error: ${response.status} ${errorBody}`);
    }

    const gptResponse = await response.json();
    // The actual suggestions are likely nested. Inspect the response structure.
    // It's common for the JSON to be a string inside a 'content' field.
    const content = JSON.parse(gptResponse.choices[0].message.content);
    
    // Assuming the AI correctly puts the array inside a root key like "suggestions" or directly as the root.
    const suggestions: Suggestion[] = content.suggestions || content;

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