import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';

export function LeadTable() {
  const { data: leads = [], isLoading } = useQuery({
    queryKey: ['leads'],
    queryFn: async () => {
      const { data, error } = await supabase.from('leads').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  if (isLoading) return <div className="text-center py-8 text-muted-foreground">Loading...</div>;

  return (
    <div className="rounded-lg border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Business</TableHead>
            <TableHead>Contact</TableHead>
            <TableHead>Phone</TableHead>
            <TableHead>Category</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {leads.map((lead: any) => (
            <TableRow key={lead.id}>
              <TableCell className="font-medium">{lead.business_name}</TableCell>
              <TableCell>{lead.contact_person || '-'}</TableCell>
              <TableCell>{lead.phone || '-'}</TableCell>
              <TableCell><Badge variant="outline" className="capitalize">{lead.category?.replace('_', ' ') || '-'}</Badge></TableCell>
              <TableCell><Badge className="capitalize">{lead.status?.replace('_', ' ')}</Badge></TableCell>
            </TableRow>
          ))}
          {leads.length === 0 && (
            <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No leads yet. Import or add leads to get started.</TableCell></TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}