import { CMSCrudPage, FieldDef } from '@/components/cms/CMSCrudPage';

const fields: FieldDef[] = [
  { key: 'label', label: 'Menu Label', type: 'text', required: true },
  { key: 'path', label: 'URL Path', type: 'text', required: true },
  { key: 'is_active', label: 'Active', type: 'boolean' },
  { key: 'display_order', label: 'Display Order', type: 'number' },
];

export default function CMSNavigation() {
  return (
    <CMSCrudPage title="Navigation Links" table="cms_navigation" queryKey="cms-navigation" fields={fields}
      cardRender={(item: any) => (
        <div>
          <p className="font-semibold">{item.label}</p>
          <p className="text-sm text-muted-foreground">Path: {item.path}</p>
        </div>
      )}
    />
  );
}
