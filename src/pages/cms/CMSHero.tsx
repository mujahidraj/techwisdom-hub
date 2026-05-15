import { CMSCrudPage, FieldDef } from '@/components/cms/CMSCrudPage';

const fields: FieldDef[] = [
  { key: 'headline', label: 'Main Headline', type: 'text', required: true },
  { key: 'subheadline', label: 'Sub-Headline', type: 'text' },
  { key: 'cta_primary', label: 'Primary CTA Text', type: 'text' },
];

export default function CMSHero() {
  return (
    <CMSCrudPage jsonKey="hero" title="Hero Section" table="cms_hero_section" queryKey="cms-hero" fields={fields}
      cardRender={(item: any) => (
        <div>
          <p className="font-semibold">{item.headline}</p>
          <p className="text-sm text-muted-foreground">{item.subheadline}</p>
        </div>
      )}
    />
  );
}
