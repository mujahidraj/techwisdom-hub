import { CMSCrudPage, FieldDef } from '@/components/cms/CMSCrudPage';
import { Badge } from '@/components/ui/badge';

const fields: FieldDef[] = [
  { key: 'product_id', label: 'Product ID', type: 'text', required: true, placeholder: 'erp-suite' },
  { key: 'title', label: 'Product Name', type: 'text', required: true },
  { key: 'developer', label: 'Developer', type: 'text', placeholder: 'TechWisdom Technologies' },
  { key: 'tagline', label: 'Tagline', type: 'text' },
  { key: 'summary', label: 'Summary', type: 'textarea' },
  { key: 'hero_image', label: 'Hero Image URL', type: 'text' },
  { key: 'gallery', label: 'Gallery URLs (one per line)', type: 'array' },
  { key: 'overview', label: 'Overview', type: 'textarea' },
  { key: 'highlights', label: 'Highlights (one per line)', type: 'array' },
  { key: 'capabilities', label: 'Capabilities (one per line)', type: 'array' },
  { key: 'built_for', label: 'Built For', type: 'textarea' },
  { key: 'status', label: 'Status', type: 'text', placeholder: 'Production ready' },
  { key: 'platforms', label: 'Platforms (one per line)', type: 'array' },
  { key: 'web_app_url', label: 'Web App URL', type: 'text' },
  { key: 'app_store_url', label: 'App Store URL', type: 'text' },
  { key: 'play_store_url', label: 'Play Store URL', type: 'text' },
  { key: 'is_active', label: 'Active', type: 'boolean' },
  { key: 'display_order', label: 'Display Order', type: 'number' },
];

export default function CMSProducts() {
  return (
    <CMSCrudPage title="Product Catalog" table="cms_products" queryKey="cms-products" fields={fields}
      cardRender={(item: any) => (
        <div>
          <p className="font-semibold">{item.title}</p>
          <p className="text-xs text-muted-foreground">{item.developer}</p>
          {item.tagline && <p className="text-sm mt-1 italic">{item.tagline}</p>}
          {item.status && <Badge variant="outline" className="mt-2">{item.status}</Badge>}
        </div>
      )}
    />
  );
}
