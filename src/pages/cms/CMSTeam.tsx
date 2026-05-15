import { CMSCrudPage, FieldDef } from '@/components/cms/CMSCrudPage';

const fields: FieldDef[] = [
  { key: 'name', label: 'Name', type: 'text', required: true },
  { key: 'role', label: 'Role', type: 'text', required: true },
  { key: 'bio', label: 'Bio', type: 'textarea' },
  { key: 'image', label: 'Image URL', type: 'text' },
  { key: 'linkedin', label: 'LinkedIn URL', type: 'text' },
  { key: 'email', label: 'Email', type: 'text' },
  { key: 'portfolio', label: 'Portfolio URL', type: 'text' },
  { key: 'is_active', label: 'Active', type: 'boolean' },
  { key: 'display_order', label: 'Display Order', type: 'number' },
];

export default function CMSTeam() {
  return (
    <CMSCrudPage jsonKey="team" title="Team Members" table="cms_team_members" queryKey="cms-team" fields={fields}
      cardRender={(item: any) => (
        <div className="flex items-center gap-3">
          {item.image && <img src={item.image} alt={item.name} className="h-10 w-10 rounded-full object-cover" />}
          <div><p className="font-semibold">{item.name}</p><p className="text-sm text-muted-foreground">{item.role}</p></div>
        </div>
      )}
    />
  );
}
