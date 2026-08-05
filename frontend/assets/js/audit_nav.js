const fs = require('fs');

['frontend/peso_officer.html', 'frontend/peso_admin.html'].forEach(file => {
  const html = fs.readFileSync(file, 'utf8');
  const ids = (html.match(/id=["']([^"']+)["']/g) || []).map(m => m.replace(/id=["']/, '').replace(/["']$/, ''));
  const switchCalls = (html.match(/switchModule\(["']([^"']+)["']\)/g) || []).map(m => m.replace(/switchModule\(["']/, '').replace(/["']\)/, ''));
  
  console.log('=== File: ' + file + ' ===');
  console.log('  switchModule targets:', [...new Set(switchCalls)]);
  console.log('  Matching IDs count:', ids.length);
  console.log('  Section IDs:', ids.filter(i => 
    i.toLowerCase().includes('section') || 
    i.toLowerCase().includes('module') || 
    i.toLowerCase().includes('dashboard') || 
    i.toLowerCase().includes('beneficiar') || 
    i.toLowerCase().includes('schedule') || 
    i.toLowerCase().includes('question') || 
    i.toLowerCase().includes('fund') || 
    i.toLowerCase().includes('report') ||
    i.toLowerCase().includes('officer') ||
    i.toLowerCase().includes('application')
  ));
});
