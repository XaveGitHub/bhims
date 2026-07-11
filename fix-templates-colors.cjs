const fs = require('fs');
let c = fs.readFileSync('src/routes/templates.tsx', 'utf8');

// Header
c = c.replace(/text-neutral-100/g, 'text-foreground');
c = c.replace(/text-neutral-500/g, 'text-muted-foreground');

// Card
c = c.replace(/bg-neutral-950/g, 'bg-card');
c = c.replace(/border-white\/10/g, 'border-border');
c = c.replace(/hover:border-white\/20/g, 'hover:border-border/80');

// Overlay
c = c.replace(/bg-neutral-950\/80/g, 'bg-background/80');

// Buttons
c = c.replace(/bg-neutral-900/g, 'bg-muted');
c = c.replace(/text-neutral-300/g, 'text-muted-foreground');
c = c.replace(/text-neutral-800/g, 'text-muted-foreground');
c = c.replace(/text-neutral-700/g, 'text-muted-foreground');
c = c.replace(/text-neutral-400/g, 'text-muted-foreground');

// Card Title
c = c.replace(/text-white leading-tight/g, 'text-foreground leading-tight');

// No templates placeholder
c = c.replace(/border-neutral-800/g, 'border-border');

// Dialog (if any leftovers)
c = c.replace(/border-neutral-800\/60/g, 'border-border');
c = c.replace(/text-neutral-200/g, 'text-foreground');

fs.writeFileSync('src/routes/templates.tsx', c);
console.log('Fixed colors in templates.tsx');
