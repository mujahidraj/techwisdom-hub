import { CMSCrudPage, FieldDef } from '@/components/cms/CMSCrudPage';

const fields: FieldDef[] = [
  { key: 'step', label: 'Step Number', type: 'number', required: true },
  { key: 'title', label: 'Title', type: 'text', required: true },
  { key: 'description', label: 'Description', type: 'textarea' },
  { key: 'icon', label: 'Icon', type: 'text' },
  { key: 'is_active', label: 'Active', type: 'boolean' },
];

export default function CMSProcess() {
  return (
    <CMSCrudPage jsonKey="process" title="Work Process" table="cms_process" queryKey="cms-process" fields={fields}
      cardRender={(item: any) => (
        <div>
          <p className="font-semibold">Step {item.step}: {item.title}</p>
          <p className="text-sm text-muted-foreground truncate">{item.description}</p>
        </div>
      )}
    />
  );
}
