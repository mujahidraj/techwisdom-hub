import { CMSCrudPage, FieldDef } from '@/components/cms/CMSCrudPage';

const fields: FieldDef[] = [
  { key: 'headline', label: 'Headline', type: 'text', required: true },
  { key: 'subheadline', label: 'Sub-Headline', type: 'textarea' },
  { key: 'form_config', label: 'Form Configuration (JSON)', type: 'json' },
];

export default function CMSContact() {
  return (
    <CMSCrudPage jsonKey="contact" title="Contact Info" table="cms_contact_info" queryKey="cms-contact" fields={fields}
      cardRender={(item: any) => (
        <div>
          <p className="font-semibold">{item.headline}</p>
          <p className="text-sm text-muted-foreground truncate">{item.subheadline}</p>
        </div>
      )}
    />
  );
}
