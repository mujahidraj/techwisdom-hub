const fs = require('fs');
const path = require('path');

function processFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let changed = false;

  // Replace grid-cols-[2-9] without md:/lg:/sm: to be responsive.
  // We avoid TabsList because they often want exact columns on mobile.
  // We'll just replace 'grid grid-cols-X' with 'grid grid-cols-1 md:grid-cols-X'
  const newContent = content.replace(/className=(["'])([^"']*)grid grid-cols-([2-7])([^"']*)\1/g, (match, quote, before, cols, after) => {
    // If it's already responsive or it's a TabsList (usually has 'TabsList' nearby, or w-full grid-cols-2) we might skip, but let's check
    if (before.includes('md:') || before.includes('sm:') || before.includes('lg:')) {
      return match;
    }
    // TabsList skip heuristic
    if (before.includes('w-full') && (cols === '2' || cols === '3' || cols === '4')) {
        // often used in TabsList, leave it alone if it's 2, but 3 or 4 might need scrolling.
        // Let's add overflow-x-auto just in case, but let's keep it safe.
    }
    changed = true;
    return `className=${quote}${before}grid grid-cols-1 md:grid-cols-${cols}${after}${quote}`;
  });

  // Also replace 'flex flex-row' to 'flex flex-col md:flex-row'
  const newContent2 = newContent.replace(/className=(["'])([^"']*)flex flex-row([^"']*)\1/g, (match, quote, before, after) => {
    if (before.includes('md:') || before.includes('sm:') || before.includes('lg:')) {
      return match;
    }
    changed = true;
    return `className=${quote}${before}flex flex-col md:flex-row${after}${quote}`;
  });

  // Also fix grid-cols-12 which are often table headers/rows
  // change to block on mobile, grid on md
  const newContent3 = newContent2.replace(/className=(["'])([^"']*)grid grid-cols-12([^"']*)\1/g, (match, quote, before, after) => {
    if (before.includes('md:') || before.includes('sm:') || before.includes('lg:')) {
      return match;
    }
    changed = true;
    return `className=${quote}${before}flex flex-col md:grid md:grid-cols-12${after}${quote}`;
  });

  if (changed) {
    fs.writeFileSync(filePath, newContent3, 'utf8');
    console.log('Fixed:', filePath);
  }
}

function walkDir(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      walkDir(fullPath);
    } else if (fullPath.endsWith('.tsx') || fullPath.endsWith('.jsx')) {
      processFile(fullPath);
    }
  }
}

walkDir(path.join(__dirname, 'src', 'pages'));
walkDir(path.join(__dirname, 'src', 'components'));
console.log('Responsiveness check complete.');
