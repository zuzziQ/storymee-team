const fs = require('fs');
const path = require('path');

const controllers = ['hr.controller.ts', 'hrTask.controller.ts', 'admin.controller.ts', 'omnitask.controller.ts'];

for (const file of controllers) {
    const filePath = path.join(__dirname, 'src', 'controllers', file);
    if (!fs.existsSync(filePath)) continue;

    let content = fs.readFileSync(filePath, 'utf8');

    // Remove asyncHandler import
    content = content.replace(/import\s+\{\s*asyncHandler\s*\}\s+from\s+['"]\.\.\/utils\/asyncHandler['"];?\n?/g, '');

    // Replace static method = asyncHandler(async (req, reply) => {
    // With static async method(req: any, reply: any) {
    content = content.replace(/static\s+(\w+)\s*=\s*asyncHandler\(async\s*\(\s*req:\s*any,\s*reply:\s*any\s*\)\s*=>\s*\{/g, 'static async $1(req: any, reply: any) {');
    
    // For non-asyncHandler wrapped methods with fat arrow
    content = content.replace(/static\s+(\w+)\s*=\s*async\s*\(\s*req:\s*any,\s*reply:\s*any\s*\)\s*=>\s*\{/g, 'static async $1(req: any, reply: any) {');

    // The hard part is removing the trailing `});` of asyncHandler. 
    // Since we know the file is well formatted, let's use a trick: `});` at the end of the method should just be `}`.
    // Or we can just run a simple replacement of `});\n` to `}\n` if it's at the same indentation level as the start.
    content = content.replace(/^  \}\);\n/gm, '  }\n');
    content = content.replace(/^  \}\);$/gm, '  }');
    content = content.replace(/^\s{2}\}\);\n/gm, '  }\n');
    content = content.replace(/^\s{2}\}\);$/gm, '  }');

    fs.writeFileSync(filePath, content);
}
console.log('asyncHandler removed!');
