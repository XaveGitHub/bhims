const fs = require('fs');
const path = require('path');

const targets = [
    'src/components/nav-main.tsx',
    'src/components/nav-secondary.tsx',
    'src/components/nav-documents.tsx',
    'src/components/nav-user.tsx',
    'src/components/ui/sidebar.tsx'
];

for (const t of targets) {
    let p = path.join(__dirname, t);
    if (fs.existsSync(p)) {
        let c = fs.readFileSync(p, 'utf8');
        
        // nav-main.tsx & nav-secondary.tsx active state
        c = c.replace(/"bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-950\/40 dark:text-blue-400 border dark:border-blue-900\/30 hover:bg-blue-200 dark:hover:bg-blue-900\/40 hover:text-blue-800 dark:hover:text-blue-300"/g, 
                      '"bg-accent text-accent-foreground font-medium"');
        c = c.replace(/"text-foreground\/90 hover:bg-neutral-200 dark:hover:bg-white\/5 hover:text-foreground border border-transparent"/g, 
                      '"text-muted-foreground hover:bg-accent/50 hover:text-foreground"');
                      
        // nav-documents.tsx active state
        c = c.replace(/"bg-blue-950\/40 text-blue-400 border border-blue-900\/30 hover:bg-blue-900\/40 hover:text-blue-300"/g,
                      '"bg-accent text-accent-foreground font-medium"');
        c = c.replace(/"text-foreground hover:bg-white\/5 hover:text-foreground border border-transparent"/g,
                      '"text-muted-foreground hover:bg-accent/50 hover:text-foreground"');
                      
        // ui/sidebar.tsx generic active state
        c = c.replace(/"bg-blue-950\/40 text-blue-400 border border-blue-900\/30"/g,
                      '"bg-accent text-accent-foreground font-medium"');

        // nav-user.tsx generic color
        c = c.replace(/bg-blue-500\/10 text-blue-400/g, 'bg-primary/10 text-primary');
        
        fs.writeFileSync(p, c);
    }
}
