import { CMSCrudPage, FieldDef } from '@/components/cms/CMSCrudPage';

const fields: FieldDef[] = [
  { key: 'name', label: 'Company Name', type: 'text', required: true },
  { key: 'tagline', label: 'Tagline', type: 'text' },
  { key: 'description', label: 'Description', type: 'text' },
  { key: 'email', label: 'Contact Email', type: 'text' },
  { key: 'phone', label: 'Phone Number', type: 'text' },
  { key: 'whatsapp', label: 'WhatsApp Link', type: 'text' },
  { key: 'address', label: 'Physical Address', type: 'text' },
  { key: 'image', label: 'Logo Image URL', type: 'text' },
];

export default function CMSSiteInfo() {
  return (
    <CMSCrudPage jsonKey="site" title="Site Info" table="cms_site_info" queryKey="cms-site-info" fields={fields}
      cardRender={(item: any) => (
        <div>
          <p className="font-semibold">{item.name}</p>
          <p className="text-sm text-muted-foreground">{item.tagline}</p>
        </div>
      )}
    />
  );
}
