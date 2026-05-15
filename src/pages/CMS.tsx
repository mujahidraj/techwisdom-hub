import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent } from '@/components/ui/card';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Shield, Users, Briefcase, FileText, Image as ImageIcon, Clock, Handshake, DollarSign, BookOpen, Package, Layers, Settings, Globe, Compass, LayoutTemplate, BarChart, Star, Info, Calculator, Upload, Loader2, Workflow, PhoneCall, Link, AlertTriangle, GraduationCap, Heart } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';

const sections = [
  { title: 'Site Info', desc: 'Main configuration', icon: Globe, path: '/cms/site-info', color: 'text-blue-500' },
  { title: 'Navigation', desc: 'Menu links', icon: Compass, path: '/cms/navigation', color: 'text-indigo-500' },
  { title: 'Hero Section', desc: 'Landing page hero', icon: LayoutTemplate, path: '/cms/hero', color: 'text-purple-500' },
  { title: 'Company Stats', desc: 'Statistics counters', icon: BarChart, path: '/cms/stats', color: 'text-pink-500' },
  { title: 'Why Choose Us', desc: 'Key benefits', icon: Star, path: '/cms/why-us', color: 'text-rose-500' },
  { title: 'About Section', desc: 'Mission & vision', icon: Info, path: '/cms/about', color: 'text-orange-500' },
  { title: 'Cost Estimator', desc: 'Estimator settings', icon: Calculator, path: '/cms/cost-estimator', color: 'text-amber-500' },
  { title: 'Process', desc: 'How we work', icon: Workflow, path: '/cms/process', color: 'text-emerald-500' },
  { title: 'Contact', desc: 'Contact page config', icon: PhoneCall, path: '/cms/contact', color: 'text-teal-500' },
  { title: 'Footer', desc: 'Footer links & info', icon: Link, path: '/cms/footer', color: 'text-cyan-500' },
  { title: '404 Page', desc: 'Not found page setup', icon: AlertTriangle, path: '/cms/not-found', color: 'text-red-500' },
  { title: 'Career Page', desc: 'Careers header info', icon: GraduationCap, path: '/cms/career-page', color: 'text-blue-600' },
  { title: 'Career Perks', desc: 'Job benefits', icon: Heart, path: '/cms/career-perks', color: 'text-rose-600' },
  { title: 'Recruitment', desc: 'Manage job openings', icon: Briefcase, path: '/cms/recruitment', color: 'text-blue-500' },
  { title: 'Demo Projects', desc: 'Showcase portfolio', icon: Layers, path: '/cms/demo-projects', color: 'text-purple-500' },
  { title: 'Product Catalog', desc: 'Manage products', icon: Package, path: '/cms/products', color: 'text-green-500' },
  { title: 'Team Members', desc: 'Company team', icon: Users, path: '/cms/team', color: 'text-orange-500' },
  { title: 'Blog Posts', desc: 'Articles & news', icon: BookOpen, path: '/cms/blog', color: 'text-pink-500' },
  { title: 'Services', desc: 'Service listings', icon: Settings, path: '/cms/services', color: 'text-cyan-500' },
  { title: 'Portfolio', desc: 'Case studies', icon: FileText, path: '/cms/portfolio', color: 'text-indigo-500' },
  { title: 'Partners', desc: 'Partner logos', icon: Handshake, path: '/cms/partners', color: 'text-amber-500' },
  { title: 'Gallery', desc: 'Photo gallery', icon: ImageIcon, path: '/cms/gallery', color: 'text-teal-500' },
  { title: 'Timeline', desc: 'Company milestones', icon: Clock, path: '/cms/timeline', color: 'text-violet-500' },
  { title: 'Pricing', desc: 'Pricing tiers', icon: DollarSign, path: '/cms/pricing', color: 'text-emerald-500' },
];

export default function CMSHub() {
  const navigate = useNavigate();
  const { role } = useAuth();

  const globalUploadMutation = useMutation({
    mutationFn: async (json: any) => {
      // 1. Is it an array of demo projects?
      if (Array.isArray(json) && json[0] && json[0].techStack !== undefined) {
         const mapped = json.map(item => ({
           project_id: item.id, title: item.title, category: item.category, image: item.image,
           short_description: item.shortDescription, full_description: item.fullDescription,
           live_link: item.liveLink, tech_stack: item.techStack, features: item.features,
           design_unique: item.designUnique, development_process: item.developmentProcess
         }));
         const { error } = await (supabase as any).from('cms_demo_projects').insert(mapped);
         if (error) throw error;
         return 'Uploaded Demo Projects';
      }
      
      // 2. Is it an array of products?
      if (Array.isArray(json) && json[0] && json[0].developer !== undefined && json[0].builtFor !== undefined) {
         const mapped = json.map(item => ({
           product_id: item.id, title: item.title, developer: item.developer, tagline: item.tagline, summary: item.summary,
           hero_image: item.heroImage, gallery: item.gallery, overview: item.overview,
           highlights: item.highlights, capabilities: item.capabilities, built_for: item.builtFor,
           status: item.status, comparison: item.comparison, pricing: item.pricing, platforms: item.platforms,
           web_app_url: item.webAppUrl, app_store_url: item.appStoreUrl, play_store_url: item.playStoreUrl
         }));
         const { error } = await (supabase as any).from('cms_products').insert(mapped);
         if (error) throw error;
         return 'Uploaded Products';
      }

      // 3. Is it openings?
      if (json.openings && Array.isArray(json.openings)) {
         const mapped = json.openings.map((item: any) => ({
           job_id: item.id, title: item.title, department: item.department, location: item.location, type: item.type,
           short_description: item.shortDescription, about_role: item.aboutRole,
           responsibilities: item.responsibilities, requirements: item.requirements, salary: item.salary
         }));
         const { error } = await (supabase as any).from('cms_job_openings').insert(mapped);
         if (error) throw error;
         return 'Uploaded Job Openings';
      }
      
      // 4. Is it data.json?
      if (json.site || json.navigation || json.hero) {
         const msg: string[] = [];

         if (json.site) { 
           await (supabase as any).from('cms_site_info').insert([{
             name: json.site.name, domain: json.site.domain, 
             contact_email: json.site.contactEmail, contact_phone: json.site.contactPhone,
             address: json.site.address, logo_light: json.site.logoLight, 
             logo_dark: json.site.logoDark, primary_color: json.site.primaryColor
           }]); 
           msg.push('Site Info'); 
         }
         if (json.navigation) { await (supabase as any).from('cms_navigation').insert(json.navigation); msg.push('Navigation'); }
         if (json.hero) { 
           await (supabase as any).from('cms_hero_section').insert([{
             headline: json.hero.headline, subheadline: json.hero.subheadline,
             cta_primary: json.hero.cta?.text || '', cta_secondary: ''
           }]); 
           msg.push('Hero'); 
         }
         if (json.stats) { await (supabase as any).from('cms_stats').insert(json.stats); msg.push('Stats'); }
         if (json.partners) { await (supabase as any).from('cms_partners').insert(json.partners); msg.push('Partners'); }
         if (json.whyUs) { await (supabase as any).from('cms_why_us').insert(json.whyUs); msg.push('Why Us'); }
         if (json.about) { await (supabase as any).from('cms_about_section').insert([{
             mission_content: json.about.mission, vision_content: json.about.vision, goals: json.about.goals
         }]); msg.push('About'); }
         if (json.team) { await (supabase as any).from('cms_team_members').insert(json.team); msg.push('Team'); }
         if (json.timeline) { await (supabase as any).from('cms_timeline').insert(json.timeline); msg.push('Timeline'); }
         if (json.gallery) { await (supabase as any).from('cms_gallery').insert(json.gallery); msg.push('Gallery'); }
         
         if (json.services) { 
           const mapped = json.services.map((s: any) => ({
             service_id: s.id, title: s.title, short_description: s.shortDescription,
             description: s.description, icon: s.icon, features: s.features
           }));
           await (supabase as any).from('cms_services').insert(mapped); 
           msg.push('Services'); 
         }
         if (json.costEstimator) { 
           await (supabase as any).from('cms_cost_estimator').insert([{
             title: json.costEstimator.title, subtitle: json.costEstimator.subtitle, steps: json.costEstimator.steps,
             result_title: json.costEstimator.result?.title, result_email_placeholder: json.costEstimator.result?.emailPlaceholder,
             result_button_text: json.costEstimator.result?.buttonText
           }]); 
           msg.push('Cost Estimator'); 
         }

         if (json.serviceDetails) {
            const details = Object.entries(json.serviceDetails).map(([k, v]: [string, any]) => ({ 
              service_id: k, tagline: v.tagline, hero_image: v.heroImage,
              overview: v.overview, deliverables: v.deliverables, process: v.process, tech_stack: v.techStack,
              benefits: v.benefits, faqs: v.faqs
            }));
            await (supabase as any).from('cms_service_details').insert(details);
            msg.push('Service Details');
         }
         if (json.process) { await (supabase as any).from('cms_process').insert(json.process); msg.push('Process'); }
         
         if (json.projects) {
           const mapped = json.projects.map((p: any) => ({
             project_id: p.id, title: p.title, category: p.category, thumbnail: p.thumbnail,
             challenge: p.challenge, solution: p.solution, tech_stack: p.techStack, results: p.results
           }));
           await (supabase as any).from('cms_portfolio').insert(mapped);
           msg.push('Projects');
         }

         if (json.blog && json.blog.posts) {
           const mapped = json.blog.posts.map((p: any) => ({
             slug: p.id, title: p.title, excerpt: p.excerpt, category: p.category, author: p.author,
             date: p.date, read_time: p.readTime, image: p.image, content: p.content
           }));
           await (supabase as any).from('cms_blog_posts').insert(mapped);
           msg.push('Blog');
         }

         if (json.contact) {
           await (supabase as any).from('cms_contact_info').insert([{
             headline: json.contact.headline, subheadline: json.contact.subheadline, form_config: json.contact.form
           }]);
           msg.push('Contact');
         }
         if (json.footer) {
           await (supabase as any).from('cms_footer_info').insert([{
             description: json.footer.description, social_links: json.footer.socialLinks, legal_links: json.footer.legalLinks
           }]);
           msg.push('Footer');
         }
         if (json.notFound) {
           await (supabase as any).from('cms_not_found').insert([json.notFound]);
           msg.push('404 Page');
         }
         if (json.careers) {
           await (supabase as any).from('cms_career_page').insert([{ headline: json.careers.headline, subheadline: json.careers.subheadline }]);
           if (json.careers.perks) await (supabase as any).from('cms_career_perks').insert(json.careers.perks);
           if (json.careers.openings) {
             const mappedOpenings = json.careers.openings.map((item: any) => ({
               job_id: item.id, title: item.title, department: item.department, location: item.location, type: item.type,
               short_description: item.shortDescription, about_role: item.aboutRole,
               responsibilities: item.responsibilities, requirements: item.requirements, salary: item.salary
             }));
             await (supabase as any).from('cms_job_openings').insert(mappedOpenings);
           }
           msg.push('Careers');
         }
         
         const handlePricingTiers = async (tiers: any[], category: string) => {
            if (!tiers) return;
            const mapped = tiers.map((t: any) => ({
              category, tier_id: t.id, name: t.name, description: t.description,
              price: t.price, monthly_price: t.monthlyPrice, yearly_price: t.yearlyPrice,
              features: t.features, cta: t.cta, highlighted: t.highlighted, badge: t.badge
            }));
            await (supabase as any).from('cms_pricing_tiers').insert(mapped);
            msg.push(`Pricing: ${category}`);
         };

         if (json.pricing) {
            await handlePricingTiers(json.pricing.projectTiers || json.pricing.webTiers || json.pricing, 'web');
            await handlePricingTiers(json.pricing.appTiers, 'app');
            await handlePricingTiers(json.pricing.graphicsTiers, 'graphics');
            await handlePricingTiers(json.pricing.marketingTiers, 'marketing');
            await handlePricingTiers(json.pricing.maintenanceTiers, 'maintenance');
         }

         return `Uploaded Data: ${msg.join(', ')}`;
      }
      
      throw new Error('Unrecognized JSON structure. Ensure it is data.json, openings.json, productCatalog.json, or demoProject.json');
    },
    onSuccess: (msg) => toast.success(msg),
    onError: (e: any) => toast.error(`Upload failed: ${e.message}`)
  });

  const handleGlobalUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        globalUploadMutation.mutate(json);
      } catch (err) {
        toast.error('Invalid JSON file format.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  if (role !== 'admin') {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center h-64 text-center">
          <Shield className="h-16 w-16 text-muted-foreground mb-4" />
          <h2 className="text-xl font-semibold mb-2">Access Denied</h2>
          <p className="text-muted-foreground">Only admins can manage CMS.</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold">Content Management</h1>
            <p className="text-muted-foreground mt-1">Manage all website content from one place</p>
          </div>
          <div>
            <input type="file" id="global-json-upload" className="hidden" accept=".json" onChange={handleGlobalUpload} disabled={globalUploadMutation.isPending} />
            <label htmlFor="global-json-upload" className="cursor-pointer">
              <div className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2">
                {globalUploadMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
                Bulk Upload JSON
              </div>
            </label>
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {sections.map((s) => (
            <Card key={s.path} className="glass-card cursor-pointer hover:shadow-lg transition-all hover:-translate-y-1" onClick={() => navigate(s.path)}>
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-xl bg-primary/10"><s.icon className={`h-6 w-6 ${s.color}`} /></div>
                  <div><p className="font-semibold">{s.title}</p><p className="text-sm text-muted-foreground">{s.desc}</p></div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </DashboardLayout>
  );
}