import { useState, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import * as XLSX from 'xlsx';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Upload, FileSpreadsheet, Check } from 'lucide-react';
import { toast } from 'sonner';

interface LeadImporterProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function LeadImporter({ open, onOpenChange }: LeadImporterProps) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<any[]>([]);
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
    setPreview(json.slice(0, 5));
  };

  const handleImport = async () => {
    if (!file) return;
    setImporting(true);
    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows: any[] = XLSX.utils.sheet_to_json(sheet);

      const leads = rows.map((row, i) => ({
        sl_no: i + 1,
        business_name: row['Business Name'] || row['business_name'] || 'Unknown',
        contact_person: row['Contact Person'] || row['contact_person'] || null,
        phone: row['Phone'] || row['phone'] || null,
        email: row['Email'] || row['email'] || null,
        category: 'other',
        city: row['City/ Area'] || row['City'] || row['city'] || null,
        address: row['Address'] || row['address'] || null,
        facebook_page: row['Facebook Page'] || row['facebook_page'] || null,
        source: 'excel_import',
        status: 'new',
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Import Leads from Excel</DialogTitle>
          <DialogDescription>Upload your Excel file to import leads into the CRM.</DialogDescription>
        </DialogHeader>

        {!file ? (
          <div
            onDrop={handleDrop}
            onDragOver={(e) => e.preventDefault()}
            className="border-2 border-dashed border-primary/30 rounded-lg p-12 text-center hover:border-primary/50 transition-colors cursor-pointer"
            onClick={() => document.getElementById('file-upload')?.click()}
          >
            <Upload className="h-12 w-12 mx-auto text-primary/50 mb-4" />
            <p className="text-lg font-medium">Drop your Excel file here</p>
            <p className="text-sm text-muted-foreground mt-1">or click to browse</p>
            <input id="file-upload" type="file" accept=".xlsx,.xls" className="hidden" onChange={(e) => e.target.files?.[0] && processFile(e.target.files[0])} />
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
              <FileSpreadsheet className="h-8 w-8 text-primary" />
              <div>
                <p className="font-medium">{file.name}</p>
                <p className="text-sm text-muted-foreground">{preview.length}+ rows detected</p>
              </div>
              <Check className="h-5 w-5 text-success ml-auto" />
            </div>

            <div className="text-sm">
              <p className="font-medium mb-2">Preview (first 5 rows):</p>
              <div className="overflow-x-auto max-h-48 border rounded">
                <pre className="p-2 text-xs">{JSON.stringify(preview, null, 2)}</pre>
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => { setFile(null); setPreview([]); }}>Cancel</Button>
              <Button onClick={handleImport} disabled={importing} className="gradient-primary">
                {importing ? 'Importing...' : 'Import Leads'}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}