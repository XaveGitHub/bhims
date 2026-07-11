const fs = require('fs');
const path = require('path');

function walk(d) {
    let r = [];
    fs.readdirSync(d).forEach(f => {
        const pf = path.join(d, f);
        if (fs.statSync(pf).isDirectory()) {
            r = r.concat(walk(pf));
        } else if (pf.endsWith('.tsx')) {
            r.push(pf);
        }
    });
    return r;
}

const files = walk('src');

files.forEach(f => {
    // Skip specific components that represent physical paper or ID cards
    if (f.includes('TemplateBuilder.tsx') || f.includes('resident-id-card.tsx')) return;

    let c = fs.readFileSync(f, 'utf8');
    let original = c;

    // 1. Remove hardcoded gradients
    c = c.replace(/bg-gradient-to-r from-neutral-\d+ to-neutral-\d+ dark:from-neutral-\d+ dark:to-neutral-\d+ bg-clip-text text-transparent/g, 'text-foreground');
    c = c.replace(/bg-gradient-to-r from-neutral-\d+ to-neutral-\d+ bg-clip-text text-transparent/g, 'text-foreground');

    // 2. Fix Button Overrides
    // Find <Button ... className="... bg-primary ... text-white ..."> and similar
    c = c.replace(/className="([^"]*)bg-primary([^"]*)text-white([^"]*)"/g, 'className="$1$2$3"');
    c = c.replace(/className="([^"]*)bg-neutral-\d+([^"]*)text-neutral-\d+([^"]*)"/g, 'className="$1$2$3"');
    // Specifically target variant="outline" with hardcoded backgrounds
    c = c.replace(/variant="outline"([^>]*?)className="([^"]*)bg-primary([^"]*)"/g, 'variant="outline"$1className="$2$3"');

    // 3. Structural Neutrals
    c = c.replace(/bg-neutral-950/g, 'bg-card');
    c = c.replace(/bg-neutral-900/g, 'bg-muted');
    c = c.replace(/bg-neutral-850/g, 'bg-muted/50');
    c = c.replace(/bg-neutral-800/g, 'bg-muted');
    c = c.replace(/bg-neutral-700/g, 'bg-muted');
    c = c.replace(/bg-neutral-600/g, 'bg-muted/50');
    c = c.replace(/bg-neutral-500/g, 'bg-accent');
    
    // Text Neutrals
    c = c.replace(/text-neutral-50/g, 'text-foreground');
    c = c.replace(/text-neutral-100/g, 'text-foreground');
    c = c.replace(/text-neutral-200/g, 'text-foreground');
    c = c.replace(/text-neutral-300/g, 'text-muted-foreground');
    c = c.replace(/text-neutral-400/g, 'text-muted-foreground');
    c = c.replace(/text-neutral-500/g, 'text-muted-foreground');
    c = c.replace(/text-neutral-600/g, 'text-muted-foreground');
    c = c.replace(/text-neutral-700/g, 'text-foreground');
    
    // Clean up multiple spaces in classes
    c = c.replace(/className="([^"]*)"/g, (match, p1) => {
        return `className="${p1.replace(/\s+/g, ' ').trim()}"`;
    });
    
    // Avoid double classes
    c = c.replace(/bg-muted bg-muted/g, 'bg-muted');
    c = c.replace(/text-foreground text-foreground/g, 'text-foreground');
    c = c.replace(/text-muted-foreground text-muted-foreground/g, 'text-muted-foreground');

    if (c !== original) {
        fs.writeFileSync(f, c);
        console.log('Fixed', f);
    }
});
