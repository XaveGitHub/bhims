const fs = require('fs');
const path = require('path');

const targets = [
    'src/components/ResidentProfilePane.tsx',
    'src/routes/document-metrics.tsx',
    'src/routes/index.tsx',
    'src/routes/kiosk.tsx',
    'src/routes/login.tsx',
    'src/routes/setup.tsx'
];

for (const t of targets) {
    let p = path.join(__dirname, t);
    if (fs.existsSync(p)) {
        let c = fs.readFileSync(p, 'utf8');
        
        // Remove background gradients
        c = c.replace(/bg-gradient-to-[a-z]+\s+(from-[a-z]+-\d+(\/\d+)?)\s+(via-[a-z]+-\d+(\/\d+)?\s+)?(to-[a-z]+(-\d+)?(\/\d+)?)/g, 'bg-background');
        
        // Handle ResidentProfilePane specific ones
        c = c.replace(/"bg-gradient-to-b from-blue-950\/20 to-transparent border-primary\/20"/g, '"bg-accent/20 border-border"');
        c = c.replace(/"bg-gradient-to-b from-neutral-900\/60 to-transparent border-border\/50"/g, '"bg-card border-border/50"');
        
        c = c.replace(/bg-gradient-to-b from-blue-500\/40 via-blue-500\/20 to-transparent/g, 'bg-border');
        
        if (c !== fs.readFileSync(p, 'utf8')) {
            fs.writeFileSync(p, c);
            console.log("Cleaned gradients in " + p);
        }
    }
}
