import { CMSCrudPage, FieldDef } from '@/components/cms/CMSCrudPage';

const fields: FieldDef[] = [
  { key: 'src', label: 'Image URL', type: 'text', required: true },
  { key: 'alt', label: 'Alt Text', type: 'text' },
  { key: 'title', label: 'Title', type: 'text' },
  { key: 'is_active', label: 'Active', type: 'boolean' },
  { key: 'display_order', label: 'Display Order', type: 'number' },
];

export default function CMSGallery() {
  return (
    <CMSCrudPage jsonKey="gallery" title="Gallery" table="cms_gallery" queryKey="cms-gallery" fields={fields}
      cardRender={(item: any) => (
        <div className="flex flex-col gap-2">
          {item.src && <img src={item.src} alt={item.alt || item.title || 'Gallery image'} className="w-full h-32 object-cover rounded-md" />}
          <div>
            {item.title && <p className="font-semibold text-sm">{item.title}</p>}
            {item.alt && <p className="text-xs text-muted-foreground">{item.alt}</p>}
          </div>
        </div>
      )}
    />
  );
}
