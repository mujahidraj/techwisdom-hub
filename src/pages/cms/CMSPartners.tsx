import { CMSCrudPage, FieldDef } from '@/components/cms/CMSCrudPage';

const fields: FieldDef[] = [
  { key: 'name', label: 'Partner Name', type: 'text', required: true },
  { key: 'logo', label: 'Logo URL', type: 'text', required: true },
  { key: 'website', label: 'Website URL', type: 'text' },
  { key: 'is_active', label: 'Active', type: 'boolean' },
  { key: 'display_order', label: 'Display Order', type: 'number' },
];

export default function CMSPartners() {
  return (
    <CMSCrudPage jsonKey="partners" title="Partners" table="cms_partners" queryKey="cms-partners" fields={fields}
      cardRender={(item: any) => (
        <div className="flex items-center gap-4">
          <div className="h-12 w-24 bg-white p-2 rounded flex items-center justify-center">
            {item.logo ? <img src={item.logo} alt={item.name} className="max-h-full max-w-full object-contain" /> : <span className="text-xs text-muted-foreground">No Logo</span>}
          </div>
          <div>
            <p className="font-semibold">{item.name}</p>
            {item.website && <p className="text-xs text-blue-500">{item.website}</p>}
          </div>
        </div>
      )}
    />
  );
}
