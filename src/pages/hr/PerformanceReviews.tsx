import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Award, Plus, Calendar as CalendarIcon, Star, Target, User, Trash2, Edit, CheckCircle2, AlertTriangle, Sparkles } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

export default function PerformanceReviews() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  
  // Dialog Open States
  const [addOpen, setAddOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [selectedReview, setSelectedReview] = useState<any | null>(null);
  
  // Create Form State
  const [title, setTitle] = useState('');
  const [employeeId, setEmployeeId] = useState('');
  const [reviewCycle, setReviewCycle] = useState('Q3 2026');

  // Fetch employees for dropdown
  const { data: teamMembers = [] } = useQuery({
    queryKey: ['team_profiles'],
    queryFn: async () => {
      const { data, error } = await supabase.from('profiles').select('user_id, full_name');
      if (error) throw error;
      return data || [];
    }
  });

  // Fetch Reviews
  const { data: reviews = [], isLoading } = useQuery({
    queryKey: ['performance_reviews'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('performance_reviews' as any)
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      if (!data || data.length === 0) return [];

      // Map names manually if needed
      const rawData = data as any[];
      const ids = [...new Set(rawData.map(r => r.employee_id).concat(rawData.map(r => r.reviewer_id)))];
      const { data: profiles } = await supabase.from('profiles').select('user_id, full_name').in('user_id', ids);
      const profileMap = new Map(profiles?.map(p => [p.user_id, p.full_name]) || []);

      return rawData.map((r: any) => ({
        ...r,
        employee_name: profileMap.get(r.employee_id) || 'Unknown Employee',
        reviewer_name: profileMap.get(r.reviewer_id) || 'Unknown Reviewer',
      }));
    }
  });

  // Create Mutation
  const createMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error("Not authenticated");
      const { error } = await supabase.from('performance_reviews' as any).insert({
        title,
        employee_id: employeeId,
        reviewer_id: user.id,
        review_cycle: reviewCycle,
        status: 'draft',
        overall_score: 0,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['performance_reviews'] });
      toast.success('Performance review drafted successfully');
      setAddOpen(false);
      setTitle('');
      setEmployeeId('');
    },
    onError: (error: any) => toast.error('Error creating review: ' + error.message)
  });

  // Update Mutation
  const updateMutation = useMutation({
    mutationFn: async (payload: any) => {
      const { id, employee_name, reviewer_name, ...data } = payload;
      const { error } = await supabase.from('performance_reviews' as any).update(data).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['performance_reviews'] });
      toast.success('Performance review updated successfully');
      setEditOpen(false);
      setSelectedReview(null);
    },
    onError: (error: any) => toast.error('Error updating review: ' + error.message)
  });

  // Delete Mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('performance_reviews' as any).delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['performance_reviews'] });
      toast.success('Performance review deleted successfully');
      setEditOpen(false);
      setSelectedReview(null);
    },
    onError: (error: any) => toast.error('Error deleting review: ' + error.message)
  });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !employeeId) {
      toast.error('Please fill in all fields');
      return;
    }
    createMutation.mutate();
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-emerald-50 text-emerald-650 border border-emerald-100 dark:bg-emerald-950/20 dark:text-emerald-450';
      case 'in_progress': return 'bg-amber-50 text-amber-650 border border-amber-100 dark:bg-amber-950/20 dark:text-amber-450';
      default: return 'bg-slate-50 text-slate-650 border border-slate-200 dark:bg-slate-800/40 dark:text-slate-305';
    }
  };

  const handleCardClick = (review: any) => {
    setSelectedReview({ ...review });
    setEditOpen(true);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in pb-12 w-full max-w-full overflow-hidden">
        {/* Header Block */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white/40 dark:bg-slate-900/40 p-6 rounded-3xl border border-slate-200/50 dark:border-slate-800/50 backdrop-blur-md">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400">
                <Award className="h-5 w-5" />
              </span>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-800 dark:text-slate-100">Performance Reviews Center</h1>
            </div>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 font-medium">
              Draft goals, assign scores, record appraisals, and manage performance cycles for employees.
            </p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <Button className="gradient-primary text-xs font-bold uppercase tracking-wider py-5 px-5 rounded-xl shadow-md shadow-indigo-500/10 hover:shadow-indigo-500/20 transition-all" onClick={() => setAddOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              New Appraisal Draft
            </Button>
          </div>
        </div>

        {/* Reviews Grid */}
        {isLoading ? (
          <div className="flex flex-col items-center justify-center min-h-[300px] space-y-4">
            <div className="h-10 w-10 rounded-full border-4 border-indigo-100 border-t-indigo-600 animate-spin"></div>
            <p className="text-xs font-semibold text-slate-400">Fetching appraisal cycles...</p>
          </div>
        ) : (
          <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 w-full">
            {reviews.map((review: any) => (
              <Card 
                key={review.id} 
                className="relative overflow-hidden bg-white/60 dark:bg-slate-900/40 backdrop-blur-xl border border-slate-200/60 dark:border-slate-800/40 shadow-sm rounded-2xl hover:shadow-md hover:scale-[1.01] transition-all duration-300 group cursor-pointer flex flex-col justify-between"
                onClick={() => handleCardClick(review)}
              >
                <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 to-transparent dark:from-indigo-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"></div>
                
                <CardContent className="p-5 space-y-4">
                  {/* Top indicators */}
                  <div className="flex justify-between items-start gap-2">
                    <Badge className={`font-bold px-2 py-0.5 rounded-lg text-[10px] shadow-none ${getStatusColor(review.status)}`}>
                      {review.status.replace('_', ' ')}
                    </Badge>
                    <Badge className="bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 font-bold px-2 py-0.5 rounded-lg text-[10px] shadow-none border border-slate-200/50 dark:border-slate-700/50">
                      {review.review_cycle}
                    </Badge>
                  </div>

                  {/* Title and Employee */}
                  <div className="space-y-1">
                    <h3 className="font-extrabold text-base text-slate-800 dark:text-slate-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                      {review.title}
                    </h3>
                    <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 font-semibold">
                      <Target className="h-3.5 w-3.5 text-indigo-500" />
                      Employee: {review.employee_name}
                    </div>
                  </div>

                  {/* Evaluation Details */}
                  <div className="space-y-2 border-t border-slate-100 dark:border-slate-800/20 pt-3 text-[11px] text-slate-400">
                    <div className="flex items-center gap-2">
                      <User className="h-3.5 w-3.5" />
                      <span>Reviewer: <span className="font-bold text-slate-650 dark:text-slate-300">{review.reviewer_name}</span></span>
                    </div>

                    <div className="flex items-center justify-between pt-1">
                      <span className="font-bold text-slate-450 uppercase tracking-wider text-[9px]">Overall Rating:</span>
                      {review.overall_score > 0 ? (
                        <div className="flex items-center gap-0.5 text-amber-500">
                          {Array.from({ length: 5 }).map((_, i) => (
                            <Star 
                              key={i} 
                              className={`h-3.5 w-3.5 ${i < review.overall_score ? 'fill-current' : 'text-slate-200 dark:text-slate-800'}`} 
                            />
                          ))}
                          <span className="ml-1 text-xs font-bold text-slate-600 dark:text-slate-350">({review.overall_score})</span>
                        </div>
                      ) : (
                        <span className="text-[10px] font-bold text-slate-400 italic">Not rated yet</span>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
            
            {reviews.length === 0 && (
              <Card className="col-span-full bg-white/40 dark:bg-slate-900/40 border border-slate-200/60 dark:border-slate-800/40 rounded-2xl">
                <CardContent className="py-16 text-center space-y-3">
                  <Award className="h-12 w-12 mx-auto text-slate-400" />
                  <p className="text-sm font-semibold text-slate-500">No appraisals listed. Create one to begin!</p>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>

      {/* Draft New Appraisal Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-[480px] p-0 overflow-hidden bg-white/95 dark:bg-slate-900/95 backdrop-blur-2xl border border-slate-200/60 dark:border-slate-800/40 rounded-2xl shadow-2xl">
          <DialogHeader className="p-6 pb-0 relative">
            <div className="absolute top-0 left-0 w-24 h-24 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none"></div>
            <div className="flex items-center gap-2">
              <div className="p-2 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-500 rounded-xl">
                <Award className="h-5 w-5" />
              </div>
              <DialogTitle className="text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                New Appraisal Draft
                <Sparkles className="h-3.5 w-3.5 text-amber-500" />
              </DialogTitle>
            </div>
            <DialogDescription className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-1 pl-1">
              Initiate a fresh review profile to evaluate an employee.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreate} className="p-6 space-y-4">
            <div>
              <Label className="text-xs font-bold text-slate-500 dark:text-slate-400">Review Title</Label>
              <Input 
                placeholder="e.g. Annual Appraisal 2026" 
                value={title} 
                onChange={e => setTitle(e.target.value)} 
                required 
                className="h-11 rounded-xl border-slate-250 dark:border-slate-800 focus:ring-2 focus:ring-indigo-500/15 text-xs font-semibold"
              />
            </div>
            
            <div>
              <Label className="text-xs font-bold text-slate-500 dark:text-slate-400">Employee under Review</Label>
              <Select value={employeeId} onValueChange={setEmployeeId}>
                <SelectTrigger className="h-11 rounded-xl border-slate-250 dark:border-slate-800 focus:ring-2 focus:ring-indigo-500/15">
                  <SelectValue placeholder="Select target employee" />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  {teamMembers.map((tm: any) => (
                    <SelectItem key={tm.user_id} value={tm.user_id} className="text-xs font-semibold">
                      {tm.full_name || 'Unnamed'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs font-bold text-slate-500 dark:text-slate-400">Appraisal Cycle</Label>
              <Select value={reviewCycle} onValueChange={setReviewCycle}>
                <SelectTrigger className="h-11 rounded-xl border-slate-250 dark:border-slate-800 focus:ring-2 focus:ring-indigo-500/15">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="Q1 2026" className="text-xs font-semibold">Q1 2026</SelectItem>
                  <SelectItem value="Q2 2026" className="text-xs font-semibold">Q2 2026</SelectItem>
                  <SelectItem value="Q3 2026" className="text-xs font-semibold">Q3 2026</SelectItem>
                  <SelectItem value="Annual 2026" className="text-xs font-semibold">Annual 2026</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <DialogFooter className="pt-2 flex gap-2 border-t border-slate-100 dark:border-slate-800/30">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => setAddOpen(false)}
                className="rounded-xl text-xs font-bold px-5 h-11 border-slate-200 dark:border-slate-800 flex-1"
              >
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={createMutation.isPending}
                className="rounded-xl text-xs font-bold px-5 h-11 gradient-primary shadow-sm flex-1"
              >
                {createMutation.isPending ? 'Drafting...' : 'Create Draft'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit / Details Appraisal Dialog */}
      <Dialog open={editOpen} onOpenChange={o => !o && setEditOpen(false)}>
        <DialogContent className="sm:max-w-[480px] p-0 overflow-hidden bg-white/95 dark:bg-slate-900/95 backdrop-blur-2xl border border-slate-200/60 dark:border-slate-800/40 rounded-2xl shadow-2xl">
          <DialogHeader className="p-6 pb-0 relative">
            <div className="absolute top-0 left-0 w-24 h-24 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none"></div>
            <div className="flex items-center justify-between pr-6">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-500 rounded-xl">
                  <Edit className="h-5 w-5" />
                </div>
                <DialogTitle className="text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                  Appraisal Details
                </DialogTitle>
              </div>
            </div>
            <DialogDescription className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-1 pl-1">
              Modify candidate score, lifecycle stages, or cycle definitions.
            </DialogDescription>
          </DialogHeader>

          {selectedReview && (
            <div className="p-6 space-y-4 max-h-[65vh] overflow-y-auto custom-scrollbar">
              <div className="bg-slate-50/50 dark:bg-slate-950/20 p-4 rounded-xl border border-slate-150 dark:border-slate-800/40 flex flex-col justify-between gap-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Evaluating Employee:</span>
                <span className="font-extrabold text-slate-850 dark:text-slate-200 flex items-center gap-1">
                  <User className="h-4 w-4 text-indigo-500" />
                  {selectedReview.employee_name}
                </span>
                <span className="text-[10px] font-medium text-slate-450 mt-1">Reviewer: {selectedReview.reviewer_name}</span>
              </div>

              <div>
                <Label className="text-xs font-bold text-slate-500 dark:text-slate-400">Review Title</Label>
                <Input 
                  value={selectedReview.title || ''} 
                  onChange={e => setSelectedReview({ ...selectedReview, title: e.target.value })} 
                  className="h-11 rounded-xl border-slate-250 dark:border-slate-800 focus:ring-2 focus:ring-indigo-500/15 text-xs font-semibold"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs font-bold text-slate-500 dark:text-slate-400">Review Cycle</Label>
                  <Select value={selectedReview.review_cycle || ''} onValueChange={v => setSelectedReview({ ...selectedReview, review_cycle: v })}>
                    <SelectTrigger className="h-11 rounded-xl border-slate-250 dark:border-slate-800 focus:ring-2 focus:ring-indigo-500/15">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      <SelectItem value="Q1 2026" className="text-xs font-semibold">Q1 2026</SelectItem>
                      <SelectItem value="Q2 2026" className="text-xs font-semibold">Q2 2026</SelectItem>
                      <SelectItem value="Q3 2026" className="text-xs font-semibold">Q3 2026</SelectItem>
                      <SelectItem value="Annual 2026" className="text-xs font-semibold">Annual 2026</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <Label className="text-xs font-bold text-slate-500 dark:text-slate-400">Review Status</Label>
                  <Select value={selectedReview.status || 'draft'} onValueChange={v => setSelectedReview({ ...selectedReview, status: v })}>
                    <SelectTrigger className="h-11 rounded-xl border-slate-250 dark:border-slate-800 focus:ring-2 focus:ring-indigo-500/15">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      <SelectItem value="draft" className="text-xs font-semibold">Draft</SelectItem>
                      <SelectItem value="in_progress" className="text-xs font-semibold">In Progress</SelectItem>
                      <SelectItem value="completed" className="text-xs font-semibold">Completed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Star Rating Interactive Field */}
              <div>
                <Label className="text-xs font-bold text-slate-500 dark:text-slate-400 block mb-1.5">Assign Performance Score (1-5 Stars)</Label>
                <div className="flex items-center gap-2 bg-slate-50/50 dark:bg-slate-950/10 p-3 rounded-xl border border-slate-150 dark:border-slate-850/20 justify-center">
                  {Array.from({ length: 5 }).map((_, i) => {
                    const ratingValue = i + 1;
                    const isActive = ratingValue <= (selectedReview.overall_score || 0);
                    return (
                      <button
                        type="button"
                        key={i}
                        onClick={() => setSelectedReview({ ...selectedReview, overall_score: ratingValue })}
                        className="p-1 hover:scale-125 transition-transform text-amber-500 focus:outline-none"
                      >
                        <Star className={`h-8 w-8 ${isActive ? 'fill-current' : 'text-slate-250 dark:text-slate-800'}`} />
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Modal Actions */}
              <div className="pt-4 border-t border-slate-100 dark:border-slate-800/30 flex flex-col gap-2">
                <div className="flex gap-2 w-full">
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => setEditOpen(false)}
                    className="rounded-xl text-xs font-bold h-11 border-slate-200 dark:border-slate-800 flex-1"
                  >
                    Cancel
                  </Button>
                  <Button 
                    type="button" 
                    onClick={() => updateMutation.mutate(selectedReview)} 
                    disabled={updateMutation.isPending}
                    className="rounded-xl text-xs font-bold h-11 gradient-primary shadow-sm flex-1"
                  >
                    {updateMutation.isPending ? 'Saving...' : 'Update Review'}
                  </Button>
                </div>

                {/* Clean Delete Action Button */}
                <Button 
                  type="button" 
                  variant="destructive"
                  onClick={() => {
                    if (window.confirm("Are you absolutely sure you want to permanently delete this performance review appraisal?")) {
                      deleteMutation.mutate(selectedReview.id);
                    }
                  }} 
                  disabled={deleteMutation.isPending}
                  className="rounded-xl text-xs font-bold h-11 bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-100 dark:bg-rose-950/20 dark:text-rose-450 dark:hover:bg-rose-950/40 w-full flex items-center justify-center gap-1.5"
                >
                  <Trash2 className="h-4 w-4" />
                  {deleteMutation.isPending ? 'Deleting...' : 'Delete Appraisal Review'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
