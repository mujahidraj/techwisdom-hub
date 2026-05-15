import { CMSCrudPage, FieldDef } from '@/components/cms/CMSCrudPage';
import { Badge } from '@/components/ui/badge';

const fields: FieldDef[] = [
  { key: 'service_id', label: 'Service ID (URL slug)', type: 'text', required: true },
  { key: 'title', label: 'Title', type: 'text', required: true },
  { key: 'short_description', label: 'Short Description', type: 'text' },
  { key: 'description', label: 'Description', type: 'textarea' },
  { key: 'icon', label: 'Icon (Lucide Name)', type: 'text' },
  { key: 'features', label: 'Features (one per line)', type: 'array' },
  { key: 'is_active', label: 'Active', type: 'boolean' },
  { key: 'display_order', label: 'Display Order', type: 'number' },
];

export default function CMSServices() {
  return (
    <CMSCrudPage jsonKey="services" title="Services" table="cms_services" queryKey="cms-services" fields={fields}
      cardRender={(item: any) => (
        <div>
          <p className="font-semibold">{item.title}</p>
          <p className="text-xs text-muted-foreground mt-1 font-mono">{item.service_id}</p>
          <p className="text-sm text-muted-foreground mt-2 line-clamp-2">{item.short_description}</p>
          {item.features?.length > 0 && <div className="flex gap-1 mt-2 flex-wrap">{item.features.slice(0, 3).map((t: string, i: number) => <Badge key={i} variant="outline" className="text-xs">{t}</Badge>)}</div>}
        </div>
      )}
    />
  );
}
