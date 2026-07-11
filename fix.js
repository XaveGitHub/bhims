const fs = require('fs');

const fixFile = (filePath) => {
    let content = fs.readFileSync(filePath, 'utf8');

    // Restore missing opacity values
    content = content.replace(/950\/(\s)/g, '950/40');
    content = content.replace(/800\/(\s)/g, '800/30');
    content = content.replace(/900\/(\s)/g, '900/30');

    // Also fix the document-metrics icons specifically
    content = content.replace(/bg-blue-950\/40\s+border-blue-800\/40/g, 'bg-blue-100 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800/40 text-blue-600 dark:text-blue-400');
    content = content.replace(/bg-cyan-950\/40\s+border-cyan-800\/40/g, 'bg-cyan-100 dark:bg-cyan-950/40 border border-cyan-200 dark:border-cyan-800/40 text-cyan-600 dark:text-cyan-400');
    content = content.replace(/bg-amber-950\/40\s+border-amber-800\/40/g, 'bg-amber-100 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/40 text-amber-600 dark:text-amber-400');

    // Fix households.tsx
    content = content.replace(/hover:bg-blue-950\/30/g, 'hover:bg-blue-100 dark:hover:bg-blue-950/30');
    content = content.replace(/hover:border-blue-900\/50/g, 'hover:border-blue-300 dark:hover:border-blue-900/50');

    fs.writeFileSync(filePath, content);
};

['src/routes/document-metrics.tsx', 'src/routes/residents.tsx', 'src/routes/households.tsx', 'src/routes/queue.tsx'].forEach(fixFile);
console.log('Fixed tags');
