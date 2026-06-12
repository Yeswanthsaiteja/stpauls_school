const fs = require('fs');

let content = fs.readFileSync('functions/index.js', 'utf8');

content = content.replace(
  "iclockApp.all('*', async (req, res) => {",
  `iclockApp.use(async (req, res) => {`
);

fs.writeFileSync('functions/index.js', content);
