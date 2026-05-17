import { useState, useEffect } from 'react';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import {
  Loader2, Plus, FileText, Download, Send, CheckCircle, Trash2, Edit,
  Eye, Printer, Building, Mail, DollarSign, Calendar, User, Check,
  XCircle, ShieldAlert, FileSignature, Sparkles, TrendingUp, Award, Clock
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { formatCurrency } from '@/lib/currency';

export default function ProposalsDashboard() {
  const { user } = useAuth();
  const qc = useQueryClient();

  // Programmatically convert white pixels of techwisdom.png to black for watermark
  const [blackLogoUrl, setBlackLogoUrl] = useState<string>('');

  useEffect(() => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = '/techwisdom.png';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth || 300;
      canvas.height = img.naturalHeight || 160;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.drawImage(img, 0, 0);
      try {
        const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imgData.data;
        for (let i = 0; i < data.length; i += 4) {
          const r = data[i];
          const g = data[i+1];
          const b = data[i+2];
          // Identify light/white pixels (white text brand)
          if (r > 200 && g > 200 && b > 200) {
            data[i] = 0;
            data[i+1] = 0;
            data[i+2] = 0;
          }
        }
        ctx.putImageData(imgData, 0, 0);
        setBlackLogoUrl(canvas.toDataURL('image/png'));
      } catch (err) {
        console.error('Failed to convert logo colors:', err);
      }
    };
  }, []);
  const [view, setView] = useState<'list' | 'builder'>('list');
  const [selectedProposal, setSelectedProposal] = useState<any | null>(null);
  const [items, setItems] = useState<any[]>([]);
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [previewCopy, setPreviewCopy] = useState<'office' | 'client'>('office');

  const { data: proposals = [], isLoading } = useQuery({
    queryKey: ['proposals'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('proposals')
        .select(`
          *,
          leads (business_name, contact_person, email),
          proposal_items (*)
        `)
        .order('created_at', { ascending: false });
      if (error) throw error;

      // Parse serialized JSON contents for our Canva-style proposals
      return (data || []).map((p: any) => {
        let executionScope = p.execution_scope || '';
        let footnote = p.footnote || '';
        let clientId = p.client_id || '';
        let contactPerson = p.contact_person || '';
        let sugs = [];
        let rawContent = p.content || '';
        let pdfUrl = p.pdf_url || '';

        // Fallback backward-compatible JSON parsing for legacy entries
        if (!executionScope || !pdfUrl) {
          try {
            if (p.content && p.content.startsWith('{')) {
              const parsed = JSON.parse(p.content);
              executionScope = executionScope || parsed.execution_scope || parsed.benefits_services || '';
              footnote = footnote || parsed.footnote || '';
              clientId = clientId || parsed.client_id || '';
              contactPerson = contactPerson || parsed.contact_person || '';
              sugs = parsed.suggestions || [];
              rawContent = parsed.raw_content || '';
              pdfUrl = pdfUrl || parsed.pdf_url || '';
            }
          } catch (e) {
            rawContent = rawContent || p.content || '';
          }
        }

        // Map items and parse optional tags from description
        const mappedItems = (p.proposal_items || []).map((item: any) => {
          let isOptional = false;
          let cleanDesc = item.description || '';
          if (cleanDesc.startsWith('[OPTIONAL]')) {
            isOptional = true;
            cleanDesc = cleanDesc.replace('[OPTIONAL] ', '').replace('[OPTIONAL]', '');
          }
          return {
            ...item,
            description: cleanDesc,
            is_optional: isOptional
          };
        });

        return {
          ...p,
          execution_scope: executionScope,
          footnote: footnote,
          client_id: clientId,
          contact_person: contactPerson,
          suggestions: sugs,
          content: rawContent,
          pdf_url: pdfUrl,
          proposal_items: mappedItems
        };
      });
    }
  });

  const { data: leads = [] } = useQuery({
    queryKey: ['leads-for-proposals'],
    queryFn: async () => {
      const { data } = await supabase.from('leads').select('id, business_name, contact_person');
      return data || [];
    }
  });

  const saveProposal = useMutation({
    mutationFn: async (payload: any) => {
      const { id, title, lead_id, status, content, terms_and_conditions, execution_scope, footnote, client_code, contact_person, suggestions: sugsPayload, pdf_url } = payload;

      // Calculate Grand Total (Core Items + Optional Items) to persist into the database
      let totalAmount = items.reduce((acc, item) => acc + (item.quantity * item.unit_price), 0);

      const sanitizeUuid = (val: string | null | undefined) => {
        if (!val) return null;
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        return uuidRegex.test(val) ? val : null;
      };

      // Save everything strictly as explicit database columns (plus backward compatibility JSON fallback for 'content' if needed)
      const propData: any = {
        title,
        lead_id: sanitizeUuid(lead_id),
        status,
        content, // Fallback raw text
        terms_and_conditions,
        execution_scope,
        footnote,
        client_code,
        contact_person,
        pdf_url,
        total_amount: totalAmount,
        created_by: sanitizeUuid(user?.id)
      };

      let propId: string = id;
      if (id) {
        const { error } = await supabase.from('proposals').update(propData).eq('id', id as string);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from('proposals').insert(propData).select().single();
        if (error) throw error;
        propId = data.id as string;
      }

      // Sync items
      if (propId) {
        // Delete old items
        await supabase.from('proposal_items').delete().eq('proposal_id', propId as string);
        // Insert new items
        if (items.length > 0) {
          const itemsData = items.map(i => {
            // Save optional tag inside description field to retain perfect standard DB schema compatibility
            const descWithOptional = i.is_optional
              ? `[OPTIONAL] ${i.description || ''}`.trim()
              : (i.description || '');

            return {
              proposal_id: propId as string,
              title: i.title,
              description: descWithOptional,
              quantity: i.quantity,
              unit_price: i.unit_price,
              total_price: i.quantity * i.unit_price
            };
          });
          await supabase.from('proposal_items').insert(itemsData);
        }

        // Sync suggestions (using any to bypass strict union types since proposal_suggestions isn't in generated schema yet)
        const suggestionsQuery = (supabase as any).from('proposal_suggestions');
        await suggestionsQuery.delete().eq('proposal_id', propId as string);

        if (sugsPayload && sugsPayload.length > 0) {
          const sugsData = sugsPayload.map((s: any) => ({
            proposal_id: propId as string,
            title: s.title,
            description: s.description,
            amount: s.amount
          }));
          await suggestionsQuery.insert(sugsData);
        }
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['proposals'] });
      toast.success('Proposal saved successfully');
      setView('list');
    },
    onError: (e: any) => toast.error(e.message)
  });

  const deleteProposal = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('proposals').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['proposals'] });
      toast.success('Proposal deleted');
    }
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string, status: "draft" | "sent" | "viewed" | "accepted" | "rejected" }) => {
      const { error } = await supabase.from('proposals').update({ status }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['proposals'] });
      toast.success('Proposal status updated');
    }
  });

  const generatePdfBlob = async (): Promise<Blob | null> => {
    // Target the absolute hidden node completely outside the dashboard grid
    const element = document.querySelector('#hidden-pdf-capture-node') as HTMLElement;
    if (!element) return null;

    try {
      // Allow browser to render images inside the hidden node
      await new Promise(resolve => setTimeout(resolve, 500));

      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        allowTaint: false,
        backgroundColor: '#ffffff',
        width: 820,
        height: 1140,
        logging: true
      });

      const imgData = canvas.toDataURL('image/jpeg', 1.0);
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();

      pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);
      return pdf.output('blob');
    } catch (error) {
      console.error("PDF generation failed:", error);
      return null;
    }
  };

  const handleSaveAndUpload = async () => {
    const toastId = toast.loading('Generating PDF and saving proposal...');
    try {
      let pdf_url = selectedProposal.pdf_url || '';
      const pdfBlob = await generatePdfBlob();

      if (pdfBlob) {
        const fileName = `proposal-${Date.now()}.pdf`;
        // Try uploading to 'proposals' bucket (using 'leads' bucket as a robust fallback if it fails, since leads bucket already exists)
        let { data: uploadData, error: uploadError } = await supabase.storage
          .from('proposals')
          .upload(fileName, pdfBlob, { contentType: 'application/pdf', upsert: true });

        if (uploadError) {
          // Fallback to leads bucket which is guaranteed to exist
          const fallbackUpload = await supabase.storage
            .from('leads')
            .upload(`proposals/${fileName}`, pdfBlob, { contentType: 'application/pdf', upsert: true });
          uploadData = fallbackUpload.data;
          uploadError = fallbackUpload.error;

          if (!uploadError && uploadData) {
            const { data: { publicUrl } } = supabase.storage.from('leads').getPublicUrl(`proposals/${fileName}`);
            pdf_url = publicUrl;
          }
        } else if (uploadData) {
          const { data: { publicUrl } } = supabase.storage.from('proposals').getPublicUrl(fileName);
          pdf_url = publicUrl;
        }
      }

      saveProposal.mutate({ ...selectedProposal, suggestions, pdf_url }, {
        onSuccess: () => toast.dismiss(toastId),
        onError: () => toast.dismiss(toastId)
      });
    } catch (e) {
      toast.dismiss(toastId);
      toast.error('Failed to generate and save proposal');
    }
  };

  const openBuilder = (proposal?: any) => {
    if (proposal) {
      setSelectedProposal(proposal);
      setItems(proposal.proposal_items || []);
      setSuggestions(proposal.suggestions || []);
    } else {
      setSelectedProposal({
        title: 'AF Associates Website Proposal',
        client_code: '2MAY6-02',
        contact_person: 'Mujahid Raj',
        status: 'draft',
        content: '',
        execution_scope: 'Project duration will be 60 day (approx.) from approval of requirements. Proper documentation and training will be provided. 6 month of maintenance support and 1 years of content support will provide and after that a charge will be added.',
        terms_and_conditions: 'All rates quoted are valid for 15 days.\n25% payment should be done in advance excluding domain hosting and other expenses, and 25% should be paid after 50% of works.\nThe remaining amount should be paid within 15 days of delivery (No revision remain) or else 10% interest on monthly basis.',
        footnote: '* Amount can be varies according to the domain name, hosting price, API cost . These are approximate cost.'
      });
      setItems([
        { title: 'Interface Development', description: 'Interactive frontend screens & layouts', quantity: 1, unit_price: 30900, is_optional: false },
        { title: 'Database design and Backend', description: 'Postgres architecture & server functions', quantity: 1, unit_price: 19300, is_optional: false },
        { title: 'Content Management System (CMS)', description: 'Vault panel & folder administrators', quantity: 1, unit_price: 15100, is_optional: false },
        { title: 'Discovery and design', description: 'Requirements elicitation & wireframing', quantity: 1, unit_price: 6600, is_optional: false },
        { title: 'Data Engineering', description: 'Migration workflows', quantity: 1, unit_price: 5000, is_optional: false },
        { title: 'Quality Assurance and Testing', description: 'End-to-end system validation checks', quantity: 1, unit_price: 6600, is_optional: false },
        { title: 'Deployment', description: 'Server staging setup', quantity: 1, unit_price: 2500, is_optional: false },
        { title: '(Optional) Hosting cost * (Yearly)', description: 'Cloud staging hosting charges', quantity: 1, unit_price: 5000, is_optional: true },
        { title: '(Optional) API Purchase * (Monthly)', description: 'External API integration keys', quantity: 1, unit_price: 7500, is_optional: true },
        { title: 'CRM discovery and redesign', description: 'Unified filtration dashboards', quantity: 1, unit_price: 15800, is_optional: false }
      ]);
      setSuggestions([
        { title: 'Payment Gateway Integration', description: 'SSLCommerz checkout supporting bKash, Nagad, Rocket & Cards', amount: 15000 }
      ]);
    }
    setView('builder');
  };

  const addCoreItem = () => setItems([...items, { title: '', description: '', quantity: 1, unit_price: 0, is_optional: false }]);
  const addOptionalItem = () => setItems([...items, { title: '', description: '', quantity: 1, unit_price: 0, is_optional: true }]);

  const updateItem = (index: number, field: string, value: any) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    setItems(newItems);
  };

  const removeItem = (index: number) => setItems(items.filter((_, i) => i !== index));

  const addSuggestion = () => setSuggestions([...suggestions, { title: '', description: '', amount: 0 }]);
  const updateSuggestion = (index: number, field: string, value: any) => {
    const newSugs = [...suggestions];
    newSugs[index] = { ...newSugs[index], [field]: value };
    setSuggestions(newSugs);
  };
  const removeSuggestion = (index: number) => setSuggestions(suggestions.filter((_, i) => i !== index));

  // Analytics helper calculations
  const totalValue = proposals.reduce((acc: number, p: any) => acc + (p.total_amount || 0), 0);
  const acceptedValue = proposals.filter((p: any) => p.status === 'accepted').reduce((acc: number, p: any) => acc + (p.total_amount || 0), 0);
  const conversionRate = proposals.length > 0
    ? Math.round((proposals.filter((p: any) => p.status === 'accepted').length / proposals.length) * 100)
    : 0;

  const filteredProposals = proposals.filter((p: any) => {
    if (statusFilter === 'all') return true;
    return p.status === statusFilter;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'accepted':
        return <Badge className="bg-emerald-500 hover:bg-emerald-600 text-white border-none gap-1"><Check className="h-3 w-3" /> Accepted</Badge>;
      case 'rejected':
        return <Badge className="bg-rose-500 hover:bg-rose-600 text-white border-none gap-1"><XCircle className="h-3 w-3" /> Rejected</Badge>;
      case 'sent':
        return <Badge className="bg-[#ff7006] hover:bg-[#e05e00] text-white border-none gap-1"><Send className="h-3 w-3" /> Sent</Badge>;
      case 'viewed':
        return <Badge className="bg-amber-500 hover:bg-amber-600 text-white border-none gap-1"><Eye className="h-3 w-3" /> Viewed</Badge>;
      default:
        return <Badge className="bg-slate-400 hover:bg-slate-500 text-white border-none gap-1"><FileText className="h-3 w-3" /> Draft</Badge>;
    }
  };

  const handlePrint = () => {
    window.print();
  };

  if (isLoading) return <DashboardLayout><div className="flex h-full items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div></DashboardLayout>;

  if (view === 'builder') {
    // Separate core items from optional upsell items
    const coreItems = items.filter(item => !item.is_optional);
    const optionalItems = items.filter(item => item.is_optional);

    // Subtotal sums only the core/mandatory items
    const subtotal = coreItems.reduce((acc, item) => acc + (item.quantity * item.unit_price), 0);

    // Optional total sums only the optional items
    const optionalTotal = optionalItems.reduce((acc, item) => acc + (item.quantity * item.unit_price), 0);

    // Grand Total is Subtotal + Optional Total (Combined pricing)
    const grandTotal = subtotal + optionalTotal;

    const currentLead = leads.find((l: any) => l.id === selectedProposal.lead_id);
    const displayClientName = selectedProposal.contact_person || currentLead?.contact_person || 'Mujahid Raj';
    const displayBusinessName = currentLead?.business_name || selectedProposal.title?.replace(' Proposal', '') || 'AF ASSOCIATES';

    // Genuine Client ID generated dynamically from lead UUID fallback to typed client_id
    const genuineClientId = selectedProposal.client_id || (currentLead
      ? `TW-${currentLead.id.split('-')[0].toUpperCase()}`
      : '2MAY6-02');

    // Canva Proposal Template HTML Block (DEEP BLACK, BRAND ORANGE #ff7006 & WHITE LAYOUT)
    const renderCanvaTemplate = (type: 'office' | 'client', isPdfCapture = false) => (
      <div className={`w-full max-w-[820px] h-[1140px] bg-white text-black border border-slate-200 shadow-2xl ${isPdfCapture ? 'rounded-none border-none shadow-none' : 'rounded-[32px]'} overflow-hidden flex flex-col justify-between font-sans print:rounded-none print:border-none print:shadow-none print:bg-white print:w-full print:h-[1140px] print:max-h-[1140px] print:overflow-hidden print:page-break-after-avoid`}>

        {/* TOP ACCENT STRIP */}
        <div className="h-2 bg-[#ff7006] flex-none" />

        <div className="flex-1 grid grid-cols-12 min-h-0">

          {/* LEFT SIDEBAR (Solid Executive Black Accent Panel) - 4 Columns */}
          <div className="col-span-4 bg-[#18181b] p-6 flex flex-col justify-between text-white min-h-0 border-r border-[#ff7006]/40">
            <div className="space-y-6">
              <div className="flex flex-col items-center text-center gap-4 w-full pb-4">
                <img src="/techwisdom.png" className="w-44 h-24 object-contain mx-auto" alt="TechWisdom Logo" />
              </div>


              {/* PAYABLE TO */}
              <div className="space-y-1 pt-4 border-t border-slate-800">
                <h4 className="text-[9px] font-black uppercase tracking-widest text-[#ff7006]">Payable To</h4>
                <div className="text-[11px] space-y-0.5 font-semibold text-white">
                  <p className="font-bold text-white">TechWisdom Technologies</p>
                  <p className="text-[10px] text-slate-400 leading-normal">158/Cha, Kuratoli Rd, Dhaka 1229</p>
                </div>
              </div>

              {/* PREPARED FOR - MENTIONS SPECIFIC CLIENT NAME */}
              <div className="space-y-2 pt-3 border-t border-slate-800">
                <h4 className="text-[9px] font-black uppercase tracking-widest text-[#ff7006]">Prepared For</h4>
                <div className="text-[11px] space-y-1 font-semibold text-white">
                  <div>
                    <p className="text-[8px] text-slate-450 uppercase tracking-widest font-extrabold">Client Name</p>
                    <p className="font-extrabold text-[12.5px] text-white leading-tight">{displayClientName}</p>
                  </div>
                  <div>
                    <p className="text-[8px] text-slate-455 uppercase tracking-widest font-extrabold">Company / Business</p>
                    <p className="font-bold text-[11px] text-slate-200 uppercase leading-tight">{displayBusinessName}</p>
                  </div>
                  {/* Physical spacer to guarantee horizontal line before ID has top space in PDF */}
                  <div className="h-4 flex-none" />

                  <div className="space-y-1 pt-2.5 text-[9.5px] text-slate-400 border-t border-slate-800/60 font-mono">
                    <div className="flex justify-between">
                      <span>ID:</span>
                      <strong className="text-white">{genuineClientId}</strong>
                    </div>
                    <div className="flex justify-between">
                      <span>DATE:</span>
                      <strong className="text-white">{selectedProposal.date || '12 May, 2026'}</strong>
                    </div>
                  </div>
                </div>
              </div>

              {/* EXECUTION & SCOPE */}
              {selectedProposal.execution_scope && (
                <div className="space-y-1.5 pt-3 border-t border-slate-800">
                  <h4 className="text-[9px] font-black uppercase tracking-widest text-[#ff7006]">Execution & Scope:</h4>
                  <p className="text-[10.5px] leading-relaxed text-slate-200 font-medium whitespace-pre-line">
                    {selectedProposal.execution_scope}
                  </p>
                </div>
              )}

              {/* TERMS & CONDITIONS */}
              {selectedProposal.terms_and_conditions && (
                <div className="space-y-1.5 pt-3 border-t border-slate-800">
                  <h4 className="text-[9px] font-black uppercase tracking-widest text-[#ff7006]">Terms and conditions:</h4>
                  <p className="text-[10.5px] leading-relaxed text-slate-200 font-medium whitespace-pre-line">
                    {selectedProposal.terms_and_conditions}
                  </p>
                </div>
              )}
            </div>

            {/* OFFICE/CLIENT COPY STAMP */}
            <div className="pt-6 flex-none text-center">
              <span className="text-[11px] font-black uppercase tracking-[0.25em] text-[#ff7006] font-mono">
                ✦ {type === 'office' ? 'OFFICE RECORD' : 'CLIENT COPY'} ✦
              </span>
            </div>
          </div>

          {/* RIGHT CANVAS (Pure Crisp White Invoice Paper) - 8 Columns */}
          <div className="col-span-8 bg-white p-6 flex flex-col justify-between text-black min-h-0 relative overflow-hidden">

            {/* SUBTLE BRAND WATERMARK BACKGROUND */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none z-0">
              <img
                src={blackLogoUrl || '/techwisdom.png'}
                className="w-[480px] h-[480px] object-contain opacity-[0.20]"
                alt="TechWisdom Watermark"
              />
            </div>

            <div className="space-y-5 min-h-0 flex-1 flex flex-col relative z-10">

              {/* TITLE segment */}
              <div className="space-y-1.5 flex-none">
                <h3 className="text-base font-black uppercase tracking-widest text-[#ff7006]">Workflow Cost</h3>
                <div className="h-0.5 bg-[#ff7006] w-full" />
              </div>

              {/* LINE ITEMS TABLE (MANDATORY CORE ITEMS ONLY) */}
              <div className="overflow-y-auto min-h-0 flex-1 pr-1 max-h-[500px]">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-[#ff7006]/40 text-[#ff7006] uppercase tracking-widest sticky top-0 bg-white">
                      <th className="font-black w-[35%] text-[10px]" style={{ paddingTop: '8px', paddingBottom: '12px' }}>Particulars</th>
                      <th className="font-black w-[40%] text-[10px]" style={{ paddingTop: '8px', paddingBottom: '12px' }}>Descriptions</th>
                      <th className="text-right font-black w-[25%] text-[10px]" style={{ paddingTop: '8px', paddingBottom: '12px' }}>Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {coreItems.map((item, idx) => (
                      <tr key={idx} className="border-b border-slate-100 hover:bg-orange-50/10 transition-colors">
                        <td className="pr-1 font-bold text-black text-[12px]" style={{ paddingTop: '12px', paddingBottom: '12px' }}>
                          {item.title || 'Untitled Line'}
                        </td>
                        <td className="text-slate-600 text-[10px] leading-relaxed pr-1" style={{ paddingTop: '12px', paddingBottom: '12px' }}>
                          {item.description || '—'}
                        </td>
                        <td className="text-right font-bold text-black text-[12.5px] font-mono" style={{ paddingTop: '12px', paddingBottom: '12px' }}>
                          {item.unit_price.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                      </tr>
                    ))}
                    {coreItems.length === 0 && (
                      <tr>
                        <td colSpan={3} className="py-6 text-center text-slate-400 italic">No core work items specified.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* SUB TOTAL & DYNAMIC OPTIONAL ITEMS BLOCK (INSERTED RIGHT AFTER SUB TOTAL) */}
              <div className="border-t border-slate-200 pt-3 space-y-2.5 flex-none bg-slate-50/50 p-3 rounded-2xl border border-slate-100">

                {/* SUB TOTAL - NOW RENDERED IN EXTRA BOLD BLACK COLOR */}
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-black text-black uppercase tracking-widest">Sub Total (Mandatory Cost)</span>
                  <span className="font-black text-black text-[14.5px] font-mono" style={{ fontWeight: 900 }}>BDT {subtotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>

                {/* DYNAMIC OPTIONS / ADD-ONS (RENDERED ONLY IF EXIST) */}
                {optionalItems.length > 0 && (
                  <div className="pt-2 border-t border-dashed border-slate-200 space-y-1.5">
                    <p className="text-[8px] font-black uppercase text-[#ff7006] tracking-widest mb-1 flex items-center gap-1">
                      <Sparkles className="h-3 w-3 text-[#ff7006]" /> Additional Service Options (Yearly/Monthly)
                    </p>
                    <div className="space-y-1">
                      {optionalItems.map((item, idx) => (
                        <div key={idx} className="flex justify-between items-start text-[10px] text-slate-700">
                          <div className="space-y-0.5">
                            <span className="font-bold text-black">[ ] {item.title}</span>
                            {item.description && <span className="block text-[9px] text-slate-500 leading-normal pl-3">{item.description}</span>}
                          </div>
                          <span className="font-bold text-slate-800 font-mono pl-2">BDT {item.unit_price.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* GRAND TOTAL - RENDERED COMBINING SUB TOTAL + ALL OPTIONAL COSTS */}
                <div className="flex justify-between items-center text-xs font-black text-black uppercase tracking-widest pt-2 border-t border-[#ff7006]/30">
                  <span>Grand Total</span>
                  <span className="text-[#ff7006] text-base font-mono">BDT {grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
              </div>

              {/* DYNAMIC RECOMMENDED SUGGESTIONS SECTION */}
              {suggestions.length > 0 && (
                <div className="bg-white border border-dashed border-[#ff7006]/40 p-4 rounded-2xl space-y-2 flex-none">
                  <h4 className="text-[9.5px] font-black uppercase tracking-widest text-[#ff7006] flex items-center gap-1">
                    <Sparkles className="h-3 w-3 text-[#ff7006]" /> Suggestions (Recommended Add-ons)
                  </h4>
                  <div className="space-y-1.5">
                    {suggestions.map((s: any, idx: number) => (
                      <div key={idx} className="flex justify-between items-start text-xs border-b border-slate-100 pb-1.5 last:border-0 last:pb-0">
                        <div className="space-y-0.5">
                          <p className="font-bold text-black text-[10.5px]">{s.title || 'Suggested Addition'}</p>
                          {s.description && <p className="text-[9.5px] text-slate-800 leading-normal">{s.description}</p>}
                        </div>
                        <p className="text-right font-black text-[#ff7006] text-[10.5px] font-mono whitespace-nowrap pl-2">
                          + BDT {Number(s.amount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* FOOTNOTE DISCLAIMER */}
              {selectedProposal.footnote && (
                <p className="text-[9.5px] leading-relaxed text-black italic flex-none border-t border-slate-50 pt-2">
                  {selectedProposal.footnote}
                </p>
              )}
            </div>

            {/* CLIENT & PROJECT MANAGER SIGNATURES */}
            <div className="pt-6 flex justify-between items-end flex-none">
              <div className="w-36 space-y-2 text-center">
                <div className="border-b border-slate-300 pb-0.5 h-6 flex items-end justify-center italic text-xs text-slate-400">
                  {/* Simulated signature area */}
                </div>
                <p className="text-[8px] font-black uppercase tracking-widest text-[#ff7006]">Client Signature</p>
              </div>
              <div className="w-36 space-y-2 text-center">
                <div className="border-b border-[#ff7006]/30 pb-0.5 h-6 flex items-end justify-center italic text-xs text-slate-400">
                  {/* Simulated signature area */}
                </div>
                <p className="text-[8px] font-black uppercase tracking-widest text-[#ff7006]">Project Manager Signature</p>
              </div>
            </div>

          </div>

        </div>

        {/* BRAND FOOTER STRIP */}
        <div className="bg-[#18181b] h-12 flex items-center justify-between px-6 text-[12px] font-extrabold text-white border-t border-slate-900 font-mono print:bg-[#18181b] print:text-white flex-none leading-none">
          <span>📞 +880 1799 269 699</span>
          <span>✉️ official@techwisdom.site</span>
          <span>🌐 www.techwisdom.site</span>
          <span className="text-slate-350">📍 Kuratoli Rd, Dhaka 1229</span>
        </div>
      </div>
    );

    return (
      <DashboardLayout>
        <div className="max-w-[1600px] mx-auto space-y-6 pb-12 print:p-0 print:pb-0">

          {/* Header Action Bar */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-gradient-to-r from-slate-900 via-slate-850 to-slate-950 p-6 rounded-[32px] border border-slate-800 shadow-xl relative overflow-hidden group print:hidden">
            <div className="absolute top-0 right-0 w-80 h-80 bg-[#ff7006]/5 rounded-full blur-[80px] pointer-events-none" />
            <div className="relative z-10">
              <div className="flex items-center gap-2">
                <span className="p-1.5 bg-[#ff7006]/10 rounded-xl border border-[#ff7006]/20">
                  <Sparkles className="h-5 w-5 text-[#ff7006] animate-pulse" />
                </span>
                <h1 className="text-2xl font-black text-white tracking-tight">
                  {selectedProposal.id ? 'Edit System Proposal' : 'Draft New ERP Proposal'}
                </h1>
              </div>
              <p className="text-xs text-slate-400 mt-1.5 font-medium max-w-xl">Real-time Canva Quotation Template compiler</p>
            </div>

            <div className="flex gap-2 relative z-10">
              <Button variant="outline" size="sm" className="rounded-xl h-10 px-4 font-extrabold text-xs tracking-wider uppercase bg-slate-850 hover:bg-slate-800 text-slate-350 border-slate-800" onClick={() => setView('list')}>Cancel</Button>
              <Button variant="outline" size="sm" className="rounded-xl h-10 px-4 font-extrabold text-xs tracking-wider uppercase border border-[#ff7006]/20 text-[#ff7006] hover:bg-[#ff7006] hover:text-white transition-all" onClick={handlePrint}>
                <Download className="h-4 w-4 mr-2" /> Download / Print PDF
              </Button>
              <Button className="bg-gradient-to-r from-[#ff7006] to-[#e05e00] hover:opacity-95 text-white rounded-xl h-10 px-5 font-extrabold text-xs tracking-wider uppercase shadow-lg shadow-orange-500/10 hover:shadow-orange-500/25 border border-[#ff7006]/20" onClick={handleSaveAndUpload} disabled={saveProposal.isPending}>
                {saveProposal.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CheckCircle className="h-4 w-4 mr-2" />} Save Draft & PDF
              </Button>
            </div>
          </div>

          <div className="grid lg:grid-cols-12 gap-6 items-start">

            {/* LEFT INPUT CONSOLE - 5 Columns */}
            <div className="lg:col-span-5 space-y-6 print:hidden">
              <Tabs defaultValue="settings" className="w-full">
                <TabsList className="grid w-full grid-cols-5 rounded-2xl h-12 p-1.5 bg-slate-100/80 dark:bg-slate-900 border border-slate-200/20 shadow-inner">
                  <TabsTrigger value="settings" className="rounded-xl text-[10px] font-black uppercase tracking-wider py-2 transition-all duration-200 data-[state=active]:bg-[#ff7006] data-[state=active]:text-white data-[state=active]:shadow-md data-[state=active]:shadow-orange-500/20 text-slate-500 hover:text-slate-800 dark:hover:text-slate-300">Settings</TabsTrigger>
                  <TabsTrigger value="scope" className="rounded-xl text-[10px] font-black uppercase tracking-wider py-2 transition-all duration-200 data-[state=active]:bg-[#ff7006] data-[state=active]:text-white data-[state=active]:shadow-md data-[state=active]:shadow-orange-500/20 text-slate-500 hover:text-slate-800 dark:hover:text-slate-300">Scope</TabsTrigger>
                  <TabsTrigger value="pricing" className="rounded-xl text-[10px] font-black uppercase tracking-wider py-2 transition-all duration-200 data-[state=active]:bg-[#ff7006] data-[state=active]:text-white data-[state=active]:shadow-md data-[state=active]:shadow-orange-500/20 text-slate-500 hover:text-slate-800 dark:hover:text-slate-300">Core Cost</TabsTrigger>
                  <TabsTrigger value="optional" className="rounded-xl text-[10px] font-black uppercase tracking-wider py-2 transition-all duration-200 data-[state=active]:bg-[#ff7006] data-[state=active]:text-white data-[state=active]:shadow-md data-[state=active]:shadow-orange-500/20 text-slate-500 hover:text-slate-800 dark:hover:text-slate-300">Optional</TabsTrigger>
                  <TabsTrigger value="suggestions" className="rounded-xl text-[10px] font-black uppercase tracking-wider py-2 transition-all duration-200 data-[state=active]:bg-[#ff7006] data-[state=active]:text-white data-[state=active]:shadow-md data-[state=active]:shadow-orange-500/20 text-slate-500 hover:text-slate-800 dark:hover:text-slate-300">Upsell</TabsTrigger>
                </TabsList>

                {/* SETTINGS TAB */}
                <TabsContent value="settings" className="mt-4 space-y-4">
                  <Card className="rounded-[28px] border border-slate-150/70 dark:border-slate-800/80 shadow-md bg-gradient-to-br from-white to-slate-50/50 dark:from-slate-900 dark:to-slate-950/40 relative overflow-hidden">
                    <CardHeader className="pb-3 border-b border-slate-100/50 dark:border-slate-850/50">
                      <CardTitle className="text-sm font-black uppercase tracking-wider text-slate-800 dark:text-slate-200 flex items-center gap-2">
                        <FileSignature className="h-4.5 w-4.5 text-[#ff7006]" />
                        Proposal Metadata
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4 pt-4">
                      <div className="space-y-1.5">
                        <Label className="text-[10px] font-black uppercase tracking-widest text-[#ff7006]">Proposal Title</Label>
                        <Input
                          value={selectedProposal.title}
                          onChange={e => setSelectedProposal({ ...selectedProposal, title: e.target.value })}
                          placeholder="e.g. AF Associates Website Proposal"
                          className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-950/30 text-xs px-3.5 focus-visible:ring-1 focus-visible:ring-[#ff7006] hover:border-slate-350 focus-visible:border-[#ff7006] transition-all duration-200 font-semibold h-10"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <Label className="text-[10px] font-black uppercase tracking-widest text-[#ff7006]">Proposal Code (Client ID)</Label>
                          <Input
                            value={selectedProposal.client_code || ''}
                            onChange={e => setSelectedProposal({ ...selectedProposal, client_code: e.target.value })}
                            placeholder="e.g. 2MAY6-02"
                            className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-950/30 text-xs px-3.5 focus-visible:ring-1 focus-visible:ring-[#ff7006] hover:border-slate-350 focus-visible:border-[#ff7006] transition-all duration-200 font-semibold h-10"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-[10px] font-black uppercase tracking-widest text-[#ff7006]">Proposal Date</Label>
                          <Input
                            value={selectedProposal.date || ''}
                            onChange={e => setSelectedProposal({ ...selectedProposal, date: e.target.value })}
                            placeholder="e.g. 12 May, 2026"
                            className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-950/30 text-xs px-3.5 focus-visible:ring-1 focus-visible:ring-[#ff7006] hover:border-slate-350 focus-visible:border-[#ff7006] transition-all duration-200 font-semibold h-10"
                          />
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-[10px] font-black uppercase tracking-widest text-[#ff7006]">Client Contact Person Name</Label>
                        <Input
                          value={selectedProposal.contact_person || ''}
                          onChange={e => setSelectedProposal({ ...selectedProposal, contact_person: e.target.value })}
                          placeholder="e.g. Mujahid Raj"
                          className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-950/30 text-xs px-3.5 focus-visible:ring-1 focus-visible:ring-[#ff7006] hover:border-slate-350 focus-visible:border-[#ff7006] transition-all duration-200 font-semibold h-10"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-[10px] font-black uppercase tracking-widest text-[#ff7006]">Target Lead / Client Lookup</Label>
                        <Select value={selectedProposal.lead_id || ''} onValueChange={v => setSelectedProposal({ ...selectedProposal, lead_id: v })}>
                          <SelectTrigger className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-950/30 text-xs px-3.5 focus-visible:ring-1 focus-visible:ring-[#ff7006] hover:border-slate-350 focus-visible:border-[#ff7006] h-10 font-semibold text-left">
                            <SelectValue placeholder="Select target business..." />
                          </SelectTrigger>
                          <SelectContent className="rounded-2xl border-slate-200 dark:border-slate-800 shadow-xl">
                            {leads.map((l: any) => (
                              <SelectItem key={l.id} value={l.id} className="text-xs font-semibold rounded-xl py-2 focus:bg-[#ff7006]/10 focus:text-[#ff7006]">{l.business_name} ({l.contact_person})</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-[10px] font-black uppercase tracking-widest text-[#ff7006]">Proposal Status</Label>
                        <Select value={selectedProposal.status} onValueChange={v => setSelectedProposal({ ...selectedProposal, status: v })}>
                          <SelectTrigger className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-950/30 text-xs px-3.5 focus-visible:ring-1 focus-visible:ring-[#ff7006] hover:border-slate-350 focus-visible:border-[#ff7006] h-10 font-semibold text-left">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="rounded-2xl border-slate-200 dark:border-slate-800 shadow-xl">
                            <SelectItem value="draft" className="text-xs font-semibold rounded-xl py-2 focus:bg-[#ff7006]/10 focus:text-[#ff7006]">Draft</SelectItem>
                            <SelectItem value="sent" className="text-xs font-semibold rounded-xl py-2 focus:bg-[#ff7006]/10 focus:text-[#ff7006]">Sent</SelectItem>
                            <SelectItem value="viewed" className="text-xs font-semibold rounded-xl py-2 focus:bg-[#ff7006]/10 focus:text-[#ff7006]">Viewed</SelectItem>
                            <SelectItem value="accepted" className="text-xs font-semibold rounded-xl py-2 focus:bg-[#ff7006]/10 focus:text-[#ff7006]">Accepted</SelectItem>
                            <SelectItem value="rejected" className="text-xs font-semibold rounded-xl py-2 focus:bg-[#ff7006]/10 focus:text-[#ff7006]">Rejected</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* EXECUTION & SCOPE TAB */}
                <TabsContent value="scope" className="mt-4 space-y-4">
                  <Card className="rounded-[28px] border border-slate-150/70 dark:border-slate-800/80 shadow-md bg-gradient-to-br from-white to-slate-50/50 dark:from-slate-900 dark:to-slate-950/40 relative overflow-hidden">
                    <CardHeader className="pb-3 border-b border-slate-100/50 dark:border-slate-850/50">
                      <CardTitle className="text-sm font-black uppercase tracking-wider text-slate-800 dark:text-slate-200 flex items-center gap-2">
                        <Sparkles className="h-4.5 w-4.5 text-[#ff7006]" />
                        Execution & Scope Details
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4 pt-4">
                      <div className="space-y-1.5">
                        <Label className="text-[10px] font-black uppercase tracking-widest text-[#ff7006]">Execution Provisions & Scope</Label>
                        <Textarea
                          rows={6}
                          value={selectedProposal.execution_scope}
                          onChange={e => setSelectedProposal({ ...selectedProposal, execution_scope: e.target.value })}
                          className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-950/30 text-xs px-3.5 focus-visible:ring-1 focus-visible:ring-[#ff7006] hover:border-slate-350 focus-visible:border-[#ff7006] transition-all duration-200 font-semibold text-xs leading-relaxed"
                          placeholder="Write support, training, and maintenance provisions..."
                        />
                      </div>

                      <div className="space-y-1.5">
                        <Label className="text-[10px] font-black uppercase tracking-widest text-[#ff7006]">Terms & Conditions</Label>
                        <Textarea
                          rows={6}
                          value={selectedProposal.terms_and_conditions || ''}
                          onChange={e => setSelectedProposal({ ...selectedProposal, terms_and_conditions: e.target.value })}
                          placeholder="e.g. Payment terms, project validity..."
                          className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-950/30 text-xs px-3.5 focus-visible:ring-1 focus-visible:ring-[#ff7006] hover:border-slate-350 focus-visible:border-[#ff7006] transition-all duration-200 font-semibold text-xs leading-relaxed"
                        />
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* CORE PRICING TAB (Mandatory Items) */}
                <TabsContent value="pricing" className="mt-4 space-y-4">
                  <Card className="rounded-[28px] border border-slate-150/70 dark:border-slate-800/80 shadow-md bg-gradient-to-br from-white to-slate-50/50 dark:from-slate-900 dark:to-slate-950/40 relative overflow-hidden">
                    <CardHeader className="pb-3 flex flex-row justify-between items-center border-b border-slate-100/50 dark:border-slate-850/50">
                      <div>
                        <CardTitle className="text-sm font-black uppercase tracking-wider text-slate-800 dark:text-slate-200 flex items-center gap-2">
                          <DollarSign className="h-4.5 w-4.5 text-[#ff7006]" />
                          Mandatory Core Costs
                        </CardTitle>
                        <CardDescription className="text-[10px]">These sum to the Subtotal amount</CardDescription>
                      </div>
                      <Button variant="outline" size="sm" onClick={addCoreItem} className="h-8 text-[11px] font-extrabold uppercase rounded-xl border-[#ff7006]/20 hover:border-[#ff7006] text-[#ff7006] hover:bg-[#ff7006]/5 transition-all"><Plus className="h-3 w-3 mr-1" /> Add Cost</Button>
                    </CardHeader>
                    <CardContent className="space-y-4 max-h-[480px] overflow-y-auto pr-1 pt-4">
                      {items.filter(item => !item.is_optional).map((item, originalIndex) => {
                        const index = items.findIndex(i => i === item);
                        return (
                          <div key={originalIndex} className="space-y-3.5 border border-slate-200/50 dark:border-slate-800/80 p-4 rounded-2xl bg-gradient-to-r from-slate-50/50 to-slate-100/30 dark:from-slate-900/60 dark:to-slate-950/40 relative group hover:border-[#ff7006]/30 transition-all duration-200">
                            <div className="space-y-1">
                              <Label className="text-[9px] font-black uppercase tracking-widest text-slate-400">Particular Title</Label>
                              <Input
                                placeholder="Particular (e.g. Interface Development)"
                                value={item.title}
                                onChange={e => updateItem(index, 'title', e.target.value)}
                                className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-950/30 text-xs px-3.5 focus-visible:ring-1 focus-visible:ring-[#ff7006] hover:border-slate-350 focus-visible:border-[#ff7006] transition-all duration-200 font-semibold h-9"
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-[9px] font-black uppercase tracking-widest text-slate-400">Particular Description</Label>
                              <Input
                                placeholder="Description Details"
                                value={item.description}
                                onChange={e => updateItem(index, 'description', e.target.value)}
                                className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-950/30 text-[11px] px-3.5 focus-visible:ring-1 focus-visible:ring-[#ff7006] hover:border-slate-350 focus-visible:border-[#ff7006] transition-all duration-200 h-8 text-muted-foreground"
                              />
                            </div>
                            <div className="flex gap-3 items-center">
                              <div className="flex-1 space-y-1">
                                <Label className="text-[9px] font-black uppercase tracking-widest text-[#ff7006]">Quantity</Label>
                                <Input
                                  type="number"
                                  value={item.quantity}
                                  onChange={e => updateItem(index, 'quantity', Number(e.target.value))}
                                  className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-950/30 text-xs px-3.5 focus-visible:ring-1 focus-visible:ring-[#ff7006] hover:border-slate-350 focus-visible:border-[#ff7006] transition-all duration-200 h-8 font-semibold"
                                />
                              </div>
                              <div className="flex-1 space-y-1">
                                <Label className="text-[9px] font-black uppercase tracking-widest text-[#ff7006]">Amount (BDT)</Label>
                                <Input
                                  type="number"
                                  value={item.unit_price}
                                  onChange={e => updateItem(index, 'unit_price', Number(e.target.value))}
                                  className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-950/30 text-xs px-3.5 focus-visible:ring-1 focus-visible:ring-[#ff7006] hover:border-slate-350 focus-visible:border-[#ff7006] transition-all duration-200 h-8 font-semibold font-mono text-[#ff7006]"
                                />
                              </div>
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="absolute -right-2 -top-2 h-6 w-6 rounded-full bg-rose-500 hover:bg-rose-600 text-white shadow-sm opacity-0 group-hover:opacity-100 transition-all scale-75 group-hover:scale-100"
                              onClick={() => removeItem(index)}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        );
                      })}
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* OPTIONAL COSTS TAB (e.g. Hosting Cost, API Cost) */}
                <TabsContent value="optional" className="mt-4 space-y-4">
                  <Card className="rounded-[28px] border border-slate-150/70 dark:border-slate-800/80 shadow-md bg-gradient-to-br from-white to-slate-50/50 dark:from-slate-900 dark:to-slate-950/40 relative overflow-hidden">
                    <CardHeader className="pb-3 flex flex-row justify-between items-center border-b border-slate-100/50 dark:border-slate-850/50">
                      <div>
                        <CardTitle className="text-sm font-black uppercase tracking-wider text-slate-800 dark:text-slate-200 flex items-center gap-2">
                          <Building className="h-4.5 w-4.5 text-[#ff7006]" />
                          Optional Costs & Add-ons
                        </CardTitle>
                        <CardDescription className="text-[10px]">Hosting cost, API cost, yearly support etc.</CardDescription>
                      </div>
                      <Button variant="outline" size="sm" onClick={addOptionalItem} className="h-8 text-[11px] font-extrabold uppercase rounded-xl border-[#ff7006]/20 hover:border-[#ff7006] text-[#ff7006] hover:bg-[#ff7006]/5 transition-all"><Plus className="h-3 w-3 mr-1" /> Add Option</Button>
                    </CardHeader>
                    <CardContent className="space-y-4 max-h-[480px] overflow-y-auto pr-1 pt-4">
                      {items.filter(item => item.is_optional).map((item, originalIndex) => {
                        const index = items.findIndex(i => i === item);
                        return (
                          <div key={originalIndex} className="space-y-3.5 border border-orange-200/40 dark:border-[#ff7006]/25 p-4 rounded-2xl bg-gradient-to-r from-orange-50/10 to-orange-100/5 dark:from-[#ff7006]/5 dark:to-orange-500/5 relative group hover:border-[#ff7006]/40 transition-all duration-200">
                            <div className="space-y-1">
                              <Label className="text-[9px] font-black uppercase tracking-widest text-slate-400">Optional Particular Title</Label>
                              <Input
                                placeholder="Optional Item (e.g. Hosting Cost * Yearly)"
                                value={item.title}
                                onChange={e => updateItem(index, 'title', e.target.value)}
                                className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-950/30 text-xs px-3.5 focus-visible:ring-1 focus-visible:ring-[#ff7006] hover:border-slate-350 focus-visible:border-[#ff7006] transition-all duration-200 font-semibold h-9"
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-[9px] font-black uppercase tracking-widest text-slate-400">Optional Description</Label>
                              <Input
                                placeholder="Description Details (e.g. Managed AWS server hosting)"
                                value={item.description}
                                onChange={e => updateItem(index, 'description', e.target.value)}
                                className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-950/30 text-[11px] px-3.5 focus-visible:ring-1 focus-visible:ring-[#ff7006] hover:border-slate-350 focus-visible:border-[#ff7006] transition-all duration-200 h-8 text-muted-foreground"
                              />
                            </div>
                            <div className="flex gap-3 items-center">
                              <div className="flex-1 space-y-1">
                                <Label className="text-[9px] font-black uppercase tracking-widest text-[#ff7006]">Quantity</Label>
                                <Input
                                  type="number"
                                  value={item.quantity}
                                  onChange={e => updateItem(index, 'quantity', Number(e.target.value))}
                                  className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-950/30 text-xs px-3.5 focus-visible:ring-1 focus-visible:ring-[#ff7006] hover:border-slate-350 focus-visible:border-[#ff7006] transition-all duration-200 h-8 font-semibold"
                                />
                              </div>
                              <div className="flex-1 space-y-1">
                                <Label className="text-[9px] font-black uppercase tracking-widest text-[#ff7006]">Estimated Cost (BDT)</Label>
                                <Input
                                  type="number"
                                  value={item.unit_price}
                                  onChange={e => updateItem(index, 'unit_price', Number(e.target.value))}
                                  className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-950/30 text-xs px-3.5 focus-visible:ring-1 focus-visible:ring-[#ff7006] hover:border-slate-350 focus-visible:border-[#ff7006] transition-all duration-200 h-8 font-semibold font-mono text-[#ff7006]"
                                />
                              </div>
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="absolute -right-2 -top-2 h-6 w-6 rounded-full bg-rose-500 hover:bg-rose-600 text-white shadow-sm opacity-0 group-hover:opacity-100 transition-all scale-75 group-hover:scale-100"
                              onClick={() => removeItem(index)}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        );
                      })}
                      {items.filter(item => item.is_optional).length === 0 && (
                        <div className="text-center py-8 text-slate-400 italic text-xs font-semibold">
                          No optional costs configured yet. Click "Add Option" above to configure hosting/API costs.
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  <Card className="rounded-[28px] border border-slate-150/70 dark:border-slate-800/80 shadow-md bg-gradient-to-br from-white to-slate-50/50 dark:from-slate-900 dark:to-slate-950/40 relative overflow-hidden">
                    <CardHeader className="pb-3 border-b border-slate-100/50 dark:border-slate-850/50"><CardTitle className="text-sm font-black uppercase tracking-wider text-slate-800 dark:text-slate-200">Footnote Disclaimer Note</CardTitle></CardHeader>
                    <CardContent className="pt-4">
                      <Input
                        value={selectedProposal.footnote || ''}
                        onChange={e => setSelectedProposal({ ...selectedProposal, footnote: e.target.value })}
                        placeholder="e.g. * Amount can be varies according to hosting..."
                        className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-950/30 text-xs px-3.5 focus-visible:ring-1 focus-visible:ring-[#ff7006] hover:border-slate-350 focus-visible:border-[#ff7006] transition-all duration-200 font-semibold h-10"
                      />
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* SUGGESTIONS TAB */}
                <TabsContent value="suggestions" className="mt-4 space-y-4">
                  <Card className="rounded-[28px] border border-slate-150/70 dark:border-slate-800/80 shadow-md bg-gradient-to-br from-white to-slate-50/50 dark:from-slate-900 dark:to-slate-950/40 relative overflow-hidden">
                    <CardHeader className="pb-3 flex flex-row justify-between items-center border-b border-slate-100/50 dark:border-slate-850/50">
                      <CardTitle className="text-sm font-black uppercase tracking-wider text-slate-800 dark:text-slate-200 flex items-center gap-2">
                        <Sparkles className="h-4.5 w-4.5 text-[#ff7006]" />
                        Upsell Add-ons & Suggestions
                      </CardTitle>
                      <Button variant="outline" size="sm" onClick={addSuggestion} className="h-8 text-[11px] font-extrabold uppercase rounded-xl border-[#ff7006]/20 hover:border-[#ff7006] text-[#ff7006] hover:bg-[#ff7006]/5 transition-all"><Plus className="h-3 w-3 mr-1" /> Add Option</Button>
                    </CardHeader>
                    <CardContent className="space-y-4 max-h-[480px] overflow-y-auto pr-1 pt-4">
                      {suggestions.map((s, index) => (
                        <div key={index} className="space-y-3.5 border border-slate-200/50 dark:border-slate-800/80 p-4 rounded-2xl bg-gradient-to-r from-slate-50/50 to-slate-100/30 dark:from-slate-900/60 dark:to-slate-950/40 relative group hover:border-[#ff7006]/30 transition-all duration-200">
                          <div className="space-y-1">
                            <Label className="text-[9px] font-black uppercase tracking-widest text-slate-400">Suggested Work / Feature</Label>
                            <Input
                              placeholder="e.g. Payment Gateway Integration"
                              value={s.title}
                              onChange={e => updateSuggestion(index, 'title', e.target.value)}
                              className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-950/30 text-xs px-3.5 focus-visible:ring-1 focus-visible:ring-[#ff7006] hover:border-slate-350 focus-visible:border-[#ff7006] transition-all duration-200 font-semibold h-9"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-[9px] font-black uppercase tracking-widest text-slate-400">Description</Label>
                            <Input
                              placeholder="e.g. SSLCommerz supporting bKash, Nagad..."
                              value={s.description}
                              onChange={e => updateSuggestion(index, 'description', e.target.value)}
                              className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-950/30 text-[10px] px-3.5 focus-visible:ring-1 focus-visible:ring-[#ff7006] hover:border-slate-350 focus-visible:border-[#ff7006] transition-all duration-200 h-8 text-muted-foreground"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-[9px] font-black uppercase tracking-widest text-[#ff7006]">Suggested Cost (BDT)</Label>
                            <Input
                              type="number"
                              placeholder="15000"
                              value={s.amount}
                              onChange={e => updateSuggestion(index, 'amount', Number(e.target.value))}
                              className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-950/30 text-xs px-3.5 focus-visible:ring-1 focus-visible:ring-[#ff7006] hover:border-slate-350 focus-visible:border-[#ff7006] transition-all duration-200 h-8 font-semibold font-mono text-[#ff7006]"
                            />
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="absolute -right-2 -top-2 h-6 w-6 rounded-full bg-rose-500 hover:bg-rose-600 text-white shadow-sm opacity-0 group-hover:opacity-100 transition-all scale-75 group-hover:scale-100"
                            onClick={() => removeSuggestion(index)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
            </div>

            {/* RIGHT TEMPLATE CANVAS - 7 Columns */}
            <div className="lg:col-span-7 flex flex-col items-center w-full space-y-4">

              {/* Copy Toggle Switch (Preview Only) */}
              <div className="flex gap-1.5 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl print:hidden">
                <button
                  onClick={() => setPreviewCopy('office')}
                  className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${previewCopy === 'office'
                    ? 'bg-white dark:bg-slate-700 text-slate-800 dark:text-white shadow-sm'
                    : 'text-slate-500'
                    }`}
                >
                  🏫 Office Copy
                </button>
                <button
                  onClick={() => setPreviewCopy('client')}
                  className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${previewCopy === 'client'
                    ? 'bg-white dark:bg-slate-700 text-slate-800 dark:text-white shadow-sm'
                    : 'text-slate-500'
                    }`}
                >
                  🤝 Client Copy
                </button>
              </div>

              {/* RENDER ACTIVE PREVIEW */}
              <div id="visible-proposal-preview" className="bg-white rounded-none">
                {renderCanvaTemplate(previewCopy)}
              </div>

              {/* PRINT STYLE INJECTOR TO FORCE EXACT A4 SINGLE-PAGE PRESET ON THE SYSTEM PRINT DIALOG */}
              <style dangerouslySetInnerHTML={{
                __html: `
                .print-only {
                  display: none !important;
                }
                @media print {
                  body {
                    background: white !important;
                    color: black !important;
                    -webkit-print-color-adjust: exact !important;
                    print-color-adjust: exact !important;
                  }
                  #root, .dashboard-layout, main, .print\\:hidden {
                    display: none !important;
                  }
                  .print-only {
                    display: block !important;
                    position: absolute;
                    left: 0;
                    top: 0;
                    width: 100% !important;
                    height: 1140px !important;
                    margin: 0 !important;
                    padding: 0 !important;
                    -webkit-print-color-adjust: exact !important;
                    print-color-adjust: exact !important;
                  }
                  .print-only * {
                    -webkit-print-color-adjust: exact !important;
                    print-color-adjust: exact !important;
                  }
                  @page {
                    size: A4 portrait;
                    margin: 0 !important;
                  }
                }
              `}} />

              {/* HIDDEN PRINT CONTAINER RENDERING THE SELECTED SINGLE COPY FOR 100% PERFECT SINGLE PAGE PRINT */}
              <div className="print-only print-root w-full h-[1140px]">
                {renderCanvaTemplate(previewCopy, true)}
              </div>

              {/* HIDDEN OFFLINE PDF CAPTURE NODE - GUARANTEES FLAWLESS HTML2CANVAS */}
              <div style={{ position: 'absolute', top: '-10000px', left: '0', width: '820px' }}>
                <div id="hidden-pdf-capture-node">
                  {renderCanvaTemplate(previewCopy, true)}
                </div>
              </div>
            </div>

          </div>

        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="max-w-[1600px] mx-auto space-y-6 pb-12">

        {/* Sleek Dashboard Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-950 p-8 rounded-[32px] border border-slate-800 shadow-xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-80 h-80 bg-[#ff7006]/5 rounded-full blur-[80px] pointer-events-none" />
          <div className="relative z-10">
            <h1 className="text-3xl font-black tracking-tight text-white flex items-center gap-3">
              <span className="p-2.5 bg-[#ff7006]/10 rounded-2xl border border-[#ff7006]/20">
                <FileSignature className="h-7 w-7 text-[#ff7006] animate-pulse" />
              </span>
              Proposals Console
            </h1>
            <p className="text-xs text-slate-400 mt-2 font-medium max-w-xl leading-relaxed">Design premium consulting proposals, track client updates, and analyze pricing tiers with instant high-fidelity PDF exports.</p>
          </div>
          <Button className="bg-[#ff7006] hover:bg-[#e05e00] text-white rounded-2xl h-12 px-6 font-extrabold text-xs tracking-wider uppercase shadow-lg shadow-orange-500/20 hover:scale-[1.03] active:scale-[0.98] transition-all relative z-10 border border-[#ff7006]/30" onClick={() => openBuilder()}>
            <Plus className="h-4.5 w-4.5 mr-2" /> New System Proposal
          </Button>
        </div>

        {/* GLOWING METRICS ROW */}
        <div className="grid gap-6 md:grid-cols-3">
          <Card className="rounded-[32px] border-slate-100 dark:border-slate-850 shadow-sm relative overflow-hidden group hover:shadow-md transition-all bg-card/40 backdrop-blur-md">
            <div className="absolute top-0 right-0 w-32 h-32 bg-[#ff7006]/5 rounded-full blur-[40px]" />
            <CardContent className="p-6">
              <div className="flex justify-between items-start">
                <div className="space-y-2">
                  <p className="text-[10px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Total Active Pipeline</p>
                  <h3 className="text-3xl font-black text-slate-800 dark:text-white tracking-tight">{formatCurrency(totalValue)}</h3>
                </div>
                <div className="p-3 bg-orange-50 dark:bg-[#ff7006]/10 text-[#ff7006] rounded-2xl border border-orange-100 dark:border-[#ff7006]/20">
                  <TrendingUp className="h-5 w-5" />
                </div>
              </div>
              <div className="flex items-center gap-1.5 mt-5 text-[10px] font-bold text-emerald-500 bg-emerald-500/5 dark:bg-emerald-500/10 px-2.5 py-1 rounded-lg w-fit border border-emerald-500/10">
                <Sparkles className="h-3.5 w-3.5 animate-spin text-[#ff7006]" />
                <span>All active custom quotes</span>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-[32px] border-slate-100 dark:border-slate-855 shadow-sm relative overflow-hidden group hover:shadow-md transition-all bg-card/40 backdrop-blur-md">
            <div className="absolute top-0 right-0 w-32 h-32 bg-[#ff7006]/5 rounded-full blur-[40px]" />
            <CardContent className="p-6">
              <div className="flex justify-between items-start">
                <div className="space-y-2">
                  <p className="text-[10px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Approved Revenue</p>
                  <h3 className="text-3xl font-black text-[#ff7006] tracking-tight">{formatCurrency(acceptedValue)}</h3>
                </div>
                <div className="p-3 bg-orange-50 dark:bg-[#ff7006]/10 text-[#ff7006] rounded-2xl border border-orange-100 dark:border-[#ff7006]/20">
                  <Award className="h-5 w-5" />
                </div>
              </div>
              <div className="flex items-center gap-1.5 mt-5 text-[10px] font-bold text-slate-500 bg-slate-100 dark:bg-slate-800/50 px-2.5 py-1 rounded-lg w-fit border border-slate-200/20">
                <Clock className="h-3.5 w-3.5 text-[#ff7006]" />
                <span>Signed contracts & active projects</span>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-[32px] border-slate-100 dark:border-slate-850 shadow-sm relative overflow-hidden group hover:shadow-md transition-all bg-card/40 backdrop-blur-md">
            <div className="absolute top-0 right-0 w-32 h-32 bg-[#ff7006]/5 rounded-full blur-[40px]" />
            <CardContent className="p-6">
              <div className="flex justify-between items-start">
                <div className="space-y-2">
                  <p className="text-[10px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Proposal Win Rate</p>
                  <h3 className="text-3xl font-black text-[#ff7006] tracking-tight">{conversionRate}%</h3>
                </div>
                <div className="p-3 bg-orange-50 dark:bg-[#ff7006]/10 text-[#ff7006] rounded-2xl border border-orange-100 dark:border-[#ff7006]/20">
                  <CheckCircle className="h-5 w-5" />
                </div>
              </div>
              <div className="flex items-center gap-1.5 mt-5 text-[10px] font-bold text-slate-500 bg-slate-100 dark:bg-slate-800/50 px-2.5 py-1 rounded-lg w-fit border border-slate-200/20">
                <span>Based on overall proposal statistics</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* TAB FILTERS ROW */}
        <div className="flex flex-wrap justify-between items-center gap-4 bg-slate-50/50 dark:bg-slate-900/40 p-3 rounded-2xl border border-slate-100 dark:border-slate-850/80 backdrop-blur-sm">
          <div className="flex flex-wrap gap-1.5">
            {['all', 'draft', 'sent', 'viewed', 'accepted', 'rejected'].map((status) => (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                className={`px-4 py-2 rounded-xl text-xs font-extrabold capitalize tracking-wider transition-all duration-200 ${statusFilter === status
                  ? 'bg-gradient-to-r from-[#ff7006] to-[#e05e00] text-white shadow-md shadow-orange-500/10'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-350 hover:bg-slate-100/50 dark:hover:bg-slate-800/50'
                  }`}
              >
                {status}
              </button>
            ))}
          </div>
          <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest px-3 py-1 bg-slate-100/80 dark:bg-slate-800/80 rounded-lg border border-slate-200/10">Showing {filteredProposals.length} Items</span>
        </div>

        {/* REDESIGNED PROPOSALS LIST GRID */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {filteredProposals.map((p: any) => (
            <Card key={p.id} className="relative group bg-gradient-to-br from-white/95 to-slate-50/95 dark:from-slate-900/90 dark:to-slate-950/95 border border-slate-200/50 dark:border-slate-800/80 rounded-[32px] overflow-hidden shadow-sm hover:shadow-2xl hover:shadow-orange-500/5 hover:-translate-y-1.5 transition-all duration-300 flex flex-col justify-between">
              
              {/* Subtle background branding watermark inside each card */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none opacity-[0.02] dark:opacity-[0.015] z-0">
                <img src="/techwisdom.png" className="w-56 h-56 object-contain" alt="" />
              </div>

              {/* Glowing animated accent line */}
              <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-orange-500/20 via-[#ff7006] to-orange-500/20 transform origin-left scale-x-50 group-hover:scale-x-100 transition-transform duration-500 ease-out z-10" />
              
              <CardContent className="p-6 space-y-5 flex-1 flex flex-col justify-between relative z-10">

                <div className="space-y-4">
                  {/* Card Status & Total Amount Header */}
                  <div className="flex justify-between items-center pb-3 border-b border-slate-100/60 dark:border-slate-800/60">
                    {getStatusBadge(p.status)}
                    <span className="font-extrabold text-[15px] text-[#ff7006] tracking-tight bg-orange-50 dark:bg-[#ff7006]/10 px-3 py-1 rounded-xl border border-orange-100 dark:border-[#ff7006]/20 font-mono">
                      {formatCurrency(p.total_amount || 0)}
                    </span>
                  </div>

                  {/* Proposal Core Details */}
                  <div className="space-y-3.5 min-h-[95px]">
                    <h3 className="font-black text-base leading-snug tracking-tight text-slate-800 dark:text-white line-clamp-2 group-hover:text-[#ff7006] transition-colors duration-200">
                      {p.title}
                    </h3>
                    <div className="space-y-1.5">
                      <p className="text-xs text-slate-500 dark:text-slate-400 font-bold flex items-center gap-1.5">
                        <span className="p-1 bg-slate-100 dark:bg-slate-800 rounded-md text-slate-500 dark:text-slate-400">
                          <Building className="h-3.5 w-3.5 text-[#ff7006]" />
                        </span>
                        {p.leads?.business_name || p.client_id || 'N/A'}
                      </p>
                      {p.contact_person && (
                        <p className="text-[11px] text-slate-400 dark:text-slate-500 font-semibold flex items-center gap-1.5 pl-0.5">
                          <span className="p-0.5 bg-slate-50 dark:bg-slate-850 rounded">
                            <User className="h-3 w-3 text-slate-400" />
                          </span>
                          Ref: {p.contact_person}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Sub-item count badge */}
                  <div className="flex items-center justify-between text-[10px] text-slate-400 dark:text-slate-500 font-extrabold uppercase tracking-widest bg-slate-50/50 dark:bg-slate-900/60 p-2.5 rounded-xl border border-slate-100 dark:border-slate-850">
                    <span className="flex items-center gap-1.5"><FileText className="h-4 w-4 text-[#ff7006]/85" /> Items Cataloged</span>
                    <span className="bg-slate-200/70 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 px-2.5 py-0.5 rounded-lg font-black">{p.proposal_items?.length || 0}</span>
                  </div>
                </div>

                {/* Interactive Card Action Buttons */}
                <div className="flex gap-2 pt-3">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 rounded-xl font-extrabold text-xs h-10 border-slate-200 dark:border-slate-800 hover:border-[#ff7006]/30 hover:bg-[#ff7006]/5 hover:text-[#ff7006] text-slate-700 dark:text-slate-200 transition-all"
                    onClick={() => openBuilder(p)}
                  >
                    <Edit className="h-3.5 w-3.5 mr-1.5 text-[#ff7006]" /> Edit
                  </Button>

                  {(() => {
                    let parsedContent: any = {};
                    try { parsedContent = JSON.parse(p.content || '{}'); } catch (e) { }
                    const activePdfUrl = p.pdf_url || parsedContent.pdf_url;

                    if (activePdfUrl) {
                      return (
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-none rounded-xl font-bold text-xs h-10 w-10 p-0 border-[#ff7006]/20 text-[#ff7006] hover:bg-[#ff7006] hover:text-white transition-all shadow-sm"
                          onClick={() => window.open(activePdfUrl, '_blank')}
                          title="Download System PDF"
                        >
                          <Download className="h-4 w-4 mx-auto" />
                        </Button>
                      );
                    }
                    return null;
                  })()}

                  {p.status === 'draft' && (
                    <Button
                      size="sm"
                      className="flex-1 bg-gradient-to-r from-[#ff7006] to-[#e05e00] text-white hover:opacity-95 rounded-xl font-extrabold text-xs h-10 shadow-md shadow-orange-500/10 hover:shadow-orange-500/20 transition-all border border-[#ff7006]/20"
                      onClick={() => updateStatus.mutate({ id: p.id, status: 'sent' })}
                    >
                      <Send className="h-3.5 w-3.5 mr-1.5" /> Send
                    </Button>
                  )}

                  {p.status === 'sent' && (
                    <Button
                      size="sm"
                      className="flex-1 bg-gradient-to-r from-emerald-500 to-teal-500 text-white hover:opacity-95 rounded-xl font-extrabold text-xs h-10 transition-all shadow-md shadow-emerald-500/10"
                      onClick={() => updateStatus.mutate({ id: p.id, status: 'accepted' })}
                    >
                      <CheckCircle className="h-3.5 w-3.5 mr-1.5" /> Accept
                    </Button>
                  )}
                </div>

                {/* Master Delete Button */}
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/20 hover:text-rose-600 rounded-full h-8 w-8 transition-all duration-200"
                  onClick={() => { if (confirm('Are you sure you want to permanently delete this proposal?')) deleteProposal.mutate(p.id); }}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>

              </CardContent>
            </Card>
          ))}

          {filteredProposals.length === 0 && (
            <div className="col-span-full py-24 text-center text-muted-foreground bg-card rounded-[32px] border border-dashed border-slate-200 dark:border-slate-800">
              <FileText className="h-14 w-14 mx-auto mb-4 opacity-25 text-indigo-500 animate-bounce" />
              <h4 className="font-extrabold text-sm text-slate-700 dark:text-slate-350">No proposals found</h4>
              <p className="text-xs text-slate-450 mt-1 max-w-[280px] mx-auto leading-relaxed">Create a new customized business proposal or adjust your active status filters.</p>
            </div>
          )}
        </div>

      </div>
    </DashboardLayout>
  );
}
