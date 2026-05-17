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
  Filter, Calendar, TrendingUp, DollarSign, Users, PieChart, X,
  SlidersHorizontal, MapPin, Laptop, HeartPulse, Building, 
  GraduationCap, Shirt, ShoppingBag, Wallet, Utensils, Globe, 
  ChevronDown, ChevronUp
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

const CATEGORY_ICONS: Record<string, any> = {
  technology: Laptop,
  healthcare: HeartPulse,
  real_estate: Building,
  education: GraduationCap,
  fashion: Shirt,
  retail: ShoppingBag,
  finance: Wallet,
  hospitality: Utensils,
  other: Globe
};

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
  const [advancedOpen, setAdvancedOpen] = useState(false);

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
      <div className="space-y-7 animate-fade-in text-slate-800 max-w-full overflow-x-hidden pb-8">
        
        {/* TOP LEVEL PREMIUM STATS CARDS */}
        <div className="grid gap-5 md:grid-cols-3">
          
          {/* PIPELINE VALUE */}
          <Card className="bg-white/80 backdrop-blur-md border border-slate-100 hover:border-orange-500/10 hover:shadow-xl hover:shadow-orange-500/5 transition-all duration-300 hover:-translate-y-1 rounded-3xl relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-orange-500/10 to-transparent blur-2xl rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
              <span className="text-xs font-black uppercase tracking-widest text-slate-400">Total Pipeline</span>
              <div className="h-9 w-9 rounded-xl bg-orange-50 border border-orange-100 flex items-center justify-center text-orange-500 group-hover:scale-110 transition-transform duration-300">
                <DollarSign className="h-4.5 w-4.5" />
              </div>
            </CardHeader>
            <CardContent className="pt-1">
              <div className="text-3xl font-black bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 bg-clip-text text-transparent tracking-tight">
                {formatCurrency(stats?.totalValue || 0)}
              </div>
              <p className="text-xs text-slate-400 font-bold uppercase tracking-wide mt-1.5">
                Potential revenue across all active leads
              </p>
            </CardContent>
          </Card>

          {/* ACTIVE LEADS */}
          <Card className="bg-white/80 backdrop-blur-md border border-slate-100 hover:border-orange-500/10 hover:shadow-xl hover:shadow-orange-500/5 transition-all duration-300 hover:-translate-y-1 rounded-3xl relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-amber-500/10 to-transparent blur-2xl rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
              <span className="text-xs font-black uppercase tracking-widest text-slate-400">Active Leads</span>
              <div className="h-9 w-9 rounded-xl bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-500 group-hover:scale-110 transition-transform duration-300">
                <Users className="h-4.5 w-4.5" />
              </div>
            </CardHeader>
            <CardContent className="pt-1">
              <div className="text-3xl font-black bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 bg-clip-text text-transparent tracking-tight">
                {stats?.total || 0}
              </div>
              <p className="text-xs text-slate-400 font-bold uppercase tracking-wide mt-1.5">
                Prospective accounts in sales pipeline
              </p>
            </CardContent>
          </Card>

          {/* CONVERSION RATE */}
          <Card className="bg-white/80 backdrop-blur-md border border-slate-100 hover:border-orange-500/10 hover:shadow-xl hover:shadow-orange-500/5 transition-all duration-300 hover:-translate-y-1 rounded-3xl relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-emerald-500/10 to-transparent blur-2xl rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
              <span className="text-xs font-black uppercase tracking-widest text-slate-400">Conversion Rate</span>
              <div className="h-9 w-9 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-500 group-hover:scale-110 transition-transform duration-300">
                <TrendingUp className="h-4.5 w-4.5" />
              </div>
            </CardHeader>
            <CardContent className="pt-1">
              <div className="text-3xl font-black bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 bg-clip-text text-transparent tracking-tight">
                {stats?.conversion}%
              </div>
              <p className="text-xs text-slate-400 font-bold uppercase tracking-wide mt-1.5">
                Proportion of leads won successfully
              </p>
            </CardContent>
          </Card>

        </div>

        {/* HERO TITLE & ACTION CONTROL HEADER */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-5 bg-white/40 border border-slate-100/60 p-5 rounded-3xl backdrop-blur-sm">
          <div>
            <h1 className="text-2xl sm:text-3xl font-black bg-gradient-to-r from-orange-600 to-amber-600 bg-clip-text text-transparent tracking-tight animate-fade-in">
              CRM & Leads
            </h1>
            <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">
              Live Sales Pipeline & Lead Conversion Matrix
            </p>
          </div>
          
          <div className="flex items-center gap-2.5 flex-wrap">
            <Button
              variant="outline"
              size="icon"
              onClick={() => setShowAnalytics(true)}
              title="View Insights"
              className="h-11 w-11 rounded-2xl border-slate-200 bg-white/90 shadow-sm text-slate-500 hover:text-slate-800 transition-all hover:scale-105"
            >
              <PieChart className="h-4.5 w-4.5" />
            </Button>

            <Button
              variant="outline"
              size="icon"
              onClick={handleRefresh}
              className={`h-11 w-11 rounded-2xl border-slate-200 bg-white/90 shadow-sm text-slate-500 hover:text-slate-800 transition-all hover:scale-105 ${isRefreshing ? "animate-spin" : ""}`}
            >
              <RefreshCw className="h-4.5 w-4.5" />
            </Button>

            <Button
              variant="outline"
              onClick={handleExport}
              className="h-11 rounded-2xl border-slate-200 bg-white/90 shadow-sm text-slate-700 hover:bg-slate-50 transition-all font-bold hover:scale-102 flex items-center gap-2 px-4"
            >
              <Download className="h-4 w-4 text-slate-500" />
              <span>Export</span>
            </Button>

            <Button
              variant="outline"
              onClick={() => setImporterOpen(true)}
              className="h-11 rounded-2xl border-slate-200 bg-white/90 shadow-sm text-slate-700 hover:bg-slate-50 transition-all font-bold hover:scale-102 flex items-center gap-2 px-4"
            >
              <Upload className="h-4 w-4 text-slate-500" />
              <span>Import</span>
            </Button>
            
            <Button
              onClick={() => setAddLeadOpen(true)}
              className="h-11 rounded-2xl bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 border-0 text-white font-bold shadow-md shadow-orange-500/10 hover:shadow-orange-500/20 active:scale-95 hover:scale-102 transition-all flex items-center gap-2 px-5"
            >
              <Plus className="h-4.5 w-4.5" />
              <span>Add Lead</span>
            </Button>
          </div>
        </div>

        {/* ULTRA-PREMIUM MODERN CRM FILTER CONSOLE */}
        <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl rounded-3xl border border-slate-200/50 dark:border-slate-800/80 shadow-xl shadow-slate-100/10 dark:shadow-none p-4 space-y-4 transition-all duration-300">
          
          {/* Main Action Bar */}
          <div className="flex flex-col lg:flex-row gap-3 items-center justify-between">
            
            {/* Search Input */}
            <div className="relative w-full lg:flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 dark:text-slate-500" />
              <Input 
                placeholder="Search by business name, contact person, email or phone..." 
                className="pl-10 pr-9 h-12 rounded-2xl border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-950/90 focus-visible:ring-orange-500/30 focus-visible:border-orange-500 text-xs placeholder-slate-405 font-semibold w-full transition-all"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {searchQuery && (
                <button 
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-205 p-1 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {/* Sliding Quick Filters & Actions Section */}
            <div className="flex flex-col sm:flex-row items-center gap-3 w-full lg:w-auto shrink-0 justify-end">
              
              {/* Apple-Style Sliding Segment Control for Quick Filters */}
              <div className="bg-slate-100/80 dark:bg-slate-800/60 p-1 rounded-2xl flex gap-1 w-full sm:w-auto overflow-x-auto sidebar-scroll">
                {[
                  { id: 'all', label: '🌟 All Pipelines' },
                  { id: 'high_value', label: '💎 High Value' },
                  { id: 'new_week', label: '✨ New Week' },
                  { id: 'follow_up', label: '⏳ Follow Up' }
                ].map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveFilter(tab.id as any)}
                    className={`text-[11px] font-bold px-3.5 py-2 rounded-xl transition-all shrink-0 ${
                      activeFilter === tab.id
                        ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-md shadow-orange-500/10 scale-102 font-black'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Controls Toggle Group */}
              <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                
                {/* Advanced Drawer Toggle */}
                <Button
                  variant="outline"
                  onClick={() => setAdvancedOpen(!advancedOpen)}
                  className={`h-11 px-4 rounded-2xl border-slate-200/80 dark:border-slate-800/80 font-bold transition-all flex items-center gap-2 text-xs shrink-0 select-none ${
                    advancedOpen || cityFilter || categoryFilter !== 'all'
                      ? 'bg-orange-50 dark:bg-orange-950/20 border-orange-200 dark:border-orange-900/50 text-orange-600 dark:text-orange-400 shadow-sm'
                      : 'bg-white/90 dark:bg-slate-950/90 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  <SlidersHorizontal className="h-3.5 w-3.5" />
                  <span>Interactive Filters</span>
                  {(cityFilter || categoryFilter !== 'all') && (
                    <span className="w-2 h-2 rounded-full bg-orange-500 animate-pulse shrink-0" />
                  )}
                  {advancedOpen ? <ChevronUp className="h-3 w-3 opacity-60" /> : <ChevronDown className="h-3 w-3 opacity-60" />}
                </Button>

                {/* View Switcher Toggle */}
                <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800/85 p-1 rounded-2xl border border-slate-200/30 shrink-0 h-11">
                  <button
                    onClick={() => setView('kanban')}
                    className={`flex items-center justify-center gap-1.5 text-xs font-bold rounded-xl px-3.5 h-9 transition-all ${
                      view === 'kanban'
                        ? 'bg-white dark:bg-slate-950 text-orange-600 dark:text-orange-400 shadow-sm'
                        : 'text-slate-500 dark:text-slate-450 hover:text-slate-800 dark:hover:text-slate-200'
                    }`}
                  >
                    <LayoutGrid className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Kanban</span>
                  </button>
                  <button
                    onClick={() => setView('table')}
                    className={`flex items-center justify-center gap-1.5 text-xs font-bold rounded-xl px-3.5 h-9 transition-all ${
                      view === 'table'
                        ? 'bg-white dark:bg-slate-950 text-orange-600 dark:text-orange-400 shadow-sm'
                        : 'text-slate-500 dark:text-slate-450 hover:text-slate-800 dark:hover:text-slate-200'
                    }`}
                  >
                    <List className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Table</span>
                  </button>
                </div>

              </div>

            </div>

          </div>

          {/* Interactive Collapsible Drawer Panel */}
          {advancedOpen && (
            <div className="pt-4 border-t border-slate-100 dark:border-slate-850 grid grid-cols-1 md:grid-cols-3 gap-6 animate-in slide-in-from-top duration-300">
              
              {/* Column 1: Industry Category Tags Cloud */}
              <div className="md:col-span-2 space-y-2.5">
                <div className="flex justify-between items-center">
                  <Label className="text-[11px] font-black uppercase tracking-wider text-slate-400">Industry Categories</Label>
                  {categoryFilter !== 'all' && (
                    <button 
                      onClick={() => setCategoryFilter('all')}
                      className="text-[10px] font-black uppercase text-orange-500 hover:underline select-none"
                    >
                      Clear Selection
                    </button>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => setCategoryFilter('all')}
                    className={`h-9 px-3.5 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition-all ${
                      categoryFilter === 'all'
                        ? 'bg-orange-500/10 border-orange-400/50 text-orange-600 dark:text-orange-400 shadow-sm'
                        : 'bg-white dark:bg-slate-950 border-slate-250/70 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-slate-350'
                    }`}
                  >
                    <Filter className="h-3.5 w-3.5 shrink-0" />
                    <span>All Industries</span>
                  </button>
                  {CATEGORIES.map(cat => {
                    const IconComponent = CATEGORY_ICONS[cat] || Globe;
                    const isActive = categoryFilter === cat;
                    return (
                      <button
                        key={cat}
                        onClick={() => setCategoryFilter(isActive ? 'all' : cat)}
                        className={`h-9 px-3.5 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition-all ${
                          isActive
                            ? 'bg-orange-500/10 border-orange-400/50 text-orange-600 dark:text-orange-400 shadow-sm'
                            : 'bg-white dark:bg-slate-950 border-slate-250/70 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-slate-350'
                        }`}
                      >
                        <IconComponent className="h-3.5 w-3.5 shrink-0 text-orange-500/70" />
                        <span className="capitalize">{cat.replace('_', ' ')}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Column 2: Target City Input & Popular Presets */}
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label className="text-[11px] font-black uppercase tracking-wider text-slate-400">Target Location</Label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-450 dark:text-slate-500" />
                    <Input 
                      placeholder="Type target city name..." 
                      value={cityFilter}
                      onChange={(e) => setCityFilter(e.target.value)}
                      className="pl-9 h-10 rounded-xl border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-xs placeholder-slate-400 font-semibold"
                    />
                    {cityFilter && (
                      <button 
                        onClick={() => setCityFilter('')}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-605 dark:hover:text-slate-200"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Popular Location Presets */}
                <div className="space-y-1.5">
                  <Label className="text-[9px] font-black uppercase tracking-wider text-slate-400">Popular Presets</Label>
                  <div className="flex flex-wrap gap-1.5">
                    {['Dhaka', 'Chittagong', 'New York', 'London', 'Dubai'].map(preset => {
                      const isSelected = cityFilter.toLowerCase() === preset.toLowerCase();
                      return (
                        <button
                          key={preset}
                          onClick={() => setCityFilter(isSelected ? '' : preset)}
                          className={`text-[10px] font-bold px-2.5 py-1 rounded-lg border transition-all ${
                            isSelected
                              ? 'bg-orange-500/10 border-orange-400/50 text-orange-600 dark:text-orange-400'
                              : 'bg-slate-50 dark:bg-slate-950 border-slate-200/60 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-100'
                          }`}
                        >
                          {preset}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

            </div>
          )}

          {/* Active Filter Badges Row (Shows under filtration console when filters are dirty) */}
          {(searchQuery || activeFilter !== 'all' || categoryFilter !== 'all' || cityFilter) && (
            <div className="flex items-center justify-between pt-2 border-t border-slate-150/40 dark:border-slate-800/40 flex-wrap gap-2">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Active Tags:</span>
                
                {/* Search query tag */}
                {searchQuery && (
                  <Badge variant="secondary" className="h-6 gap-1 rounded-lg bg-orange-500/5 hover:bg-orange-500/10 text-orange-600 dark:text-orange-400 text-[10px] border border-orange-500/20 px-2 font-bold">
                    <span>Search: "{searchQuery}"</span>
                    <X className="h-3 w-3 cursor-pointer shrink-0" onClick={() => setSearchQuery('')} />
                  </Badge>
                )}

                {/* Pipeline tag */}
                {activeFilter !== 'all' && (
                  <Badge variant="secondary" className="h-6 gap-1 rounded-lg bg-orange-500/5 hover:bg-orange-500/10 text-orange-600 dark:text-orange-400 text-[10px] border border-orange-500/20 px-2 font-bold">
                    <span>Pipeline: {activeFilter.replace('_', ' ')}</span>
                    <X className="h-3 w-3 cursor-pointer shrink-0" onClick={() => setActiveFilter('all')} />
                  </Badge>
                )}

                {/* Category tag */}
                {categoryFilter !== 'all' && (
                  <Badge variant="secondary" className="h-6 gap-1 rounded-lg bg-orange-500/5 hover:bg-orange-500/10 text-orange-600 dark:text-orange-400 text-[10px] border border-orange-500/20 px-2 font-bold capitalize">
                    <span>Category: {categoryFilter.replace('_', ' ')}</span>
                    <X className="h-3 w-3 cursor-pointer shrink-0" onClick={() => setCategoryFilter('all')} />
                  </Badge>
                )}

                {/* City tag */}
                {cityFilter && (
                  <Badge variant="secondary" className="h-6 gap-1 rounded-lg bg-orange-500/5 hover:bg-orange-500/10 text-orange-600 dark:text-orange-400 text-[10px] border border-orange-500/20 px-2 font-bold">
                    <span>City: {cityFilter}</span>
                    <X className="h-3 w-3 cursor-pointer shrink-0" onClick={() => setCityFilter('')} />
                  </Badge>
                )}
              </div>

              {/* Master reset */}
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => {
                  setSearchQuery('');
                  setActiveFilter('all');
                  clearFilters();
                }}
                className="h-7 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-orange-500 transition-colors rounded-lg flex items-center gap-1 p-0.5 hover:bg-transparent"
              >
                <X className="h-3 w-3" />
                <span>Reset All Filters</span>
              </Button>
            </div>
          )}

        </div>

        {/* DATA CONTAINER AREA (With Smooth Animation Wrapper) */}
        <div className="bg-white/40 border border-slate-100/80 rounded-3xl p-1.5 backdrop-blur-sm">
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
        </div>

        {/* Modal Dialog Importer & Add Leads */}
        <LeadImporter open={importerOpen} onOpenChange={setImporterOpen} />
        <AddLeadDialog open={addLeadOpen} onOpenChange={setAddLeadOpen} />

        {/* HIGH-FIDELITY REDESIGNED ANALYTICS INSIGHTS */}
        <Dialog open={showAnalytics} onOpenChange={setShowAnalytics}>
          <DialogContent className="sm:max-w-[425px] rounded-3xl border border-slate-100 shadow-2xl p-6">
            <DialogHeader className="pb-3 border-b border-slate-50">
              <DialogTitle className="font-black text-lg bg-gradient-to-r from-orange-600 to-amber-600 bg-clip-text text-transparent">
                CRM Insights
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-400 font-bold uppercase tracking-wider mt-0.5">
                Live Lead Acquisition Analysis
              </DialogDescription>
            </DialogHeader>
            
            <div className="py-5 space-y-4">
              {sourceData.map((item, idx) => {
                // Generate a vibrant premium gradient color for each source type
                const gradientClass = idx === 0 
                  ? 'bg-gradient-to-r from-orange-500 to-amber-500'
                  : idx === 1
                  ? 'bg-gradient-to-r from-blue-500 to-indigo-500'
                  : idx === 2
                  ? 'bg-gradient-to-r from-violet-500 to-purple-500'
                  : 'bg-gradient-to-r from-emerald-500 to-teal-500';
                  
                return (
                  <div key={item.name} className="space-y-2">
                    <div className="flex justify-between text-xs font-bold text-slate-700">
                      <span className="uppercase tracking-widest text-[10px] text-slate-400">{item.name}</span>
                      <span className="text-slate-800">{item.value}%</span>
                    </div>
                    <div className="h-2.5 bg-slate-50 border border-slate-100 rounded-full overflow-hidden shadow-inner">
                      <div 
                        className={`h-full ${gradientClass} rounded-full transition-all duration-700 ease-out shadow-sm`} 
                        style={{ width: `${item.value}%` }} 
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </DialogContent>
        </Dialog>

      </div>
    </DashboardLayout>
  );
}