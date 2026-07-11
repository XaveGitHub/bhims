const fs = require('fs');

function revert(file) {
    let c = fs.readFileSync(file, 'utf8');
    
    // Replace Sheet tags with Dialog tags
    c = c.replace(/<Sheet/g, '<Dialog');
    c = c.replace(/<\/Sheet>/g, '</Dialog>');
    c = c.replace(/<SheetContent/g, '<DialogContent');
    c = c.replace(/<\/SheetContent>/g, '</DialogContent>');
    c = c.replace(/<SheetHeader/g, '<DialogHeader');
    c = c.replace(/<\/SheetHeader>/g, '</DialogHeader>');
    c = c.replace(/<SheetTitle/g, '<DialogTitle');
    c = c.replace(/<\/SheetTitle>/g, '</DialogTitle>');

    // Fix imports
    c = c.replace(/import\s*\{\s*Sheet,\s*SheetContent,\s*SheetHeader,\s*SheetTitle,\s*\}\s*from\s*"[\.\/]+components\/ui\/sheet";/g, '');
    c = c.replace(/import\s*\{\s*Sheet,\s*SheetContent,\s*SheetHeader,\s*SheetTitle\s*\}\s*from\s*"[\.\/]+components\/ui\/sheet";/g, '');
    
    fs.writeFileSync(file, c);
}

revert('src/routes/accounts.tsx');
revert('src/routes/templates.tsx');

