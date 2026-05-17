import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Bot, FileText, CheckSquare, Sparkles, Wand2, CalendarClock } from 'lucide-react';
import { toast } from 'sonner';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';

export default function AIHub() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState('');
  
  // Proposal Writer State
  const [selectedLead, setSelectedLead] = useState('');
  const [proposalNotes, setProposalNotes] = useState('');

  // Meeting Summary State
  const [meetingTranscript, setMeetingTranscript] = useState('');

  // Project Estimator State
  const [projectReqs, setProjectReqs] = useState('');

  const { data: leads = [] } = useQuery({
    queryKey: ['crm-leads-ai'],
    queryFn: async () => {
      const { data } = await supabase.from('leads').select('*').order('created_at', { ascending: false });
      return data || [];
    }
  });

  const callGroq = async (prompt: string) => {
    const apiKey = import.meta.env.VITE_GROQ_API_KEY;
    if (!apiKey) {
      toast.error('VITE_GROQ_API_KEY is missing in your .env file!');
      return;
    }

    setLoading(true);
    setResult('');
    
    try {
      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: 'llama3-70b-8192',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.7
        })
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error?.message || 'Failed to generate response from AI');
      }
      
      const data = await res.json();
      setResult(data.choices?.[0]?.message?.content || 'No response generated.');
      toast.success('AI generation complete!');
    } catch (e: any) {
      toast.error(e.message || 'AI request failed');
    } finally {
      setLoading(false);
    }
  };

  const generateProposal = () => {
    const lead = leads.find((l: any) => l.id === selectedLead);
    if (!lead) return toast.error('Please select a lead first');
    
    const prompt = `You are an expert sales executive for TechWisdom Technologies, a premium software agency.
Write a professional, persuasive project proposal for the following lead. Use markdown formatting.

Lead Name: ${lead.contact_person || 'Unknown'}
Company: ${lead.business_name || 'N/A'}
Service/Category: ${lead.category || 'General'}
Requirements/Notes: ${lead.description || lead.notes || 'N/A'}

Additional context from our team: ${proposalNotes}

Structure the proposal with:
1. Executive Summary
2. Proposed Solution & Approach
3. Expected Timeline & Phases
4. Investment (Budget breakdown based on their budget)
5. Next Steps`;

    callGroq(prompt);
  };

  const generateMeetingSummary = () => {
    if (!meetingTranscript.trim()) return toast.error('Please enter meeting notes');
    
    const prompt = `You are an expert AI meeting assistant. Analyze the following meeting notes/transcript and provide a structured summary.
Use markdown formatting.

Structure the output as follows:
## 📝 Meeting Summary
(A concise 2-3 paragraph summary of what was discussed and the main outcomes)

## 🎯 Key Decisions
(Bullet points of important decisions made)

## ✅ Action Items
(A checklist of action items, assigning them to individuals if mentioned, and deadlines if mentioned)

Meeting Notes:
${meetingTranscript}`;

    callGroq(prompt);
  };

  const estimateProject = () => {
    if (!projectReqs.trim()) return toast.error('Please enter project requirements');
    
    const prompt = `You are a Senior Technical Project Manager. I will give you a set of project requirements. 
Please provide a realistic software development timeline estimation. Use markdown formatting.

Structure the output as follows:
## 🏗️ Project Timeline Estimation

### 📅 High-Level Phases
(Break down the project into standard phases like Discovery, UI/UX Design, Development, Testing, Deployment with time estimates for each)

### 🏃 Sprint Breakdown
(Assuming 2-week sprints, list what would theoretically be accomplished in each sprint)

### ⚠️ Potential Risks & Blockers
(Identify 2-3 potential risks based on these requirements)

Requirements:
${projectReqs}`;

    callGroq(prompt);
  };

  const scoreLeads = async () => {
    if (!leads.length) return toast.error('No leads found in CRM');
    
    const leadsData = leads.map((l: any) => ({
      contact_person: l.contact_person || 'Unknown',
      company: l.business_name,
      category: l.category,
      status: l.status,
      notes: l.description || l.notes
    }));

    const prompt = `You are an AI Sales Director. Analyze the following list of CRM leads and assign a "Lead Score" from 1 to 100 for each lead based on their status, category, and requirements/notes. 

Return ONLY a Markdown table with the following columns:
| Contact Person | Company | Category | Score (1-100) | AI Reason (1 short sentence) |

Leads JSON Data:
${JSON.stringify(leadsData, null, 2)}`;

    callGroq(prompt);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Sparkles className="h-8 w-8 text-primary" /> AI Assistant Hub
          </h1>
          <p className="text-muted-foreground mt-1">Leverage advanced AI to accelerate your agency's workflows.</p>
        </div>

        {!import.meta.env.VITE_GROQ_API_KEY && (
          <div className="bg-destructive/15 text-destructive p-4 rounded-lg border border-destructive/30 flex items-center gap-3">
            <Wand2 className="h-5 w-5" />
            <div>
              <p className="font-semibold">Groq API Key Missing</p>
              <p className="text-sm">Please add <code>VITE_GROQ_API_KEY=your_key_here</code> to your <code>.env</code> file to enable AI features.</p>
            </div>
          </div>
        )}

        <div className="grid lg:grid-cols-2 gap-6">
          <Card className="glass-card flex flex-col h-[70vh]">
            <CardHeader className="shrink-0 border-b border-border/50 pb-4">
              <CardTitle>AI Tools</CardTitle>
              <CardDescription>Select a tool to generate content</CardDescription>
            </CardHeader>
            <CardContent className="p-0 flex-1 overflow-hidden">
              <Tabs defaultValue="proposal" className="h-full flex flex-col">
                <TabsList className="w-full justify-start rounded-none border-b bg-transparent p-0">
                  <TabsTrigger value="proposal" className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none py-3"><FileText className="h-4 w-4 mr-2" /> Proposal Writer</TabsTrigger>
                  <TabsTrigger value="meeting" className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none py-3"><CheckSquare className="h-4 w-4 mr-2" /> Meeting Summary</TabsTrigger>
                  <TabsTrigger value="estimator" className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none py-3"><CalendarClock className="h-4 w-4 mr-2" /> Project Estimator</TabsTrigger>
                </TabsList>
                
                <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                  <TabsContent value="proposal" className="m-0 space-y-4">
                    <div>
                      <Label>Select CRM Lead</Label>
                      <Select value={selectedLead} onValueChange={setSelectedLead}>
                        <SelectTrigger className="mt-1"><SelectValue placeholder="Choose a lead..." /></SelectTrigger>
                        <SelectContent>
                          {leads.map((l: any) => <SelectItem key={l.id} value={l.id}>{l.business_name} ({l.contact_person || 'No Contact'}) - {l.category || 'General'}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Additional Context / Custom Offers</Label>
                      <Textarea 
                        placeholder="e.g. Offer them a 10% discount if they sign this week. Highlight our expertise in React." 
                        value={proposalNotes} onChange={e => setProposalNotes(e.target.value)} rows={5} className="mt-1"
                      />
                    </div>
                    <Button onClick={generateProposal} disabled={loading} className="w-full gradient-primary">
                      {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Wand2 className="h-4 w-4 mr-2" />}
                      Generate Proposal
                    </Button>
                  </TabsContent>

                  <TabsContent value="meeting" className="m-0 space-y-4">
                    <div>
                      <Label>Meeting Transcript or Rough Notes</Label>
                      <Textarea 
                        placeholder="Paste your raw, messy meeting notes here..." 
                        value={meetingTranscript} onChange={e => setMeetingTranscript(e.target.value)} rows={10} className="mt-1"
                      />
                    </div>
                    <Button onClick={generateMeetingSummary} disabled={loading} className="w-full gradient-primary">
                      {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CheckSquare className="h-4 w-4 mr-2" />}
                      Extract Summary & Action Items
                    </Button>
                  </TabsContent>

                  <TabsContent value="estimator" className="m-0 space-y-4">
                    <div>
                      <Label>Project Requirements / Scope</Label>
                      <Textarea 
                        placeholder="Describe the app or website to be built..." 
                        value={projectReqs} onChange={e => setProjectReqs(e.target.value)} rows={10} className="mt-1"
                      />
                    </div>
                    <Button onClick={estimateProject} disabled={loading} className="w-full gradient-primary">
                      {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CalendarClock className="h-4 w-4 mr-2" />}
                      Estimate Timeline
                    </Button>
                  </TabsContent>
                </div>
              </Tabs>
            </CardContent>
          </Card>

          <Card className="glass-card flex flex-col h-[70vh]">
            <CardHeader className="shrink-0 border-b border-border/50 pb-4 flex flex-col md:flex-row items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2"><Bot className="h-5 w-5 text-primary" /> AI Output</CardTitle>
                <CardDescription>Generated results will appear here</CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={scoreLeads} disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2 text-amber-500" />}
                Auto-Score All CRM Leads
              </Button>
            </CardHeader>
            <CardContent className="p-0 flex-1 overflow-hidden relative">
              {loading && (
                <div className="absolute inset-0 bg-background/50 backdrop-blur-sm z-10 flex flex-col items-center justify-center">
                  <div className="relative">
                    <div className="absolute inset-0 blur-xl bg-primary/30 rounded-full animate-pulse"></div>
                    <Bot className="h-12 w-12 text-primary animate-bounce relative z-10" />
                  </div>
                  <p className="mt-4 font-medium text-primary animate-pulse">AI is thinking...</p>
                </div>
              )}
              <ScrollArea className="h-full w-full">
                {result ? (
                  <div className="p-6 prose prose-slate dark:prose-invert max-w-none text-sm leading-relaxed" dangerouslySetInnerHTML={{ 
                    __html: result.replace(/\n/g, '<br/>').replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/## (.*?)\<br\/\>/g, '<h2>$1</h2>').replace(/### (.*?)\<br\/\>/g, '<h3>$1</h3>').replace(/\|/g, ' | ') 
                  }} />
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-muted-foreground p-8 text-center">
                    <Sparkles className="h-16 w-16 mb-4 opacity-20" />
                    <p>Select a tool from the left and click generate to see the AI output here.</p>
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
