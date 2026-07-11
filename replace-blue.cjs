const fs = require('fs');
const path = require('path');

function walk(dir) {
    let results = [];
    const list = fs.readdirSync(dir);
    list.forEach(function(file) {
        file = path.join(dir, file);
        const stat = fs.statSync(file);
        if (stat && stat.isDirectory()) {
            results = results.concat(walk(file));
        } else {
            if (file.endsWith('.tsx') || file.endsWith('.ts')) {
                results.push(file);
            }
        }
    });
    return results;
}

const files = walk(path.join(__dirname, 'src'));

for (const file of files) {
    let content = fs.readFileSync(file, 'utf8');
    let original = content;

    // Fix the typo hover:bg-blue- 
    content = content.replace(/hover:bg-blue-\s+text-white/g, 'hover:bg-primary/90 text-primary-foreground');
    content = content.replace(/bg-blue-600/g, 'bg-primary');
    content = content.replace(/text-blue-600/g, 'text-primary');
    content = content.replace(/border-blue-600/g, 'border-primary');
    content = content.replace(/shadow-blue-600/g, 'shadow-primary');
    
    // Also change other bg-blue-500 to primary for backgrounds (except specific opacities maybe)
    // Let's just do blue-600 for now to be safe, as it's the main button color.
    
    if (content !== original) {
        fs.writeFileSync(file, content);
        console.log("Updated " + file);
    }
}
