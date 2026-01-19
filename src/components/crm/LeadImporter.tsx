import { useState, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import * as XLSX from 'xlsx';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Upload, FileSpreadsheet, Check } from 'lucide-react';
import { toast } from 'sonner';

type LeadCategory = 'study_abroad' | 'fashion' | 'real_estate' | 'healthcare' | 'technology' | 'education' | 'retail' | 'hospitality' | 'other';
type LeadStatus = 'new' | 'contacted' | 'in_negotiation' | 'deal_won' | 'deal_lost';

interface LeadImporterProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function LeadImporter({ open, onOpenChange }: LeadImporterProps) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<any[]>([]);
  // New state to control how many rows are shown (default to 10)
  const [previewLimit, setPreviewLimit] = useState<string>('10');
  const [importing, setImporting] = useState(false);
  const queryClient = useQueryClient();

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile?.name.endsWith('.xlsx') || droppedFile?.name.endsWith('.xls')) {
      processFile(droppedFile);
    } else {
      toast.error('Please upload an Excel file (.xlsx or .xls)');
    }
  }, []);

  const processFile = async (file: File) => {
    setFile(file);
    const data = await file.arrayBuffer();
    const workbook = XLSX.read(data);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const json = XLSX.utils.sheet_to_json(sheet);
    setPreview(json);
  };

  const mapCategory = (cat: string | undefined): LeadCategory => {
    if (!cat) return 'other';
    const lower = cat.toLowerCase().replace(/\s+/g, '_');
    const validCategories: LeadCategory[] = ['study_abroad', 'fashion', 'real_estate', 'healthcare', 'technology', 'education', 'retail', 'hospitality', 'other'];
    return validCategories.includes(lower as LeadCategory) ? (lower as LeadCategory) : 'other';
  };

  const handleImport = async () => {
    if (!file) return;
    setImporting(true);
    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows: any[] = XLSX.utils.sheet_to_json(sheet);

      const leads: {
        sl_no: number;
        business_name: string;
        contact_person?: string;
        phone?: string;
        email?: string;
        category: LeadCategory;
        city?: string;
        address?: string;
        facebook_page?: string;
        source: string;
        status: LeadStatus;
      }[] = rows.map((row, i) => ({
        sl_no: i + 1,
        business_name: String(row['Business Name'] || row['business_name'] || 'Unknown'),
        contact_person: row['Contact Person'] || row['contact_person'] || undefined,
        phone: row['Phone'] || row['phone'] || undefined,
        email: row['Email'] || row['email'] || undefined,
        category: mapCategory(row['Category'] || row['category']),
        city: row['City/ Area'] || row['City'] || row['city'] || undefined,
        address: row['Address'] || row['address'] || undefined,
        facebook_page: row['Facebook Page'] || row['facebook_page'] || undefined,
        source: 'excel_import',
        status: 'new' as LeadStatus,
      }));

      const { error } = await supabase.from('leads').insert(leads);
      if (error) throw error;

      toast.success(`Successfully imported ${leads.length} leads!`);
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      onOpenChange(false);
      setFile(null);
      setPreview([]);
    } catch (err: any) {
      toast.error(err.message || 'Failed to import leads');
    } finally {
      setImporting(false);
    }
  };

  // Logic to slice the data based on the selection
  const displayedPreview = previewLimit === 'all' 
    ? preview 
    : preview.slice(0, parseInt(previewLimit));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Import Leads from Excel</DialogTitle>
          <DialogDescription>Upload your Excel file to import leads into the CRM.</DialogDescription>
        </DialogHeader>

        {!file ? (
          <div
            onDrop={handleDrop}
            onDragOver={(e) => e.preventDefault()}
            className="border-2 border-dashed border-primary/30 rounded-lg p-8 text-center hover:border-primary/50 transition-colors cursor-pointer"
            onClick={() => document.getElementById('file-upload')?.click()}
          >
            <Upload className="h-10 w-10 mx-auto text-primary/50 mb-3" />
            <p className="text-base font-medium">Drop your Excel file here</p>
            <p className="text-xs text-muted-foreground mt-1">or click to browse</p>
            <input id="file-upload" type="file" accept=".xlsx,.xls" className="hidden" onChange={(e) => e.target.files?.[0] && processFile(e.target.files[0])} />
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
              <FileSpreadsheet className="h-6 w-6 text-primary" />
              <div>
                <p className="font-medium text-sm">{file.name}</p>
                <p className="text-xs text-muted-foreground">{preview.length} rows detected</p>
              </div>
              <Check className="h-4 w-4 text-success ml-auto" />
            </div>

            <div className="text-sm">
              <div className="flex items-center justify-between mb-2">
                <p className="font-medium text-xs">Preview Data:</p>
                
                {/* --- CUSTOMIZATION DROPDOWN --- */}
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Show rows:</span>
                  <Select value={previewLimit} onValueChange={setPreviewLimit}>
                    <SelectTrigger className="h-7 w-[90px] text-xs">
                      <SelectValue placeholder="10" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="10">10 Rows</SelectItem>
                      <SelectItem value="50">50 Rows</SelectItem>
                      <SelectItem value="all">Show All</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {/* ----------------------------- */}
              </div>

              <div className="overflow-x-auto max-h-64 border rounded bg-background/50">
                <pre className="p-2 text-[10px] leading-tight">
                  {JSON.stringify(displayedPreview, null, 2)}
                </pre>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" size="sm" onClick={() => { setFile(null); setPreview([]); }}>Cancel</Button>
              <Button onClick={handleImport} disabled={importing} size="sm" className="gradient-primary">
                {importing ? 'Importing...' : 'Import Leads'}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}