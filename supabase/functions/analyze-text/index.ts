import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from '@supabase/supabase-js'
import { OpenAI } from 'https://deno.land/x/openai@v4.52.0/mod.ts'

const ALLOWED_ORIGINS = [
  'http://localhost:5173',
  'http://localhost:3000',
  'https://paperwise-five.vercel.app',
]

// Rate limiting storage (in production, use Redis or similar)
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

// Configuration
const MAX_TEXT_LENGTH = 10000; // 10KB limit
const MAX_REQUESTS_PER_MINUTE = 10;
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute

// Get CORS headers based on origin
function getCorsHeaders(origin: string | null) {
  const isAllowedOrigin = origin && ALLOWED_ORIGINS.includes(origin);
  
  return {
    "Access-Control-Allow-Origin": isAllowedOrigin ? origin : ALLOWED_ORIGINS[0],
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, content-type, apikey, supabase-auth-token, x-client-info",
    "Access-Control-Max-Age": "86400", // 24 hours
  };
}

// Authentication function using Supabase's built-in JWT verification
async function authenticateRequest(req: Request): Promise<{ authenticated: boolean; user?: any; error?: string }> {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return { authenticated: false, error: 'Missing or invalid authorization header' };
    }

    const token = authHeader.substring(7);
    
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !supabaseServiceKey) {
      return { authenticated: false, error: 'Missing Supabase configuration' };
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // Verify the JWT token
    const { data: { user }, error } = await supabase.auth.getUser(token);
    
    if (error || !user) {
      return { authenticated: false, error: 'Invalid or expired token' };
    }
    
    return { authenticated: true, user };
  } catch (error) {
    return { authenticated: false, error: 'Authentication failed' };
  }
}

// Initialize the OpenAI client with your API key
const openai = new OpenAI({
  apiKey: Deno.env.get('OPENAI_API_KEY'),
})

const systemPrompt = `
You are an expert writing assistant. Your task is to analyze the user's text and provide suggestions for improvement.
- Analyze the text for spelling, grammar, style, clarity, and tone issues.
- You MUST respond with a JSON array of suggestion objects. Do not add any other text or commentary outside of the JSON array.
- Each suggestion object in the array must have the following structure:
  {
    "type": "spelling" | "grammar",
    "originalText": "the exact text to be replaced from the user's input",
    "suggestion": "the new text to insert",
    "explanation": "a brief, user-friendly explanation of the change"
  }
- If you find no issues, return an empty array: [].
- It is critical that 'originalText' is an EXACT substring from the provided user text.

Example Request Text: "I can has cheezburger. its so gud."
Example JSON Response:
[
  {
    "type": "grammar",
    "originalText": "can has",
    "suggestion": "can have a",
    "explanation": "Incorrect verb form and missing article."
  },
  {
    "type": "spelling",
    "originalText": "cheezburger",
    "suggestion": "cheeseburger",
    "explanation": "Potential spelling mistake."
  },
  {
    "type": "grammar",
    "originalText": "its so gud",
    "suggestion": "It's so good",
    "explanation": "Corrects the contraction 'it's' and the word 'good'."
  }
]
`;

const newSystemPrompt = `
You are an expert writing assistant. Your task is to analyze multiple chunks of text from a user and provide suggestions for improvement.
- The user will provide a JSON object with text chunks, each identified by a unique key.
- You MUST respond with a single JSON object. Do not add any other text or commentary outside of this JSON object.
- The response object should have keys corresponding to the original chunk keys.
- The value for each key should be a JSON array of suggestion objects for that chunk.
- Each suggestion object in the array must have the following structure:
  {
    "type": "spelling" | "grammar" | "style" | "clarity" | "tone",
    "originalText": "the exact text to be replaced from the user's input chunk",
    "suggestion": "the new text to insert",
    "explanation": "a brief, user-friendly explanation of the change"
  }
- If a chunk has no issues, its corresponding value should be an empty array: [].
- It is critical that 'originalText' is an EXACT substring from the provided user text chunk.

Example Request:
{
  "tone": "formal",
  "chunks": {
    "chunk1": "I can has cheezburger.",
    "chunk2": "its so gud."
  }
}

Example JSON Response:
{
  "chunk1": [
    {
      "type": "grammar",
      "originalText": "can has",
      "suggestion": "can have a",
      "explanation": "Incorrect verb form and missing article."
    },
    {
      "type": "spelling",
      "originalText": "cheezburger",
      "suggestion": "cheeseburger",
      "explanation": "Potential spelling mistake."
    }
  ],
  "chunk2": [
    {
      "type": "grammar",
      "originalText": "its so gud",
      "suggestion": "It's so good",
      "explanation": "Corrects the contraction 'it's' and the word 'good'."
    }
  ]
}
`;

serve(async (req) => {
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  // Only allow POST requests
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 405,
    });
  }


  // TODO: Check rate limiting



  // Authenticate the request
  const auth = await authenticateRequest(req);
  if (!auth.authenticated) {
    return new Response(JSON.stringify({ error: auth.error || 'Authentication failed' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 401,
    });
  }



  // TODO: Validate input


  try {
    const { tone, chunks } = await req.json()

    if (!chunks || Object.keys(chunks).length === 0) {
      throw new Error("No text chunks provided.");
    }

    console.log('=== EDGE FUNCTION DEBUG ===');
    console.log('Input chunks:', chunks);
    console.log('Tone:', tone);

    const userContent = `Tone preference: ${tone}\n\nText chunks to correct:\n${JSON.stringify(chunks, null, 2)}`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: newSystemPrompt },
        { role: 'user', content: userContent },
      ],
      temperature: 0.3,
      response_format: { type: "json_object" },
    })

    const rawResponse = completion.choices[0].message.content;
    console.log('LLM raw response:', rawResponse);
    
    let results = {};
    try {
        results = JSON.parse(rawResponse);
    } catch (e) {
        console.error("Failed to parse JSON from LLM response:", e);
        throw new Error("Invalid JSON response from analysis engine.");
    }
    
    console.log('Parsed results:', results);
    
    return new Response(
      JSON.stringify({ results }), // Return a structured object
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )
  } catch (error) {
    return new Response(
        JSON.stringify({ error: error.message }), 
        { 
            headers: { 
                'Access-Control-Allow-Origin': '*',
                'Content-Type': 'application/json'
            }, 
            status: 500 
        }
    );
  }
})