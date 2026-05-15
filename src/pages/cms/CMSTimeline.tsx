import { CMSCrudPage, FieldDef } from '@/components/cms/CMSCrudPage';

const fields: FieldDef[] = [
  { key: 'year', label: 'Year/Date', type: 'text', required: true, placeholder: '2023 or Q1 2024' },
  { key: 'title', label: 'Title', type: 'text', required: true },
  { key: 'description', label: 'Description', type: 'textarea' },
  { key: 'display_order', label: 'Display Order', type: 'number' },
];

export default function CMSTimeline() {
  return (
    <CMSCrudPage jsonKey="timeline" title="Timeline" table="cms_timeline" queryKey="cms-timeline" fields={fields}
      cardRender={(item: any) => (
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="font-bold text-primary">{item.year}</span>
            <span className="font-semibold">{item.title}</span>
          </div>
          <p className="text-sm text-muted-foreground line-clamp-3">{item.description}</p>
        </div>
      )}
    />
  );
}
