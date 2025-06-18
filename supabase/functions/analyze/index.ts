// supabase/functions/analyze/index.ts
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from '@supabase/supabase-js'

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
function checkRateLimit(identifier: string): { allowed: boolean; remaining: number } {
  const now = Date.now();
  const record = rateLimitStore.get(identifier);
  
  if (!record || now > record.resetTime) {
    // Reset or create new record
    rateLimitStore.set(identifier, {
      count: 1,
      resetTime: now + RATE_LIMIT_WINDOW
    });
    return { allowed: true, remaining: MAX_REQUESTS_PER_MINUTE - 1 };
  }
  
  if (record.count >= MAX_REQUESTS_PER_MINUTE) {
    return { allowed: false, remaining: 0 };
  }
  
  record.count++;
  return { allowed: true, remaining: MAX_REQUESTS_PER_MINUTE - record.count };
}

// Input validation
function validateInput(text: string, tone?: string): { valid: boolean; error?: string } {
  if (!text || typeof text !== 'string') {
    return { valid: false, error: 'Text is required and must be a string' };
  }
  
  if (text.length > MAX_TEXT_LENGTH) {
    return { valid: false, error: `Text too long. Maximum ${MAX_TEXT_LENGTH} characters allowed` };
  }
  
  if (text.trim().length === 0) {
    return { valid: false, error: 'Text cannot be empty' };
  }
  
  if (tone && typeof tone !== 'string') {
    return { valid: false, error: 'Tone must be a string' };
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

  try {
    // Check rate limiting
    const clientIP = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown';
    const rateLimit = checkRateLimit(clientIP);
    
    if (!rateLimit.allowed) {
      return new Response(JSON.stringify({ 
        error: 'Rate limit exceeded. Please try again later.',
        retryAfter: Math.ceil(RATE_LIMIT_WINDOW / 1000)
      }), {
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json',
          'X-RateLimit-Remaining': rateLimit.remaining.toString(),
          'Retry-After': Math.ceil(RATE_LIMIT_WINDOW / 1000).toString()
        },
        status: 429,
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

    // Get OpenAI API key
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) {
      throw new Error("Missing OPENAI_API_KEY environment variable.");
    }

    // Parse and validate request body
    let body;
    try {
      body = await req.json();
    } catch (error) {
      return new Response(JSON.stringify({ error: 'Invalid JSON in request body' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    const { text, tone } = body;
    
    // Validate input
    const validation = validateInput(text, tone);
    if (!validation.valid) {
      return new Response(JSON.stringify({ error: validation.error }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
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
        max_tokens: 2000, // Limit response size
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
    });

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
      headers: { 
        ...corsHeaders, 
        'Content-Type': 'application/json',
        'X-RateLimit-Remaining': rateLimit.remaining.toString(),
      },
      status: 200,
    });
  } catch (error) {
    console.error('Function error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});