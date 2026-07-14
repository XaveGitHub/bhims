const fs = require('fs');

const files = [
    'src/routes/templates.tsx',
    'src/routes/settings.tsx',
    'src/routes/residents.tsx',
    'src/routes/accounts.tsx',
    'src/routes/queue.tsx',
    'src/routes/households.tsx',
    'src/routes/distributions.tsx',
    'src/components/ResidentProfilePane.tsx',
    'src/components/ManagePuroksModal.tsx',
    'src/components/AddResidentModal.tsx'
];

files.forEach(file => {
    if (!fs.existsSync(file)) return;
    let content = fs.readFileSync(file, 'utf8');

    // Revert red dialog titles to foreground
    content = content.replace(/<DialogTitle className="text-xl font-bold tracking-tight text-red-600(.*?)">/g, '<DialogTitle className="text-xl font-bold tracking-tight text-foreground$1">');
    
    fs.writeFileSync(file, content);
    console.log('Reverted red titles in', file);
});
