import { CMSCrudPage, FieldDef } from '@/components/cms/CMSCrudPage';

const fields: FieldDef[] = [
  { key: 'mission_title', label: 'Mission Title', type: 'text' },
  { key: 'mission_content', label: 'Mission Content', type: 'text' },
  { key: 'vision_title', label: 'Vision Title', type: 'text' },
  { key: 'vision_content', label: 'Vision Content', type: 'text' },
];

export default function CMSAbout() {
  return (
    <CMSCrudPage jsonKey="about" title="About Us Section" table="cms_about_section" queryKey="cms-about" fields={fields}
      cardRender={(item: any) => (
        <div>
          <p className="font-semibold">{item.mission_title || 'About Section'}</p>
          <p className="text-sm text-muted-foreground truncate">{item.mission_content}</p>
        </div>
      )}
    />
  );
}
