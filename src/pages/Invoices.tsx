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
  MoreVertical, Trash2, AlertCircle, RefreshCw, Download, Hexagon 
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
    toast.success("Downloading Invoice...");
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
      // FIX: Added 'as any' to bypass the missing type definition in your local cache
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
      setFormData({ client_name: '', due_date: '', notes: '', status: 'pending' });
      toast.success("Invoice created successfully");
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
      toast.success("Invoice updated!");
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
      toast.success("Invoice deleted");
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
      case 'paid': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
      case 'partially_paid': return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'overdue': return 'bg-red-100 text-red-700 border-red-200';
      case 'pending': return 'bg-amber-100 text-amber-700 border-amber-200';
      default: return 'bg-slate-100 text-slate-700 border-slate-200';
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

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in">
        
        {/* HEADER */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <FileText className="h-8 w-8 text-primary" /> Invoices
            </h1>
            <p className="text-muted-foreground">Manage client billing and payments</p>
          </div>
          <div className="flex gap-2">
            <Card className="px-4 py-2 bg-red-50 border-red-100 flex items-center gap-3 shadow-none">
               <AlertCircle className="h-5 w-5 text-red-500" />
               <div>
                 <p className="text-[10px] text-red-600 font-bold uppercase tracking-wider">Due Amount</p>
                 <p className="text-lg font-bold text-red-700 leading-none">{formatCurrency(totalOutstanding)}</p>
               </div>
            </Card>
            
            <Button variant="outline" onClick={() => generateRecurringMutation.mutate()} disabled={isGenerating}>
              <RefreshCw className={`h-4 w-4 mr-2 ${isGenerating ? 'animate-spin' : ''}`} />
              {isGenerating ? 'Checking...' : 'Run Auto-Billing'}
            </Button>

            <Button className="gradient-primary" onClick={() => setCreateOpen(true)}>
              <Plus className="h-5 w-5 mr-2" /> Manual Invoice
            </Button>
          </div>
        </div>

        {/* SEARCH BAR */}
        <div className="relative">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Search by client, ID, or status..." 
            className="pl-10 bg-white/50 backdrop-blur border-muted"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {/* INVOICE LIST */}
        <div className="grid gap-4">
          {isLoading ? (
            <div className="text-center py-10 text-muted-foreground">Loading invoices...</div>
          ) : filteredInvoices.length === 0 ? (
            <Card className="glass-card p-12 text-center text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-4 opacity-20" />
              <p>No invoices found.</p>
            </Card>
          ) : (
            filteredInvoices.map((inv) => (
              <Card key={inv.id} className="hover:shadow-md transition-all duration-200 group border-l-4" style={{ borderLeftColor: inv.status === 'paid' ? '#10b981' : inv.status === 'overdue' ? '#ef4444' : '#f59e0b' }}>
                <CardContent className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="h-12 w-12 rounded-xl bg-primary/5 flex items-center justify-center text-primary font-bold text-lg">
                      {inv.client_name?.charAt(0) || '#'}
                    </div>
                    <div>
                      <div className="flex items-center gap-3">
                        <span className="font-bold text-lg text-slate-800">{inv.invoice_number}</span>
                        <Badge variant="outline" className={`capitalize ${getStatusColor(inv.status)}`}>
                          {inv.status.replace('_', ' ')}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        {inv.client_name} • Due: {inv.due_date ? format(parseISO(inv.due_date), 'MMM d, yyyy') : 'N/A'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-8">
                    <div className="text-right">
                      <p className="text-xl font-bold text-slate-900">{formatCurrency(inv.total_amount)}</p>
                      {inv.paid_amount > 0 && inv.status !== 'paid' && (
                        <p className="text-xs text-blue-600 font-medium mt-1">
                          Partially Paid: {formatCurrency(inv.paid_amount)}
                        </p>
                      )}
                    </div>

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-500">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => { setSelectedInvoice(inv); setPreviewOpen(true); }}>
                          <Printer className="h-4 w-4 mr-2" /> View / Print
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => openPaymentDialog(inv)}>
                          <DollarSign className="h-4 w-4 mr-2" /> Update / Pay
                        </DropdownMenuItem>
                        <DropdownMenuItem className="text-red-600" onClick={() => deleteMutation.mutate(inv.id)}>
                          <Trash2 className="h-4 w-4 mr-2" /> Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>

        {/* --- CREATE DIALOG --- */}
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Manual Invoice</DialogTitle></DialogHeader>
            <div className="grid grid-cols-2 gap-4 py-4">
              <div><Label>Client</Label><Input value={formData.client_name} onChange={(e) => setFormData({...formData, client_name: e.target.value})} /></div>
              <div><Label>Due Date</Label><Input type="date" value={formData.due_date} onChange={(e) => setFormData({...formData, due_date: e.target.value})} /></div>
            </div>
            
            <div className="mb-4">
              <Label>Set Status</Label>
              <Select value={formData.status} onValueChange={(val: InvoiceStatus) => setFormData({...formData, status: val})}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="partially_paid">Partially Paid</SelectItem>
                  <SelectItem value="paid">Paid</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="bg-muted/30 p-4 rounded-lg space-y-3 border mb-4">
              <Label>Items</Label>
              {formItems.map((item, i) => (
                <div key={i} className="flex justify-between text-sm border-b pb-2">
                  <span>{item.description} (x{item.quantity})</span>
                  <span>{formatCurrency(item.price * item.quantity)}</span>
                </div>
              ))}
              <div className="flex gap-2 items-end pt-2">
                <div className="flex-1"><Input placeholder="Description" value={newItem.description} onChange={(e) => setNewItem({...newItem, description: e.target.value})} className="h-8" /></div>
                <div className="w-20"><Input type="number" placeholder="Qty" value={newItem.quantity} onChange={(e) => setNewItem({...newItem, quantity: Number(e.target.value)})} className="h-8" /></div>
                <div className="w-24"><Input type="number" placeholder="Price" value={newItem.price} onChange={(e) => setNewItem({...newItem, price: Number(e.target.value)})} className="h-8" /></div>
                <Button size="icon" className="h-8 w-8" onClick={addItem}><Plus className="h-4 w-4" /></Button>
              </div>
            </div>

            <DialogFooter>
              <Button onClick={() => createMutation.mutate()} disabled={createMutation.isPending || formItems.length === 0}>Generate Invoice</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* --- UPDATE/PAYMENT DIALOG --- */}
        <Dialog open={paymentOpen} onOpenChange={setPaymentOpen}>
          <DialogContent>
            <DialogHeader><DialogTitle>Update Invoice</DialogTitle></DialogHeader>
            <div className="py-4 space-y-4">
              <div className="bg-blue-50 p-4 rounded text-sm text-blue-700 border border-blue-100">
                <p><strong>Total:</strong> {selectedInvoice ? formatCurrency(selectedInvoice.total_amount) : 0}</p>
                <p><strong>Currently Paid:</strong> {selectedInvoice ? formatCurrency(selectedInvoice.paid_amount) : 0}</p>
              </div>
              
              <div>
                <Label>Record New Payment (Add to total)</Label>
                <Input type="number" placeholder="0.00" value={paymentAmount} onChange={(e) => setPaymentAmount(e.target.value)} />
              </div>

              <div>
                <Label>Manual Status Update</Label>
                <Select value={newStatus} onValueChange={(val: InvoiceStatus) => setNewStatus(val)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="partially_paid">Partially Paid</SelectItem>
                    <SelectItem value="paid">Paid</SelectItem>
                    <SelectItem value="overdue">Overdue</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-1">Force update the status if needed.</p>
              </div>
            </div>
            <DialogFooter><Button onClick={() => paymentMutation.mutate()}>Save Changes</Button></DialogFooter>
          </DialogContent>
        </Dialog>

        {/* --- PROFESSIONAL INVOICE PREVIEW --- */}
        <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
          <DialogContent className="max-w-4xl h-[90vh] flex flex-col p-0 overflow-hidden bg-slate-50">
            
            {/* Scrollable Preview Area */}
            <div className="flex-1 overflow-y-auto p-8 flex justify-center">
              <div ref={printRef} className="bg-white text-black shadow-2xl w-[210mm] min-h-[297mm] p-[15mm] relative box-border">
                
                {/* PAID STAMP */}
                {selectedInvoice?.status === 'paid' && (
                  <div className="absolute top-[100px] right-[50px] border-[5px] border-emerald-600 text-emerald-600 font-black text-6xl px-4 py-2 transform rotate-[-15deg] opacity-20 pointer-events-none select-none uppercase tracking-widest">
                    PAID
                  </div>
                )}

                {selectedInvoice && (
                  <div className="flex flex-col h-full font-sans">
                    
                    {/* 1. Header Section */}
                    <div className="flex justify-between items-start border-b-2 border-slate-900 pb-8 mb-8">
                      <div className="flex flex-col gap-2">
                        {/* Fake Logo Placeholder */}
                        <div className="flex items-center gap-2 mb-2">
                            <div className="bg-black text-white p-2 rounded">
                               <img src={logo} className='h-32 w-52' alt="" />
                            </div>
                            
                        </div>
                        <div className="text-sm text-slate-500 leading-snug">
                          <p>Bashundhara R/A , Block - C</p>
                          <p>Dhaka, Bangladesh 1200</p>
                          <p>billing@techwisdom.site</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <h1 className="text-5xl font-light text-slate-300 tracking-tighter">INVOICE</h1>
                        <p className="text-lg font-bold text-slate-900 mt-2">#{selectedInvoice.invoice_number}</p>
                        <p className="text-sm text-slate-500 mt-1">
                            Issued: {selectedInvoice.created_at ? format(parseISO(selectedInvoice.created_at), 'MMMM d, yyyy') : format(new Date(), 'MMMM d, yyyy')}
                        </p>
                      </div>
                    </div>

                    {/* 2. Bill To & Details */}
                    <div className="grid grid-cols-2 gap-12 mb-12">
                      <div>
                        <h3 className="text-xs font-bold uppercase text-slate-400 tracking-wider mb-3">Bill To</h3>
                        <p className="text-xl font-bold text-slate-900">{selectedInvoice.client_name}</p>
                        <p className="text-sm text-slate-500 mt-1">Valued Client</p>
                      </div>
                      <div className="flex flex-col gap-4">
                        <div className="flex justify-between border-b border-slate-100 pb-2">
                            <span className="text-sm font-medium text-slate-500">Invoice Status</span>
                            <span className="text-sm font-bold uppercase">{selectedInvoice.status.replace('_', ' ')}</span>
                        </div>
                        <div className="flex justify-between border-b border-slate-100 pb-2">
                            <span className="text-sm font-medium text-slate-500">Due Date</span>
                            <span className="text-sm font-bold text-slate-900">{selectedInvoice.due_date ? format(parseISO(selectedInvoice.due_date), 'MMM d, yyyy') : 'Upon Receipt'}</span>
                        </div>
                        <div className="flex justify-between border-b border-slate-100 pb-2">
                            <span className="text-sm font-medium text-slate-500">Amount Due</span>
                            <span className="text-sm font-bold text-red-600">{formatCurrency(selectedInvoice.total_amount - (selectedInvoice.paid_amount || 0))}</span>
                        </div>
                      </div>
                    </div>

                    {/* 3. Table */}
                    <div className="mb-8">
                        <table className="w-full">
                        <thead className="bg-slate-50">
                            <tr>
                            <th className="text-left py-3 px-4 font-bold text-slate-600 text-xs uppercase tracking-wider">Item Description</th>
                            <th className="text-right py-3 px-4 font-bold text-slate-600 text-xs uppercase tracking-wider">Qty</th>
                            <th className="text-right py-3 px-4 font-bold text-slate-600 text-xs uppercase tracking-wider">Price</th>
                            <th className="text-right py-3 px-4 font-bold text-slate-600 text-xs uppercase tracking-wider">Total</th>
                            </tr>
                        </thead>
                        <tbody className="text-sm">
                            {selectedInvoice.items?.map((item, i) => (
                            <tr key={i} className="border-b border-slate-100 last:border-0">
                                <td className="py-4 px-4 font-medium text-slate-800">{item.description}</td>
                                <td className="text-right py-4 px-4 text-slate-600">{item.quantity}</td>
                                <td className="text-right py-4 px-4 text-slate-600">{formatCurrency(item.price)}</td>
                                <td className="text-right py-4 px-4 font-bold text-slate-900">{formatCurrency(item.price * item.quantity)}</td>
                            </tr>
                            ))}
                        </tbody>
                        </table>
                    </div>

                    {/* 4. Totals */}
                    <div className="flex justify-end mb-12">
                      <div className="w-5/12 space-y-3">
                        <div className="flex justify-between text-slate-600">
                          <span className="font-medium">Subtotal</span>
                          <span>{formatCurrency(selectedInvoice.total_amount)}</span>
                        </div>
                        <div className="flex justify-between text-slate-600">
                          <span className="font-medium">Tax (0%)</span>
                          <span>৳0.00</span>
                        </div>
                        <div className="flex justify-between py-3 border-t border-b border-slate-200">
                          <span className="font-bold text-xl text-slate-900">Total</span>
                          <span className="font-bold text-xl text-slate-900">{formatCurrency(selectedInvoice.total_amount)}</span>
                        </div>
                        <div className="flex justify-between text-emerald-600 font-medium">
                          <span>Amount Paid</span>
                          <span>- {formatCurrency(selectedInvoice.paid_amount)}</span>
                        </div>
                        <div className="flex justify-between bg-slate-900 text-white p-3 rounded shadow-sm mt-4">
                          <span className="font-bold">Balance Due</span>
                          <span className="font-bold">{formatCurrency(selectedInvoice.total_amount - (selectedInvoice.paid_amount || 0))}</span>
                        </div>
                      </div>
                    </div>

                    {/* 5. Footer / Notes */}
                    <div className="mt-auto pt-8 border-t border-slate-200">
                        <h4 className="font-bold text-slate-900 mb-2 text-sm">Notes & Terms</h4>
                        <p className="text-sm text-slate-500 whitespace-pre-wrap leading-relaxed max-w-lg">
                            {selectedInvoice.notes || "Payment is due within the specified time. Please include the invoice number in your transfer details."}
                        </p>
                        
                        <div className="mt-8 flex justify-between items-end">
                            <div className="text-xs text-slate-400">
                                <p>TechWisdom Technologies Ltd.</p>
                                <p>Registered in Bangladesh</p>
                            </div>
                            <div className="text-2xl font-handwriting text-slate-400 opacity-50 font-serif italic">
                                TechWisdom
                            </div>
                        </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Actions Bar */}
            <div className="p-4 border-t bg-white flex justify-end gap-3 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] z-10">
              <Button variant="outline" onClick={() => setPreviewOpen(false)}>Close Preview</Button>
              <Button onClick={handlePrint} variant="secondary">
                <Printer className="h-4 w-4 mr-2" /> Print System
              </Button>
              <Button onClick={handleDownload} className="gradient-primary">
                <Download className="h-4 w-4 mr-2" /> Download PDF
              </Button>
            </div>
          </DialogContent>
        </Dialog>

      </div>
    </DashboardLayout>
  );
}