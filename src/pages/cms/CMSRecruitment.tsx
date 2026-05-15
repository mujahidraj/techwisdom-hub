import { CMSCrudPage, FieldDef } from '@/components/cms/CMSCrudPage';
import { Badge } from '@/components/ui/badge';

const fields: FieldDef[] = [
  { key: 'job_id', label: 'Job ID', type: 'text', required: true, placeholder: 'frontend-dev' },
  { key: 'title', label: 'Job Title', type: 'text', required: true, placeholder: 'e.g. Frontend Developer' },
  { key: 'department', label: 'Department', type: 'text', required: true, placeholder: 'Engineering' },
  { key: 'location', label: 'Location', type: 'text', placeholder: 'Remote / Hybrid / On-site' },
  { key: 'type', label: 'Employment Type', type: 'text', placeholder: 'Full-time / Part-time / Contractual' },
  { key: 'short_description', label: 'Short Description', type: 'textarea', placeholder: 'Brief overview' },
  { key: 'about_role', label: 'About the Role', type: 'textarea', placeholder: 'Detailed role description' },
  { key: 'responsibilities', label: 'Responsibilities (one per line)', type: 'array' },
  { key: 'requirements', label: 'Requirements (one per line)', type: 'array' },
  { key: 'salary', label: 'Salary', type: 'text', placeholder: 'Competitive / Negotiable' },
  { key: 'is_active', label: 'Active', type: 'boolean' },
  { key: 'display_order', label: 'Display Order', type: 'number' },
];

export default function CMSRecruitment() {
  return (
    <CMSCrudPage
      title="Recruitment"
      table="cms_job_openings"
      queryKey="cms-recruitment"
      jsonKey="openings"
      fields={fields}
      cardRender={(item: any) => (
        <div>
          <p className="font-semibold">{item.title}</p>
          <div className="flex gap-1 mt-1 flex-wrap">
            <Badge variant="outline">{item.department}</Badge>
            <Badge variant="outline">{item.location}</Badge>
            <Badge variant="secondary">{item.type}</Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-2 line-clamp-2">{item.short_description}</p>
        </div>
      )}
    />
  );
}
