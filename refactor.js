const fs = require('fs');

// 1. templates.tsx Dialog -> Sheet
let tpl = fs.readFileSync('src/routes/templates.tsx', 'utf8');
tpl = tpl.replace(/import\s*\{\s*Dialog,\s*DialogContent,\s*DialogHeader,\s*DialogTitle\s*\}\s*from\s*\"[^\"]+dialog\"/g, 'import { Sheet, SheetContent, SheetHeader, SheetTitle } from \"#/components/ui/sheet.tsx\";\nimport { Dialog, DialogContent, DialogHeader, DialogTitle } from \"../components/ui/dialog\";');
tpl = tpl.replace(/<Dialog open=\{isModalOpen\}/g, '<Sheet open={isModalOpen}');
tpl = tpl.replace(/<\/Dialog>([\s\S]*?)<Dialog open=\{isBuilderMode\}/, '</Sheet>$1<Sheet open={isBuilderMode}');
tpl = tpl.replace(/<\/Dialog>([\s\S]*?)<Dialog open=\{deleteId/, '</Sheet>$1<Dialog open={deleteId');
tpl = tpl.replace(/<DialogContent className=\"sm:max-w-\[425px\] bg-background border-border\/60 shadow-2xl text-foreground\">/g, '<SheetContent className=\"sm:max-w-[425px] bg-background border-border/60 shadow-2xl text-foreground overflow-y-auto\">');
tpl = tpl.replace(/<DialogContent className=\"max-w-\[850px\] w-full max-h-\[95vh\] h-full bg-background border-border\/60 shadow-2xl p-0 flex flex-col\">/g, '<SheetContent className=\"max-w-[850px] w-full max-h-[95vh] h-full bg-background border-border/60 shadow-2xl p-0 flex flex-col sm:max-w-[850px]\">');
tpl = tpl.replace(/<DialogHeader/g, (match, offset) => offset < 10000 ? '<SheetHeader' : match);
tpl = tpl.replace(/<\/DialogHeader>/g, (match, offset) => offset < 10000 ? '</SheetHeader>' : match);
tpl = tpl.replace(/<DialogTitle/g, (match, offset) => offset < 10000 ? '<SheetTitle' : match);
tpl = tpl.replace(/<\/DialogTitle>/g, (match, offset) => offset < 10000 ? '</SheetTitle>' : match);
fs.writeFileSync('src/routes/templates.tsx', tpl);

// 2. households.tsx Badge refactor
let hh = fs.readFileSync('src/routes/households.tsx', 'utf8');
hh = hh.replace(/<span className=\"inline-flex items-center rounded-full bg-[^>]+>\s*(PWD|Senior|Voter|Solo|Deceased)\s*<\/span>/g, (m, p1) => {
    return '<Badge variant=\"' + (p1==='Deceased'?'outline':'secondary') + '\" size=\"sm\">' + p1 + '</Badge>';
});
hh = hh.replace(/import \{ Card/g, 'import { Badge } from \"#/components/ui/badge.tsx\";\nimport { Card');
fs.writeFileSync('src/routes/households.tsx', hh);

// 3. residents.tsx Badge refactor
let r = fs.readFileSync('src/routes/residents.tsx', 'utf8');
r = r.replace(/<span className={`px-2 py-0\\.5 rounded-full text-\\[10px\\] font-bold uppercase tracking-wider \\$\\{[^}]+\\}`}>\\s*\\{resident\\.householdRole\\}\\s*<\\/span>/g, '<Badge size=\"sm\" variant={resident.householdRole === \"head\" ? \"default\" : resident.householdRole === \"spouse\" ? \"secondary\" : \"outline\"} className=\"uppercase tracking-wider\">{resident.householdRole}</Badge>');
r = r.replace(/<span className=\"rounded-full bg-[^>]+>\s*(PWD|Senior|Voter|Solo|Deceased)\s*<\/span>/g, (m, p1) => {
    return '<Badge variant=\"' + (p1==='Deceased'?'outline':'secondary') + '\" size=\"sm\">' + p1 + '</Badge>';
});
r = r.replace(/import \{ Card/g, 'import { Badge } from \"#/components/ui/badge.tsx\";\nimport { Card');
fs.writeFileSync('src/routes/residents.tsx', r);

// 4. queue.tsx Badge refactor
let q = fs.readFileSync('src/routes/queue.tsx', 'utf8');
q = q.replace(/<span className={`px-2 py-1 rounded-md text-xs font-semibold \\$\\{.*?\\}`}>\\s*?\\{item\\.status\\}\\s*?<\\/span>/gs, (match) => {
    return '<Badge size=\"md\" variant={item.status === \"Completed\" || item.status === \"Ready to Claim\" ? \"default\" : item.status === \"Processing\" ? \"secondary\" : item.status === \"Failed\" ? \"destructive\" : \"outline\"}>{item.status}</Badge>';
});
q = q.replace(/import \{ Card/g, 'import { Badge } from \"#/components/ui/badge.tsx\";\nimport { Card');
fs.writeFileSync('src/routes/queue.tsx', q);

// 5. import.tsx Badge refactor
let imp = fs.readFileSync('src/routes/import.tsx', 'utf8');
imp = imp.replace(/<span className=\"rounded-full bg-[^>]+>\s*(PWD|Senior Citizen|Registered Voter|Solo Parent)\s*<\/span>/g, (m, p1) => {
    return '<Badge variant=\"secondary\" size=\"sm\">' + p1 + '</Badge>';
});
imp = imp.replace(/import \{ Card/g, 'import { Badge } from \"#/components/ui/badge.tsx\";\nimport { Card');
fs.writeFileSync('src/routes/import.tsx', imp);

// Delete tag.tsx
if (fs.existsSync('src/components/ui/tag.tsx')) {
    fs.unlinkSync('src/components/ui/tag.tsx');
}
