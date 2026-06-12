const fs = require('fs');
const path = require('path');

function walk(dir, callback) {
  fs.readdirSync(dir).forEach(f => {
    let dirPath = path.join(dir, f);
    let isDirectory = fs.statSync(dirPath).isDirectory();
    isDirectory ? walk(dirPath, callback) : callback(path.join(dir, f));
  });
}

walk('src/pages', (filePath) => {
  if (!filePath.endsWith('.jsx')) return;
  
  let content = fs.readFileSync(filePath, 'utf8');
  let original = content;
  
  // 1. In AdmissionFormFull.jsx, it's missing setSaving(true) completely.
  if (filePath.includes('AdmissionFormFull.jsx')) {
    if (!content.includes('setSaving(true)')) {
      content = content.replace(/try {\n\s*const payload = {/, 'if (saving) return;\n    setSaving(true);\n    try {\n      const payload = {');
    }
  }

  // 2. Replace setSaving(true) with if (saving) return; setSaving(true);
  // but only if it doesn't already have if (saving) return;
  content = content.replace(/(?<!if\s*\(\s*saving\s*\)\s*return;\s*)setSaving\s*\(\s*true\s*\)/g, 'if (saving) return; setSaving(true)');
  
  // 3. Same for setSubmitting
  content = content.replace(/(?<!if\s*\(\s*submitting\s*\)\s*return;\s*)setSubmitting\s*\(\s*true\s*\)/g, 'if (submitting) return; setSubmitting(true)');

  if (content !== original) {
    fs.writeFileSync(filePath, content);
    console.log('Fixed', filePath);
  }
});
