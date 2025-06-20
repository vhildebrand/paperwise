// supabase/functions/analyze-text/index.ts
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

// --- SYSTEM PROMPTS ---

function getAnalysisSystemPrompt({ formality, audience, domain, intent }) {
    let guidelines = "You are an expert writing assistant.";

    if (formality) {
        guidelines += ` Your tone should be ${formality}.`;
        if (formality === "zoomer brainrot") {
            guidelines += " This means using modern slang, memes, and a very casual, sometimes chaotic tone. Think gen-z internet humor.";
        } else if (formality === "18th century impoverished russian poet") {
            guidelines += " This means writing with a tone of bleak, existential dread, longing, and melodrama. Use flowery, archaic language.";
        }
    }
    if (audience) {
        guidelines += ` The target audience is ${audience}.`;
    }
    if (domain) {
        guidelines += ` The writing domain is ${domain}.`;
    }
    if (intent) {
        guidelines += ` The primary intent of the text is to ${intent}.`;
    }

    return `
${guidelines}
- You will be given a JSON object containing text chunks to analyze, where each key is a unique sentence identifier.
- You MUST respond with a single JSON object where keys are the SAME sentence identifiers from the request.
- The value for each key must be an array of suggestion objects for that sentence.
- Each suggestion object must have the structure: { "type": "spelling" | "grammar" | "style" | "clarity" | "tone", "originalText": "the exact text to be replaced", "suggestion": "the new text", "explanation": "a brief explanation" }.
- If a sentence has no issues, return an empty array for its key, like this: "some-id-3": [].
- It is critical that 'originalText' is an EXACT substring from the provided sentence.

Example Request:
{
  "chunks": {
    "xyz789-0": "I can has cheezburger.",
    "xyz789-1": "its so gud."
  }
}

Example JSON Response:
{
  "xyz789-0": [
    { "type": "grammar", "originalText": "can has", "suggestion": "can have a", "explanation": "Incorrect verb form and missing article." },
    { "type": "spelling", "originalText": "cheezburger", "suggestion": "cheeseburger", "explanation": "Potential spelling mistake." }
  ],
  "xyz789-1": [
    { "type": "grammar", "originalText": "its so gud", "suggestion": "It's so good", "explanation": "Corrects contraction and spelling." }
  ]
}
`;
}


const rewriteSystemPrompt = (action: string) => `You are an AI writing assistant. The user has selected a piece of text and wants to ${action} it. Rewrite the following text accordingly. Respond only with the rewritten text, without any additional commentary or quotation marks.`;
const latexSystemPrompt = `You are a helpful assistant that specializes in generating LaTeX code for mathematical equations. The user will provide a description of a math equation. Respond ONLY with the raw LaTeX code for that equation. Do not include the '$$' delimiters or any other explaining text.`;

// --- HANDLERS ---

async function handleAnalysis(reqBody) {
  const { chunks, formality, audience, domain, intent } = reqBody;
  if (!chunks || Object.keys(chunks).length === 0) {
    throw new Error("No text chunks provided for analysis.");
  }

  const systemPrompt = getAnalysisSystemPrompt({ formality, audience, domain, intent });
  const userContent = `Text chunks to correct:\n${JSON.stringify(chunks, null, 2)}`;

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userContent },
    ],
    temperature: 0.3,
    response_format: { type: "json_object" },
  });

  const rawResponse = completion.choices[0].message.content;
  return { results: JSON.parse(rawResponse) };
}

async function handleRewrite(reqBody) {
  const { text, action } = reqBody;
  if (!text || !action) {
    throw new Error("Missing 'text' or 'action' for rewrite task.");
  }
  
  const systemPrompt = rewriteSystemPrompt(action);

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: text },
    ],
    temperature: 0.7,
  });

  return { rewrittenText: completion.choices[0].message.content };
}

async function handleLatex(reqBody) {
  const { prompt } = reqBody;
  if (!prompt) {
    throw new Error("Missing 'prompt' for LaTeX generation task.");
  }

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: latexSystemPrompt },
      { role: 'user', content: prompt },
    ],
    temperature: 0.2,
  });
  
  return { latex: completion.choices[0].message.content.trim() };
}


serve(async (req) => {
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 405,
    });
  }

  // Authenticate the request
  const auth = await authenticateRequest(req);
  if (!auth.authenticated) {
    return new Response(JSON.stringify({ error: auth.error || 'Authentication failed' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 401,
    });
  }

  try {
    const body = await req.json();
    const { task } = body;
    let data;

    switch (task) {
      case 'analyze':
        data = await handleAnalysis(body);
        break;
      case 'rewrite':
        data = await handleRewrite(body);
        break;
      case 'latex':
        data = await handleLatex(body);
        break;
      default:
        throw new Error(`Invalid task: ${task}`);
    }
    
    return new Response(
      JSON.stringify(data),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )
  } catch (error) {
    return new Response(
        JSON.stringify({ error: error.message }), 
        { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }, 
            status: 500 
        }
    );
  }
})