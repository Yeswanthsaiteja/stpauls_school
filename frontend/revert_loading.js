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

  // Revert fix_loading changes exactly: "if (loading) return; setLoading(true)" -> "setLoading(true)"
  content = content.replace(/if\s*\(\s*loading\s*\)\s*return;\s*setLoading\s*\(\s*true\s*\)/g, 'setLoading(true)');

  if (content !== original) {
    fs.writeFileSync(filePath, content);
    console.log('Reverted loading in', filePath);
  }
});
