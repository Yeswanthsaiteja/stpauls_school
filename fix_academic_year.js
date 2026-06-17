const fs = require('fs');
const path = require('path');

const files = [
  'frontend/src/pages/Transport.jsx',
  'frontend/src/pages/IDCardStudio.jsx',
  'frontend/src/pages/IDCards.jsx',
  'frontend/src/pages/ParentDashboard.jsx',
  'frontend/src/pages/Hostel.jsx',
  'frontend/src/pages/students/Certificates.jsx',
  'frontend/src/pages/students/StudentDirectoryPage.jsx',
  'frontend/src/pages/StudentAttendance.jsx',
  'frontend/src/pages/ResultsEntry.jsx',
  'frontend/src/pages/finance/FeeStatus.jsx',
  'frontend/src/pages/finance/FeeCollection.jsx',
  'frontend/src/pages/finance/FeeSetup.jsx',
  'frontend/src/pages/finance/FeeDefaulters.jsx'
];

files.forEach(file => {
  const filePath = path.join(__dirname, file);
  if (fs.existsSync(filePath)) {
    let content = fs.readFileSync(filePath, 'utf-8');
    
    // Add import if not exists
    if (!content.includes('getCurrentAcademicYear')) {
      // Find the first import
      const firstImportMatch = content.match(/^import .*$/m);
      if (firstImportMatch) {
        // Calculate relative path to utils.js
        const dir = path.dirname(filePath);
        let relPath = path.relative(dir, path.join(__dirname, 'frontend/src/utils'));
        if (!relPath.startsWith('.')) relPath = './' + relPath;
        
        const importStatement = `import { getCurrentAcademicYear } from '${relPath}';\n`;
        content = content.replace(firstImportMatch[0], firstImportMatch[0] + '\n' + importStatement);
      }
    }
    
    // Replace useState('2026-27')
    content = content.replace(/useState\('2026-27'\)/g, 'useState(getCurrentAcademicYear())');
    
    fs.writeFileSync(filePath, content);
    console.log(`Updated ${file}`);
  }
});
