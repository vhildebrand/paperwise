/**
 * Unified interface for writing suggestions
 * This interface is used across all components to ensure type consistency
 */
export interface AnalysisSuggestion {
  type: 'spelling' | 'grammar' | 'style' | 'clarity' | 'tone';
  originalText: string;
  suggestion: string;
  explanation: string;
  startIndex: number;
  endIndex: number;
  chunkId: string; // Required for AnalysisExtension
  ruleName?: string; // Optional for additional context
}

/**
 * Request interface for analyze function
 */
export interface AnalyzeRequest {
  text: string;
  tone?: string;
}

/**
 * Response interface for analyze function
 */
export interface AnalyzeResponse {
  data?: AnalysisSuggestion[];
  error?: string;
  rateLimitRemaining?: number;
}

/**
 * Document statistics
 */
export interface DocumentStats {
  words: number;
  characters: number;
  readingTime: number;
  fleschKincaid: number; // Flesch-Kincaid Grade Level
}

/**
 * Analysis status
 */
export type AnalysisStatus = 'idle' | 'analyzing' | 'complete' | 'error'; 