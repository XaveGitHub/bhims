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

    content = content.replace(/border-white\/5/g, 'border-border');
    content = content.replace(/border-t-white\/8/g, 'border-border');
    content = content.replace(/border-t-white\/10/g, 'border-border');
    
    // Also, "border-border/50" should probably just be "border-border" for crisp lines
    content = content.replace(/border-border\/50/g, 'border-border');
    
    // Fix "bg-background/40", "bg-background/50", "bg-background/60" etc which is transparent in light mode
    // Standard shadcn cards are solid bg-card or bg-background.
    // I'll leave them if they have backdrop-blur-xl, but I removed blur earlier... wait.
    // I only removed background glowing orbs, NOT backdrop-blur-xl on Cards. So it's fine.

    if (content !== original) {
        fs.writeFileSync(file, content);
        console.log("Fixed borders in " + file);
    }
}
