const fs = require('fs');

function addImport(file) {
    let c = fs.readFileSync(file, 'utf8');
    if (!c.includes('import { Dialog,')) {
        c = c.replace('import { Button }', 'import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../components/ui/dialog";\nimport { Button }');
        fs.writeFileSync(file, c);
    }
}

addImport('src/routes/accounts.tsx');
addImport('src/routes/templates.tsx');
