import { supabase } from './supabase';
import type { AnalysisSuggestion, AnalyzeRequest, AnalyzeResponse } from '../types/analysis';

/**
 * Generate a unique chunk ID for text analysis
 */
function generateChunkId(): string {
  return `chunk_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Call the secured analyze function with proper authentication
 */
export async function analyzeText(request: AnalyzeRequest): Promise<AnalyzeResponse> {
  try {
    // Get the current session to extract the JWT token
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError || !session) {
      return { error: 'Authentication required. Please log in again.' };
    }

    // Get the function URL based on environment
    const isDevelopment = import.meta.env.DEV;
    const functionUrl = isDevelopment 
      ? 'http://localhost:54321/functions/v1/analyze'
      : `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/analyze`;

    // Make the request with proper authentication
    const response = await fetch(functionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
      },
      body: JSON.stringify(request),
    });

    // Handle rate limiting
    if (response.status === 429) {
      const retryAfter = response.headers.get('Retry-After');
      const rateLimitRemaining = response.headers.get('X-RateLimit-Remaining');
      return { 
        error: `Rate limit exceeded. Please try again in ${retryAfter || 60} seconds.`,
        rateLimitRemaining: rateLimitRemaining ? parseInt(rateLimitRemaining) : 0
      };
    }

    // Handle authentication errors
    if (response.status === 401) {
      return { error: 'Authentication failed. Please log in again.' };
    }

    // Handle other errors
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return { error: errorData.error || `Request failed with status ${response.status}` };
    }

    // Parse successful response and add chunkIds
    const rawData = await response.json();
    const rateLimitRemaining = response.headers.get('X-RateLimit-Remaining');
    
    // Add chunkId to each suggestion if not present
    const data = Array.isArray(rawData) ? rawData.map(suggestion => ({
      ...suggestion,
      chunkId: suggestion.chunkId || generateChunkId()
    })) : [];
    
    return { 
      data,
      rateLimitRemaining: rateLimitRemaining ? parseInt(rateLimitRemaining) : undefined
    };

  } catch (error) {
    console.error('Error calling analyze function:', error);
    return { error: 'Network error. Please check your connection and try again.' };
  }
}

/**
 * Validate text before sending to analyze function
 */
export function validateTextForAnalysis(text: string): { valid: boolean; error?: string } {
  if (!text || typeof text !== 'string') {
    return { valid: false, error: 'Text is required and must be a string' };
  }
  
  if (text.trim().length === 0) {
    return { valid: false, error: 'Text cannot be empty' };
  }
  
  if (text.length > 10000) {
    return { valid: false, error: 'Text too long. Maximum 10,000 characters allowed' };
  }
  
  if (text.length < 20) {
    return { valid: false, error: 'Text too short. Minimum 20 characters required for analysis' };
  }
  
  return { valid: true };
} 