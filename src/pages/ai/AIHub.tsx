import { useState, useRef, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Loader2, Bot, FileText, CheckSquare, Sparkles, Wand2, CalendarClock, 
  MessageSquare, Briefcase, Mail, Code, Copy, Check, RotateCcw, 
  Trash2, Send, Cpu, Zap, History, ArrowUpRight
} from 'lucide-react';
import { toast } from 'sonner';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { format } from 'date-fns';

interface HistoryItem {
  id: string;
  tool: string;
  prompt: string;
  result: string;
  timestamp: Date;
}

// Token failover array read from environment variables (no hardcoded secrets)
const GROQ_KEYS = [
  import.meta.env.VITE_GROQ_API_KEY || '',
  import.meta.env.VITE_GROQ_API_KEY_2 || '',
  import.meta.env.VITE_GROQ_API_KEY_3 || ''
].filter(Boolean);

export default function AIHub() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState('');
  const [activeTab, setActiveTab] = useState('copilot');
  const [copied, setCopied] = useState(false);
  const [history, setHistory] = useState<HistoryItem[]>([]);

  const TOOLS = [
    { id: 'copilot', label: 'AI Chat', icon: MessageSquare, color: 'text-indigo-500' },
    { id: 'proposal', label: 'Proposal', icon: FileText, color: 'text-emerald-500' },
    { id: 'meeting', label: 'Meetings', icon: CheckSquare, color: 'text-sky-500' },
    { id: 'estimator', label: 'Timeline', icon: CalendarClock, color: 'text-amber-500' },
    { id: 'hr', label: 'HR JDs', icon: Briefcase, color: 'text-violet-500' },
    { id: 'marketing', label: 'Emails', icon: Mail, color: 'text-rose-500' },
    { id: 'boilerplate', label: 'Code Dev', icon: Code, color: 'text-pink-500' },
    { id: 'history', label: 'Session Logs', icon: History, color: 'text-blue-500' }
  ];
  
  // Custom Copilot Chat State
  const [chatInput, setChatInput] = useState('');
  const [chatPersona, setChatPersona] = useState('general');
  const [chatMessages, setChatMessages] = useState<{ role: 'user' | 'assistant'; content: string }[]>([
    { role: 'assistant', content: "Hi! I am your AI Enterprise Copilot. How can I help you automate your tasks or generate business insights today?" }
  ]);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  // Proposal Writer State
  const [selectedLead, setSelectedLead] = useState('');
  const [proposalNotes, setProposalNotes] = useState('');

  // Meeting Summary State
  const [meetingTranscript, setMeetingTranscript] = useState('');

  // Project Estimator State
  const [projectReqs, setProjectReqs] = useState('');

  // Job Description State
  const [jdRole, setJdRole] = useState('');
  const [jdDept, setJdDept] = useState('Engineering');
  const [jdSkills, setJdSkills] = useState('');

  // Marketing Copy State
  const [marketingChannel, setMarketingChannel] = useState('email');
  const [marketingTone, setMarketingTone] = useState('professional');
  const [marketingContext, setMarketingContext] = useState('');

  // SQL & Code Boilerplate State
  const [codeLang, setCodeLang] = useState('sql');
  const [codeRequirements, setCodeRequirements] = useState('');

  const { data: leads = [] } = useQuery({
    queryKey: ['crm-leads-ai'],
    queryFn: async () => {
      const { data } = await supabase.from('leads').select('*').order('created_at', { ascending: false });
      return data || [];
    }
  });

  // Auto scroll to bottom in copilot chat
  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  const copyToClipboard = () => {
    if (!result) return;
    navigator.clipboard.writeText(result);
    setCopied(true);
    toast.success('Copied to clipboard!');
    setTimeout(() => setCopied(false), 2000);
  };

  // Roll-over Groq request mechanism
  const callGroq = async (prompt: string, bypassState = false) => {
    if (GROQ_KEYS.length === 0) {
      toast.error('No Groq API Keys are configured!');
      return null;
    }

    if (!bypassState) {
      setLoading(true);
      setResult('');
    }
    
    let success = false;
    let outputText = 'No response generated.';
    
    // Attempt Groq API keys in sequence if any key fails or rate-limits
    for (let i = 0; i < GROQ_KEYS.length; i++) {
      const activeKey = GROQ_KEYS[i];
      try {
        const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${activeKey}`
          },
          body: JSON.stringify({
            model: 'llama-3.3-70b-versatile',
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.7
          })
        });

        if (res.ok) {
          const data = await res.json();
          outputText = data.choices?.[0]?.message?.content || 'No response generated.';
          success = true;
          break; // Key call was successful, exit failover loop
        } else {
          console.warn(`Groq Key index ${i} rate-limited or failed. Trying next token...`);
        }
      } catch (err) {
        console.error(`Error calling Groq with key index ${i}:`, err);
      }
    }

    if (!success) {
      toast.error('All configured Groq API keys are exhausted or rate-limited! Please try again later.');
      if (!bypassState) setLoading(false);
      return null;
    }
    
    if (!bypassState) {
      setResult(outputText);
      toast.success('AI generation complete!');
      
      // Save history block
      const toolLabel = activeTab.charAt(0).toUpperCase() + activeTab.slice(1);
      setHistory(prev => [
        {
          id: Math.random().toString(36).substring(2, 9),
          tool: toolLabel,
          prompt: prompt.slice(0, 100) + '...',
          result: outputText,
          timestamp: new Date()
        },
        ...prev
      ]);
    }

    if (!bypassState) {
      setLoading(false);
    }
    return outputText;
  };

  // 1. Custom Copilot Chat Flow
  const handleChatSend = async () => {
    if (!chatInput.trim()) return;
    
    const userMsg = chatInput;
    setChatInput('');
    setChatMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setLoading(true);

    const personas: Record<string, string> = {
      general: "You are a helpful Senior Enterprise AI Copilot integrated in the TechWisdom CRM and ERP software platform. Answer professionally, use formatting, and provide highly structured, action-oriented assistance.",
      analyst: "You are a Senior Business Systems Analyst. Analyze user prompts looking for KPI definitions, efficiency improvements, process mapping, and bottleneck analysis.",
      recruiter: "You are an expert HR Manager & Tech Recruiter. Answer the user focusing on talent attraction, modern corporate culture, retention frameworks, and structured interviews.",
      engineer: "You are a Principal Software Architect. Help the user with database designs, SQL queries, TypeScript API patterns, and secure enterprise infrastructure."
    };

    const systemContext = personas[chatPersona] || personas.general;
    const chatPrompt = `${systemContext}\n\nUser Question: ${userMsg}\n\nAnswer cleanly using Markdown:`;

    const aiResponse = await callGroq(chatPrompt, true);
    setLoading(false);

    if (aiResponse) {
      setChatMessages(prev => [...prev, { role: 'assistant', content: aiResponse }]);
    }
  };

  // 2. Proposal Generator Flow
  const generateProposal = () => {
    const lead = leads.find((l: any) => l.id === selectedLead);
    if (!lead) return toast.error('Please select a lead first');
    
    const prompt = `You are a Principal Consultant and Enterprise Sales Architect at TechWisdom Technologies.
Write a professional, premium sales proposal for the following CRM lead. Make it highly engaging, modern, and structured using clean Markdown formatting.

Lead Contact: ${lead.contact_person || 'Unknown'}
Company: ${lead.business_name || 'N/A'}
Service category: ${lead.category || 'General Software Engineering'}
Original Scope & Description: ${lead.description || lead.notes || 'N/A'}

Additional contextual guidance from our team:
"${proposalNotes || 'Provide standard agency high-fidelity service details.'}"

Outline structure:
1. ## Executive Summary
2. ## Core Technical Solution & Deliverables
3. ## Project Timeline & Roadmap
4. ## Financial Investment & Milestones
5. ## Next Steps`;

    callGroq(prompt);
  };

  // 3. Meeting Summary Flow
  const generateMeetingSummary = () => {
    if (!meetingTranscript.trim()) return toast.error('Please paste your meeting notes or transcripts first');
    
    const prompt = `You are a high-fidelity business operations assistant. Convert these raw, messy meeting logs or transcript into a sleek, executive-level summary.
Use clean markdown and highlight key action assignments explicitly.

Raw Meeting Log:
"${meetingTranscript}"

Format beautifully with:
1. ## 📝 Executive Meeting Digest
2. ## 🎯 Key Decisions Made
3. ## ✅ Actions & Ownership Matrix
4. ## 🗓️ Next Sync Agenda`;

    callGroq(prompt);
  };

  // 4. Project Timeline Flow
  const estimateProject = () => {
    if (!projectReqs.trim()) return toast.error('Please specify the project scope or requirements');
    
    const prompt = `You are a Senior Project Manager & Technical Architect. Estimate a software project scope based on these high-level requirements.
Provide a high-fidelity roadmap assuming agile sprints. Use markdown.

Project Requirements:
"${projectReqs}"

Required output section structure:
1. ## 📊 Technical Complexity Audit
2. ## 📅 Phase Breakdown
3. ## 🏃 Sprint Plan (Sprint 1 through 4)
4. ## ⚠️ Risks & Timeline Buffer`;

    callGroq(prompt);
  };

  // 5. Job Description Writer Flow
  const generateJobDescription = () => {
    if (!jdRole.trim()) return toast.error('Please enter the target Job Title');
    
    const prompt = `You are a Senior Technical Recruiter. Write an engaging, highly professional and modern Job Description for the following open role. 
Format using premium Markdown.

Job Title: ${jdRole}
Department: ${jdDept}
Desired Core Skills & Technologies: ${jdSkills || 'Standard competencies'}

Provide:
1. ## Role Overview
2. ## Key Responsibilities
3. ## Technical Qualifications
4. ## Perks & Growth Roadmap`;

    callGroq(prompt);
  };

  // 6. Marketing Copy Flow
  const generateMarketingCopy = () => {
    if (!marketingContext.trim()) return toast.error('Please describe what you want to promote or communicate');
    
    const prompt = `You are a Senior Copywriter and Marketing Specialist. Write high-conversion marketing copy tailored for the selected channel and tone.
Use Markdown.

Marketing Channel: ${marketingChannel}
Tone of Voice: ${marketingTone}
Context/Product/Topic: ${marketingContext}

Format the response with:
1. ## 📣 Strategic Hook / Headlines
2. ## ✍️ Prime Copy Draft
3. ## 💡 Pro-tips for Call-to-action`;

    callGroq(prompt);
  };

  // 7. Developer Boilerplate SQL Flow
  const generateBoilerplate = () => {
    if (!codeRequirements.trim()) return toast.error('Please enter the boilerplate requirements');
    
    const prompt = `You are a Senior Software Architect. Generate highly optimized, production-ready boilerplate configurations or code templates.

Language/Format: ${codeLang}
Requirements: ${codeRequirements}

Format standard markdown with:
1. ## 🛠️ Architecture & Setup Guide
2. ## 💻 Implementation Code Block
3. ## 🔒 Security & Performance Recommendations`;

    callGroq(prompt);
  };

  // 8. CRM Leads Auto Score Flow
  const scoreLeads = async () => {
    if (!leads.length) return toast.error('No active leads found in CRM');
    
    const leadsData = leads.map((l: any) => ({
      contact_person: l.contact_person || 'Unknown',
      company: l.business_name,
      category: l.category,
      status: l.status,
      notes: l.description || l.notes
    }));

    const prompt = `You are an AI Sales Director. Analyze the following CRM leads database and calculate a proprietary "Lead Score" (1 to 100) based on category viability, status progress, and notes depth.

Return ONLY a premium Markdown table:
| Client Partner | Company | Domain Category | Score (1-100) | Conversion Predictor & AI Reason |

Leads Database:
${JSON.stringify(leadsData, null, 2)}`;

    callGroq(prompt);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 flex flex-col h-[calc(100vh-120px)] md:h-[calc(100vh-130px)]">
        
        {/* TOP ROW HEADER */}
        <div className="flex flex-row items-center justify-between border-b pb-4 shrink-0">
          <div>
            <h1 className="text-3xl font-extrabold flex items-center gap-2 bg-gradient-to-r from-primary to-indigo-600 bg-clip-text text-transparent">
              <Sparkles className="h-8 w-8 text-primary animate-pulse" /> AI Assistant Hub
            </h1>
            <p className="text-sm text-muted-foreground mt-1 flex items-center gap-2">
              <Cpu className="h-4 w-4 text-indigo-500" /> High Availability Pool: {GROQ_KEYS.length} AI Tokens Active
            </p>
          </div>
          <Button 
            onClick={scoreLeads} 
            disabled={loading}
            className="gradient-primary text-white font-bold h-11 px-5 rounded-xl shadow-lg hover:shadow-primary/20 hover:opacity-95 transition-all active:scale-[0.98] flex items-center gap-2"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4.5 w-4.5 text-amber-300" />}
            Auto-Score CRM Leads
          </Button>
        </div>

        {/* MAIN SPLIT WORKSPACE GRID */}
        <div className="grid lg:grid-cols-2 gap-6 flex-1 min-h-0 items-stretch overflow-hidden pb-2">
          
          {/* LEFT CARDS: TOOLS WORKSPACE */}
          <Card className="glass-card flex flex-col h-full overflow-hidden border-border/60 bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl shadow-xl rounded-2xl">
            <CardHeader className="shrink-0 border-b border-border/50 pb-4 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-xl font-bold text-foreground">AI Workspaces</CardTitle>
                <CardDescription className="text-xs">Select a workspace template to accelerate outputs</CardDescription>
              </div>
              
              {activeTab === 'copilot' && (
                <div className="flex items-center gap-2">
                  <Select value={chatPersona} onValueChange={setChatPersona}>
                    <SelectTrigger className="h-9 w-36 text-xs font-semibold rounded-xl bg-background/50 border-border/60">
                      <SelectValue placeholder="Persona" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      <SelectItem value="general" className="text-xs font-semibold">General Copilot</SelectItem>
                      <SelectItem value="analyst" className="text-xs font-semibold">Business Analyst</SelectItem>
                      <SelectItem value="recruiter" className="text-xs font-semibold">HR Recruiter</SelectItem>
                      <SelectItem value="engineer" className="text-xs font-semibold">Architect</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button 
                    variant="ghost" 
                    onClick={() => setChatMessages([{ role: 'assistant', content: "Chat timeline cleared. How can I assist you?" }])}
                    className="h-9 px-3 rounded-xl text-xs font-semibold text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/20"
                  >
                    Clear
                  </Button>
                </div>
              )}
            </CardHeader>
            
            <CardContent className="p-0 flex-1 overflow-hidden flex flex-row min-h-0 h-full">
              {/* VERTICAL TOOL SELECTOR SIDEBAR */}
              <div className="w-[160px] shrink-0 border-r border-border/50 bg-slate-50/50 dark:bg-slate-950/20 p-2.5 flex flex-col gap-1 h-full select-none">
                {TOOLS.map((tool) => {
                  const Icon = tool.icon;
                  const isActive = activeTab === tool.id;
                  return (
                    <button
                      key={tool.id}
                      onClick={() => setActiveTab(tool.id)}
                      type="button"
                      className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs font-bold transition-all duration-200 active:scale-[0.97] text-left ${
                        isActive
                          ? 'bg-primary text-white shadow-md shadow-primary/10'
                          : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-900/60'
                      }`}
                    >
                      <Icon className={`h-4 w-4 shrink-0 ${isActive ? 'text-white' : tool.color}`} />
                      <span className="truncate">{tool.label}</span>
                    </button>
                  );
                })}
              </div>

              {/* DYNAMIC SCROLLABLE FORM PANEL (NO SCROLLBAR) */}
              <div className="flex-1 p-5 overflow-y-auto min-h-0 h-full scrollbar-none [scrollbar-width:none] [-ms-overflow-style:none]">
                
                {/* 1. COPILOT */}
                {activeTab === 'copilot' && (
                  <div className="h-full flex flex-col justify-between gap-4 min-h-0">
                    <div className="flex-1 bg-slate-50/50 dark:bg-slate-950/20 border border-border/30 rounded-2xl p-4 overflow-y-auto custom-scrollbar flex flex-col space-y-4 min-h-[220px]">
                      {chatMessages.map((m, i) => (
                        <div key={i} className={`flex gap-3 max-w-[85%] ${m.role === 'user' ? 'self-end flex-row-reverse' : 'self-start'}`}>
                          <div className={`p-3.5 rounded-2xl text-sm leading-relaxed font-medium shadow-sm ${
                            m.role === 'user' 
                              ? 'bg-primary text-white rounded-tr-none' 
                              : 'bg-white dark:bg-slate-800 border border-border/40 rounded-tl-none text-slate-700 dark:text-slate-300'
                          }`}>
                            <p className="whitespace-pre-wrap">{m.content}</p>
                          </div>
                        </div>
                      ))}
                      <div ref={chatBottomRef}></div>
                    </div>

                    <div className="flex gap-2 shrink-0">
                      <Input 
                        placeholder="Type message and consult AI Copilot..." 
                        value={chatInput} 
                        onChange={e => setChatInput(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleChatSend()}
                        className="h-11 rounded-xl text-sm border-border/60 bg-white/50 dark:bg-slate-950/20 focus:ring-2 focus:ring-primary/20 font-medium"
                      />
                      <Button onClick={handleChatSend} className="h-11 rounded-xl w-11 shrink-0 gradient-primary text-white shadow-sm flex items-center justify-center">
                        <Send className="h-4.5 w-4.5" />
                      </Button>
                    </div>
                  </div>
                )}

                {/* 2. PROPOSAL WRITER */}
                {activeTab === 'proposal' && (
                  <div className="space-y-4">
                    <div>
                      <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Choose CRM Lead Partner</Label>
                      <Select value={selectedLead} onValueChange={setSelectedLead}>
                        <SelectTrigger className="mt-1.5 h-11 rounded-xl text-sm border-border/60 bg-white/50 dark:bg-slate-950/25">
                          <SelectValue placeholder="Select active CRM lead..." />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl">
                          {leads.map((l: any) => (
                            <SelectItem key={l.id} value={l.id} className="text-sm font-semibold">
                              {l.business_name} ({l.contact_person || 'No Contact'}) - {l.category || 'General'}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Custom Offer Details & Context</Label>
                      <Textarea 
                        placeholder="e.g. Include 10% discount. Highlight React, Node, and TailwindCSS expertise. Emphasize a 3-month timeline." 
                        value={proposalNotes} 
                        onChange={e => setProposalNotes(e.target.value)} 
                        rows={6} 
                        className="mt-1.5 rounded-xl text-sm border-border/60 bg-white/50 dark:bg-slate-950/25 font-medium leading-relaxed resize-none"
                      />
                    </div>
                    <Button onClick={generateProposal} disabled={loading} className="w-full h-11 rounded-xl text-sm font-bold gradient-primary text-white flex gap-2 shadow-md">
                      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
                      Generate Project Proposal
                    </Button>
                  </div>
                )}

                {/* 3. MEETING SUMMARY */}
                {activeTab === 'meeting' && (
                  <div className="space-y-4">
                    <div>
                      <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Meeting Notes / Transcript</Label>
                      <Textarea 
                        placeholder="Paste your raw, messy meeting notes or transcripts here..." 
                        value={meetingTranscript} 
                        onChange={e => setMeetingTranscript(e.target.value)} 
                        rows={9} 
                        className="mt-1.5 rounded-xl text-sm border-border/60 bg-white/50 dark:bg-slate-950/25 font-medium leading-relaxed resize-none"
                      />
                    </div>
                    <Button onClick={generateMeetingSummary} disabled={loading} className="w-full h-11 rounded-xl text-sm font-bold gradient-primary text-white flex gap-2 shadow-md">
                      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckSquare className="h-4 w-4" />}
                      Extract Executive Action Matrix
                    </Button>
                  </div>
                )}

                {/* 4. TIMELINE ESTIMATOR */}
                {activeTab === 'estimator' && (
                  <div className="space-y-4">
                    <div>
                      <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Requirements & Feature Checklist</Label>
                      <Textarea 
                        placeholder="List the main features or details of the application to estimate sprints..." 
                        value={projectReqs} 
                        onChange={e => setProjectReqs(e.target.value)} 
                        rows={9} 
                        className="mt-1.5 rounded-xl text-sm border-border/60 bg-white/50 dark:bg-slate-950/25 font-medium leading-relaxed resize-none"
                      />
                    </div>
                    <Button onClick={estimateProject} disabled={loading} className="w-full h-11 rounded-xl text-sm font-bold gradient-primary text-white flex gap-2 shadow-md">
                      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CalendarClock className="h-4 w-4" />}
                      Estimate Roadmap & Sprints
                    </Button>
                  </div>
                )}

                {/* 5. HR JDS */}
                {activeTab === 'hr' && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Job Title</Label>
                        <Input 
                          placeholder="e.g. Senior Architect" 
                          value={jdRole} 
                          onChange={e => setJdRole(e.target.value)}
                          className="mt-1.5 h-11 rounded-xl text-sm border-border/60 bg-white/50 dark:bg-slate-950/25 font-medium"
                        />
                      </div>
                      <div>
                        <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Department</Label>
                        <Select value={jdDept} onValueChange={setJdDept}>
                          <SelectTrigger className="mt-1.5 h-11 rounded-xl text-sm border-border/60 bg-white/50 dark:bg-slate-950/25"><SelectValue /></SelectTrigger>
                          <SelectContent className="rounded-xl">
                            <SelectItem value="Engineering" className="text-sm font-semibold">Engineering</SelectItem>
                            <SelectItem value="Product Management" className="text-sm font-semibold">Product</SelectItem>
                            <SelectItem value="Sales & Growth" className="text-sm font-semibold">Sales & Growth</SelectItem>
                            <SelectItem value="Human Resources" className="text-sm font-semibold">HR Dept</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div>
                      <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Key Competencies & Perks</Label>
                      <Textarea 
                        placeholder="e.g. React 19, TypeScript, next.js. Hybrid workspace, yearly learning budget." 
                        value={jdSkills} 
                        onChange={e => setJdSkills(e.target.value)} 
                        rows={5} 
                        className="mt-1.5 rounded-xl text-sm border-border/60 bg-white/50 dark:bg-slate-950/25 font-medium leading-relaxed resize-none"
                      />
                    </div>
                    <Button onClick={generateJobDescription} disabled={loading} className="w-full h-11 rounded-xl text-sm font-bold gradient-primary text-white flex gap-2 shadow-md">
                      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Briefcase className="h-4 w-4" />}
                      Generate Job Description
                    </Button>
                  </div>
                )}

                {/* 6. EMAILS */}
                {activeTab === 'marketing' && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Copy Channel</Label>
                        <Select value={marketingChannel} onValueChange={setMarketingChannel}>
                          <SelectTrigger className="mt-1.5 h-11 rounded-xl text-sm border-border/60 bg-white/50 dark:bg-slate-950/25"><SelectValue /></SelectTrigger>
                          <SelectContent className="rounded-xl">
                            <SelectItem value="email" className="text-sm font-semibold">Outreach Email</SelectItem>
                            <SelectItem value="newsletter" className="text-sm font-semibold">Newsletter</SelectItem>
                            <SelectItem value="linkedin" className="text-sm font-semibold">LinkedIn Post</SelectItem>
                            <SelectItem value="twitter" className="text-sm font-semibold">Social Thread</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Tone of Voice</Label>
                        <Select value={marketingTone} onValueChange={setMarketingTone}>
                          <SelectTrigger className="mt-1.5 h-11 rounded-xl text-sm border-border/60 bg-white/50 dark:bg-slate-950/25"><SelectValue /></SelectTrigger>
                          <SelectContent className="rounded-xl">
                            <SelectItem value="professional" className="text-sm font-semibold">Professional</SelectItem>
                            <SelectItem value="persuasive" className="text-sm font-semibold">Persuasive</SelectItem>
                            <SelectItem value="creative" className="text-sm font-semibold">Creative</SelectItem>
                            <SelectItem value="casual" className="text-sm font-semibold">Casual</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div>
                      <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Topic & Campaign details</Label>
                      <Textarea 
                        placeholder="Explain what campaign or services you are launching, or client news you want to share..." 
                        value={marketingContext} 
                        onChange={e => setMarketingContext(e.target.value)} 
                        rows={5} 
                        className="mt-1.5 rounded-xl text-sm border-border/60 bg-white/50 dark:bg-slate-950/25 font-medium leading-relaxed resize-none"
                      />
                    </div>
                    <Button onClick={generateMarketingCopy} disabled={loading} className="w-full h-11 rounded-xl text-sm font-bold gradient-primary text-white flex gap-2 shadow-md">
                      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
                      Generate Marketing Copy
                    </Button>
                  </div>
                )}

                {/* 7. CODE GENERATOR */}
                {activeTab === 'boilerplate' && (
                  <div className="space-y-4">
                    <div>
                      <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Code Format / Language</Label>
                      <Select value={codeLang} onValueChange={setCodeLang}>
                        <SelectTrigger className="mt-1.5 h-11 rounded-xl text-sm border-border/60 bg-white/50 dark:bg-slate-950/25"><SelectValue /></SelectTrigger>
                        <SelectContent className="rounded-xl">
                          <SelectItem value="sql" className="text-sm font-semibold">PostgreSQL Table / RLS</SelectItem>
                          <SelectItem value="typescript" className="text-sm font-semibold">TypeScript Hook</SelectItem>
                          <SelectItem value="python" className="text-sm font-semibold">Python Data Script</SelectItem>
                          <SelectItem value="json" className="text-sm font-semibold">API JSON Schema</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Parameters & Scope</Label>
                      <Textarea 
                        placeholder="e.g. Create a performance_reviews table with uuid, employee_id referencing profiles, and RLS policies for hr role." 
                        value={codeRequirements} 
                        onChange={e => setCodeRequirements(e.target.value)} 
                        rows={5} 
                        className="mt-1.5 rounded-xl text-sm border-border/60 bg-white/50 dark:bg-slate-950/25 font-medium leading-relaxed resize-none"
                      />
                    </div>
                    <Button onClick={generateBoilerplate} disabled={loading} className="w-full h-11 rounded-xl text-sm font-bold gradient-primary text-white flex gap-2 shadow-md">
                      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Code className="h-4 w-4" />}
                      Generate Code Template
                    </Button>
                  </div>
                )}

                {/* 8. SESSION HISTORICAL LOG */}
                {activeTab === 'history' && (
                  <div className="h-full flex flex-col min-h-0">
                    <ScrollArea className="flex-1 w-full min-h-0">
                      <div className="space-y-3.5 pr-2">
                        {history.map(item => (
                          <div 
                            key={item.id} 
                            className="p-4 bg-slate-50/50 dark:bg-slate-950/20 border border-border/40 hover:border-primary/45 rounded-xl hover:shadow-sm transition-all cursor-pointer group"
                            onClick={() => {
                              setResult(item.result);
                              toast.info(`Restored ${item.tool} output from cache!`);
                            }}
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold uppercase text-primary bg-primary/10 px-2.5 py-0.5 rounded-md">
                                {item.tool}
                              </span>
                              <span className="text-xs text-muted-foreground font-semibold flex items-center gap-1">
                                {format(item.timestamp, 'p')} <ArrowUpRight className="h-3.5 w-3.5 opacity-0 group-hover:opacity-100 transition-opacity text-primary" />
                              </span>
                            </div>
                            <p className="text-xs text-slate-500 mt-2 font-semibold truncate">
                              Prompt: {item.prompt}
                            </p>
                          </div>
                        ))}
                        {history.length === 0 && (
                          <div className="py-20 text-center text-muted-foreground flex flex-col items-center justify-center">
                            <RotateCcw className="h-10 w-10 mb-2 opacity-30 animate-spin-slow" />
                            <p className="text-sm font-medium">No history logs in this session yet</p>
                          </div>
                        )}
                      </div>
                    </ScrollArea>
                  </div>
                )}

              </div>
            </CardContent>
          </Card>

          {/* RIGHT CARDS: OUTPUT SANDBOX CONTAINER */}
          <Card className="glass-card flex flex-col h-full overflow-hidden border-border/60 bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl shadow-xl rounded-2xl">
            <CardHeader className="shrink-0 border-b border-border/50 pb-4 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-xl font-bold flex items-center gap-2 text-foreground">
                  <Bot className="h-5 w-5 text-primary" /> AI Output Sandbox
                </CardTitle>
                <CardDescription className="text-xs">Copy, edit or export your synthesized results</CardDescription>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {result && (
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={copyToClipboard}
                    className="rounded-xl text-xs font-bold border-border/60 hover:bg-slate-50 dark:hover:bg-slate-950/20 text-slate-700 dark:text-slate-355 flex items-center gap-1.5 h-9 px-3.5"
                  >
                    {copied ? <Check className="h-4 w-4 text-emerald-500 animate-pulse" /> : <Copy className="h-4 w-4" />}
                    {copied ? 'Copied' : 'Copy'}
                  </Button>
                )}
                {result && (
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => setResult('')}
                    className="rounded-xl text-xs font-bold hover:bg-rose-50 dark:hover:bg-rose-950/10 text-rose-500 flex items-center gap-1.5 h-9 px-3"
                  >
                    <Trash2 className="h-4 w-4" /> Clear
                  </Button>
                )}
              </div>
            </CardHeader>

            <CardContent className="p-0 flex-1 overflow-hidden relative flex flex-col min-h-0">
              
              {/* Central Premium Glass Loading Overlay */}
              {loading && (
                <div className="absolute inset-0 bg-white/80 dark:bg-slate-950/70 backdrop-blur-md z-20 flex flex-col items-center justify-center animate-fade-in">
                  <div className="relative flex flex-col items-center">
                    <div className="absolute w-24 h-24 bg-primary/20 rounded-full blur-2xl animate-pulse"></div>
                    <div className="p-4 bg-gradient-to-tr from-primary to-indigo-650 rounded-2xl shadow-lg text-white animate-bounce relative z-10">
                      <Bot className="h-9 w-9" />
                    </div>
                    <p className="mt-4 font-extrabold text-sm text-primary tracking-widest uppercase animate-pulse">
                      Synthesizing intelligence...
                    </p>
                  </div>
                </div>
              )}

              {/* Dynamic scrollable markdown result view */}
              <ScrollArea className="flex-1 w-full min-h-0">
                {result ? (
                  <div className="p-6 prose prose-indigo dark:prose-invert max-w-none text-slate-700 dark:text-slate-300 text-sm font-medium leading-relaxed">
                    <div className="space-y-4">
                      {result.split('\n').map((line, lineIdx) => {
                        if (line.startsWith('## ')) {
                          return <h2 key={lineIdx} className="text-lg font-black text-primary mt-6 border-b border-border/40 pb-2 uppercase tracking-wide">{line.slice(3)}</h2>;
                        }
                        if (line.startsWith('### ')) {
                          return <h3 key={lineIdx} className="text-base font-extrabold text-slate-800 dark:text-slate-200 mt-5">{line.slice(4)}</h3>;
                        }
                        if (line.startsWith('* ') || line.startsWith('- ')) {
                          return <div key={lineIdx} className="pl-4 py-1.5 flex items-start gap-2 text-slate-650 dark:text-slate-355"><span className="text-primary shrink-0">•</span> <span>{line.slice(2).replace(/\*\*(.*?)\*\*/g, '$1')}</span></div>;
                        }
                        if (line.startsWith('|')) {
                          return (
                            <div key={lineIdx} className="bg-slate-50/60 dark:bg-slate-950/40 px-4 py-2.5 border border-border/60 rounded-xl font-mono text-xs text-indigo-600 dark:text-indigo-400 overflow-x-auto whitespace-pre my-3">
                              {line}
                            </div>
                          );
                        }
                        if (line.trim() === '') {
                          return <div key={lineIdx} className="h-2.5"></div>;
                        }
                        return (
                          <p key={lineIdx} className="leading-relaxed">
                            {line.split('**').map((chunk, chunkIdx) => 
                              chunkIdx % 2 === 1 
                                ? <strong key={chunkIdx} className="text-primary font-bold">{chunk}</strong> 
                                : chunk
                            )}
                          </p>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-muted-foreground p-8 text-center min-h-[300px]">
                    <div className="relative mb-4 opacity-30">
                      <div className="absolute inset-0 bg-primary/10 rounded-full blur-xl animate-pulse"></div>
                      <Cpu className="h-16 w-16 text-primary" />
                    </div>
                    <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200 uppercase tracking-widest">Awaiting Synthesis</h4>
                    <p className="text-xs max-w-sm mt-1.5 leading-relaxed font-semibold">
                      Choose any dedicated AI template from the workspace tab, input parameters, and hit generate to construct executive-level reports here.
                    </p>
                  </div>
                )}
              </ScrollArea>

            </CardContent>
          </Card>
          
        </div>
        
      </div>
    </DashboardLayout>
  );
}
