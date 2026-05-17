import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useActivityLog } from '@/hooks/useActivityLog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
import { FileText, Upload, Trash2, Download, Loader2, File } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

interface ProjectDocumentsProps {
  projectId: string;
  isAdmin: boolean;
}

const documentTypes = [
  { value: 'requirement', label: 'Requirement' },
  { value: 'agreement', label: 'Agreement' },
  { value: 'design', label: 'Design' },
  { value: 'other', label: 'Other' },
];

export function ProjectDocuments({ projectId, isAdmin }: ProjectDocumentsProps) {
  const queryClient = useQueryClient();
  const { logActivity, logSecurity } = useActivityLog();
  const [uploading, setUploading] = useState(false);
  const [docType, setDocType] = useState('other');
  const [deleteDoc, setDeleteDoc] = useState<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: documents = [], isLoading } = useQuery({
    queryKey: ['project-documents', projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('project_documents')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (doc: any) => {
      // Delete from storage
      const { error: storageError } = await supabase.storage
        .from('project-documents')
        .remove([doc.file_path]);
      
      if (storageError) console.error('Storage delete error:', storageError);

      // Delete from database
      const { error } = await supabase
        .from('project_documents')
        .delete()
        .eq('id', doc.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-documents', projectId] });
      toast.success('Document deleted');
      setDeleteDoc(null);
    },
    onError: (error: any) => {
      toast.error('Failed to delete: ' + error.message);
    },
  });

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Max 10MB
    if (file.size > 10 * 1024 * 1024) {
      toast.error('File must be less than 10MB');
      return;
    }

    setUploading(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}-${file.name}`;
      const filePath = `${projectId}/${fileName}`;

      // Upload to storage
      const { error: uploadError } = await supabase.storage
        .from('project-documents')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // Save to database
      const { error: dbError } = await supabase
        .from('project_documents')
        .insert({
          project_id: projectId,
          file_name: file.name,
          file_path: filePath,
          file_type: fileExt || 'unknown',
          document_type: docType,
          uploaded_by: userData.user?.id,
        });

      if (dbError) throw dbError;

      queryClient.invalidateQueries({ queryKey: ['project-documents', projectId] });
      toast.success('Document uploaded successfully');
    } catch (error: any) {
      console.error('Upload error:', error);
      toast.error('Failed to upload: ' + error.message);
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleDownload = async (doc: any) => {
    try {
      const { data, error } = await supabase.storage
        .from('project-documents')
        .download(doc.file_path);

      if (error) throw error;

      // Create download link
      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = doc.file_name;
      a.click();
      URL.revokeObjectURL(url);

      logActivity('downloaded', 'project_document', doc.file_name, projectId);
      logSecurity('EXPORT', 'PROJECT_DOCUMENT', `Downloaded project document "${doc.file_name}"`, projectId);
    } catch (error: any) {
      toast.error('Failed to download: ' + error.message);
    }
  };

  const getDocTypeColor = (type: string) => {
    switch (type) {
      case 'requirement': return 'bg-blue-500/10 text-blue-500';
      case 'agreement': return 'bg-green-500/10 text-green-500';
      case 'design': return 'bg-purple-500/10 text-purple-500';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  return (
    <div className="space-y-3">
      {/* Header with Upload Tool */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-border/30">
        <h4 className="font-bold text-xs flex items-center gap-1.5 text-slate-800 dark:text-slate-200">
          <FileText className="h-3.5 w-3.5 text-indigo-500" />
          Documents Folder
        </h4>
        {isAdmin && (
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Select value={docType} onValueChange={setDocType}>
              <SelectTrigger className="h-8 flex-1 sm:w-[110px] text-[10px] rounded-lg">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                {documentTypes.map((type) => (
                  <SelectItem key={type.value} value={type.value} className="text-xs">
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              className="hidden"
            />
            <Button
              size="sm"
              className="h-8 text-[10px] rounded-lg gap-1 px-2.5 shrink-0"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
            >
              {uploading ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <>
                  <Upload className="h-3 w-3" />
                  Upload
                </>
              )}
            </Button>
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="text-center py-4 text-xs text-muted-foreground flex items-center justify-center gap-1.5">
          <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" /> Loading documents...
        </div>
      ) : documents.length === 0 ? (
        <div className="text-center py-6 text-muted-foreground">
          <File className="h-6 w-6 mx-auto mb-1.5 opacity-40 text-muted-foreground" />
          <p className="text-xs">No documents uploaded yet</p>
        </div>
      ) : (
        <div className="space-y-2 mt-2">
          {documents.map((doc: any) => (
            <div
              key={doc.id}
              className="flex items-start sm:items-center justify-between p-2.5 rounded-xl bg-muted/30 hover:bg-muted/60 transition-colors border border-border/20 gap-2"
            >
              <div className="flex items-start sm:items-center gap-2.5 min-w-0 flex-1">
                <div className="p-1.5 bg-indigo-50 dark:bg-indigo-950/40 rounded-lg text-indigo-500 shrink-0">
                  <FileText className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-xs text-slate-800 dark:text-slate-200 truncate leading-snug" title={doc.file_name}>
                    {doc.file_name}
                  </p>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <span className="text-[9px] text-muted-foreground font-medium">
                      {format(new Date(doc.created_at), 'MMM d, yyyy')}
                    </span>
                    <Badge className={`text-[8px] px-1 py-0 font-bold uppercase rounded-md border-0 ${getDocTypeColor(doc.document_type)}`}>
                      {doc.document_type}
                    </Badge>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-0.5 shrink-0">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 rounded-lg text-muted-foreground hover:text-foreground"
                  onClick={() => handleDownload(doc)}
                >
                  <Download className="h-3.5 w-3.5" />
                </Button>
                {isAdmin && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 rounded-lg text-destructive hover:text-destructive"
                    onClick={() => setDeleteDoc(doc)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Delete Doc Dialog */}
      <AlertDialog open={!!deleteDoc} onOpenChange={(open) => !open && setDeleteDoc(null)}>
        <AlertDialogContent className="rounded-2xl max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="h-5 w-5" /> Delete Document
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs mt-2">
              Are you sure you want to delete "{deleteDoc?.file_name}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-4">
            <AlertDialogCancel className="rounded-xl text-xs h-9">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteDoc && deleteMutation.mutate(deleteDoc)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-xl text-xs h-9"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
