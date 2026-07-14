const fs = require('fs');

const files = [
    'src/routes/residents.tsx',
];

files.forEach(file => {
    if (!fs.existsSync(file)) return;
    let content = fs.readFileSync(file, 'utf8');

    // Archive icon back to amber
    content = content.replace(/className="lucide lucide-archive-x text-red-600"/g, 'className="lucide lucide-archive-x text-amber-500"');
    
    // Deceased/Archive button lighter amber
    content = content.replace(/className="bg-red-600 hover:bg-red-500 text-white rounded-xl px-5"/g, 'className="bg-amber-500 hover:bg-amber-400 text-white rounded-xl px-5 font-semibold"');

    fs.writeFileSync(file, content);
    console.log('Fixed archive in', file);
});
