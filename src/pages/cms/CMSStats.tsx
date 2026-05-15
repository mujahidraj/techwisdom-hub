import { CMSCrudPage, FieldDef } from '@/components/cms/CMSCrudPage';

const fields: FieldDef[] = [
  { key: 'value', label: 'Stat Value (Number)', type: 'number', required: true },
  { key: 'suffix', label: 'Suffix (e.g. %, +)', type: 'text' },
  { key: 'label', label: 'Stat Label', type: 'text', required: true },
  { key: 'is_active', label: 'Active', type: 'boolean' },
  { key: 'display_order', label: 'Display Order', type: 'number' },
];

export default function CMSStats() {
  return (
    <CMSCrudPage title="Company Stats" table="cms_stats" queryKey="cms-stats" fields={fields}
      cardRender={(item: any) => (
        <div>
          <p className="font-semibold">{item.value}{item.suffix}</p>
          <p className="text-sm text-muted-foreground">{item.label}</p>
        </div>
      )}
    />
  );
}
