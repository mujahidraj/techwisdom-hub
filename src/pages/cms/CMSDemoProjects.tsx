import { CMSCrudPage, FieldDef } from '@/components/cms/CMSCrudPage';
import { Badge } from '@/components/ui/badge';

const fields: FieldDef[] = [
  { key: 'project_id', label: 'Project ID', type: 'text', required: true, placeholder: 'cambry-admission' },
  { key: 'title', label: 'Project Title', type: 'text', required: true },
  { key: 'category', label: 'Category', type: 'text', placeholder: 'E-Commerce / SaaS / etc.' },
  { key: 'image', label: 'Image URL', type: 'text' },
  { key: 'short_description', label: 'Short Description', type: 'textarea' },
  { key: 'full_description', label: 'Full Description', type: 'textarea' },
  { key: 'live_link', label: 'Live Link', type: 'text', placeholder: 'https://...' },
  { key: 'tech_stack', label: 'Tech Stack (one per line)', type: 'array' },
  { key: 'features', label: 'Features (one per line)', type: 'array' },
  { key: 'design_unique', label: 'Design Uniqueness', type: 'textarea' },
  { key: 'development_process', label: 'Development Process', type: 'textarea' },
  { key: 'is_active', label: 'Active', type: 'boolean' },
  { key: 'display_order', label: 'Display Order', type: 'number' },
];

export default function CMSDemoProjects() {
  return (
    <CMSCrudPage title="Demo Projects" table="cms_demo_projects" queryKey="cms-demo-projects" fields={fields}
      cardRender={(item: any) => (
        <div>
          <p className="font-semibold">{item.title}</p>
          {item.category && <Badge variant="secondary" className="mt-1">{item.category}</Badge>}
          <p className="text-sm text-muted-foreground mt-2 line-clamp-2">{item.short_description}</p>
          {item.tech_stack?.length > 0 && <div className="flex gap-1 mt-2 flex-wrap">{item.tech_stack.slice(0, 3).map((t: string, i: number) => <Badge key={i} variant="outline" className="text-xs">{t}</Badge>)}</div>}
        </div>
      )}
    />
  );
}
