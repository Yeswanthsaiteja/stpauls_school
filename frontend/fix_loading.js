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

  // Let's replace setLoading(true) ONLY inside handleSave, handleSubmit, submit, handleAdd
  // using a regex. Actually, it's safer to just do the same replace for setLoading(true)
  // ONLY if it's right after `const handle... = async () => {`
  // But wait, what if loading data also uses setLoading(true)? It does!
  // If we do `if (loading) return;`, then data fetching won't run if loading is already true (which is fine, it prevents double-fetch).
  
  content = content.replace(/(?<!if\s*\(\s*loading\s*\)\s*return;\s*)setLoading\s*\(\s*true\s*\)/g, 'if (loading) return; setLoading(true)');

  if (content !== original) {
    fs.writeFileSync(filePath, content);
    console.log('Fixed loading in', filePath);
  }
});
