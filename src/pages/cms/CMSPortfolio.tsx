import { CMSCrudPage, FieldDef } from '@/components/cms/CMSCrudPage';
import { Badge } from '@/components/ui/badge';

const fields: FieldDef[] = [
  { key: 'project_id', label: 'Project ID (URL slug)', type: 'text', required: true },
  { key: 'title', label: 'Title', type: 'text', required: true },
  { key: 'category', label: 'Category', type: 'text' },
  { key: 'thumbnail', label: 'Thumbnail URL', type: 'text' },
  { key: 'challenge', label: 'Challenge', type: 'textarea' },
  { key: 'solution', label: 'Solution', type: 'textarea' },
  { key: 'tech_stack', label: 'Tech Stack (one per line)', type: 'array' },
  { key: 'results', label: 'Results (JSON)', type: 'json', placeholder: '[{"metric":"...","value":"..."}]' },
  { key: 'is_active', label: 'Active', type: 'boolean' },
  { key: 'display_order', label: 'Display Order', type: 'number' },
];

export default function CMSPortfolio() {
  return (
    <CMSCrudPage jsonKey="projects" title="Portfolio Projects" table="cms_portfolio" queryKey="cms-portfolio" fields={fields}
      cardRender={(item: any) => (
        <div>
          <p className="font-semibold">{item.title}</p>
          <p className="text-xs text-muted-foreground mt-1 font-mono">{item.project_id}</p>
          <div className="flex gap-1 mt-2 flex-wrap">
            {item.category && <Badge variant="secondary">{item.category}</Badge>}
          </div>
        </div>
      )}
    />
  );
}
