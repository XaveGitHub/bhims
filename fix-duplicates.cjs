const fs = require('fs');

function fixImports(file) {
    let c = fs.readFileSync(file, 'utf8');
    
    // The previous script added:
    // import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../components/ui/dialog";
    // right before 'import { Button }'
    
    // Let's just remove the FIRST occurrence if there's two
    let count = (c.match(/import { Dialog/g) || []).length;
    if (count > 1) {
        c = c.replace(/import { Dialog, DialogContent, DialogHeader, DialogTitle } from "\.\.\/components\/ui\/dialog";\n/, '');
        fs.writeFileSync(file, c);
    }
}

fixImports('src/routes/accounts.tsx');
fixImports('src/routes/templates.tsx');
