import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Award, Plus, Calendar as CalendarIcon, Star, Target } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

export default function PerformanceReviews() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);
  
  // Form State
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

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error("Not authenticated");
      const { error } = await supabase.from('performance_reviews' as any).insert({
        title,
        employee_id: employeeId,
        reviewer_id: user.id,
        review_cycle: reviewCycle,
        status: 'draft',
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
      case 'completed': return 'bg-success';
      case 'in_progress': return 'bg-warning text-warning-foreground';
      default: return 'bg-secondary text-secondary-foreground';
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2">
              <Award className="h-8 w-8 text-primary" />
              Performance Reviews
            </h1>
            <p className="text-muted-foreground mt-1">Manage team appraisals and goals.</p>
          </div>
          
          <Dialog open={addOpen} onOpenChange={setAddOpen}>
            <DialogTrigger asChild>
              <Button className="gradient-primary">
                <Plus className="h-4 w-4 mr-2" /> New Review
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Draft New Performance Review</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleCreate} className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label>Review Title</Label>
                  <Input placeholder="e.g. Annual Performance Review" value={title} onChange={e => setTitle(e.target.value)} required />
                </div>
                <div className="space-y-2">
                  <Label>Employee</Label>
                  <Select value={employeeId} onValueChange={setEmployeeId}>
                    <SelectTrigger><SelectValue placeholder="Select Employee" /></SelectTrigger>
                    <SelectContent>
                      {teamMembers.map((tm: any) => (
                        <SelectItem key={tm.user_id} value={tm.user_id}>{tm.full_name || 'Unnamed'}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Review Cycle</Label>
                  <Select value={reviewCycle} onValueChange={setReviewCycle}>
                    <SelectTrigger><SelectValue placeholder="Select Cycle" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Q1 2026">Q1 2026</SelectItem>
                      <SelectItem value="Q2 2026">Q2 2026</SelectItem>
                      <SelectItem value="Q3 2026">Q3 2026</SelectItem>
                      <SelectItem value="Annual 2026">Annual 2026</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button type="submit" className="w-full" disabled={createMutation.isPending}>
                  {createMutation.isPending ? 'Creating...' : 'Create Draft'}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {isLoading ? (
          <div className="text-center py-12 text-muted-foreground">Loading reviews...</div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {reviews.map((review: any) => (
              <Card key={review.id} className="glass-card hover:shadow-medium transition-shadow cursor-pointer">
                <CardHeader className="pb-2">
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="text-lg">{review.title}</CardTitle>
                      <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1">
                        <Target className="h-3 w-3" /> {review.employee_name}
                      </p>
                    </div>
                    <Badge className={getStatusColor(review.status)}>{review.status.replace('_', ' ')}</Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex justify-between items-center text-sm mt-4">
                    <span className="flex items-center gap-1 text-muted-foreground">
                      <CalendarIcon className="h-4 w-4" /> {review.review_cycle}
                    </span>
                    {review.overall_score && (
                      <span className="flex items-center gap-1 font-bold text-primary">
                        <Star className="h-4 w-4" fill="currentColor" /> {review.overall_score}
                      </span>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
            
            {reviews.length === 0 && (
              <Card className="col-span-full glass-card p-12 text-center">
                <Award className="h-12 w-12 mx-auto text-muted-foreground mb-4 opacity-50" />
                <h3 className="text-lg font-medium">No reviews found</h3>
                <p className="text-muted-foreground">Start by drafting a new performance review.</p>
              </Card>
            )}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
