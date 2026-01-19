/* eslint-disable @typescript-eslint/no-explicit-any */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const apiKey = Deno.env.get('GROQ_API_KEY')
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    if (!apiKey) throw new Error("Missing Secret: GROQ_API_KEY")

    const { query } = await req.json()

    // =================================================================================
    // THE MASTER INSTRUCTION (THE BRAIN)
    // =================================================================================
    const masterPrompt = `
      You are a Senior PostgreSQL Architect for a Digital Agency CRM. 
      Your job is to translate human questions into precise, crash-proof SQL queries.

      ============= 1. THE DATABASE SCHEMA (Read Carefully) =============
      
      Table: leads
      - Columns: id, business_name, contact_person, email, phone, city, status, created_at
      - Context: Potential clients who haven't paid yet.
      
      Table: active_projects
      - Columns: id, project_name, client_name, status, total_budget, paid_amount, deadline, start_date
      - Context: Ongoing work. 'total_budget' is the deal value. 'paid_amount' is collected revenue.
      
      Table: profiles (User details)
      - Columns: id, full_name, email, phone, avatar_url
      - Note: This table DOES NOT contain the role (admin/employee). It only has names.
      
      Table: user_roles (Permissions)
      - Columns: user_id, role (enum: 'admin', 'employee', 'client')
      - Note: You MUST join this with 'profiles' to know who is who.
      - Link: profiles.id = user_roles.user_id

      ============= 2. BUSINESS LOGIC & DICTIONARY =============
      - "Revenue", "Income", "Earnings" -> SUM(active_projects.paid_amount)
      - "Total Value", "Budget", "Pipeline" -> SUM(active_projects.total_budget)
      - "Employees", "Staff", "Team" -> Users in 'user_roles' where role = 'employee'
      - "Admins", "Boss" -> Users in 'user_roles' where role = 'admin'
      - "Clients" -> Users in 'user_roles' where role = 'client' OR entries in 'active_projects'
      - "Owed", "Pending Payment" -> (total_budget - paid_amount)
      - "Recent" -> ORDER BY created_at DESC LIMIT 5

      ============= 3. CRASH PREVENTION RULES (Strict Enforce) =============
      1. CAST ENUMS: The 'status' and 'role' columns are ENUMs. You CANNOT compare them to text directly.
         - WRONG: WHERE status = 'pending'
         - RIGHT: WHERE status::text ILIKE 'pending'
         - RIGHT: WHERE role::text = 'employee'
      
      2. FUZZY SEARCH: Always use ILIKE for names/emails.
         - RIGHT: WHERE business_name ILIKE '%affirm%'
      
      3. JOINING USERS: To list people by role, you MUST JOIN:
         - "SELECT p.full_name, p.email, r.role FROM profiles p JOIN user_roles r ON p.id = r.user_id WHERE r.role::text = 'employee'"

      4. FORMATTING: 
         - Return ONLY the raw SQL string.
         - NO Markdown (no \`\`\`). 
         - NO Semicolons (;). 
         - NO Explanations.

      ============= 4. THE USER REQUEST =============
      User Question: "${query}"
    `

    // 1. Generate SQL
    const sqlQuery = await callGroq(apiKey, masterPrompt)
    console.log("SQL Generated:", sqlQuery)

    // 2. Run SQL
    const supabase = createClient(supabaseUrl, supabaseKey)
    const { data: dbResult, error: dbError } = await supabase.rpc('run_sql_query', { query: sqlQuery })

    if (dbError) throw new Error(`DB Error: ${dbError.message}`)
    if (dbResult && dbResult.error) throw new Error(`SQL Logic Error: ${dbResult.error}`)

    // 3. Summarize Answer
    const summary = await callGroq(apiKey, `
      Act as a helpful CRM Assistant.
      Summarize this data into a short, friendly answer.
      User asked: "${query}"
      Database found: ${JSON.stringify(dbResult)}
    `)

    return new Response(JSON.stringify({ answer: summary }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error: any) {
    console.error("Bot Error:", error.message)
    return new Response(JSON.stringify({ answer: `⚠️ I had a hiccup: ${error.message}` }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})

// Helper Function
async function callGroq(apiKey: string, prompt: string) {
  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: "You are a senior database engineer." },
        { role: 'user', content: prompt }
      ],
      temperature: 0.1,
      max_tokens: 1000
    })
  })

  const data = await response.json()
  if (data.error) throw new Error(`Groq API Error: ${data.error.message}`)

  const text = data.choices?.[0]?.message?.content || ""
  
  // Clean up any formatting garbage
  return text.trim()
    .replace(/```sql/g, '')
    .replace(/```/g, '')
    .replace(/;/g, '')
    .trim()
}