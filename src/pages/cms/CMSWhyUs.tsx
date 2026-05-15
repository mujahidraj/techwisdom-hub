import { CMSCrudPage, FieldDef } from '@/components/cms/CMSCrudPage';

const fields: FieldDef[] = [
  { key: 'title', label: 'Title', type: 'text', required: true },
  { key: 'description', label: 'Description', type: 'text' },
  { key: 'icon', label: 'Icon Name', type: 'text' },
  { key: 'is_active', label: 'Active', type: 'boolean' },
  { key: 'display_order', label: 'Display Order', type: 'number' },
];

export default function CMSWhyUs() {
  return (
    <CMSCrudPage jsonKey="whyUs" title="Why Choose Us" table="cms_why_us" queryKey="cms-why-us" fields={fields}
      cardRender={(item: any) => (
        <div>
          <p className="font-semibold">{item.title}</p>
          <p className="text-sm text-muted-foreground truncate">{item.description}</p>
        </div>
      )}
    />
  );
}
