# Paperwise

A modern AI-powered writing assistant with real-time grammar and style suggestions.

## Features

- **Real-time Analysis**: AI-powered writing suggestions as you type
- **Structured Output**: Fast and reliable JSON responses using OpenAI's structured output feature
- **Multiple Suggestion Types**: Spelling, grammar, style, clarity, and tone improvements
- **Tone Control**: Adjust analysis based on your preferred writing tone
- **Rich Text Editor**: Full-featured editor with formatting tools
- **Document Management**: Save, edit, and organize your documents

## Technical Improvements

### Structured Output Implementation

The application now uses OpenAI's structured output feature (`response_format: { type: "json_object" }`) for improved:

- **Speed**: Faster response times due to guaranteed JSON format
- **Reliability**: Reduced parsing errors and more consistent responses
- **Type Safety**: Better TypeScript integration with proper type definitions

### Key Updates

1. **Edge Function (`supabase/functions/analyze-text/index.ts`)**:
   - Optimized system prompt for structured output
   - Removed unnecessary JSON parsing (response is guaranteed valid JSON)
   - Added comprehensive input validation
   - Improved error handling and logging

2. **Type Definitions (`src/types/analysis.ts`)**:
   - Added `RawAnalysisSuggestion` interface for AI responses
   - Updated `AnalyzeResponse` interface for structured output
   - Added `AnalysisTone` type for better type safety
   - Added `ParagraphState` interface for tracking analysis status

3. **Editor Component (`src/pages/Editor.tsx`)**:
   - Enhanced error handling for structured responses
   - Better logging for debugging
   - Improved type safety with new interfaces

4. **Editor Toolbar (`src/components/EditorToolbar.tsx`)**:
   - Updated to use proper `AnalysisTone` types
   - Added more tone options (formal, casual, academic, business, creative, neutral)

## Development

### Prerequisites

- Node.js 18+
- Supabase account
- OpenAI API key

### Setup

1. Clone the repository
2. Install dependencies: `npm install`
3. Set up environment variables:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `OPENAI_API_KEY` (in Supabase Edge Functions)
4. Deploy Supabase Edge Functions: `supabase functions deploy`
5. Start development server: `npm run dev`

### Edge Functions

The main analysis functionality is handled by the `analyze-text` Edge Function, which:

- Accepts text chunks with tone preferences
- Returns structured JSON responses with suggestions
- Includes comprehensive error handling and validation
- Supports rate limiting and authentication

## Architecture

- **Frontend**: React + TypeScript + TipTap editor
- **Backend**: Supabase Edge Functions (Deno)
- **AI**: OpenAI GPT-4o-mini with structured output
- **Database**: Supabase PostgreSQL
- **Styling**: Tailwind CSS
