import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://vfcukdsbpvraxbgavhvx.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZmY3VrZHNicHZyYXhiZ2F2aHZ4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk1NTY0NTcsImV4cCI6MjA4NTEzMjQ1N30.Fv_xc_jRROhzYChAkqc5Kc1Fq1S61dPRBT1ZLucE7q4'

export const supabase = createClient(supabaseUrl, supabaseKey)
