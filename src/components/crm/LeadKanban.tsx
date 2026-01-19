import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Phone, Mail, Building2 } from 'lucide-react';

const columns = [
  { id: 'new', title: 'New', color: 'bg-blue-500' },
  { id: 'contacted', title: 'Contacted', color: 'bg-yellow-500' },
  { id: 'in_negotiation', title: 'In Negotiation', color: 'bg-purple-500' },
  { id: 'deal_won', title: 'Deal Won', color: 'bg-green-500' },
];

export function LeadKanban() {
  const { data: leads = [], isLoading } = useQuery({
    queryKey: ['leads'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('leads')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const getLeadsByStatus = (status: string) => 
    leads.filter((lead: any) => lead.status === status);

  if (isLoading) {
    return <div className="text-center py-8 text-muted-foreground">Loading leads...</div>;
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {columns.map((column) => (
        <div key={column.id} className="space-y-3">
          <div className="flex items-center gap-2 px-2">
            <div className={`w-2 h-2 rounded-full ${column.color}`} />
            <h3 className="font-semibold">{column.title}</h3>
            <Badge variant="secondary" className="ml-auto">
              {getLeadsByStatus(column.id).length}
            </Badge>
          </div>
          <div className="space-y-2 min-h-[200px] p-2 bg-muted/30 rounded-lg">
            {getLeadsByStatus(column.id).map((lead: any) => (
              <Card key={lead.id} className="glass-card cursor-pointer hover:shadow-medium transition-shadow">
                <CardContent className="p-3 space-y-2">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium text-sm truncate">{lead.business_name}</span>
                    </div>
                  </div>
                  {lead.contact_person && (
                    <p className="text-xs text-muted-foreground">{lead.contact_person}</p>
                  )}
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    {lead.phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{lead.phone}</span>}
                  </div>
                  {lead.category && (
                    <Badge variant="outline" className="text-[10px] capitalize">
                      {lead.category.replace('_', ' ')}
                    </Badge>
                  )}
                </CardContent>
              </Card>
            ))}
            {getLeadsByStatus(column.id).length === 0 && (
              <div className="text-center py-8 text-sm text-muted-foreground">
                No leads
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}