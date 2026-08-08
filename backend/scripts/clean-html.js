const fs = require('fs');
const path = require('path');

const targetPath = path.join(__dirname, '../../frontend/peso_admin.html');
const backupPath = path.join(__dirname, '../../frontend/peso_admin_backup.html');
const content = fs.readFileSync(targetPath, 'utf8');

// Backup first
fs.writeFileSync(backupPath, content, 'utf8');
console.log('[INFO] Backup created at:', backupPath);

const firstDoctype = content.indexOf('<!DOCTYPE html>');
const secondDoctype = content.indexOf('<!DOCTYPE html>', firstDoctype + 15);

if (secondDoctype !== -1) {
    console.log('[INFO] Removing duplicate prefix...');
    console.log('Preview of removed content:\n', content.substring(0, secondDoctype));
    const cleanContent = content.substring(secondDoctype);
    fs.writeFileSync(targetPath, cleanContent, 'utf8');
    console.log('[SUCCESS] Cleaned duplicate prefix! New size:', cleanContent.length);
} else {
    console.log('[INFO] No duplicate doctype found, file is already clean.');
}
