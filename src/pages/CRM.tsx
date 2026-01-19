/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query'; // Added useQueryClient
import { supabase } from '@/integrations/supabase/client'; // Added supabase import
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input'; // New Import
import { Badge } from '@/components/ui/badge'; // New Import
import { 
  Plus, 
  Upload, 
  LayoutGrid, 
  List, 
  Search,       // New Icon
  Download,     // New Icon
  RefreshCw,    // New Icon
  Filter,       // New Icon
  Calendar,     // New Icon
  TrendingUp,   // New Icon
  DollarSign,   // New Icon
  Users,        // New Icon
  PieChart      // New Icon
} from 'lucide-react';
import { LeadKanban } from '@/components/crm/LeadKanban';
import { LeadTable } from '@/components/crm/LeadTable';
import { LeadImporter } from '@/components/crm/LeadImporter';
import { AddLeadDialog } from '@/components/crm/AddLeadDialog';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCurrency } from '@/lib/currency';
import { toast } from 'sonner';

// Mock data for the new Analytics feature (since we don't have a real analytics table yet)
const sourceData = [
  { name: 'Website', value: 45 },
  { name: 'Referral', value: 25 },
  { name: 'Cold Call', value: 20 },
  { name: 'Social', value: 10 },
];

export default function CRM() {
  const queryClient = useQueryClient();
  const [view, setView] = useState<'kanban' | 'table'>('kanban');
  const [importerOpen, setImporterOpen] = useState(false);
  const [addLeadOpen, setAddLeadOpen] = useState(false);
  
  // --- NEW STATES ---
  const [searchQuery, setSearchQuery] = useState('');
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // --- FEATURE 1: KPI STATS QUERY ---
  const { data: stats } = useQuery({
    queryKey: ['crm_stats'],
    queryFn: async () => {
      const { data: leads, error } = await supabase.from('leads').select('value, status');
      if (error || !leads) return { total: 0, totalValue: 0, conversion: '0' };
      
      const total = leads.length;
      const totalValue = leads.reduce((sum: number, lead: any) => sum + (Number(lead.value) || 0), 0);
      const won = leads.filter((l: any) => l.status === 'won').length;
      const conversion = total > 0 ? ((won / total) * 100).toFixed(1) : '0';
      return { total, totalValue, conversion };
    }
  });

  // --- FEATURE 2: EXPORT FUNCTIONALITY ---
  const handleExport = async () => {
    try {
      const { data, error } = await supabase.from('leads').select('*').csv();
      if (error) throw error;
      
      const blob = new Blob([data], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `leads_export_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      toast.success("Leads exported successfully");
    } catch (e: any) {
      toast.error("Export failed: " + e.message);
    }
  };

  // --- FEATURE 3: REFRESH DATA ---
  const handleRefresh = async () => {
    setIsRefreshing(true);
    await queryClient.invalidateQueries({ queryKey: ['leads'] });
    await queryClient.invalidateQueries({ queryKey: ['crm_stats'] });
    setTimeout(() => setIsRefreshing(false), 800);
    toast.success("CRM data refreshed");
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in">
        
        {/* --- FEATURE 1 (UI): STATS CARDS --- */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card className="glass-card">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Pipeline</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(stats?.totalValue || 0)}</div>
              <p className="text-xs text-muted-foreground">Potential revenue across all leads</p>
            </CardContent>
          </Card>
          <Card className="glass-card">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Leads</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.total || 0}</div>
              <p className="text-xs text-muted-foreground">Potential clients in pipeline</p>
            </CardContent>
          </Card>
          <Card className="glass-card">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Conversion Rate</CardTitle>
              <TrendingUp className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.conversion}%</div>
              <p className="text-xs text-muted-foreground">Leads converted to Won</p>
            </CardContent>
          </Card>
        </div>

        {/* Header (Modified with new buttons) */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold">CRM & Leads</h1>
            <p className="text-muted-foreground mt-1">
              Manage your sales pipeline and track lead conversions.
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {/* --- FEATURE 6: ANALYTICS BUTTON --- */}
            <Button variant="outline" size="icon" onClick={() => setShowAnalytics(true)} title="View Insights">
              <PieChart className="h-4 w-4" />
            </Button>

            {/* --- FEATURE 3: REFRESH BUTTON --- */}
            <Button variant="outline" size="icon" onClick={handleRefresh} className={isRefreshing ? "animate-spin" : ""}>
              <RefreshCw className="h-4 w-4" />
            </Button>

            {/* --- FEATURE 2: EXPORT BUTTON --- */}
            <Button variant="outline" onClick={handleExport}>
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>

            <Button variant="outline" onClick={() => setImporterOpen(true)}>
              <Upload className="h-4 w-4 mr-2" />
              Import
            </Button>
            <Button className="gradient-primary" onClick={() => setAddLeadOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Lead
            </Button>
          </div>
        </div>

        {/* --- FEATURE 4 & 5: SEARCH & FILTER TOOLBAR --- */}
        <div className="flex flex-col sm:flex-row gap-4 items-center justify-between bg-muted/30 p-3 rounded-lg border">
          <div className="flex items-center gap-3 w-full sm:w-auto flex-1">
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Search leads, companies..." 
                className="pl-9 bg-background"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <Button variant="outline" size="sm" className="hidden sm:flex">
              <Filter className="h-4 w-4 mr-2" /> Filter
            </Button>
            <Button variant="outline" size="sm" className="hidden sm:flex">
              <Calendar className="h-4 w-4 mr-2" /> Date
            </Button>
          </div>

          {/* --- FEATURE 7: QUICK FILTER BADGES --- */}
          <div className="flex gap-2 overflow-x-auto pb-1 sm:pb-0">
             <Badge variant="outline" className="cursor-pointer hover:bg-primary/10">High Value</Badge>
             <Badge variant="outline" className="cursor-pointer hover:bg-primary/10">New This Week</Badge>
             <Badge variant="outline" className="cursor-pointer hover:bg-primary/10">Follow Up</Badge>
          </div>

          {/* View Toggle (Existing) */}
          <div className="flex items-center gap-2 bg-background rounded-md border p-1">
            <Button
              variant={view === 'kanban' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setView('kanban')}
              className="h-8"
            >
              <LayoutGrid className="h-4 w-4 mr-2" />
              Kanban
            </Button>
            <Button
              variant={view === 'table' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setView('table')}
              className="h-8"
            >
              <List className="h-4 w-4 mr-2" />
              Table
            </Button>
          </div>
        </div>

        {/* Content (Passed searchQuery as prop if supported, otherwise just renders) */}
        {view === 'kanban' ? <LeadKanban /> : <LeadTable />}

        {/* Dialogs */}
        <LeadImporter open={importerOpen} onOpenChange={setImporterOpen} />
        <AddLeadDialog open={addLeadOpen} onOpenChange={setAddLeadOpen} />

        {/* --- FEATURE 6 (DIALOG): INSIGHTS --- */}
        <Dialog open={showAnalytics} onOpenChange={setShowAnalytics}>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>CRM Insights</DialogTitle>
              <DialogDescription>Quick snapshot of your lead sources.</DialogDescription>
            </DialogHeader>
            <div className="py-4 space-y-4">
              {sourceData.map((item) => (
                <div key={item.name} className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="font-medium">{item.name}</span>
                    <span>{item.value}%</span>
                  </div>
                  <div className="h-2 bg-secondary rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-primary transition-all duration-500" 
                      style={{ width: `${item.value}%` }} 
                    />
                  </div>
                </div>
              ))}
            </div>
          </DialogContent>
        </Dialog>

      </div>
    </DashboardLayout>
  );
}