import { CMSCrudPage, FieldDef } from '@/components/cms/CMSCrudPage';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';

const fields: FieldDef[] = [
  { key: 'tier_id', label: 'Tier ID', type: 'text', required: true },
  { key: 'category', label: 'Category', type: 'text', required: true, placeholder: 'projects / apps / marketing / etc.' },
  { key: 'name', label: 'Name', type: 'text', required: true },
  { key: 'description', label: 'Description', type: 'textarea' },
  { key: 'price', label: 'Base Price (Numeric)', type: 'number' },
  { key: 'monthly_price', label: 'Monthly Price (Numeric)', type: 'number' },
  { key: 'yearly_price', label: 'Yearly Price (Numeric)', type: 'number' },
  { key: 'features', label: 'Features (one per line)', type: 'array' },
  { key: 'cta', label: 'CTA Text', type: 'text', placeholder: 'Start Project' },
  { key: 'highlighted', label: 'Highlighted (Popular)', type: 'boolean' },
  { key: 'badge', label: 'Badge Text', type: 'text', placeholder: 'Popular / Hot' },
  { key: 'is_active', label: 'Active', type: 'boolean' },
  { key: 'display_order', label: 'Display Order', type: 'number' },
];

export default function CMSPricing() {
  const handlePricingUpload = async (json: any) => {
    let data = json.pricing || json;
    
    const mapTiers = async (tiers: any[], category: string) => {
      if (!tiers || !Array.isArray(tiers)) return;
      const mapped = tiers.map((t: any) => ({
        category, tier_id: t.id, name: t.name, description: t.description,
        price: t.price, monthly_price: t.monthlyPrice, yearly_price: t.yearlyPrice,
        features: t.features, cta: t.cta, highlighted: t.highlighted, badge: t.badge
      }));
      const { error } = await supabase.from('cms_pricing_tiers').insert(mapped);
      if (error) throw error;
    };

    if (data.projectTiers) await mapTiers(data.projectTiers, 'web');
    else if (data.webTiers) await mapTiers(data.webTiers, 'web');
    else if (Array.isArray(data)) await mapTiers(data, 'web');

    if (data.appTiers) await mapTiers(data.appTiers, 'app');
    if (data.graphicsTiers) await mapTiers(data.graphicsTiers, 'graphics');
    if (data.marketingTiers) await mapTiers(data.marketingTiers, 'marketing');
    if (data.maintenanceTiers) await mapTiers(data.maintenanceTiers, 'maintenance');
  };

  return (
    <CMSCrudPage title="Pricing Tiers" table="cms_pricing_tiers" queryKey="cms-pricing-tiers" fields={fields} onUpload={handlePricingUpload}
      cardRender={(item: any) => (
        <div>
          <div className="flex justify-between items-start mb-2">
            <div>
              <p className="font-semibold">{item.name}</p>
              <p className="text-xs text-muted-foreground font-mono">{item.category}</p>
            </div>
            {item.highlighted && <Badge className="bg-primary/20 text-primary hover:bg-primary/30 border-none">Highlighted</Badge>}
          </div>
          <p className="text-sm font-medium">৳ {item.price}</p>
          <p className="text-sm text-muted-foreground mt-2 line-clamp-2">{item.description}</p>
        </div>
      )}
    />
  );
}
