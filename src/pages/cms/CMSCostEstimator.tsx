import { CMSCrudPage, FieldDef } from '@/components/cms/CMSCrudPage';

const fields: FieldDef[] = [
  { key: 'title', label: 'Estimator Title', type: 'text', required: true },
  { key: 'subtitle', label: 'Subtitle', type: 'text' },
  { key: 'result_title', label: 'Result Title', type: 'text' },
  { key: 'result_email_placeholder', label: 'Result Email Placeholder', type: 'text' },
  { key: 'result_button_text', label: 'Result Button Text', type: 'text' },
];

export default function CMSCostEstimator() {
  return (
    <CMSCrudPage jsonKey="costEstimator" title="Cost Estimator Settings" table="cms_cost_estimator" queryKey="cms-cost-estimator" fields={fields}
      cardRender={(item: any) => (
        <div>
          <p className="font-semibold">{item.title}</p>
          <p className="text-sm text-muted-foreground">{item.subtitle}</p>
        </div>
      )}
    />
  );
}
