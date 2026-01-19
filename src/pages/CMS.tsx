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

  // Form states
  const [portfolioForm, setPortfolioForm] = useState({
    title: '',
    description: '',
    image_url: '',
    project_url: '',
    category: '',
    featured: false,
  });
  const [serviceForm, setServiceForm] = useState({
    name: '',
    description: '',
    icon: '',
    is_active: true,
  });
  const [pricingForm, setPricingForm] = useState({
    name: '',
    description: '',
    price: 0,
    billing_cycle: 'one-time',
    is_popular: false,
    is_active: true,
  });

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
      return data;
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
      return data;
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
      return data;
    },
    enabled: role === 'admin',
  });

  // Mutations
  const addPortfolioMutation = useMutation({
    mutationFn: async (data: typeof portfolioForm) => {
      const { error } = await supabase.from('portfolio').insert({
        ...data,
        created_by: user?.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['portfolio'] });
      toast.success('Portfolio item added');
      setPortfolioDialog(false);
      setPortfolioForm({ title: '', description: '', image_url: '', project_url: '', category: '', featured: false });
    },
    onError: (error) => toast.error('Failed: ' + error.message),
  });

  const addServiceMutation = useMutation({
    mutationFn: async (data: typeof serviceForm) => {
      const { error } = await supabase.from('services').insert({
        ...data,
        created_by: user?.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['services'] });
      toast.success('Service added');
      setServiceDialog(false);
      setServiceForm({ name: '', description: '', icon: '', is_active: true });
    },
    onError: (error) => toast.error('Failed: ' + error.message),
  });

  const addPricingMutation = useMutation({
    mutationFn: async (data: typeof pricingForm) => {
      const { error } = await supabase.from('pricing_tiers').insert({
        ...data,
        created_by: user?.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pricing_tiers'] });
      toast.success('Pricing tier added');
      setPricingDialog(false);
      setPricingForm({ name: '', description: '', price: 0, billing_cycle: 'one-time', is_popular: false, is_active: true });
    },
    onError: (error) => toast.error('Failed: ' + error.message),
  });

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
              <Dialog open={portfolioDialog} onOpenChange={setPortfolioDialog}>
                <DialogTrigger asChild>
                  <Button className="gradient-primary">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Portfolio
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add Portfolio Item</DialogTitle>
                    <DialogDescription>Add a new project to your portfolio.</DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div>
                      <Label>Title</Label>
                      <Input
                        value={portfolioForm.title}
                        onChange={(e) => setPortfolioForm({ ...portfolioForm, title: e.target.value })}
                        placeholder="Project name"
                      />
                    </div>
                    <div>
                      <Label>Description</Label>
                      <Textarea
                        value={portfolioForm.description}
                        onChange={(e) => setPortfolioForm({ ...portfolioForm, description: e.target.value })}
                        placeholder="Brief description"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Image URL</Label>
                        <Input
                          value={portfolioForm.image_url}
                          onChange={(e) => setPortfolioForm({ ...portfolioForm, image_url: e.target.value })}
                          placeholder="https://..."
                        />
                      </div>
                      <div>
                        <Label>Project URL</Label>
                        <Input
                          value={portfolioForm.project_url}
                          onChange={(e) => setPortfolioForm({ ...portfolioForm, project_url: e.target.value })}
                          placeholder="https://..."
                        />
                      </div>
                    </div>
                    <div>
                      <Label>Category</Label>
                      <Input
                        value={portfolioForm.category}
                        onChange={(e) => setPortfolioForm({ ...portfolioForm, category: e.target.value })}
                        placeholder="Web Design, App, etc."
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
                    <Button variant="outline" onClick={() => setPortfolioDialog(false)}>Cancel</Button>
                    <Button
                      className="gradient-primary"
                      onClick={() => addPortfolioMutation.mutate(portfolioForm)}
                      disabled={addPortfolioMutation.isPending || !portfolioForm.title}
                    >
                      {addPortfolioMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                      Add
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
              <Dialog open={serviceDialog} onOpenChange={setServiceDialog}>
                <DialogTrigger asChild>
                  <Button className="gradient-primary">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Service
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add Service</DialogTitle>
                    <DialogDescription>Add a new service listing.</DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div>
                      <Label>Name</Label>
                      <Input
                        value={serviceForm.name}
                        onChange={(e) => setServiceForm({ ...serviceForm, name: e.target.value })}
                        placeholder="Service name"
                      />
                    </div>
                    <div>
                      <Label>Description</Label>
                      <Textarea
                        value={serviceForm.description}
                        onChange={(e) => setServiceForm({ ...serviceForm, description: e.target.value })}
                        placeholder="Service description"
                      />
                    </div>
                    <div>
                      <Label>Icon (Lucide icon name)</Label>
                      <Input
                        value={serviceForm.icon}
                        onChange={(e) => setServiceForm({ ...serviceForm, icon: e.target.value })}
                        placeholder="Globe, Code, Palette, etc."
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
                    <Button variant="outline" onClick={() => setServiceDialog(false)}>Cancel</Button>
                    <Button
                      className="gradient-primary"
                      onClick={() => addServiceMutation.mutate(serviceForm)}
                      disabled={addServiceMutation.isPending || !serviceForm.name}
                    >
                      {addServiceMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                      Add
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
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
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
              <Dialog open={pricingDialog} onOpenChange={setPricingDialog}>
                <DialogTrigger asChild>
                  <Button className="gradient-primary">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Pricing
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add Pricing Tier</DialogTitle>
                    <DialogDescription>Add a new pricing package.</DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div>
                      <Label>Name</Label>
                      <Input
                        value={pricingForm.name}
                        onChange={(e) => setPricingForm({ ...pricingForm, name: e.target.value })}
                        placeholder="Basic, Pro, Enterprise"
                      />
                    </div>
                    <div>
                      <Label>Description</Label>
                      <Textarea
                        value={pricingForm.description}
                        onChange={(e) => setPricingForm({ ...pricingForm, description: e.target.value })}
                        placeholder="Package description"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Price ($)</Label>
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
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={pricingForm.is_popular}
                          onCheckedChange={(v) => setPricingForm({ ...pricingForm, is_popular: v })}
                        />
                        <Label>Popular</Label>
                      </div>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={pricingForm.is_active}
                          onCheckedChange={(v) => setPricingForm({ ...pricingForm, is_active: v })}
                        />
                        <Label>Active</Label>
                      </div>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setPricingDialog(false)}>Cancel</Button>
                    <Button
                      className="gradient-primary"
                      onClick={() => addPricingMutation.mutate(pricingForm)}
                      disabled={addPricingMutation.isPending || !pricingForm.name}
                    >
                      {addPricingMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                      Add
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
                  <Card key={item.id} className={`glass-card group ${item.is_popular ? 'ring-2 ring-primary' : ''}`}>
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between">
                        <div>
                          <CardTitle className="text-base flex items-center gap-2">
                            {item.name}
                            {item.is_popular && <Badge className="bg-primary">Popular</Badge>}
                          </CardTitle>
                          <p className="text-2xl font-bold mt-2">
                            ${Number(item.price).toLocaleString()}
                            <span className="text-sm font-normal text-muted-foreground">/{item.billing_cycle}</span>
                          </p>
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
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
                      <p className="text-sm text-muted-foreground line-clamp-2">{item.description}</p>
                      <div className="mt-2 flex items-center gap-1">
                        {item.is_active ? (
                          <Badge variant="secondary" className="text-green-600">Active</Badge>
                        ) : (
                          <Badge variant="secondary" className="text-muted-foreground">Inactive</Badge>
                        )}
                      </div>
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
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteItem && deleteMutation.mutate({ type: deleteItem.type, id: deleteItem.id })}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}
