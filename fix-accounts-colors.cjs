const fs = require('fs');
let c = fs.readFileSync('src/routes/accounts.tsx', 'utf8');

// Table and Cards
c = c.replace(/bg-neutral-950\/40/g, 'bg-card');
c = c.replace(/bg-neutral-950\/50/g, 'bg-muted/50');
c = c.replace(/bg-neutral-950/g, 'bg-background');

// Borders
c = c.replace(/border-neutral-800\/60/g, 'border-border');
c = c.replace(/border-neutral-800/g, 'border-border');

// Text colors
c = c.replace(/text-neutral-100/g, 'text-foreground');
c = c.replace(/text-neutral-500/g, 'text-muted-foreground');
c = c.replace(/text-neutral-400/g, 'text-muted-foreground');
c = c.replace(/text-neutral-300/g, 'text-muted-foreground');

// Inputs
c = c.replace(/bg-neutral-900\/50/g, 'bg-muted/50');
c = c.replace(/bg-neutral-900/g, 'bg-background');

fs.writeFileSync('src/routes/accounts.tsx', c);
console.log('Fixed colors in accounts.tsx');
