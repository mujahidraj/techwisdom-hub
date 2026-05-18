import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Loader2, 
  Plus, 
  Calendar, 
  Star, 
  MoreVertical, 
  Search, 
  ArrowRight, 
  Briefcase, 
  DollarSign, 
  FileText, 
  Mail, 
  Phone, 
  ExternalLink,
  ChevronRight,
  UserCheck,
  Award
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';

const COLUMNS = [
  { id: 'applied', title: 'Applied', color: 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800/40 dark:text-slate-300 dark:border-slate-700/50' },
  { id: 'screening', title: 'Screening', color: 'bg-blue-50 text-blue-700 border-blue-150 dark:bg-blue-950/20 dark:text-blue-400 dark:border-blue-900/30' },
  { id: 'interview', title: 'Interview', color: 'bg-purple-50 text-purple-700 border-purple-150 dark:bg-purple-950/20 dark:text-purple-400 dark:border-purple-900/30' },
  { id: 'offer', title: 'Offer', color: 'bg-amber-50 text-amber-700 border-amber-150 dark:bg-amber-950/20 dark:text-amber-400 dark:border-amber-900/30' },
  { id: 'hired', title: 'Hired', color: 'bg-green-50 text-green-700 border-green-150 dark:bg-green-950/20 dark:text-green-400 dark:border-green-900/30' },
  { id: 'rejected', title: 'Rejected', color: 'bg-rose-50 text-rose-700 border-rose-150 dark:bg-rose-950/20 dark:text-rose-400 dark:border-rose-900/30' }
];

export default function ATSPipeline() {
  const qc = useQueryClient();
  const [selectedApp, setSelectedApp] = useState<any | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const { data: applications = [], isLoading } = useQuery({
    queryKey: ['ats-applications'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ats_applications')
        .select(`
          *,
          ats_candidates (*),
          cms_job_openings (title)
        `)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    }
  });

  const { data: jobs = [] } = useQuery({
    queryKey: ['cms_job_openings'],
    queryFn: async () => {
      const { data } = await supabase.from('cms_job_openings').select('id, title').eq('is_active', true);
      return data || [];
    }
  });

  const { data: candidates = [] } = useQuery({
    queryKey: ['ats-candidates'],
    queryFn: async () => {
      const { data } = await supabase.from('ats_candidates').select('*').order('created_at', { ascending: false });
      return data || [];
    }
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string, status: string }) => {
      const { error } = await supabase.from('ats_applications').update({ status: status as any }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ats-applications'] });
      toast.success('Applicant stage advanced successfully');
    },
    onError: (e: any) => toast.error(e.message)
  });

  const updateAppMutation = useMutation({
    mutationFn: async (payload: any) => {
      const { id, ...data } = payload;
      const { error } = await supabase.from('ats_applications').update(data).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ats-applications'] });
      toast.success('Application updated');
      setDialogOpen(false);
    }
  });

  const createFormMutation = useMutation({
    mutationFn: async (payload: any) => {
      const { error } = await supabase.from('ats_applications').insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ats-applications'] });
      toast.success('Application added');
      setDialogOpen(false);
    },
    onError: (e: any) => toast.error(e.message)
  });

  // Dynamic candidate aggregation metrics
  const stageCounts = useMemo(() => {
    const counts: Record<string, number> = { all: applications.length };
    COLUMNS.forEach(col => counts[col.id] = 0);
    applications.forEach(app => {
      if (counts[app.status] !== undefined) counts[app.status]++;
    });
    return counts;
  }, [applications]);

  // Real-time search query + tab filter logic
  const filteredApplications = useMemo(() => {
    return applications.filter(app => {
      const name = `${app.ats_candidates?.first_name || ''} ${app.ats_candidates?.last_name || ''}`.toLowerCase();
      const jobTitle = (app.cms_job_openings?.title || '').toLowerCase();
      const search = searchQuery.toLowerCase();
      
      const matchesSearch = name.includes(search) || jobTitle.includes(search);
      const matchesTab = activeTab === 'all' || app.status === activeTab;
      
      return matchesSearch && matchesTab;
    });
  }, [applications, searchQuery, activeTab]);

  const openAppDetails = (app: any) => { setSelectedApp(app); setDialogOpen(true); };
  const openNewApp = () => { setSelectedApp({ isNew: true, status: 'applied', rating: 0 }); setDialogOpen(true); };

  // Helper: return next stage ID in line
  const getNextStage = (currentStatus: string) => {
    const idx = COLUMNS.findIndex(c => c.id === currentStatus);
    if (idx !== -1 && idx < COLUMNS.length - 2) {
      return COLUMNS[idx + 1].id; // Advance to next, skipping rejected
    }
    return null;
  };

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
          <div className="relative">
            <div className="h-12 w-12 rounded-full border-4 border-indigo-100 border-t-indigo-600 animate-spin"></div>
            <Award className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 h-5 w-5 text-indigo-600 animate-pulse" />
          </div>
          <p className="text-sm font-semibold text-slate-500">Assembling recruitment engine...</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in pb-12 w-full max-w-full overflow-hidden">
        {/* Top Header Row */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white/40 dark:bg-slate-900/40 p-6 rounded-3xl border border-slate-200/50 dark:border-slate-800/50 backdrop-blur-md">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400">
                <Briefcase className="h-5 w-5" />
              </span>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-800 dark:text-slate-100">Recruitment Pipeline</h1>
            </div>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 font-medium">
              Track applicant statuses, evaluate candidate ratings, and advance hiring stages.
            </p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <Button className="gradient-primary text-xs font-bold uppercase tracking-wider py-5 px-5 rounded-xl shadow-md shadow-indigo-500/10 hover:shadow-indigo-500/20 transition-all" onClick={openNewApp}>
              <Plus className="h-4 w-4 mr-2" />
              Add Application
            </Button>
          </div>
        </div>

        {/* Dynamic Horizontal Stage Navigation Tab Pill Bar (No Scrollbar, Always Fits Width) */}
        <div className="bg-white/50 dark:bg-slate-900/40 p-1.5 rounded-2xl border border-slate-200/60 dark:border-slate-800/40 flex flex-wrap gap-1 md:gap-1.5 items-center w-full">
          <Button
            variant="ghost"
            onClick={() => setActiveTab('all')}
            className={`rounded-xl text-xs font-bold px-4 py-2 transition-all shrink-0 ${
              activeTab === 'all'
                ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-sm'
                : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/40'
            }`}
          >
            All Candidates
            <Badge className={`ml-2 font-black text-[10px] rounded-lg border-0 ${
              activeTab === 'all' 
                ? 'bg-white/20 text-white dark:bg-slate-900/10 dark:text-slate-900' 
                : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
            }`}>
              {stageCounts.all}
            </Badge>
          </Button>

          {COLUMNS.map(col => {
            const isActive = activeTab === col.id;
            return (
              <Button
                key={col.id}
                variant="ghost"
                onClick={() => setActiveTab(col.id)}
                className={`rounded-xl text-xs font-bold px-4 py-2 transition-all capitalize shrink-0 ${
                  isActive
                    ? 'bg-indigo-600 text-white dark:bg-indigo-500 dark:text-white shadow-sm'
                    : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/40'
                }`}
              >
                {col.title}
                <Badge className={`ml-2 font-black text-[10px] rounded-lg border-0 ${
                  isActive 
                    ? 'bg-white/20 text-white' 
                    : 'bg-slate-100 text-slate-650 dark:bg-slate-800 dark:text-slate-300'
                }`}>
                  {stageCounts[col.id]}
                </Badge>
              </Button>
            );
          })}
        </div>

        {/* Real-time Search input */}
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            <Search className="h-4 w-4 text-slate-400" />
          </div>
          <input
            type="text"
            placeholder="Search candidate by name or job title..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full text-xs font-semibold pl-11 pr-4 py-3 bg-white/60 dark:bg-slate-900/40 backdrop-blur-md rounded-2xl border border-slate-200/60 dark:border-slate-800/40 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-slate-800 dark:text-slate-100 placeholder-slate-400"
          />
        </div>

        {/* Responsive Grid List of Applicants (Guarantees zero bottom scrollbars!) */}
        <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 w-full">
          {filteredApplications.map((app) => {
            const nextStage = getNextStage(app.status);
            const columnInfo = COLUMNS.find(c => c.id === app.status);
            return (
              <Card key={app.id} className="relative overflow-hidden bg-white/60 dark:bg-slate-900/40 backdrop-blur-xl border border-slate-200/60 dark:border-slate-800/40 shadow-sm rounded-2xl hover:shadow-md hover:scale-[1.01] transition-all duration-300 group flex flex-col justify-between">
                <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 to-transparent dark:from-indigo-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"></div>
                
                <CardContent className="p-5 space-y-4 flex-1 flex flex-col justify-between">
                  {/* Top line candidate branding */}
                  <div className="space-y-3">
                    <div className="flex justify-between items-start gap-2">
                      <div className="space-y-0.5">
                        <h4 className="font-extrabold text-sm text-slate-800 dark:text-slate-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                          {app.ats_candidates?.first_name} {app.ats_candidates?.last_name}
                        </h4>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider flex items-center gap-1">
                          <Calendar className="h-3 w-3 text-slate-400" />
                          Applied {new Date(app.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </p>
                      </div>
                      
                      {/* Rating visual */}
                      {app.rating > 0 && (
                        <Badge className="bg-amber-50 text-amber-600 border border-amber-100 flex items-center gap-0.5 font-bold px-1.5 py-0 rounded-lg text-[10px] shadow-none">
                          <Star className="h-3 w-3 fill-current" />
                          {app.rating}
                        </Badge>
                      )}
                    </div>

                    {/* Applied Position Badge */}
                    <div className="flex flex-wrap gap-1.5">
                      <Badge className="bg-indigo-50/50 text-indigo-600 dark:bg-indigo-950/20 dark:text-indigo-400 border border-indigo-100/50 font-bold px-2 py-0.5 rounded-lg text-[10px] max-w-full truncate shadow-none">
                        {app.cms_job_openings?.title || 'General Position'}
                      </Badge>
                      {columnInfo && (
                        <Badge className={`capitalize border font-bold px-2 py-0.5 rounded-lg text-[10px] shadow-none ${columnInfo.color}`}>
                          {columnInfo.title}
                        </Badge>
                      )}
                    </div>

                    {/* Contact Links */}
                    <div className="space-y-1 text-[11px] text-slate-400 border-t border-slate-100 dark:border-slate-800/20 pt-3">
                      <div className="flex items-center gap-1.5">
                        <Mail className="h-3 w-3 text-slate-400 shrink-0" />
                        <span className="truncate">{app.ats_candidates?.email || 'N/A'}</span>
                      </div>
                      {app.ats_candidates?.phone && (
                        <div className="flex items-center gap-1.5">
                          <Phone className="h-3 w-3 text-slate-400 shrink-0" />
                          <span>{app.ats_candidates.phone}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Footer metadata details & actions */}
                  <div className="pt-3 border-t border-slate-100 dark:border-slate-800/20 space-y-3">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Salary Expected:</span>
                      <span className="font-extrabold text-slate-850 dark:text-slate-200">{app.expected_salary || 'Confidential'}</span>
                    </div>

                    <div className="flex items-center justify-between gap-2 pt-1.5">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openAppDetails(app)}
                        className="rounded-xl text-[10px] font-bold uppercase tracking-wider px-3 h-8 border-slate-200 dark:border-slate-800 w-full"
                      >
                        Details
                      </Button>

                      {/* Immediate Stage steppers instead of drag-and-drop kanban! */}
                      {nextStage ? (
                        <Button
                          size="sm"
                          onClick={() => updateStatus.mutate({ id: app.id, status: nextStage })}
                          className="rounded-xl text-[10px] font-bold uppercase tracking-wider px-3 h-8 bg-indigo-50 text-indigo-650 hover:bg-indigo-100 dark:bg-indigo-950/40 dark:text-indigo-400 border border-indigo-100 w-full flex items-center justify-center gap-1"
                        >
                          Advance
                          <ArrowRight className="h-3 w-3" />
                        </Button>
                      ) : app.status !== 'rejected' && app.status !== 'hired' ? (
                        <Button
                          size="sm"
                          onClick={() => updateStatus.mutate({ id: app.id, status: 'rejected' })}
                          className="rounded-xl text-[10px] font-bold uppercase tracking-wider px-3 h-8 bg-rose-50 text-rose-650 hover:bg-rose-100 dark:bg-rose-950/20 dark:text-rose-400 border border-rose-100 w-full"
                        >
                          Reject Applicant
                        </Button>
                      ) : (
                        <Badge className="bg-slate-100 text-slate-500 border border-slate-200 font-bold text-[9px] uppercase tracking-wider py-1.5 rounded-xl w-full text-center block shadow-none">
                          Pipeline Final
                        </Badge>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}

          {filteredApplications.length === 0 && (
            <Card className="bg-white/40 dark:bg-slate-900/40 border border-slate-200/60 dark:border-slate-800/40 col-span-full rounded-2xl">
              <CardContent className="py-16 text-center space-y-3">
                <Briefcase className="h-12 w-12 mx-auto text-slate-400" />
                <p className="text-sm font-semibold text-slate-500">No applicants found in this pipeline category.</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Application Details Dialog Modal */}
      <Dialog open={dialogOpen} onOpenChange={o => !o && setDialogOpen(false)}>
        <DialogContent className="sm:max-w-[550px] p-0 overflow-hidden bg-white/95 dark:bg-slate-900/95 backdrop-blur-2xl border border-slate-200/60 dark:border-slate-800/40 rounded-2xl shadow-2xl">
          <DialogHeader className="p-6 pb-0 relative">
            <div className="absolute top-0 left-0 w-24 h-24 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none"></div>
            
            <div className="flex items-center gap-2">
              <div className="p-2 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-500 rounded-xl">
                <UserCheck className="h-5 w-5" />
              </div>
              <DialogTitle className="text-lg font-bold text-slate-800 dark:text-slate-100">
                {selectedApp?.isNew ? 'New Applicant Record' : 'Application Overview Details'}
              </DialogTitle>
            </div>
            <DialogDescription className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-1 pl-1">
              Add or update candidates profiles in the workspace.
            </DialogDescription>
          </DialogHeader>

          {selectedApp && (
            <div className="p-6 space-y-5 max-h-[65vh] overflow-y-auto custom-scrollbar">
              {selectedApp.isNew ? (
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-slate-500 dark:text-slate-400">Candidate Profile</Label>
                    <Select value={selectedApp.candidate_id || ''} onValueChange={v => setSelectedApp({ ...selectedApp, candidate_id: v })}>
                      <SelectTrigger className="h-11 rounded-xl border-slate-250 dark:border-slate-800 focus:ring-2 focus:ring-indigo-500/15">
                        <SelectValue placeholder="Select candidate profile" />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl">
                        {candidates.map((c: any) => (
                          <SelectItem key={c.id} value={c.id} className="text-xs font-semibold">
                            {c.first_name} {c.last_name} ({c.email})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-slate-500 dark:text-slate-400">Applied Job Opening</Label>
                    <Select value={selectedApp.job_id || ''} onValueChange={v => setSelectedApp({ ...selectedApp, job_id: v })}>
                      <SelectTrigger className="h-11 rounded-xl border-slate-250 dark:border-slate-800 focus:ring-2 focus:ring-indigo-500/15">
                        <SelectValue placeholder="Select target job" />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl">
                        {jobs.map((j: any) => (
                          <SelectItem key={j.id} value={j.id} className="text-xs font-semibold">
                            {j.title}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              ) : (
                <div className="bg-slate-50/50 dark:bg-slate-950/20 p-4 rounded-xl border border-slate-150 dark:border-slate-800/40 flex flex-col sm:flex-row justify-between gap-4 items-start">
                  <div className="space-y-1">
                    <h3 className="font-extrabold text-base text-slate-800 dark:text-slate-200">
                      {selectedApp.ats_candidates?.first_name} {selectedApp.ats_candidates?.last_name}
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold">
                      {selectedApp.ats_candidates?.email} • {selectedApp.ats_candidates?.phone}
                    </p>
                    <div className="flex gap-3 pt-2">
                      {selectedApp.ats_candidates?.resume_url && (
                        <a 
                          href={selectedApp.ats_candidates.resume_url} 
                          target="_blank" 
                          rel="noreferrer" 
                          className="text-xs font-extrabold text-indigo-650 dark:text-indigo-400 hover:underline flex items-center gap-1"
                        >
                          View Resume
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                      {selectedApp.ats_candidates?.linkedin_url && (
                        <a 
                          href={selectedApp.ats_candidates.linkedin_url} 
                          target="_blank" 
                          rel="noreferrer" 
                          className="text-xs font-extrabold text-indigo-655 dark:text-indigo-400 hover:underline flex items-center gap-1"
                        >
                          LinkedIn
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                    </div>
                  </div>
                  
                  <Badge className="bg-indigo-50 text-indigo-650 border border-indigo-100 font-bold text-xs rounded-lg px-2.5 py-0.5 shadow-none shrink-0">
                    {selectedApp.cms_job_openings?.title || 'General'}
                  </Badge>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-slate-500 dark:text-slate-400">Current Pipeline Stage</Label>
                  <Select value={selectedApp.status} onValueChange={v => setSelectedApp({ ...selectedApp, status: v })}>
                    <SelectTrigger className="h-11 rounded-xl border-slate-250 dark:border-slate-800 focus:ring-2 focus:ring-indigo-500/15">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      {COLUMNS.map(c => (
                        <SelectItem key={c.id} value={c.id} className="text-xs font-semibold">
                          {c.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-slate-500 dark:text-slate-400">Candidate Evaluation Rating (1-5)</Label>
                  <Input 
                    type="number" 
                    min="0" 
                    max="5" 
                    value={selectedApp.rating || 0} 
                    onChange={e => setSelectedApp({ ...selectedApp, rating: parseInt(e.target.value) })} 
                    className="h-11 rounded-xl border-slate-250 dark:border-slate-800 focus:ring-2 focus:ring-indigo-500/15 text-xs font-semibold"
                  />
                </div>
              </div>
              
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1">
                  <DollarSign className="h-3 w-3 text-slate-400" />
                  Expected Salary Compensation
                </Label>
                <Input 
                  value={selectedApp.expected_salary || ''} 
                  onChange={e => setSelectedApp({ ...selectedApp, expected_salary: e.target.value })} 
                  placeholder="e.g. $80k - $100k or ৳80,000/mo" 
                  className="h-11 rounded-xl border-slate-250 dark:border-slate-800 focus:ring-2 focus:ring-indigo-500/15 text-xs font-semibold"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1">
                  <FileText className="h-3 w-3 text-slate-400" />
                  Internal Evaluation Notes & Feedback
                </Label>
                <Textarea 
                  value={selectedApp.internal_notes || ''} 
                  onChange={e => setSelectedApp({ ...selectedApp, internal_notes: e.target.value })} 
                  rows={3} 
                  placeholder="Applicant feedback, internal discussions, interview highlights..." 
                  className="rounded-xl border-slate-250 dark:border-slate-800 focus:ring-2 focus:ring-indigo-500/15 text-xs font-semibold resize-none"
                />
              </div>

              {/* Modal Actions */}
              <DialogFooter className="pt-2 flex flex-col-reverse sm:flex-row gap-2 sm:gap-0 border-t border-slate-100 dark:border-slate-800/30">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setDialogOpen(false)}
                  className="rounded-xl text-xs font-bold px-5 h-11 border-slate-200 dark:border-slate-800"
                >
                  Cancel
                </Button>
                <Button 
                  type="button"
                  className="rounded-xl text-xs font-bold px-5 h-11 gradient-primary shadow-sm"
                  onClick={() => selectedApp.isNew ? createFormMutation.mutate({
                    candidate_id: selectedApp.candidate_id,
                    job_id: selectedApp.job_id,
                    status: selectedApp.status,
                    rating: selectedApp.rating || null,
                    expected_salary: selectedApp.expected_salary,
                    internal_notes: selectedApp.internal_notes
                  }) : updateAppMutation.mutate({
                    id: selectedApp.id,
                    status: selectedApp.status,
                    rating: selectedApp.rating || null,
                    expected_salary: selectedApp.expected_salary,
                    internal_notes: selectedApp.internal_notes
                  })} 
                  disabled={createFormMutation.isPending || updateAppMutation.isPending}
                >
                  {createFormMutation.isPending || updateAppMutation.isPending ? 'Saving...' : 'Save Application'}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
