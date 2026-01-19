import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Search, Building2, Briefcase, Users, X } from 'lucide-react';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Badge } from '@/components/ui/badge';

export function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  // Keyboard shortcut
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };

    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, []);

  const { data: leads = [] } = useQuery({
    queryKey: ['search-leads'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('leads')
        .select('id, business_name, contact_person, status, category')
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return data;
    },
    enabled: open,
  });

  const { data: projects = [] } = useQuery({
    queryKey: ['search-projects'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('active_projects')
        .select('id, project_name, client_name, status, stage')
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return data;
    },
    enabled: open,
  });

  const handleSelect = useCallback(
    (type: string, id: string) => {
      setOpen(false);
      if (type === 'lead') {
        navigate('/crm');
      } else if (type === 'project') {
        navigate('/projects');
      }
    },
    [navigate]
  );

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Search leads, projects..." />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        
        {leads.length > 0 && (
          <CommandGroup heading="Leads">
            {leads.map((lead) => (
              <CommandItem
                key={lead.id}
                value={`lead-${lead.business_name}-${lead.contact_person}`}
                onSelect={() => handleSelect('lead', lead.id)}
                className="flex items-center gap-3 cursor-pointer"
              >
                <Building2 className="h-4 w-4 text-muted-foreground" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{lead.business_name}</p>
                  {lead.contact_person && (
                    <p className="text-xs text-muted-foreground">{lead.contact_person}</p>
                  )}
                </div>
                <Badge variant="outline" className="capitalize text-xs">
                  {lead.status?.replace('_', ' ')}
                </Badge>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {projects.length > 0 && (
          <CommandGroup heading="Projects">
            {projects.map((project) => (
              <CommandItem
                key={project.id}
                value={`project-${project.project_name}-${project.client_name}`}
                onSelect={() => handleSelect('project', project.id)}
                className="flex items-center gap-3 cursor-pointer"
              >
                <Briefcase className="h-4 w-4 text-muted-foreground" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{project.project_name}</p>
                  <p className="text-xs text-muted-foreground">{project.client_name}</p>
                </div>
                <Badge variant="secondary" className="capitalize text-xs">
                  {project.stage?.replace('_', ' ')}
                </Badge>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
      </CommandList>
    </CommandDialog>
  );
}
