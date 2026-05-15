import { CMSCrudPage, FieldDef } from '@/components/cms/CMSCrudPage';
import { Badge } from '@/components/ui/badge';

const fields: FieldDef[] = [
  { key: 'slug', label: 'Slug (URL)', type: 'text', required: true, placeholder: 'my-blog-post' },
  { key: 'title', label: 'Title', type: 'text', required: true },
  { key: 'excerpt', label: 'Excerpt', type: 'textarea' },
  { key: 'category', label: 'Category', type: 'text', placeholder: 'Engineering / Design / Innovation' },
  { key: 'author', label: 'Author', type: 'text' },
  { key: 'read_time', label: 'Read Time', type: 'text', placeholder: '8 min' },
  { key: 'image', label: 'Cover Image URL', type: 'text' },
  { key: 'content', label: 'Content (JSON)', type: 'json', placeholder: '[{"heading":"...","text":"..."}]' },
  { key: 'is_published', label: 'Published', type: 'boolean' },
];

export default function CMSBlog() {
  return (
    <CMSCrudPage jsonKey="blog" title="Blog Posts" table="cms_blog_posts" queryKey="cms-blog" fields={fields}
      cardRender={(item: any) => (
        <div>
          <p className="font-semibold">{item.title}</p>
          <div className="flex gap-1 mt-1"><Badge variant="outline">{item.category}</Badge><Badge variant="secondary">{item.read_time}</Badge></div>
          <p className="text-sm text-muted-foreground mt-2 line-clamp-2">{item.excerpt}</p>
          <p className="text-xs text-muted-foreground mt-1">By {item.author}</p>
        </div>
      )}
    />
  );
}
