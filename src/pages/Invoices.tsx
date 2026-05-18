/* eslint-disable @typescript-eslint/ban-ts-comment */
/* eslint-disable @typescript-eslint/no-explicit-any */
// @ts-ignore
import logo from '../assets/techwisdom.png';
import html2pdf from 'html2pdf.js';
import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { formatCurrency } from '@/lib/currency';
import { format, addDays, parseISO } from 'date-fns';
import { useReactToPrint } from 'react-to-print';
import { 
  FileText, Plus, Search, Printer, DollarSign, 
  MoreVertical, Trash2, AlertCircle, RefreshCw, Download, Hexagon,
  CheckCircle2, Wallet, Coins, ArrowUpRight, Clock
} from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from '@/components/ui/dialog';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select';
import { toast } from 'sonner';
import { useNotifications } from '@/hooks/useNotifications';

// --- TYPES ---
type InvoiceStatus = 'draft' | 'pending' | 'partially_paid' | 'paid' | 'overdue' | 'cancelled';

interface InvoiceItem {
  description: string;
  quantity: number;
  price: number;
}

interface Invoice {
  id: string;
  invoice_number: string;
  client_name: string;
  total_amount: number;
  paid_amount: number;
  status: InvoiceStatus;
  due_date: string;
  issue_date: string;
  items: InvoiceItem[];
  notes?: string;
  created_at: string;
}

export default function Invoices() {
  const queryClient = useQueryClient();
  const { sendNotification } = useNotifications();
  
  // States
  const [createOpen, setCreateOpen] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  
  // Selection
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [paymentAmount, setPaymentAmount] = useState<string>('');
  const [newStatus, setNewStatus] = useState<InvoiceStatus>('pending');

  // Creation Form State
  const [newItem, setNewItem] = useState<InvoiceItem>({ description: '', quantity: 1, price: 0 });
  const [formItems, setFormItems] = useState<InvoiceItem[]>([]);
  const [formData, setFormData] = useState({
    client_name: '',
    due_date: format(addDays(new Date(), 7), 'yyyy-MM-dd'),
    notes: '',
    status: 'pending' as InvoiceStatus
  });

  // --- PRINT & DOWNLOAD LOGIC ---
  const printRef = useRef<HTMLDivElement>(null);
  
  const handlePrint = useReactToPrint({
    content: () => printRef.current,
    documentTitle: selectedInvoice ? `Invoice-${selectedInvoice.invoice_number}` : 'Invoice',
  } as any);

  const handleDownload = () => {
    const element = printRef.current;
    const opt = {
      margin: 0,
      filename: selectedInvoice ? `Invoice-${selectedInvoice.invoice_number}.pdf` : 'invoice.pdf',
      image: { type: 'jpeg' as const, quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true },
      jsPDF: { unit: 'mm', format: 'a4' as const, orientation: 'portrait' as const }
    };
    html2pdf().set(opt).from(element).save();
    toast.success("Downloading Invoice PDF...");
  };

  // --- 1. FETCH INVOICES ---
  const { data: invoices = [], isLoading } = useQuery({
    queryKey: ['invoices'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('invoices' as any)
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return (data as any) as Invoice[];
    }
  });

  // --- 2. AUTOMATION ---
  const generateRecurringMutation = useMutation({
    mutationFn: async () => {
      setIsGenerating(true);
      const { error } = await supabase.rpc('generate_due_maintenance_invoices' as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      setIsGenerating(false);
      toast.success("Checked & Generated due invoices!");
    },
    onError: (err) => {
      setIsGenerating(false);
      toast.error(err.message);
    }
  });

  // --- 3. CREATE MANUAL INVOICE ---
  const createMutation = useMutation({
    mutationFn: async () => {
      const total = formItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
      const { error } = await supabase.from('invoices' as any).insert({
        client_name: formData.client_name,
        due_date: formData.due_date,
        total_amount: total,
        paid_amount: formData.status === 'paid' ? total : 0,
        items: formItems,
        notes: formData.notes,
        status: formData.status
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      setCreateOpen(false);
      setFormItems([]);
      setFormData({ client_name: '', due_date: format(addDays(new Date(), 7), 'yyyy-MM-dd'), notes: '', status: 'pending' });
      toast.success("Invoice created successfully");
      try {
        sendNotification({
          targetRoles: ['admin'],
          title: 'New Invoice Created',
          message: `An invoice for ${formData.client_name || 'a client'} was created.`,
          type: 'info',
          actionLink: '/invoices'
        });
      } catch (e) {
        console.error('Invoice notification failed:', e);
      }
    },
    onError: (err) => toast.error(err.message)
  });

  // --- 4. UPDATE PAYMENT & STATUS ---
  const paymentMutation = useMutation({
    mutationFn: async () => {
      if (!selectedInvoice) return;
      const pay = Number(paymentAmount);
      const currentPaid = Number(selectedInvoice.paid_amount) || 0;
      const newPaidTotal = currentPaid + pay;
      
      const { error } = await supabase
        .from('invoices' as any)
        .update({ 
          paid_amount: newPaidTotal,
          status: newStatus 
        })
        .eq('id', selectedInvoice.id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      setPaymentOpen(false);
      setPaymentAmount('');
      toast.success("Invoice updated successfully!");
      try {
        // Notify admins about payment update
        sendNotification({
          targetRoles: ['admin'],
          title: 'Invoice Payment Recorded',
          message: `Payment recorded for invoice ${selectedInvoice?.invoice_number || ''}.`,
          type: 'success',
          actionLink: '/invoices'
        });
      } catch (e) {
        console.error('Payment notification failed:', e);
      }
    },
    onError: (err) => toast.error(err.message)
  });

  // --- 5. DELETE ---
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await supabase.from('invoices' as any).delete().eq('id', id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      toast.success("Invoice deleted successfully");
    }
  });

  // --- UI HELPERS ---
  const addItem = () => {
    if (!newItem.description || newItem.price <= 0) return;
    setFormItems([...formItems, newItem]);
    setNewItem({ description: '', quantity: 1, price: 0 });
  };

  const openPaymentDialog = (inv: Invoice) => {
    setSelectedInvoice(inv);
    setNewStatus(inv.status);
    setPaymentAmount('');
    setPaymentOpen(true);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid': return 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20';
      case 'partially_paid': return 'bg-blue-500/10 text-blue-600 border-blue-500/20';
      case 'overdue': return 'bg-rose-500/10 text-rose-600 border-rose-500/20';
      case 'pending': return 'bg-amber-500/10 text-amber-600 border-amber-500/20';
      default: return 'bg-slate-500/10 text-slate-600 border-slate-500/20';
    }
  };

  const filteredInvoices = invoices.filter(inv => 
    inv.client_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    inv.invoice_number?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const totalOutstanding = invoices.reduce((sum, inv) => {
    if (inv.status === 'paid') return sum;
    return sum + (Number(inv.total_amount) - Number(inv.paid_amount || 0));
  }, 0);

  const totalPaidRevenue = invoices.reduce((sum, inv) => {
    return sum + Number(inv.paid_amount || 0);
  }, 0);

  return (
    <DashboardLayout>
      <div className="space-y-8 animate-fade-in max-w-6xl mx-auto pb-16">
        
        {/* --- HEADER --- */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-border/40">
          <div>
            <h1 className="text-3xl font-extrabold flex items-center gap-2.5 tracking-tight text-slate-800 dark:text-slate-100">
              <div className="p-2 rounded-xl bg-primary/10 text-primary">
                <FileText className="h-6 w-6" />
              </div>
              Invoices Manager
            </h1>
            <p className="text-muted-foreground mt-1.5 text-sm">Issue, track, and process client billing and payment transactions.</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="outline" className="rounded-xl" onClick={() => generateRecurringMutation.mutate()} disabled={isGenerating}>
              <RefreshCw className={`h-4 w-4 mr-2 text-primary ${isGenerating ? 'animate-spin' : ''}`} />
              {isGenerating ? 'Checking...' : 'Run Auto-Billing'}
            </Button>
            <Button className="gradient-primary rounded-xl shadow-md" onClick={() => setCreateOpen(true)}>
              <Plus className="h-5 w-5 mr-2" /> Manual Invoice
            </Button>
          </div>
        </div>

        {/* --- KPI ANALYTICS ROW --- */}
        <div className="grid gap-4 grid-cols-1 md:grid-cols-3">
          <Card className="relative overflow-hidden bg-rose-500/5 dark:bg-rose-500/5 border border-rose-500/15 rounded-2xl shadow-sm p-5">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-[10px] font-extrabold text-rose-600 uppercase tracking-widest">Total Outstanding</p>
                <div className="text-2xl font-black text-rose-700 dark:text-rose-400">{formatCurrency(totalOutstanding)}</div>
                <p className="text-[10px] text-muted-foreground">Cumulative client unpaid invoices</p>
              </div>
              <div className="p-3 rounded-2xl bg-rose-500/10 text-rose-600">
                <AlertCircle className="h-5 w-5" />
              </div>
            </div>
          </Card>

          <Card className="relative overflow-hidden bg-emerald-500/5 dark:bg-emerald-500/5 border border-emerald-500/15 rounded-2xl shadow-sm p-5">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-[10px] font-extrabold text-emerald-600 uppercase tracking-widest">Revenue Collected</p>
                <div className="text-2xl font-black text-emerald-700 dark:text-emerald-400">{formatCurrency(totalPaidRevenue)}</div>
                <p className="text-[10px] text-muted-foreground">Total cash deposits captured</p>
              </div>
              <div className="p-3 rounded-2xl bg-emerald-500/10 text-emerald-600">
                <CheckCircle2 className="h-5 w-5" />
              </div>
            </div>
          </Card>

          <Card className="relative overflow-hidden bg-primary/5 border border-primary/10 rounded-2xl shadow-sm p-5">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-[10px] font-extrabold text-primary uppercase tracking-widest">Billing Records</p>
                <div className="text-2xl font-black text-slate-800 dark:text-slate-100">{invoices.length}</div>
                <p className="text-[10px] text-muted-foreground">Total system generated invoices</p>
              </div>
              <div className="p-3 rounded-2xl bg-primary/10 text-primary">
                <Coins className="h-5 w-5" />
              </div>
            </div>
          </Card>
        </div>

        {/* --- SEARCH BAR --- */}
        <div className="relative max-w-lg">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground/60" />
          <Input 
            placeholder="Search by client, ID number, or billing status..." 
            className="pl-10 rounded-xl border-border/60 bg-card/60 backdrop-blur shadow-sm"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {/* --- INVOICE LEDGER CONTAINER --- */}
        <div className="space-y-3">
          {isLoading ? (
            <div className="text-center py-20 text-xs text-muted-foreground">
              <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2 opacity-60" />
              Loading client invoices...
            </div>
          ) : filteredInvoices.length === 0 ? (
            <Card className="glass-card bg-card/65 dark:bg-slate-900/65 border border-border/40 rounded-2xl p-16 text-center text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-4 opacity-20" />
              <h4 className="font-extrabold text-slate-800 dark:text-slate-200 text-sm">No Invoices Found</h4>
              <p className="text-xs text-muted-foreground mt-1">No generated or manual billing records matched your active query filters.</p>
            </Card>
          ) : (
            filteredInvoices.map((inv) => (
              <Card 
                key={inv.id} 
                className="hover:shadow-md transition-all duration-300 group border border-border/40 hover:border-primary/20 bg-card/65 dark:bg-slate-900/65 backdrop-blur-md rounded-2xl overflow-hidden"
              >
                <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    {/* Color status bar badge */}
                    <div 
                      className="w-1.5 h-12 rounded-full shrink-0" 
                      style={{ 
                        backgroundColor: inv.status === 'paid' ? '#10b981' : inv.status === 'overdue' ? '#ef4444' : inv.status === 'pending' ? '#f59e0b' : '#6b7280' 
                      }} 
                    />
                    <div className="h-10 w-10 rounded-xl bg-primary/5 flex items-center justify-center text-primary font-bold shrink-0">
                      {inv.client_name?.charAt(0).toUpperCase() || '#'}
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-bold text-slate-800 dark:text-slate-100 text-sm tracking-tight">{inv.invoice_number}</span>
                        <Badge variant="outline" className={`capitalize text-[9px] font-extrabold tracking-wider px-2 py-0.5 shadow-none border ${getStatusColor(inv.status)}`}>
                          {inv.status.replace('_', ' ')}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1 font-medium">
                        {inv.client_name} • <span className="font-semibold text-slate-600 dark:text-slate-300">Due: {inv.due_date ? format(parseISO(inv.due_date), 'MMM d, yyyy') : 'N/A'}</span>
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-6 border-t sm:border-t-0 pt-3 sm:pt-0 border-border/30">
                    <div className="text-left sm:text-right">
                      <p className="text-base font-extrabold text-slate-900 dark:text-slate-100">{formatCurrency(inv.total_amount)}</p>
                      {inv.paid_amount > 0 && inv.status !== 'paid' && (
                        <p className="text-[10px] text-blue-600 dark:text-blue-400 font-bold mt-0.5">
                          Paid: {formatCurrency(inv.paid_amount)}
                        </p>
                      )}
                    </div>

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg text-slate-500 hover:bg-muted">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="rounded-xl">
                        <DropdownMenuItem onClick={() => { setSelectedInvoice(inv); setPreviewOpen(true); }} className="text-xs font-semibold cursor-pointer">
                          <Printer className="h-3.5 w-3.5 mr-2 text-slate-500" /> View / Print Invoice
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => openPaymentDialog(inv)} className="text-xs font-semibold cursor-pointer">
                          <DollarSign className="h-3.5 w-3.5 mr-2 text-slate-500" /> Record Payment
                        </DropdownMenuItem>
                        <DropdownMenuItem className="text-red-600 text-xs font-bold cursor-pointer hover:bg-red-50" onClick={() => deleteMutation.mutate(inv.id)}>
                          <Trash2 className="h-3.5 w-3.5 mr-2" /> Delete Record
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>

        {/* --- CREATE MANUAL INVOICE DIALOG --- */}
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border-border/40 shadow-xl">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold">Issue Manual Billing Invoice</DialogTitle>
            </DialogHeader>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4 pr-1">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Client Name *</Label>
                <Input value={formData.client_name} className="rounded-xl border-border/60" placeholder="E.g. Acme Corporation" onChange={(e) => setFormData({...formData, client_name: e.target.value})} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Payment Due Date *</Label>
                <Input type="date" value={formData.due_date} className="rounded-xl border-border/60" onChange={(e) => setFormData({...formData, due_date: e.target.value})} />
              </div>
            </div>
            
            <div className="space-y-1.5 mb-4">
              <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Initial Billing Status *</Label>
              <Select value={formData.status} onValueChange={(val: InvoiceStatus) => setFormData({...formData, status: val})}>
                <SelectTrigger className="rounded-xl border-border/60">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="pending">Pending Payment</SelectItem>
                  <SelectItem value="partially_paid">Partially Paid</SelectItem>
                  <SelectItem value="paid">Pre-paid / Paid</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="bg-muted/30 p-4 rounded-xl space-y-3 border border-border/50 mb-4">
              <Label className="text-xs font-bold text-slate-600 uppercase tracking-wider">Invoice Billable Items</Label>
              {formItems.length === 0 ? (
                <p className="text-[11px] text-muted-foreground italic py-1">No items added to this invoice yet. Add an item below.</p>
              ) : (
                <div className="space-y-2">
                  {formItems.map((item, i) => (
                    <div key={i} className="flex justify-between text-xs border-b border-border/30 pb-2">
                      <span className="font-semibold text-slate-700 dark:text-slate-300">{item.description} <span className="text-slate-400 font-normal">({item.quantity}x @ {formatCurrency(item.price)})</span></span>
                      <span className="font-bold text-slate-900 dark:text-slate-100">{formatCurrency(item.price * item.quantity)}</span>
                    </div>
                  ))}
                </div>
              )}
              
              <div className="flex flex-wrap gap-2 items-end pt-2">
                <div className="flex-1 min-w-[150px]">
                  <Label className="text-[10px] text-slate-400 uppercase font-bold mb-1">Item Description</Label>
                  <Input placeholder="E.g. Dedicated Support Tier" value={newItem.description} onChange={(e) => setNewItem({...newItem, description: e.target.value})} className="h-8 rounded-lg text-xs" />
                </div>
                <div className="w-16">
                  <Label className="text-[10px] text-slate-400 uppercase font-bold mb-1">Qty</Label>
                  <Input type="number" placeholder="Qty" value={newItem.quantity} onChange={(e) => setNewItem({...newItem, quantity: Number(e.target.value)})} className="h-8 rounded-lg text-xs" />
                </div>
                <div className="w-24">
                  <Label className="text-[10px] text-slate-400 uppercase font-bold mb-1">Price</Label>
                  <Input type="number" placeholder="Price" value={newItem.price} onChange={(e) => setNewItem({...newItem, price: Number(e.target.value)})} className="h-8 rounded-lg text-xs" />
                </div>
                <Button size="icon" className="h-8 w-8 rounded-lg" onClick={addItem}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="space-y-1.5 mb-4">
              <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Internal Notes & Terms</Label>
              <Textarea 
                placeholder="Add special notes, bank transfer details, or terms here..." 
                value={formData.notes} 
                onChange={(e) => setFormData({...formData, notes: e.target.value})}
                className="rounded-xl text-xs border-border/60"
              />
            </div>

            <DialogFooter>
              <Button className="gradient-primary rounded-xl" onClick={() => createMutation.mutate()} disabled={createMutation.isPending || formItems.length === 0}>
                {createMutation.isPending ? 'Generating...' : 'Generate Invoice'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* --- RECORD PAYMENT DIALOG --- */}
        <Dialog open={paymentOpen} onOpenChange={setPaymentOpen}>
          <DialogContent className="rounded-2xl border-border/40 shadow-xl">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold">Record Client Payment</DialogTitle>
            </DialogHeader>
            <div className="py-4 space-y-4">
              <div className="bg-primary/5 p-4 rounded-xl text-xs text-slate-700 dark:text-slate-300 border border-primary/10 space-y-1">
                <p className="flex justify-between"><strong>Billing Target:</strong> <span className="font-bold text-slate-900 dark:text-slate-100">{selectedInvoice?.invoice_number}</span></p>
                <p className="flex justify-between"><strong>Total Invoice Sum:</strong> <span className="font-extrabold text-slate-900 dark:text-slate-100">{selectedInvoice ? formatCurrency(selectedInvoice.total_amount) : '৳0.00'}</span></p>
                <p className="flex justify-between"><strong>Paid Amount:</strong> <span className="font-bold text-emerald-600">{selectedInvoice ? formatCurrency(selectedInvoice.paid_amount) : '৳0.00'}</span></p>
                <p className="flex justify-between border-t border-border/30 pt-1.5 mt-1 font-bold text-slate-800 dark:text-slate-200">
                  <span>Outstanding Balance:</span>
                  <span className="text-rose-600">{selectedInvoice ? formatCurrency(selectedInvoice.total_amount - (selectedInvoice.paid_amount || 0)) : '৳0.00'}</span>
                </p>
              </div>
              
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Record Deposit Amount</Label>
                <Input type="number" placeholder="Enter captured amount (e.g. 5000)" value={paymentAmount} className="rounded-xl border-border/60" onChange={(e) => setPaymentAmount(e.target.value)} />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Set System Billing Status</Label>
                <Select value={newStatus} onValueChange={(val: InvoiceStatus) => setNewStatus(val)}>
                  <SelectTrigger className="rounded-xl border-border/60">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="pending">Pending Payment</SelectItem>
                    <SelectItem value="partially_paid">Partially Paid</SelectItem>
                    <SelectItem value="paid">Paid (Settled)</SelectItem>
                    <SelectItem value="overdue">Overdue</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-[10px] text-muted-foreground">Adjust status code manually to trigger client updates.</p>
              </div>
            </div>
            <DialogFooter>
              <Button className="gradient-primary rounded-xl" onClick={() => paymentMutation.mutate()} disabled={paymentMutation.isPending}>
                {paymentMutation.isPending ? 'Updating...' : 'Record Payment & Close'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* --- DYNAMIC PROFESSIONAL INVOICE PREVIEW --- */}
        <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
          <DialogContent className="max-w-4xl h-[90vh] flex flex-col p-0 overflow-hidden bg-slate-50 rounded-2xl border-none">
            
            {/* Scrollable Preview Area */}
            <div className="flex-1 overflow-y-auto p-6 sm:p-8 flex justify-center custom-scrollbar">
              <div ref={printRef} className="bg-white text-slate-800 w-[210mm] h-[296mm] max-h-[296mm] p-[16mm] relative box-border border border-slate-200 rounded-sm shadow-sm flex flex-col justify-between overflow-hidden">
                {selectedInvoice && (
                  <div className="flex flex-col h-full font-sans justify-between flex-1">
                    
                    {/* Header Section */}
                    <div>
                      <div className="flex justify-between items-start border-b border-slate-100 pb-4 mb-5">
                        <div className="space-y-3">
                          <div className="bg-[#0f172a] p-2.5 rounded-xl inline-block shadow-sm">
                            <img src={logo} className="h-7 w-auto object-contain" alt="TechWisdom Technologies" />
                          </div>
                          <div className="text-[11px] text-slate-400 space-y-0.5 leading-relaxed">
                            <p className="font-bold text-slate-600">TechWisdom Technologies</p>
                            <p>158/Cha, Kuratoli Rd, Dhaka 1229, Bangladesh</p>
                            <p><strong>Email:</strong> official@techwisdom.site</p>
                            <p><strong>Phone:</strong> +8801799269699</p>
                          </div>
                        </div>

                        <div className="text-right space-y-2">
                          <div className="space-y-1">
                            <h1 className="text-3xl font-extralight tracking-widest text-slate-300">INVOICE</h1>
                            <p className="text-sm font-bold text-slate-800">#{selectedInvoice.invoice_number}</p>
                          </div>
                          <div>
                            <span className={`inline-block text-[9px] font-extrabold uppercase tracking-widest px-2.5 py-1 rounded-md border ${
                              selectedInvoice.status === 'paid' 
                                ? 'bg-emerald-50 text-emerald-600 border-emerald-100' 
                                : selectedInvoice.status === 'overdue'
                                ? 'bg-rose-50 text-rose-600 border-rose-100'
                                : 'bg-amber-50 text-amber-600 border-amber-100'
                            }`}>
                              {selectedInvoice.status.replace('_', ' ')}
                            </span>
                          </div>
                          <div className="text-[10px] text-slate-400 space-y-0.5 pt-1">
                            <p><strong>Issue Date:</strong> {selectedInvoice.created_at ? format(parseISO(selectedInvoice.created_at), 'MMM d, yyyy') : format(new Date(), 'MMM d, yyyy')}</p>
                            <p><strong>Due Date:</strong> {selectedInvoice.due_date ? format(parseISO(selectedInvoice.due_date), 'MMM d, yyyy') : 'Upon Receipt'}</p>
                          </div>
                        </div>
                      </div>

                      {/* Recipient details */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-5">
                        <div>
                          <h3 className="text-[9px] font-extrabold uppercase text-slate-400 tracking-wider mb-2">Bill To:</h3>
                          <p className="text-base font-bold text-slate-800">{selectedInvoice.client_name}</p>
                          <p className="text-[11px] text-slate-400 mt-0.5">Corporate Client</p>
                        </div>
                        <div className="flex flex-col justify-end space-y-1 text-[11px] text-right">
                          <p className="text-slate-400">Total Invoice Sum: <span className="font-bold text-slate-800 ml-1">{formatCurrency(selectedInvoice.total_amount)}</span></p>
                          <p className="text-slate-400">Amount Collected: <span className="font-bold text-emerald-600 ml-1">{formatCurrency(selectedInvoice.paid_amount || 0)}</span></p>
                        </div>
                      </div>

                      {/* Items table */}
                      <div className="mb-5">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="border-b border-slate-200 text-slate-400 text-left">
                              <th className="pb-2 font-bold uppercase tracking-wider text-[10px]">Description</th>
                              <th className="pb-2 text-center font-bold uppercase tracking-wider text-[10px] w-12">Qty</th>
                              <th className="pb-2 text-right font-bold uppercase tracking-wider text-[10px] w-24">Rate</th>
                              <th className="pb-2 text-right font-bold uppercase tracking-wider text-[10px] w-24">Amount</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 text-slate-700">
                            {selectedInvoice.items?.length > 0 ? (
                              selectedInvoice.items.map((item, i) => (
                                <tr key={i} className="py-2">
                                  <td className="py-2.5 font-medium">{item.description}</td>
                                  <td className="py-2.5 text-center text-slate-400">{item.quantity}</td>
                                  <td className="py-2.5 text-right text-slate-400">{formatCurrency(item.price)}</td>
                                  <td className="py-2.5 text-right font-bold text-slate-800">{formatCurrency(item.price * item.quantity)}</td>
                                </tr>
                              ))
                            ) : (
                              <tr>
                                <td colSpan={4} className="py-4 text-center text-slate-400 italic">No billable details listed</td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Footer Calculations & Signature */}
                    <div className="space-y-5">
                      <div className="flex justify-between items-start border-t border-slate-100 pt-4">
                        {/* Terms & notes */}
                        <div className="max-w-xs space-y-1.5">
                          <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Notes & Payment Terms</h4>
                          <p className="text-[10px] text-slate-400 leading-relaxed whitespace-pre-wrap">
                            {selectedInvoice.notes || "Please include the invoice reference code on your wire transfer sheet. Standard Net terms apply."}
                          </p>
                        </div>

                        {/* Balance due */}
                        <div className="w-56 space-y-2 text-xs">
                          <div className="flex justify-between text-slate-500">
                            <span>Subtotal</span>
                            <span className="font-semibold text-slate-700">{formatCurrency(selectedInvoice.total_amount)}</span>
                          </div>
                          <div className="flex justify-between text-slate-500 border-b border-slate-100 pb-2">
                            <span>VAT / Tax (0.00%)</span>
                            <span className="text-slate-400">৳0.00</span>
                          </div>
                          <div className="flex justify-between text-slate-500">
                            <span>Total Paid</span>
                            <span className="text-emerald-600 font-semibold">- {formatCurrency(selectedInvoice.paid_amount || 0)}</span>
                          </div>
                          <div className="flex justify-between border-t border-slate-200 pt-2 text-slate-800 font-bold text-sm">
                            <span>Balance Due</span>
                            <span className="text-slate-900 font-black">{formatCurrency(selectedInvoice.total_amount - (selectedInvoice.paid_amount || 0))}</span>
                          </div>
                        </div>
                      </div>

                      {/* E-Signature Box */}
                      <div className="flex justify-between items-end border-t border-slate-100 pt-4">
                        <div className="text-[9px] text-slate-400 space-y-0.5">
                          <p className="font-bold text-slate-500">TechWisdom Technologies</p>
                          <p>official@techwisdom.site | +8801799269699</p>
                        </div>

                        <div className="flex flex-col items-end">
                          <div className="font-serif italic text-xl text-slate-800 select-none tracking-wide" style={{ fontFamily: 'Georgia, serif' }}>
                            Mujahid Raj
                          </div>
                          <div className="w-32 border-t border-slate-200 my-1"></div>
                          <div className="text-[9px] text-slate-400 uppercase font-bold tracking-widest">Authorized Signature</div>
                        </div>
                      </div>
                    </div>

                  </div>
                )}
              </div>
            </div>

            {/* Actions Bar */}
            <div className="p-4 border-t bg-white flex justify-end gap-3 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] z-10 rounded-b-2xl">
              <Button variant="outline" className="rounded-xl" onClick={() => setPreviewOpen(false)}>Close Preview</Button>
              <Button onClick={handlePrint} variant="secondary" className="rounded-xl">
                <Printer className="h-4 w-4 mr-2" /> Print Invoice
              </Button>
              <Button onClick={handleDownload} className="gradient-primary rounded-xl shadow-sm">
                <Download className="h-4 w-4 mr-2" /> Download PDF
              </Button>
            </div>
          </DialogContent>
        </Dialog>

      </div>
    </DashboardLayout>
  );
}