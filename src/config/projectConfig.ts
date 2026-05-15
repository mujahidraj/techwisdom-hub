// =============================================
// Centralized Project Types & Dynamic Stages
// =============================================

export const projectTypes = [
  // Development
  { value: 'custom_website', label: 'Custom Website', group: 'Development' },
  { value: 'wordpress', label: 'WordPress Development', group: 'Development' },
  { value: 'ecommerce', label: 'E-Commerce Store', group: 'Development' },
  { value: 'web_app', label: 'Web Application', group: 'Development' },
  { value: 'mobile_app', label: 'Mobile App', group: 'Development' },
  { value: 'landing_page', label: 'Landing Page', group: 'Development' },
  // Design
  { value: 'logo_design', label: 'Logo Design', group: 'Design' },
  { value: 'graphics_design', label: 'Graphics Design', group: 'Design' },
  { value: 'ui_ux_design', label: 'UI/UX Design', group: 'Design' },
  { value: 'brand_identity', label: 'Brand Identity', group: 'Design' },
  // Marketing
  { value: 'seo', label: 'SEO Optimization', group: 'Marketing' },
  { value: 'social_media', label: 'Social Media Management', group: 'Marketing' },
  { value: 'digital_marketing', label: 'Digital Marketing', group: 'Marketing' },
  { value: 'ppc_campaign', label: 'PPC / Ads Campaign', group: 'Marketing' },
  { value: 'content_marketing', label: 'Content Marketing', group: 'Marketing' },
  { value: 'email_marketing', label: 'Email Marketing', group: 'Marketing' },
  // Other
  { value: 'consulting', label: 'Consulting', group: 'Other' },
  { value: 'maintenance_retainer', label: 'Maintenance Retainer', group: 'Other' },
  { value: 'other', label: 'Other', group: 'Other' },
];

// Dynamic stages per project type group
export const stagesByType: Record<string, string[]> = {
  // Development projects
  custom_website: ['discovery', 'requirement', 'design', 'development', 'content', 'qa', 'deployment', 'maintenance'],
  wordpress: ['discovery', 'requirement', 'design', 'development', 'content', 'qa', 'deployment', 'maintenance'],
  ecommerce: ['discovery', 'requirement', 'design', 'development', 'product_setup', 'payment_integration', 'qa', 'deployment', 'maintenance'],
  web_app: ['discovery', 'requirement', 'architecture', 'design', 'development', 'qa', 'deployment', 'maintenance'],
  mobile_app: ['discovery', 'requirement', 'architecture', 'design', 'development', 'qa', 'beta_testing', 'app_store_submission', 'maintenance'],
  landing_page: ['discovery', 'design', 'development', 'content', 'qa', 'deployment'],
  // Design projects
  logo_design: ['discovery', 'research', 'concept', 'design', 'revision', 'finalize', 'delivery'],
  graphics_design: ['discovery', 'concept', 'design', 'revision', 'finalize', 'delivery'],
  ui_ux_design: ['discovery', 'research', 'wireframe', 'design', 'prototype', 'revision', 'delivery'],
  brand_identity: ['discovery', 'research', 'strategy', 'concept', 'design', 'revision', 'brand_guide', 'delivery'],
  // Marketing projects
  seo: ['audit', 'strategy', 'on_page', 'off_page', 'content', 'monitoring', 'reporting'],
  social_media: ['strategy', 'content_plan', 'content_creation', 'scheduling', 'engagement', 'reporting'],
  digital_marketing: ['strategy', 'campaign_setup', 'content_creation', 'launch', 'optimization', 'reporting'],
  ppc_campaign: ['strategy', 'keyword_research', 'ad_creation', 'campaign_setup', 'launch', 'optimization', 'reporting'],
  content_marketing: ['strategy', 'content_plan', 'content_creation', 'publishing', 'promotion', 'reporting'],
  email_marketing: ['strategy', 'list_building', 'template_design', 'content_creation', 'scheduling', 'reporting'],
  // Other
  consulting: ['discovery', 'analysis', 'strategy', 'implementation', 'review'],
  maintenance_retainer: ['active', 'monitoring', 'updates', 'reporting'],
  other: ['discovery', 'planning', 'execution', 'review', 'delivery'],
};

// Fallback stages
export const defaultStages = ['discovery', 'requirement', 'design', 'development', 'qa', 'deployment', 'maintenance'];

export function getStagesForType(type: string): string[] {
  return stagesByType[type] || defaultStages;
}

export function formatLabel(value: string): string {
  return value.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

export function getProjectTypeGroups() {
  const groups: Record<string, typeof projectTypes> = {};
  for (const t of projectTypes) {
    if (!groups[t.group]) groups[t.group] = [];
    groups[t.group].push(t);
  }
  return groups;
}
