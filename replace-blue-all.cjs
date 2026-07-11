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

    // Complex strings first
    content = content.replace(/bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-950\/40 dark:text-blue-400 border dark:border-blue-900\/30/g, 'bg-accent text-accent-foreground border-accent');
    content = content.replace(/bg-blue-100 dark:bg-blue-950\/40 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800\/30/g, 'bg-accent text-accent-foreground border-accent');
    content = content.replace(/bg-blue-100 dark:bg-blue-950\/50 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-900\/30/g, 'bg-accent text-accent-foreground border border-accent');
    content = content.replace(/bg-blue-100 dark:bg-blue-950\/60 dark:text-blue-400 dark:border-blue-800\/40/g, 'bg-accent text-accent-foreground');
    content = content.replace(/bg-blue-100 text-primary border-blue-200/g, 'bg-accent text-accent-foreground');
    
    // Backgrounds
    content = content.replace(/bg-blue-[89]00(\/\d+)?/g, 'bg-primary/10');
    content = content.replace(/bg-blue-950(\/\d+)?/g, 'bg-primary/10');
    content = content.replace(/bg-blue-[4567]00(\/\d+)?/g, 'bg-primary');
    content = content.replace(/bg-blue-[123]00(\/\d+)?/g, 'bg-accent');
    content = content.replace(/bg-blue-50(\/\d+)?/g, 'bg-accent');
    
    // Text
    content = content.replace(/text-blue-[1-9]00(\/\d+)?/g, 'text-primary');
    content = content.replace(/text-blue-950(\/\d+)?/g, 'text-primary');
    
    // Borders
    content = content.replace(/border-blue-[1-9]00(\/\d+)?/g, 'border-primary/20');
    content = content.replace(/border-blue-950(\/\d+)?/g, 'border-primary/20');
    
    // Shadows
    content = content.replace(/shadow-blue-[1-9]00(\/\d+)?/g, 'shadow-primary/20');
    content = content.replace(/shadow-blue-950(\/\d+)?/g, 'shadow-primary/20');
    
    // Hover variants
    content = content.replace(/hover:bg-blue-[1-9]00(\/\d+)?/g, 'hover:bg-accent');
    content = content.replace(/hover:bg-blue-950(\/\d+)?/g, 'hover:bg-accent');
    content = content.replace(/hover:text-blue-[1-9]00(\/\d+)?/g, 'hover:text-accent-foreground');
    content = content.replace(/hover:border-blue-[1-9]00(\/\d+)?/g, 'hover:border-primary/50');
    
    // Selection
    content = content.replace(/selection:bg-blue-[1-9]00(\/\d+)?/g, 'selection:bg-primary/30');

    // Ring
    content = content.replace(/ring-blue-[1-9]00(\/\d+)?/g, 'ring-primary/50');
    
    if (content !== original) {
        fs.writeFileSync(file, content);
        console.log("Updated " + file);
    }
}
