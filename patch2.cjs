const fs = require('fs');

const pages = [
  { file: 'CMSProcess', key: 'process' },
  { file: 'CMSCareerPage', key: 'careers' },
  { file: 'CMSCareerPerks', key: 'careers' },
  { file: 'CMSContact', key: 'contact' },
  { file: 'CMSFooter', key: 'footer' },
  { file: 'CMSNotFound', key: 'notFound' }
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
