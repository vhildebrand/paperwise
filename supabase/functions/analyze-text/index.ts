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

// Rate limiting function
function checkRateLimit(userId: string): { allowed: boolean; remaining: number; resetTime: number } {
  const now = Date.now();
  const userLimit = rateLimitStore.get(userId);
  
  if (!userLimit || now > userLimit.resetTime) {
    // Reset or initialize rate limit
    rateLimitStore.set(userId, {
      count: 1,
      resetTime: now + RATE_LIMIT_WINDOW
    });
    return { allowed: true, remaining: MAX_REQUESTS_PER_MINUTE - 1, resetTime: now + RATE_LIMIT_WINDOW };
  }
  
  if (userLimit.count >= MAX_REQUESTS_PER_MINUTE) {
    return { allowed: false, remaining: 0, resetTime: userLimit.resetTime };
  }
  
  // Increment count
  userLimit.count++;
  rateLimitStore.set(userId, userLimit);
  
  return { allowed: true, remaining: MAX_REQUESTS_PER_MINUTE - userLimit.count, resetTime: userLimit.resetTime };
}

// Input validation function
function validateRequest(body: any): { valid: boolean; error?: string } {
  if (!body || typeof body !== 'object') {
    return { valid: false, error: 'Invalid request body' };
  }
  
  if (!body.task || typeof body.task !== 'string') {
    return { valid: false, error: 'Missing or invalid task parameter' };
  }
  
  // Validate task-specific requirements
  switch (body.task) {
    case 'analyze':
      if (!body.chunks || typeof body.chunks !== 'object') {
        return { valid: false, error: 'Missing or invalid chunks for analysis' };
      }
      
      // Check total text length
      const totalLength = Object.values(body.chunks).reduce((acc: number, chunk: any) => {
        return acc + (typeof chunk === 'string' ? chunk.length : 0);
      }, 0);
      
      if (totalLength > MAX_TEXT_LENGTH) {
        return { valid: false, error: `Total text length exceeds limit of ${MAX_TEXT_LENGTH} characters` };
      }
      break;
      
    case 'rewrite':
      if (!body.text || typeof body.text !== 'string') {
        return { valid: false, error: 'Missing or invalid text for rewrite' };
      }
      if (!body.action || typeof body.action !== 'string') {
        return { valid: false, error: 'Missing or invalid action for rewrite' };
      }
      if (body.text.length > MAX_TEXT_LENGTH) {
        return { valid: false, error: `Text length exceeds limit of ${MAX_TEXT_LENGTH} characters` };
      }
      break;
      
    case 'latex':
      if (!body.prompt || typeof body.prompt !== 'string') {
        return { valid: false, error: 'Missing or invalid prompt for LaTeX generation' };
      }
      if (body.prompt.length > 1000) {
        return { valid: false, error: 'Prompt length exceeds limit of 1000 characters' };
      }
      break;

    case 'citation':
    if (!body.query || typeof body.query !== 'string') {
      return { valid: false, error: 'Missing or invalid query for citation generation' };
    }
    if (body.query.length > 1000) {
      return { valid: false, error: 'Query length exceeds limit of 1000 characters' };
    }
      break;
      
    default:
      return { valid: false, error: `Invalid task: ${body.task}` };
  }
  
  return { valid: true };
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

function getAnalysisSystemPrompt({ formality, audience, domain }) {
    let guidelines = "You are an expert writing assistant.";

    if (formality) {
        guidelines += ` Your tone should be ${formality}.`;
    }
    if (audience) {
        guidelines += ` The target audience is ${audience}.`;
    }
    if (domain) {
        guidelines += ` The writing domain is ${domain}.`;
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
const citationSystemPrompt = `You are an expert academic librarian and citation specialist. The user will provide a description of a source. Your task is to generate a single, complete BibTeX entry for that source.

- Find the most credible source matching the description.
- Ensure the BibTeX is complete and well-formatted.
- Respond ONLY with the raw BibTeX code. Do not include any other explaining text, commentary, or markdown code fences.

Example User Query: "sapiens a brief history of humankind"

Example Response:
@book{harari2015sapiens,
  title={Sapiens: A brief history of humankind},
  author={Harari, Yuval Noah},
  year={2015},
  publisher={Harper}
}`;


// --- HANDLERS ---

async function handleAnalysis(reqBody) {
  const { chunks, formality, audience, domain } = reqBody;
  if (!chunks || Object.keys(chunks).length === 0) {
    throw new Error("No text chunks provided for analysis.");
  }

  const systemPrompt = getAnalysisSystemPrompt({ formality, audience, domain });
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

async function handleCitation(reqBody) {
  const { query } = reqBody;
  if (!query) {
    throw new Error("Missing 'query' for citation task.");
  }

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      { role: 'system', content: citationSystemPrompt },
      { role: 'user', content: query },
    ],
    temperature: 0, // Set to 0 for deterministic and accurate output
  });
  
  return { bibtex: completion.choices[0].message.content.trim() };
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

  // Apply rate limiting
  const rateLimit = checkRateLimit(auth.user!.id);
  if (!rateLimit.allowed) {
    return new Response(JSON.stringify({ 
      error: 'Rate limit exceeded', 
      remaining: rateLimit.remaining,
      resetTime: rateLimit.resetTime 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 429,
    });
  }

  try {
    const body = await req.json();
    
    // Validate request
    const validation = validateRequest(body);
    if (!validation.valid) {
      return new Response(JSON.stringify({ error: validation.error }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }
    
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
      case 'citation':
        data = await handleCitation(body);
        break;
      default:
        throw new Error(`Invalid task: ${task}`);
    }
    
    return new Response(
      JSON.stringify(data),
      {
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json',
          'X-RateLimit-Remaining': rateLimit.remaining.toString(),
          'X-RateLimit-Reset': rateLimit.resetTime.toString()
        },
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