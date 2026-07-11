const fs = require('fs');
const path = require('path');

const targets = [
    'src/routes/__root.tsx',
    'src/routes/setup.tsx',
    'src/routes/monitor.tsx',
    'src/routes/login.tsx',
    'src/routes/kiosk.tsx'
];

for (const t of targets) {
    let p = path.join(__dirname, t);
    if (fs.existsSync(p)) {
        let lines = fs.readFileSync(p, 'utf8').split('\n');
        
        let newLines = lines.filter(line => {
            if (line.includes('blur-[100px]') || line.includes('blur-[120px]') || line.includes('blur-xl rounded-full') || line.includes('blur-2xl rounded-full') || (line.includes('absolute inset-0 bg-primary opacity-0 group-hover:opacity-100 transition-opacity blur-2xl'))) {
                return false;
            }
            return true;
        });
        
        if (lines.length !== newLines.length) {
            fs.writeFileSync(p, newLines.join('\n'));
            console.log("Cleaned orbs in " + p);
        }
    }
}
