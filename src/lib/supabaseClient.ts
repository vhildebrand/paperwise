// src/lib/supabaseClient.ts

import { createClient } from '@supabase/supabase-js';
import type { Database } from '../types/supabase'; // Optional: For TypeScript type safety

// --- Configuration ---
// These variables are pulled from your environment variables (.env.local file).
// Using Vite, environment variables exposed to the browser must be prefixed with `VITE_`.
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;


// --- Environment Variable Validation ---
// A crucial step to ensure the application doesn't run without its configuration.
// This provides a clear error message during development if the .env file is missing or misconfigured.
if (!supabaseUrl) {
  throw new Error("VITE_SUPABASE_URL is not set. Please check your .env.local file.");
}

if (!supabaseAnonKey) {
  throw new Error("VITE_SUPABASE_ANON_KEY is not set. Please check your .env.local file.");
}


// --- Supabase Client Initialization ---
// Create the Supabase client instance. This object will be used throughout your app
// to interact with Supabase services like Auth, Database, and Storage.
//
// The optional generic `<Database>` provides full TypeScript support,
// giving you autocompletion and type-checking for your tables and columns.
// You can generate this type using the Supabase CLI.
export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey);

// To generate the `Database` type for enhanced TypeScript support:
// 1. Install the Supabase CLI and log in.
// 2. Run the following command in your project's root directory:
//    npx supabase gen types typescript --project-id YOUR_PROJECT_ID > src/types/supabase.ts
//    (Replace YOUR_PROJECT_ID with the ID from your Supabase project settings)
// 3. If you don't want to use this feature yet, you can remove the `<Database>` generic:
//    export const supabase = createClient(supabaseUrl, supabaseAnonKey);
