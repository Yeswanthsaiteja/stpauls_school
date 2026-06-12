const fs = require('fs');

let content = fs.readFileSync('functions/index.js', 'utf8');

content = content.replace(
  "iclockApp.all(['/registry', '/iclock/registry', '/cdata', '/iclock/cdata', '/getrequest', '/iclock/getrequest'], async (req, res) => {",
  `iclockApp.all('*', async (req, res) => {
  res.setHeader('Content-Type', 'text/plain');
  console.log("ADMS Request:", req.method, req.path, req.query, req.body);`
);

fs.writeFileSync('functions/index.js', content);
