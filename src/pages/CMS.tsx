import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Briefcase,
  Package,
  DollarSign,
  Plus,
  MoreVertical,
  Edit,
  Trash2,
  Shield,
  Loader2,
  Star,
  Eye,
  EyeOff,
} from 'lucide-react';

// Types
interface PortfolioItem {
  id: string;
  title: string;
  description: string | null;
  image_url: string | null;
  project_url: string | null;
  category: string | null;
  featured: boolean | null;
  thumbnail: string | null;
  challenge: string | null;
  solution: string | null;
  tech_stack: string[] | null;
  results: Record<string, unknown>[] | null;
  display_order: number | null;
}

interface ServiceItem {
  id: string;
  name: string;
  description: string | null;
  short_description: string | null;
  icon: string | null;
  features: string[] | null;
  is_active: boolean | null;
  display_order: number | null;
}

interface PricingItem {
  id: string;
  tier_id: string | null;
  name: string;
  description: string | null;
  price: number;
  billing_cycle: string | null;
  features: string[] | null;
  is_popular: boolean | null;
  is_active: boolean | null;
  cta: string | null;
  highlighted: boolean | null;
  display_order: number | null;
}

export default function CMS() {
  const navigate = useNavigate();
  const { role, loading: authLoading, user } = useAuth();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('portfolio');

  // Dialog states
  const [portfolioDialog, setPortfolioDialog] = useState(false);
  const [serviceDialog, setServiceDialog] = useState(false);
  const [pricingDialog, setPricingDialog] = useState(false);
  const [deleteItem, setDeleteItem] = useState<{ type: 'portfolio' | 'services' | 'pricing_tiers'; id: string; name: string } | null>(null);

  // Edit states
  const [editingPortfolio, setEditingPortfolio] = useState<PortfolioItem | null>(null);
  const [editingService, setEditingService] = useState<ServiceItem | null>(null);
  const [editingPricing, setEditingPricing] = useState<PricingItem | null>(null);

  // Form states
  const [portfolioForm, setPortfolioForm] = useState({
    title: '',
    description: '',
    image_url: '',
    project_url: '',
    category: '',
    featured: false,
    thumbnail: '',
    challenge: '',
    solution: '',
    tech_stack: '',
    results: '',
  });

  const [serviceForm, setServiceForm] = useState({
    name: '',
    description: '',
    short_description: '',
    icon: '',
    features: '',
    is_active: true,
  });

  const [pricingForm, setPricingForm] = useState({
    tier_id: '',
    name: '',
    description: '',
    price: 0,
    billing_cycle: 'one-time',
    features: '',
    is_popular: false,
    is_active: true,
    cta: 'Start Project',
    highlighted: false,
  });

  // Reset forms
  const resetPortfolioForm = () => {
    setPortfolioForm({
      title: '', description: '', image_url: '', project_url: '',
      category: '', featured: false, thumbnail: '', challenge: '',
      solution: '', tech_stack: '', results: '',
    });
    setEditingPortfolio(null);
  };

  const resetServiceForm = () => {
    setServiceForm({
      name: '', description: '', short_description: '', icon: '', features: '', is_active: true,
    });
    setEditingService(null);
  };

  const resetPricingForm = () => {
    setPricingForm({
      tier_id: '', name: '', description: '', price: 0,
      billing_cycle: 'one-time', features: '', is_popular: false,
      is_active: true, cta: 'Start Project', highlighted: false,
    });
    setEditingPricing(null);
  };

  // Open edit dialogs
  const openEditPortfolio = (item: PortfolioItem) => {
    setEditingPortfolio(item);
    setPortfolioForm({
      title: item.title || '',
      description: item.description || '',
      image_url: item.image_url || '',
      project_url: item.project_url || '',
      category: item.category || '',
      featured: item.featured || false,
      thumbnail: item.thumbnail || '',
      challenge: item.challenge || '',
      solution: item.solution || '',
      tech_stack: item.tech_stack?.join(', ') || '',
      results: item.results ? JSON.stringify(item.results, null, 2) : '',
    });
    setPortfolioDialog(true);
  };

  const openEditService = (item: ServiceItem) => {
    setEditingService(item);
    setServiceForm({
      name: item.name || '',
      description: item.description || '',
      short_description: item.short_description || '',
      icon: item.icon || '',
      features: item.features?.join('\n') || '',
      is_active: item.is_active ?? true,
    });
    setServiceDialog(true);
  };

  const openEditPricing = (item: PricingItem) => {
    setEditingPricing(item);
    setPricingForm({
      tier_id: item.tier_id || '',
      name: item.name || '',
      description: item.description || '',
      price: item.price || 0,
      billing_cycle: item.billing_cycle || 'one-time',
      features: item.features?.join('\n') || '',
      is_popular: item.is_popular || false,
      is_active: item.is_active ?? true,
      cta: item.cta || 'Start Project',
      highlighted: item.highlighted || false,
    });
    setPricingDialog(true);
  };

  // Redirect non-admins
  useEffect(() => {
    if (!authLoading && role !== 'admin') {
      toast.error('Access denied. Only admins can manage CMS.');
      navigate('/dashboard');
    }
  }, [role, authLoading, navigate]);

  // Fetch portfolio
  const { data: portfolio = [], isLoading: portfolioLoading } = useQuery({
    queryKey: ['portfolio'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('portfolio')
        .select('*')
        .order('display_order', { ascending: true });
      if (error) throw error;
      return data as PortfolioItem[];
    },
    enabled: role === 'admin',
  });

  // Fetch services
  const { data: services = [], isLoading: servicesLoading } = useQuery({
    queryKey: ['services'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('services')
        .select('*')
        .order('display_order', { ascending: true });
      if (error) throw error;
      return data as ServiceItem[];
    },
    enabled: role === 'admin',
  });

  // Fetch pricing tiers
  const { data: pricing = [], isLoading: pricingLoading } = useQuery({
    queryKey: ['pricing_tiers'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pricing_tiers')
        .select('*')
        .order('display_order', { ascending: true });
      if (error) throw error;
      return data as PricingItem[];
    },
    enabled: role === 'admin',
  });

  // Portfolio mutations
  const portfolioMutation = useMutation({
    mutationFn: async (data: typeof portfolioForm & { id?: string }) => {
      const techStackArray = data.tech_stack ? data.tech_stack.split(',').map(s => s.trim()).filter(Boolean) : null;
      let resultsJson = null;
      if (data.results) {
        try {
          resultsJson = JSON.parse(data.results);
        } catch {
          throw new Error('Invalid JSON in results field');
        }
      }

      const payload = {
        title: data.title,
        description: data.description || null,
        image_url: data.image_url || null,
        project_url: data.project_url || null,
        category: data.category || null,
        featured: data.featured,
        thumbnail: data.thumbnail || null,
        challenge: data.challenge || null,
        solution: data.solution || null,
        tech_stack: techStackArray,
        results: resultsJson,
      };

      if (data.id) {
        const { error } = await supabase.from('portfolio').update(payload).eq('id', data.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('portfolio').insert({ ...payload, created_by: user?.id });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['portfolio'] });
      toast.success(editingPortfolio ? 'Portfolio item updated' : 'Portfolio item added');
      setPortfolioDialog(false);
      resetPortfolioForm();
    },
    onError: (error) => toast.error('Failed: ' + error.message),
  });

  // Service mutations
  const serviceMutation = useMutation({
    mutationFn: async (data: typeof serviceForm & { id?: string }) => {
      const featuresArray = data.features ? data.features.split('\n').map(s => s.trim()).filter(Boolean) : null;

      const payload = {
        name: data.name,
        description: data.description || null,
        short_description: data.short_description || null,
        icon: data.icon || null,
        features: featuresArray,
        is_active: data.is_active,
      };

      if (data.id) {
        const { error } = await supabase.from('services').update(payload).eq('id', data.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('services').insert({ ...payload, created_by: user?.id });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['services'] });
      toast.success(editingService ? 'Service updated' : 'Service added');
      setServiceDialog(false);
      resetServiceForm();
    },
    onError: (error) => toast.error('Failed: ' + error.message),
  });

  // Pricing mutations
  const pricingMutation = useMutation({
    mutationFn: async (data: typeof pricingForm & { id?: string }) => {
      const featuresArray = data.features ? data.features.split('\n').map(s => s.trim()).filter(Boolean) : null;

      const payload = {
        tier_id: data.tier_id || null,
        name: data.name,
        description: data.description || null,
        price: data.price,
        billing_cycle: data.billing_cycle,
        features: featuresArray,
        is_popular: data.is_popular,
        is_active: data.is_active,
        cta: data.cta || 'Start Project',
        highlighted: data.highlighted,
      };

      if (data.id) {
        const { error } = await supabase.from('pricing_tiers').update(payload).eq('id', data.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('pricing_tiers').insert({ ...payload, created_by: user?.id });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pricing_tiers'] });
      toast.success(editingPricing ? 'Pricing tier updated' : 'Pricing tier added');
      setPricingDialog(false);
      resetPricingForm();
    },
    onError: (error) => toast.error('Failed: ' + error.message),
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async ({ type, id }: { type: 'portfolio' | 'services' | 'pricing_tiers'; id: string }) => {
      const { error } = await supabase.from(type).delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [deleteItem?.type] });
      toast.success('Item deleted');
      setDeleteItem(null);
    },
    onError: (error) => toast.error('Failed: ' + error.message),
  });

  if (authLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  if (role !== 'admin') {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center h-64 text-center">
          <Shield className="h-16 w-16 text-muted-foreground mb-4" />
          <h2 className="text-xl font-semibold mb-2">Access Denied</h2>
          <p className="text-muted-foreground">Only administrators can manage CMS content.</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">CMS Content</h1>
          <p className="text-muted-foreground mt-1">Manage website content: portfolio, services, and pricing.</p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="portfolio" className="flex items-center gap-2">
              <Briefcase className="h-4 w-4" />
              Portfolio
            </TabsTrigger>
            <TabsTrigger value="services" className="flex items-center gap-2">
              <Package className="h-4 w-4" />
              Services
            </TabsTrigger>
            <TabsTrigger value="pricing" className="flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              Pricing
            </TabsTrigger>
          </TabsList>

          {/* Portfolio Tab */}
          <TabsContent value="portfolio" className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-semibold">Portfolio Items ({portfolio.length})</h2>
              <Dialog open={portfolioDialog} onOpenChange={(open) => {
                setPortfolioDialog(open);
                if (!open) resetPortfolioForm();
              }}>
                <DialogTrigger asChild>
                  <Button className="gradient-primary">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Portfolio
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>{editingPortfolio ? 'Edit Portfolio Item' : 'Add Portfolio Item'}</DialogTitle>
                    <DialogDescription>
                      {editingPortfolio ? 'Update portfolio details.' : 'Add a new project to your portfolio.'}
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Title *</Label>
                        <Input
                          value={portfolioForm.title}
                          onChange={(e) => setPortfolioForm({ ...portfolioForm, title: e.target.value })}
                          placeholder="Project name"
                        />
                      </div>
                      <div>
                        <Label>Category</Label>
                        <Input
                          value={portfolioForm.category}
                          onChange={(e) => setPortfolioForm({ ...portfolioForm, category: e.target.value })}
                          placeholder="Web Design, App, etc."
                        />
                      </div>
                    </div>
                    <div>
                      <Label>Description</Label>
                      <Textarea
                        value={portfolioForm.description}
                        onChange={(e) => setPortfolioForm({ ...portfolioForm, description: e.target.value })}
                        placeholder="Brief project description"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Thumbnail URL</Label>
                        <Input
                          value={portfolioForm.thumbnail}
                          onChange={(e) => setPortfolioForm({ ...portfolioForm, thumbnail: e.target.value })}
                          placeholder="https://..."
                        />
                      </div>
                      <div>
                        <Label>Image URL</Label>
                        <Input
                          value={portfolioForm.image_url}
                          onChange={(e) => setPortfolioForm({ ...portfolioForm, image_url: e.target.value })}
                          placeholder="https://..."
                        />
                      </div>
                    </div>
                    <div>
                      <Label>Project URL</Label>
                      <Input
                        value={portfolioForm.project_url}
                        onChange={(e) => setPortfolioForm({ ...portfolioForm, project_url: e.target.value })}
                        placeholder="https://..."
                      />
                    </div>
                    <div>
                      <Label>Challenge</Label>
                      <Textarea
                        value={portfolioForm.challenge}
                        onChange={(e) => setPortfolioForm({ ...portfolioForm, challenge: e.target.value })}
                        placeholder="Describe the challenge/problem"
                      />
                    </div>
                    <div>
                      <Label>Solution</Label>
                      <Textarea
                        value={portfolioForm.solution}
                        onChange={(e) => setPortfolioForm({ ...portfolioForm, solution: e.target.value })}
                        placeholder="Describe the solution implemented"
                      />
                    </div>
                    <div>
                      <Label>Tech Stack (comma-separated)</Label>
                      <Input
                        value={portfolioForm.tech_stack}
                        onChange={(e) => setPortfolioForm({ ...portfolioForm, tech_stack: e.target.value })}
                        placeholder="React, Node.js, PostgreSQL"
                      />
                    </div>
                    <div>
                      <Label>Results (JSON array)</Label>
                      <Textarea
                        value={portfolioForm.results}
                        onChange={(e) => setPortfolioForm({ ...portfolioForm, results: e.target.value })}
                        placeholder='[{"metric": "Conversion Rate", "value": "+40%"}]'
                        className="font-mono text-sm"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={portfolioForm.featured}
                        onCheckedChange={(v) => setPortfolioForm({ ...portfolioForm, featured: v })}
                      />
                      <Label>Featured</Label>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => { setPortfolioDialog(false); resetPortfolioForm(); }}>Cancel</Button>
                    <Button
                      className="gradient-primary"
                      onClick={() => portfolioMutation.mutate({ ...portfolioForm, id: editingPortfolio?.id })}
                      disabled={portfolioMutation.isPending || !portfolioForm.title}
                    >
                      {portfolioMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                      {editingPortfolio ? 'Update' : 'Add'}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {portfolioLoading ? (
                <div className="col-span-full flex justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : portfolio.length === 0 ? (
                <Card className="col-span-full">
                  <CardContent className="py-8 text-center text-muted-foreground">
                    No portfolio items yet.
                  </CardContent>
                </Card>
              ) : (
                portfolio.map((item) => (
                  <Card key={item.id} className="glass-card group">
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between">
                        <div>
                          <CardTitle className="text-base flex items-center gap-2">
                            {item.title}
                            {item.featured && <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />}
                          </CardTitle>
                          {item.category && (
                            <Badge variant="secondary" className="mt-1">{item.category}</Badge>
                          )}
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openEditPortfolio(item)}>
                              <Edit className="h-4 w-4 mr-2" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => setDeleteItem({ type: 'portfolio', id: item.id, name: item.title })}
                              className="text-destructive"
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground line-clamp-2">{item.description}</p>
                      {item.tech_stack && item.tech_stack.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {item.tech_stack.slice(0, 3).map((tech, i) => (
                            <Badge key={i} variant="outline" className="text-xs">{tech}</Badge>
                          ))}
                          {item.tech_stack.length > 3 && (
                            <Badge variant="outline" className="text-xs">+{item.tech_stack.length - 3}</Badge>
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </TabsContent>

          {/* Services Tab */}
          <TabsContent value="services" className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-semibold">Services ({services.length})</h2>
              <Dialog open={serviceDialog} onOpenChange={(open) => {
                setServiceDialog(open);
                if (!open) resetServiceForm();
              }}>
                <DialogTrigger asChild>
                  <Button className="gradient-primary">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Service
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-xl">
                  <DialogHeader>
                    <DialogTitle>{editingService ? 'Edit Service' : 'Add Service'}</DialogTitle>
                    <DialogDescription>
                      {editingService ? 'Update service details.' : 'Add a new service listing.'}
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Name *</Label>
                        <Input
                          value={serviceForm.name}
                          onChange={(e) => setServiceForm({ ...serviceForm, name: e.target.value })}
                          placeholder="Service name"
                        />
                      </div>
                      <div>
                        <Label>Icon (Lucide name)</Label>
                        <Input
                          value={serviceForm.icon}
                          onChange={(e) => setServiceForm({ ...serviceForm, icon: e.target.value })}
                          placeholder="Code, Globe, etc."
                        />
                      </div>
                    </div>
                    <div>
                      <Label>Short Description</Label>
                      <Input
                        value={serviceForm.short_description}
                        onChange={(e) => setServiceForm({ ...serviceForm, short_description: e.target.value })}
                        placeholder="Brief tagline"
                      />
                    </div>
                    <div>
                      <Label>Full Description</Label>
                      <Textarea
                        value={serviceForm.description}
                        onChange={(e) => setServiceForm({ ...serviceForm, description: e.target.value })}
                        placeholder="Detailed service description"
                      />
                    </div>
                    <div>
                      <Label>Features (one per line)</Label>
                      <Textarea
                        value={serviceForm.features}
                        onChange={(e) => setServiceForm({ ...serviceForm, features: e.target.value })}
                        placeholder="React & Next.js&#10;Node.js Backend&#10;API Development"
                        rows={4}
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={serviceForm.is_active}
                        onCheckedChange={(v) => setServiceForm({ ...serviceForm, is_active: v })}
                      />
                      <Label>Active</Label>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => { setServiceDialog(false); resetServiceForm(); }}>Cancel</Button>
                    <Button
                      className="gradient-primary"
                      onClick={() => serviceMutation.mutate({ ...serviceForm, id: editingService?.id })}
                      disabled={serviceMutation.isPending || !serviceForm.name}
                    >
                      {serviceMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                      {editingService ? 'Update' : 'Add'}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {servicesLoading ? (
                <div className="col-span-full flex justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : services.length === 0 ? (
                <Card className="col-span-full">
                  <CardContent className="py-8 text-center text-muted-foreground">
                    No services yet.
                  </CardContent>
                </Card>
              ) : (
                services.map((item) => (
                  <Card key={item.id} className="glass-card group">
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between">
                        <div>
                          <CardTitle className="text-base flex items-center gap-2">
                            {item.name}
                            {item.is_active ? (
                              <Eye className="h-4 w-4 text-green-500" />
                            ) : (
                              <EyeOff className="h-4 w-4 text-muted-foreground" />
                            )}
                          </CardTitle>
                          {item.short_description && (
                            <p className="text-xs text-muted-foreground mt-1">{item.short_description}</p>
                          )}
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openEditService(item)}>
                              <Edit className="h-4 w-4 mr-2" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => setDeleteItem({ type: 'services', id: item.id, name: item.name })}
                              className="text-destructive"
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground line-clamp-2">{item.description}</p>
                      {item.features && item.features.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {item.features.slice(0, 3).map((f, i) => (
                            <Badge key={i} variant="outline" className="text-xs">{f}</Badge>
                          ))}
                          {item.features.length > 3 && (
                            <Badge variant="outline" className="text-xs">+{item.features.length - 3}</Badge>
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </TabsContent>

          {/* Pricing Tab */}
          <TabsContent value="pricing" className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-semibold">Pricing Tiers ({pricing.length})</h2>
              <Dialog open={pricingDialog} onOpenChange={(open) => {
                setPricingDialog(open);
                if (!open) resetPricingForm();
              }}>
                <DialogTrigger asChild>
                  <Button className="gradient-primary">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Pricing Tier
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>{editingPricing ? 'Edit Pricing Tier' : 'Add Pricing Tier'}</DialogTitle>
                    <DialogDescription>
                      {editingPricing ? 'Update pricing tier details.' : 'Add a new pricing tier.'}
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Tier ID</Label>
                        <Input
                          value={pricingForm.tier_id}
                          onChange={(e) => setPricingForm({ ...pricingForm, tier_id: e.target.value })}
                          placeholder="starter, corporate, etc."
                        />
                      </div>
                      <div>
                        <Label>Name *</Label>
                        <Input
                          value={pricingForm.name}
                          onChange={(e) => setPricingForm({ ...pricingForm, name: e.target.value })}
                          placeholder="The Starter"
                        />
                      </div>
                    </div>
                    <div>
                      <Label>Description</Label>
                      <Textarea
                        value={pricingForm.description}
                        onChange={(e) => setPricingForm({ ...pricingForm, description: e.target.value })}
                        placeholder="For Personal Portfolios, Small F-Commerce..."
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Price</Label>
                        <Input
                          type="number"
                          value={pricingForm.price}
                          onChange={(e) => setPricingForm({ ...pricingForm, price: Number(e.target.value) })}
                        />
                      </div>
                      <div>
                        <Label>Billing Cycle</Label>
                        <Input
                          value={pricingForm.billing_cycle}
                          onChange={(e) => setPricingForm({ ...pricingForm, billing_cycle: e.target.value })}
                          placeholder="one-time, monthly, yearly"
                        />
                      </div>
                    </div>
                    <div>
                      <Label>CTA Button Text</Label>
                      <Input
                        value={pricingForm.cta}
                        onChange={(e) => setPricingForm({ ...pricingForm, cta: e.target.value })}
                        placeholder="Start Project"
                      />
                    </div>
                    <div>
                      <Label>Features (one per line)</Label>
                      <Textarea
                        value={pricingForm.features}
                        onChange={(e) => setPricingForm({ ...pricingForm, features: e.target.value })}
                        placeholder="1 Page (Long Scroll) & Hero Section&#10;Gallery/Portfolio & Contact Form"
                        rows={5}
                      />
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={pricingForm.is_popular}
                          onCheckedChange={(v) => setPricingForm({ ...pricingForm, is_popular: v })}
                        />
                        <Label className="text-sm">Popular</Label>
                      </div>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={pricingForm.highlighted}
                          onCheckedChange={(v) => setPricingForm({ ...pricingForm, highlighted: v })}
                        />
                        <Label className="text-sm">Highlighted</Label>
                      </div>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={pricingForm.is_active}
                          onCheckedChange={(v) => setPricingForm({ ...pricingForm, is_active: v })}
                        />
                        <Label className="text-sm">Active</Label>
                      </div>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => { setPricingDialog(false); resetPricingForm(); }}>Cancel</Button>
                    <Button
                      className="gradient-primary"
                      onClick={() => pricingMutation.mutate({ ...pricingForm, id: editingPricing?.id })}
                      disabled={pricingMutation.isPending || !pricingForm.name}
                    >
                      {pricingMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                      {editingPricing ? 'Update' : 'Add'}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {pricingLoading ? (
                <div className="col-span-full flex justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : pricing.length === 0 ? (
                <Card className="col-span-full">
                  <CardContent className="py-8 text-center text-muted-foreground">
                    No pricing tiers yet.
                  </CardContent>
                </Card>
              ) : (
                pricing.map((item) => (
                  <Card key={item.id} className={`glass-card group ${item.highlighted ? 'ring-2 ring-primary' : ''}`}>
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between">
                        <div>
                          <CardTitle className="text-base flex items-center gap-2">
                            {item.name}
                            {item.is_popular && <Badge className="bg-primary text-primary-foreground text-xs">Popular</Badge>}
                          </CardTitle>
                          <div className="text-2xl font-bold mt-1">
                            ৳{item.price.toLocaleString()}
                            {item.billing_cycle !== 'one-time' && (
                              <span className="text-sm font-normal text-muted-foreground">/{item.billing_cycle}</span>
                            )}
                          </div>
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openEditPricing(item)}>
                              <Edit className="h-4 w-4 mr-2" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => setDeleteItem({ type: 'pricing_tiers', id: item.id, name: item.name })}
                              className="text-destructive"
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground line-clamp-2 mb-2">{item.description}</p>
                      {item.features && item.features.length > 0 && (
                        <ul className="text-xs text-muted-foreground space-y-1">
                          {item.features.slice(0, 3).map((f, i) => (
                            <li key={i} className="flex items-center gap-1">
                              <span className="w-1 h-1 rounded-full bg-primary" />
                              {f}
                            </li>
                          ))}
                          {item.features.length > 3 && (
                            <li className="text-primary">+{item.features.length - 3} more features</li>
                          )}
                        </ul>
                      )}
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteItem} onOpenChange={(open) => !open && setDeleteItem(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {deleteItem?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete this item.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteItem && deleteMutation.mutate({ type: deleteItem.type, id: deleteItem.id })}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}
