import { CMSCrudPage, FieldDef } from '@/components/cms/CMSCrudPage';

const fields: FieldDef[] = [
  { key: 'headline', label: 'Career Page Headline', type: 'text', required: true },
  { key: 'subheadline', label: 'Sub-Headline', type: 'textarea' },
];

export default function CMSCareerPage() {
  return (
    <CMSCrudPage jsonKey="careers" title="Career Page Info" table="cms_career_page" queryKey="cms-career-page" fields={fields}
      cardRender={(item: any) => (
        <div>
          <p className="font-semibold">{item.headline}</p>
          <p className="text-sm text-muted-foreground truncate">{item.subheadline}</p>
        </div>
      )}
    />
  );
}
