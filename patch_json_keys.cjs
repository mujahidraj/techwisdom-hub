const fs = require('fs');

const pages = [
  { file: 'CMSHero', key: 'hero' },
  { file: 'CMSSiteInfo', key: 'site' },
  { file: 'CMSAbout', key: 'about' },
  { file: 'CMSCostEstimator', key: 'costEstimator' },
  { file: 'CMSPartners', key: 'partners' },
  { file: 'CMSWhyUs', key: 'whyUs' },
  { file: 'CMSTeam', key: 'team' },
  { file: 'CMSGallery', key: 'gallery' },
  { file: 'CMSTimeline', key: 'timeline' },
  { file: 'CMSProcess', key: 'process' },
  { file: 'CMSServices', key: 'services' },
  { file: 'CMSPortfolio', key: 'projects' },
  { file: 'CMSBlog', key: 'blog' },
];

pages.forEach(p => {
  const path = 'src/pages/cms/' + p.file + '.tsx';
  if (fs.existsSync(path)) {
    let content = fs.readFileSync(path, 'utf-8');
    if (content.includes('CMSCrudPage') && !content.includes('jsonKey=')) {
      content = content.replace('<CMSCrudPage ', '<CMSCrudPage jsonKey="' + p.key + '" ');
      fs.writeFileSync(path, content);
      console.log('Updated ' + p.file);
    }
  }
});
