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
You are an expert writing assistant. Your task is to correct grammar and spelling errors in the provided text.
- Respond ONLY with the corrected text.
- Do not add any commentary or introductory phrases.
- For every change you make, you MUST wrap the original text in <del> tags and the new, corrected text in <ins> tags.
- If a sentence is correct, return it unchanged.
- Preserve proper spacing around words - do not add extra spaces unless necessary for grammar.
- When correcting contractions, ensure proper spacing (e.g., "im" -> "I'm" not "I'm ").
- When correcting punctuation, ensure proper spacing (e.g., "its good" -> "it's good" not "it's good ").

Example Request: "I can has cheezburger. its so gud."
Example Response: "I <del>can has</del><ins>can have a</ins> <del>cheezburger</del><ins>cheeseburger</ins>. <del>its so gud</del><ins>It's so good</ins>."

Example Request: "this wurks really good im sick of all errors"
Example Response: "this <del>wurks really good</del><ins>works really well</ins> <del>im</del><ins>I'm</ins> <del>sick of all errors</del><ins>sick of all the errors</ins>."
`

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
    const { text, tone } = await req.json()

    if (!text) {
      throw new Error("No text provided.");
    }

    console.log('=== EDGE FUNCTION DEBUG ===');
    console.log('Input text:', text);
    console.log('Tone:', tone);

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini', // Or another powerful model
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Tone preference: ${tone}\n\nText to correct:\n${text}` },
      ],
      temperature: 0.3,
    })

    const correctedText = completion.choices[0].message.content;
    console.log('LLM response:', correctedText);
    console.log('=== END EDGE FUNCTION DEBUG ===');

    return new Response(
      JSON.stringify({ correctedText }),
      {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json'
        },
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