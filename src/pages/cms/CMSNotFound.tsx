import { CMSCrudPage, FieldDef } from '@/components/cms/CMSCrudPage';

const fields: FieldDef[] = [
  { key: 'title', label: 'Title', type: 'text', required: true },
  { key: 'description', label: 'Description', type: 'textarea' },
  { key: 'cta', label: 'Call to Action Button', type: 'text' },
];

export default function CMSNotFound() {
  return (
    <CMSCrudPage jsonKey="notFound" title="Not Found Page (404)" table="cms_not_found" queryKey="cms-not-found" fields={fields}
      cardRender={(item: any) => (
        <div>
          <p className="font-semibold">{item.title}</p>
          <p className="text-sm text-muted-foreground truncate">{item.description}</p>
        </div>
      )}
    />
  );
}
