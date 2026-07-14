const fs = require('fs');

const files = [
    'src/routes/accounts.tsx',
    'src/routes/settings.tsx',
    'src/routes/templates.tsx',
    'src/routes/residents.tsx',
    'src/routes/households.tsx',
    'src/components/ResidentProfilePane.tsx'
];

files.forEach(file => {
    if (!fs.existsSync(file)) return;
    let content = fs.readFileSync(file, 'utf8');

    // accounts.tsx delete
    content = content.replace(/<Trash2 className="h-5 w-5" \/>/g, '<Trash2 className="h-5 w-5 text-red-600" />');
    
    // residents.tsx archive/deceased
    // Make amber-500 red-600
    content = content.replace(/text-amber-500/g, 'text-red-600');
    // The button bg-amber-600 hover:bg-amber-500 text-foreground
    content = content.replace(/className="bg-amber-600 hover:bg-amber-500 text-foreground rounded-xl px-5"/g, 'className="bg-red-600 hover:bg-red-500 text-white rounded-xl px-5"');

    // settings.tsx delete database
    // check if it has an icon
    content = content.replace(/<AlertTriangle className="h-5 w-5" \/>/g, '<AlertTriangle className="h-5 w-5 text-red-600" />');
    content = content.replace(/<Archive className="h-5 w-5" \/>/g, '<Archive className="h-5 w-5 text-red-600" />');

    // any generic lucide-archive-x without color
    content = content.replace(/className="lucide lucide-archive-x"/g, 'className="lucide lucide-archive-x text-red-600"');

    fs.writeFileSync(file, content);
    console.log('Fixed icons in', file);
});
