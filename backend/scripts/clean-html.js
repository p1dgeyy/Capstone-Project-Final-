const fs = require('fs');
const path = require('path');

const targetPath = path.join(__dirname, '../../frontend/peso_admin.html');
const content = fs.readFileSync(targetPath, 'utf8');

// Find the second occurrence of '<!DOCTYPE html>'
const firstDoctype = content.indexOf('<!DOCTYPE html>');
const secondDoctype = content.indexOf('<!DOCTYPE html>', firstDoctype + 15);

if (secondDoctype !== -1) {
    const cleanContent = content.substring(secondDoctype);
    fs.writeFileSync(targetPath, cleanContent, 'utf8');
    console.log('[SUCCESS] Cleaned duplicate prefix! New size:', cleanContent.length);
} else {
    console.log('[INFO] No duplicate doctype found, file is already clean.');
}
