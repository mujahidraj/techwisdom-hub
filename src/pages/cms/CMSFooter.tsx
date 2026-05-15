import { CMSCrudPage, FieldDef } from '@/components/cms/CMSCrudPage';

const fields: FieldDef[] = [
  { key: 'description', label: 'Footer Description', type: 'textarea' },
  { key: 'social_links', label: 'Social Links (JSON)', type: 'json' },
  { key: 'legal_links', label: 'Legal Links (JSON)', type: 'json' },
];

export default function CMSFooter() {
  return (
    <CMSCrudPage jsonKey="footer" title="Footer Info" table="cms_footer_info" queryKey="cms-footer" fields={fields}
      cardRender={(item: any) => (
        <div>
          <p className="font-semibold">Footer Configuration</p>
          <p className="text-sm text-muted-foreground truncate">{item.description}</p>
        </div>
      )}
    />
  );
}
