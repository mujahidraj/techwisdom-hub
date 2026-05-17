/* eslint-disable @typescript-eslint/ban-ts-comment */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useActivityLog } from '@/hooks/useActivityLog';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { 
  Plus, Upload, LayoutGrid, List, Search, Download, RefreshCw, 
  Filter, Calendar, TrendingUp, DollarSign, Users, PieChart, X 
} from 'lucide-react';
import { LeadKanban } from '@/components/crm/LeadKanban';
import { LeadTable } from '@/components/crm/LeadTable';
import { LeadImporter } from '@/components/crm/LeadImporter';
import { AddLeadDialog } from '@/components/crm/AddLeadDialog';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import {
  Popover, PopoverContent, PopoverTrigger,
} from '@/components/ui/popover';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCurrency } from '@/lib/currency';
import { toast } from 'sonner';

// Standard Categories (You can fetch these from DB if preferred)
const CATEGORIES = [
  "technology", "healthcare", "real_estate", "education", 
  "fashion", "retail", "finance", "hospitality", "other"
];

// Mock data for analytics
const sourceData = [
  { name: 'Website', value: 45 },
  { name: 'Referral', value: 25 },
  { name: 'Cold Call', value: 20 },
  { name: 'Social', value: 10 },
];

export default function CRM() {
  const queryClient = useQueryClient();
  const { logActivity, logSecurity } = useActivityLog();
  const [view, setView] = useState<'kanban' | 'table'>('kanban');
  const [importerOpen, setImporterOpen] = useState(false);
  const [addLeadOpen, setAddLeadOpen] = useState(false);
  
  // --- SEARCH & FILTER STATES ---
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<'all' | 'high_value' | 'new_week' | 'follow_up'>('all');
  
  // --- NEW: SPECIFIC FILTERS ---
  const [cityFilter, setCityFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');

  const [showAnalytics, setShowAnalytics] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // --- KPI STATS QUERY ---
  const { data: stats } = useQuery({
    queryKey: ['crm_stats'],
    queryFn: async () => {
      const { data: leads, error } = await supabase.from('leads').select('value, status');
      if (error || !leads) return { total: 0, totalValue: 0, conversion: '0' };
      
      const total = leads.length;
      const totalValue = leads.reduce((sum: number, lead: any) => sum + (Number(lead.value) || 0), 0);
      const won = leads.filter((l: any) => l.status === 'deal_won').length;
      const conversion = total > 0 ? ((won / total) * 100).toFixed(1) : '0';
      return { total, totalValue, conversion };
    }
  });

  // --- EXPORT FUNCTIONALITY (With All Filters) ---
  const handleExport = async () => {
    try {
      logSecurity('EXPORT', 'CLIENT_LIST', 'Exported full leads/clients CRM pipeline list to CSV format');
      let query = supabase.from('leads').select('*');

      // 1. Search
      if (searchQuery) {
        query = query.or(`business_name.ilike.%${searchQuery}%,contact_person.ilike.%${searchQuery}%,email.ilike.%${searchQuery}%,phone.ilike.%${searchQuery}%`);
      }

      // 2. Badge Filters
      if (activeFilter === 'high_value') {
        query = query.gte('value', 5000);
      } else if (activeFilter === 'new_week') {
        const oneWeekAgo = new Date();
        oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
        query = query.gte('created_at', oneWeekAgo.toISOString());
      } else if (activeFilter === 'follow_up') {
        query = query.eq('status', 'contacted');
      }

      // 3. New Filters (City & Category)
      if (cityFilter) {
        query = query.ilike('city', `%${cityFilter}%`);
      }
      if (categoryFilter && categoryFilter !== 'all') {
        query = query.eq('category', categoryFilter as any);
      }

      // 4. Sorting
      query = query.order('sl_no', { ascending: true, nullsFirst: false }).order('id', { ascending: true });

      const { data, error } = await query.csv();
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
      logActivity('exported', 'crm_leads', `leads_export_${new Date().toISOString().split('T')[0]}.csv`);
      logSecurity('EXPORT', 'CRM_LEADS', `Exported CRM leads to CSV format`);
    } catch (e: any) {
      toast.error("Export failed: " + e.message);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await queryClient.invalidateQueries({ queryKey: ['leads'] });
    await queryClient.invalidateQueries({ queryKey: ['crm_stats'] });
    setTimeout(() => setIsRefreshing(false), 800);
    toast.success("CRM data refreshed");
  };

  // Helper to clear advanced filters
  const clearFilters = () => {
    setCityFilter('');
    setCategoryFilter('all');
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in">
        
        {/* STATS CARDS */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card className="glass-card">
            <CardHeader className="flex flex-col md:flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Pipeline</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(stats?.totalValue || 0)}</div>
              <p className="text-xs text-muted-foreground">Potential revenue across all leads</p>
            </CardContent>
          </Card>
          <Card className="glass-card">
            <CardHeader className="flex flex-col md:flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Leads</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.total || 0}</div>
              <p className="text-xs text-muted-foreground">Potential clients in pipeline</p>
            </CardContent>
          </Card>
          <Card className="glass-card">
            <CardHeader className="flex flex-col md:flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Conversion Rate</CardTitle>
              <TrendingUp className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.conversion}%</div>
              <p className="text-xs text-muted-foreground">Leads converted to Won</p>
            </CardContent>
          </Card>
        </div>

        {/* HEADER */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold">CRM & Leads</h1>
            <p className="text-muted-foreground mt-1">
              Manage your sales pipeline and track lead conversions.
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Button variant="outline" size="icon" onClick={() => setShowAnalytics(true)} title="View Insights">
              <PieChart className="h-4 w-4" />
            </Button>

            <Button variant="outline" size="icon" onClick={handleRefresh} className={isRefreshing ? "animate-spin" : ""}>
              <RefreshCw className="h-4 w-4" />
            </Button>

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

        {/* SEARCH & FILTER TOOLBAR */}
        <div className="flex flex-col sm:flex-row gap-4 items-center justify-between bg-muted/30 p-3 rounded-lg border">
          <div className="flex items-center gap-3 w-full sm:w-auto flex-1">
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Search leads..." 
                className="pl-9 bg-background"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            {/* --- NEW: ADVANCED FILTER POPOVER --- */}
            <Popover>
              <PopoverTrigger asChild>
                <Button variant={cityFilter || categoryFilter !== 'all' ? "secondary" : "outline"} size="sm" className="hidden sm:flex">
                  <Filter className="h-4 w-4 mr-2" /> 
                  Filters
                  {(cityFilter || categoryFilter !== 'all') && <Badge variant="secondary" className="ml-2 h-5 w-5 p-0 flex items-center justify-center text-[10px]">!</Badge>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80 p-4" align="start">
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <h4 className="font-medium leading-none">Filter Leads</h4>
                    {(cityFilter || categoryFilter !== 'all') && (
                        <Button variant="ghost" size="sm" className="h-auto p-0 text-xs text-muted-foreground" onClick={clearFilters}>
                            Clear all
                        </Button>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="category">Category</Label>
                    <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                      <SelectTrigger id="category">
                        <SelectValue placeholder="All Categories" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Categories</SelectItem>
                        {CATEGORIES.map(cat => (
                            <SelectItem key={cat} value={cat} className="capitalize">{cat.replace('_', ' ')}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="city">City</Label>
                    <Input 
                        id="city" 
                        placeholder="Enter city name..." 
                        value={cityFilter} 
                        onChange={(e) => setCityFilter(e.target.value)} 
                    />
                  </div>
                </div>
              </PopoverContent>
            </Popover>

            <Button variant="outline" size="sm" className="hidden sm:flex">
              <Calendar className="h-4 w-4 mr-2" /> Date
            </Button>
          </div>

          {/* ACTIVE FILTER BADGES */}
          <div className="flex gap-2 overflow-x-auto pb-1 sm:pb-0">
             <Badge 
                variant={activeFilter === 'high_value' ? 'default' : 'outline'} 
                className="cursor-pointer"
                onClick={() => setActiveFilter(activeFilter === 'high_value' ? 'all' : 'high_value')}
             >
                High Value
             </Badge>
             <Badge 
                variant={activeFilter === 'new_week' ? 'default' : 'outline'} 
                className="cursor-pointer"
                onClick={() => setActiveFilter(activeFilter === 'new_week' ? 'all' : 'new_week')}
             >
                New This Week
             </Badge>
             <Badge 
                variant={activeFilter === 'follow_up' ? 'default' : 'outline'} 
                className="cursor-pointer"
                onClick={() => setActiveFilter(activeFilter === 'follow_up' ? 'all' : 'follow_up')}
             >
                Follow Up
             </Badge>
          </div>

          {/* View Toggle */}
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

        {/* CONTENT (Passing all filters) */}
        {view === 'kanban' ? (
            // @ts-ignore
            <LeadKanban 
                searchQuery={searchQuery} 
                filter={activeFilter} 
                cityFilter={cityFilter} 
                categoryFilter={categoryFilter} 
            />
        ) : (
            // @ts-ignore
            <LeadTable 
                searchQuery={searchQuery} 
                filter={activeFilter} 
                cityFilter={cityFilter} 
                categoryFilter={categoryFilter}
            />
        )}

        {/* Dialogs */}
        <LeadImporter open={importerOpen} onOpenChange={setImporterOpen} />
        <AddLeadDialog open={addLeadOpen} onOpenChange={setAddLeadOpen} />

        {/* INSIGHTS */}
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