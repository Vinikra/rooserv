import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://wggajdfwthocruelxmyv.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndnZ2FqZGZ3dGhvY3J1ZWx4bXl2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODcxNjEyMTgsImV4cCI6MjEwMjczNzIxOH0.R8RJjTC5lqm3pbmNVBJNACoFRaEequuEqRATUqZfr6Y';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
