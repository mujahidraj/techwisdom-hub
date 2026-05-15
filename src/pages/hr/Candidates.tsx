import { CMSCrudPage, FieldDef } from '@/components/cms/CMSCrudPage';
import { Mail, Phone, Link as LinkIcon, FileText } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

const fields: FieldDef[] = [
  { key: 'first_name', label: 'First Name', type: 'text', required: true },
  { key: 'last_name', label: 'Last Name', type: 'text', required: true },
  { key: 'email', label: 'Email Address', type: 'text', required: true },
  { key: 'phone', label: 'Phone Number', type: 'text' },
  { key: 'resume_url', label: 'Resume URL', type: 'text', placeholder: 'https://...' },
  { key: 'linkedin_url', label: 'LinkedIn URL', type: 'text', placeholder: 'https://linkedin.com/in/...' },
  { key: 'portfolio_url', label: 'Portfolio URL', type: 'text' },
  { key: 'source', label: 'Source', type: 'text', placeholder: 'Website, LinkedIn, Referral, etc.' }
];

export default function Candidates() {
  return (
    <CMSCrudPage
      title="Candidates Directory"
      table="ats_candidates"
      queryKey="ats-candidates"
      fields={fields}
      cardRender={(item: any) => (
        <div className="space-y-3">
          <div>
            <h3 className="font-bold text-lg">{item.first_name} {item.last_name}</h3>
            {item.source && <Badge variant="secondary" className="mt-1">{item.source}</Badge>}
          </div>
          
          <div className="space-y-1.5 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <Mail className="h-4 w-4" />
              <a href={`mailto:${item.email}`} className="hover:text-primary transition-colors">{item.email}</a>
            </div>
            {item.phone && (
              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4" />
                <span>{item.phone}</span>
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-2 pt-2 border-t border-border/50">
            {item.resume_url && (
              <a href={item.resume_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs text-primary hover:underline bg-primary/10 px-2 py-1 rounded">
                <FileText className="h-3 w-3" /> Resume
              </a>
            )}
            {item.linkedin_url && (
              <a href={item.linkedin_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs text-[#0A66C2] hover:underline bg-[#0A66C2]/10 px-2 py-1 rounded">
                <LinkIcon className="h-3 w-3" /> LinkedIn
              </a>
            )}
            {item.portfolio_url && (
              <a href={item.portfolio_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors hover:underline bg-muted px-2 py-1 rounded">
                <LinkIcon className="h-3 w-3" /> Portfolio
              </a>
            )}
          </div>
        </div>
      )}
    />
  );
}
