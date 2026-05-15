import { CMSCrudPage, FieldDef } from '@/components/cms/CMSCrudPage';

const fields: FieldDef[] = [
  { key: 'title', label: 'Perk Title', type: 'text', required: true },
  { key: 'description', label: 'Description', type: 'textarea' },
  { key: 'icon', label: 'Icon Name', type: 'text' },
  { key: 'is_active', label: 'Active', type: 'boolean' },
  { key: 'display_order', label: 'Display Order', type: 'number' },
];

export default function CMSCareerPerks() {
  return (
    <CMSCrudPage jsonKey="careers" title="Career Perks" table="cms_career_perks" queryKey="cms-career-perks" fields={fields}
      cardRender={(item: any) => (
        <div>
          <p className="font-semibold">{item.title}</p>
          <p className="text-sm text-muted-foreground truncate">{item.description}</p>
        </div>
      )}
    />
  );
}
