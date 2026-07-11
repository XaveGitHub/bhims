const fs = require('fs');

let imp = fs.readFileSync('src/routes/import.tsx', 'utf8');

imp = imp.replace(/<table className="w-full text-left text-xs text-foreground\/80">/g, '<Table>');
imp = imp.replace(/<\/table>/g, '</Table>');
imp = imp.replace(/<thead[^>]*>/g, '<TableHeader className="bg-card">');
imp = imp.replace(/<\/thead>/g, '</TableHeader>');
imp = imp.replace(/<tbody[^>]*>/g, '<TableBody>');
imp = imp.replace(/<\/tbody>/g, '</TableBody>');
imp = imp.replace(/<tr className="hover:bg-card\/20">/g, '<TableRow className="hover:bg-muted/50">');
imp = imp.replace(/<tr>/g, '<TableRow>');
imp = imp.replace(/<\/tr>/g, '</TableRow>');
imp = imp.replace(/<th className="px-4 py-3">/g, '<TableHead className="px-4 py-3 font-semibold text-muted-foreground">');
imp = imp.replace(/<\/th>/g, '</TableHead>');
imp = imp.replace(/<td className="px-4 py-3">/g, '<TableCell className="px-4 py-3">');
imp = imp.replace(/<\/td>/g, '</TableCell>');

// Badge refactor for import.tsx
imp = imp.replace(/<span\s*className="rounded-full[^>]+>\s*([\w\s]+)\s*<\/span>/g, '<Badge variant="outline" size="sm">$1</Badge>');

// Add imports
if (!imp.includes('TableBody')) {
    imp = imp.replace(/import \{ Card \} from \"\.\.\/components\/ui\/card\";/, 'import { Card } from "../components/ui/card";\nimport { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";\nimport { Badge } from "#/components/ui/badge.tsx";');
}

fs.writeFileSync('src/routes/import.tsx', imp);
