import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Folder, FileText, Upload, Plus, Download, Trash2, Clock, CheckCircle } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { 
  getCloudinaryUploadUrl, 
  CLOUDINARY_PRESET, 
  downloadCloudinaryFile, 
  deleteCloudinaryAsset 
} from '@/utils/cloudinary';


export default function DocumentManagement() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);

  // Fetch Folders
  const { data: folders = [], isLoading: loadingFolders } = useQuery({
    queryKey: ['dms_folders', currentFolderId],
    queryFn: async () => {
      let query = supabase.from('dms_folders' as any).select('*').order('name');
      if (currentFolderId) query = query.eq('parent_id', currentFolderId);
      else query = query.is('parent_id', null);

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    }
  });

  // Fetch Files
  const { data: files = [], isLoading: loadingFiles } = useQuery({
    queryKey: ['dms_files', currentFolderId],
    queryFn: async () => {
      let query = supabase.from('dms_files' as any).select('*').order('created_at', { ascending: false });
      if (currentFolderId) query = query.eq('folder_id', currentFolderId);
      else query = query.is('folder_id', null);

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    }
  });

  const createFolderMutation = useMutation({
    mutationFn: async () => {
      const name = prompt("Enter folder name:");
      if (!name) return;
      if (!user?.id) throw new Error("Not authenticated");
      const { error } = await supabase.from('dms_folders' as any).insert({
        name,
        parent_id: currentFolderId,
        created_by: user.id
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dms_folders'] });
      toast.success("Folder created");
    },
    onError: (error: any) => {
      toast.error("Failed to create folder: " + error.message);
      console.error("Folder creation error:", error);
    }
  });

  const uploadFileMutation = useMutation({
    mutationFn: async (file: File) => {
      if (!user?.id) throw new Error("Not authenticated");

      // 1. Upload to Cloudinary (dynamically routing by file type to avoid PDF viewer errors)
      const uploadUrl = getCloudinaryUploadUrl(file.type, file.name);

      const formData = new FormData();
      formData.append("file", file);
      formData.append("upload_preset", CLOUDINARY_PRESET);

      const res = await fetch(uploadUrl, { method: "POST", body: formData });
      const data = await res.json();
      if (!data.secure_url) {
        throw new Error("Cloudinary Upload Error: " + (data.error?.message || "Unknown error"));
      }

      // 2. Insert into dms_files table
      const { error: dbError } = await supabase.from('dms_files' as any).insert({
        name: file.name,
        folder_id: currentFolderId,
        file_path: data.secure_url,
        size_bytes: file.size,
        mime_type: file.type,
        created_by: user.id,
      });

      if (dbError) {
        throw new Error("Database Error: " + dbError.message);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dms_files'] });
      toast.success("File uploaded successfully");
    },
    onError: (error: any) => {
      toast.error(error.message);
      console.error("File upload error:", error);
    }
  });

  const deleteFolderMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('dms_folders' as any).delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dms_folders'] });
      toast.success("Folder deleted");
    },
    onError: (error: any) => toast.error("Failed to delete folder: " + error.message)
  });

  const deleteFileMutation = useMutation({
    mutationFn: async (file: any) => {
      // Delete from storage first if it's not a Cloudinary file
      if (file.file_path && file.file_path.startsWith('http')) {
        await deleteCloudinaryAsset(file.file_path);
      } else if (file.file_path) {
        const { error: storageError } = await supabase.storage.from('dms_documents').remove([file.file_path]);
        if (storageError) throw new Error("Storage Error: " + storageError.message);
      }

      // Delete from DB
      const { error: dbError } = await supabase.from('dms_files' as any).delete().eq('id', file.id);
      if (dbError) throw dbError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dms_files'] });
      toast.success("File deleted");
    },
    onError: (error: any) => toast.error("Failed to delete file: " + error.message)
  });

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    toast.loading("Uploading...", { id: "upload-toast" });
    uploadFileMutation.mutate(file, {
      onSettled: () => toast.dismiss("upload-toast")
    });
    // Reset input
    e.target.value = '';
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2">
              <FileText className="h-8 w-8 text-primary" />
              DMS & E-Signatures
            </h1>
            <p className="text-muted-foreground mt-1">Manage corporate documents and signatures securely.</p>
          </div>

          <div className="flex gap-2">
            <Button variant="outline" onClick={() => createFolderMutation.mutate()} disabled={createFolderMutation.isPending}>
              <Plus className="h-4 w-4 mr-2" /> New Folder
            </Button>
            <div>
              <input
                type="file"
                id="file-upload"
                className="hidden"
                onChange={handleFileUpload}
              />
              <Button
                className="gradient-primary"
                onClick={() => document.getElementById('file-upload')?.click()}
                disabled={uploadFileMutation.isPending}
              >
                <Upload className="h-4 w-4 mr-2" />
                {uploadFileMutation.isPending ? 'Uploading...' : 'Upload File'}
              </Button>
            </div>
          </div>
        </div>

        {currentFolderId && (
          <Button variant="ghost" onClick={() => setCurrentFolderId(null)} className="mb-4">
            &larr; Back to Root
          </Button>
        )}

        {loadingFolders || loadingFiles ? (
          <div className="text-center py-12 text-muted-foreground">Loading documents...</div>
        ) : (
          <div className="bg-card rounded-xl border shadow-sm overflow-hidden">
            <div className="hidden md:grid md:grid-cols-12 gap-4 p-4 border-b bg-muted/50 font-medium text-sm text-muted-foreground">
              <div className="col-span-6">Name</div>
              <div className="col-span-3">Status / Version</div>
              <div className="col-span-3 text-right">Actions</div>
            </div>

            <div className="divide-y">
              {folders.map((folder: any) => (
                <div key={folder.id} className="flex flex-row md:grid md:grid-cols-12 justify-between items-center p-4 hover:bg-muted/50 cursor-pointer" onClick={() => setCurrentFolderId(folder.id)}>
                  <div className="flex-1 md:col-span-6 flex items-center gap-3">
                    <Folder className="h-5 w-5 text-primary fill-primary/20 shrink-0" />
                    <span className="font-medium text-sm sm:text-base truncate">{folder.name}</span>
                  </div>
                  <div className="hidden md:block md:col-span-3">
                    <span className="text-xs text-muted-foreground">Folder</span>
                  </div>
                  <div className="shrink-0 md:col-span-3 text-right ml-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (confirm('Are you sure you want to delete this folder?')) {
                          deleteFolderMutation.mutate(folder.id);
                        }
                      }}
                      disabled={deleteFolderMutation.isPending}
                    >
                      <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}

              {files.map((file: any) => (
                <div key={file.id} className="flex flex-col md:grid md:grid-cols-12 gap-3 p-4 hover:bg-muted/50 w-full">
                  <div className="md:col-span-6 flex items-center gap-3 w-full">
                    <FileText className="h-5 w-5 text-muted-foreground shrink-0" />
                    <span className="font-medium text-sm sm:text-base break-all">{file.name}</span>
                  </div>
                  <div className="md:col-span-3 flex items-center gap-2 flex-wrap">
                    <Badge variant="outline" className="text-[10px] py-0 px-1.5 font-semibold">v{file.current_version}</Badge>
                    {file.requires_signature && (
                      <Badge variant="secondary" className="bg-warning/20 text-warning text-[10px] py-0 px-1.5 font-semibold">
                        <Clock className="h-3 w-3 mr-1 shrink-0" /> Pending Sign
                      </Badge>
                    )}
                  </div>
                  <div className="md:col-span-3 flex justify-start md:justify-end gap-2 w-full md:w-auto border-t md:border-t-0 pt-2 md:pt-0">
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-9 w-9" 
                      onClick={() => {
                        if (file.file_path?.startsWith('http')) {
                          downloadCloudinaryFile(file.file_path, file.name);
                        } else {
                          window.open(supabase.storage.from('dms_documents').getPublicUrl(file.file_path).data.publicUrl, '_blank');
                        }
                      }}
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive hover:bg-destructive/10 h-9 w-9"
                      onClick={() => {
                        if (confirm('Are you sure you want to delete this file?')) {
                          deleteFileMutation.mutate(file);
                        }
                      }}
                      disabled={deleteFileMutation.isPending}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}

              {folders.length === 0 && files.length === 0 && (
                <div className="p-12 text-center">
                  <Folder className="h-12 w-12 mx-auto text-muted-foreground/30 mb-4" />
                  <h3 className="text-lg font-medium text-muted-foreground">Empty Directory</h3>
                  <p className="text-sm text-muted-foreground/70">Create a folder or upload a document to get started.</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
