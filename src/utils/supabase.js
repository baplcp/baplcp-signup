import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(
  'https://rkmxoqopptyuqhbeswqo.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJrbXhvcW9wcHR5dXFoYmVzd3FvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0ODU1NzMsImV4cCI6MjA5MjA2MTU3M30.r_Mows0iPF_FULtFJGCQctxERy8E5JCIndyD-llDbIA'
)
