/**
 * Safe JavaScript Syntax Validator & Linter Tool
 * 
 * Validates JavaScript syntax across all standalone .js files and embedded HTML <script> blocks
 * using safe AST compilation (vm.Script) without executing any code.
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const rootDir = path.resolve(__dirname, '../../');

let totalFilesChecked = 0;
let totalScriptsChecked = 0;
let errorsFound = 0;

function checkJsFile(filePath) {
    totalFilesChecked++;
    totalScriptsChecked++;
    const relPath = path.relative(rootDir, filePath);
    try {
        const code = fs.readFileSync(filePath, 'utf8');
        // vm.Script strictly parses the AST and validates syntax without executing code.
        new vm.Script(code, { filename: relPath, displayErrors: true });
        console.log(`  ✅ [VALID] ${relPath}`);
    } catch (err) {
        errorsFound++;
        console.error(`  ❌ [SYNTAX ERROR] ${relPath}:`);
        console.error(`     ${err.message}`);
        if (err.stack) {
            const lines = err.stack.split('\n').slice(0, 3).join('\n     ');
            console.error(`     ${lines}`);
        }
    }
}

function checkHtmlFile(filePath) {
    totalFilesChecked++;
    const relPath = path.relative(rootDir, filePath);
    try {
        const html = fs.readFileSync(filePath, 'utf8');
        const scriptRegex = /<script\b(?![^>]*\bsrc\s*=)[^>]*>([\s\S]*?)<\/script>/gi;
        let match;
        let scriptIndex = 0;
        let htmlHasErrors = false;

        while ((match = scriptRegex.exec(html)) !== null) {
            scriptIndex++;
            totalScriptsChecked++;
            const scriptContent = match[1];
            
            // Calculate line offset of the script tag in the HTML
            const upToMatch = html.substring(0, match.index);
            const lineOffset = upToMatch.split('\n').length;
            const virtualFileName = `${relPath} (script block #${scriptIndex}, line ${lineOffset})`;

            try {
                new vm.Script(scriptContent, { filename: virtualFileName, displayErrors: true, lineOffset });
            } catch (err) {
                errorsFound++;
                htmlHasErrors = true;
                console.error(`  ❌ [SYNTAX ERROR] ${virtualFileName}:`);
                console.error(`     ${err.message}`);
            }
        }

        if (!htmlHasErrors) {
            console.log(`  ✅ [VALID] ${relPath} (${scriptIndex} script block${scriptIndex === 1 ? '' : 's'})`);
        }
    } catch (err) {
        errorsFound++;
        console.error(`  ❌ [FILE READ ERROR] ${relPath}: ${err.message}`);
    }
}

function scanDirectory(dirPath) {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);
        if (entry.isDirectory()) {
            if (['node_modules', '.git', '.agents', '.gemini'].includes(entry.name)) {
                continue;
            }
            scanDirectory(fullPath);
        } else if (entry.isFile()) {
            const ext = path.extname(entry.name).toLowerCase();
            if (ext === '.js') {
                checkJsFile(fullPath);
            } else if (entry.name.endsWith('.html')) {
                checkHtmlFile(fullPath);
            }
        }
    }
}

console.log('===============================================================');
console.log('🔍 SAFE JAVASCRIPT AST SYNTAX VALIDATOR & LINTER');
console.log('===============================================================');
console.log(`Target Workspace: ${rootDir}\n`);

console.log('📁 Scanning JavaScript & HTML source files...');
scanDirectory(rootDir);

console.log('\n===============================================================');
console.log(`📊 Summary: ${totalFilesChecked} files checked (${totalScriptsChecked} scripts parsed).`);

if (errorsFound === 0) {
    console.log('🎉 Result: 0 Syntax Errors. All scripts parsed successfully!');
    console.log('===============================================================\n');
    process.exit(0);
} else {
    console.error(`⚠️ Result: ${errorsFound} Syntax Error(s) detected. Please resolve them.`);
    console.log('===============================================================\n');
    process.exit(1);
}
