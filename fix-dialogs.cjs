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

    // 1. Unstyled neutral dialogs -> text-xl font-bold tracking-tight text-foreground
    content = content.replace(/<DialogTitle>\{editingId \? "Edit Template" : "New Template"\}<\/DialogTitle>/g, '<DialogTitle className="text-xl font-bold tracking-tight text-foreground">{editingId ? "Edit Template" : "New Template"}</DialogTitle>');
    content = content.replace(/<DialogTitle>Template Builder<\/DialogTitle>/g, '<DialogTitle className="text-xl font-bold tracking-tight text-foreground">Template Builder</DialogTitle>');
    
    // 2. Existing neutral dialogs
    content = content.replace(/<DialogTitle className="text-xl font-bold text-foreground(.*?)">/g, '<DialogTitle className="text-xl font-bold tracking-tight text-foreground$1">');
    content = content.replace(/<DialogTitle className="text-xl text-foreground(.*?)">/g, '<DialogTitle className="text-xl font-bold tracking-tight text-foreground$1">');
    
    // 3. Existing red dialogs
    content = content.replace(/<DialogTitle className="text-xl font-bold text-red-500(.*?)">/g, '<DialogTitle className="text-xl font-bold tracking-tight text-red-600$1">');
    content = content.replace(/<DialogTitle className="text-xl font-bold text-red-400(.*?)">/g, '<DialogTitle className="text-xl font-bold tracking-tight text-red-600$1">');

    // Special case for ResidentProfilePane
    content = content.replace(/<DialogTitle className="text-2xl font-bold tracking-tight text-foreground\/90 flex-1">/g, '<DialogTitle className="text-xl font-bold tracking-tight text-foreground flex-1">');
    
    fs.writeFileSync(file, content);
    console.log('Updated', file);
});
