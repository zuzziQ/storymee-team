const fs = require('fs');
const path = require('path');

const controllers = ['hr.controller.ts', 'hrTask.controller.ts', 'admin.controller.ts', 'omnitask.controller.ts'];

for (const file of controllers) {
    const filePath = path.join(__dirname, 'src', 'controllers', file);
    if (!fs.existsSync(filePath)) continue;

    let content = fs.readFileSync(filePath, 'utf8');

    // Remove express imports
    content = content.replace(/import\s+\{[^}]*Request,\s*Response[^}]*\}\s+from\s+['"]express['"];?/g, '');

    // Replace req: Request, res: Response, next: NextFunction -> req: any, reply: any
    content = content.replace(/req:\s*Request,\s*res:\s*Response(?:,\s*next:\s*NextFunction)?/g, 'req: any, reply: any');

    // Replace res.status(xxx).json(...) -> reply.code(xxx).send(...)
    content = content.replace(/res\.status\(([^)]+)\)\.json\(/g, 'reply.code($1).send(');

    // Replace res.json(...) -> reply.send(...)
    content = content.replace(/res\.json\(/g, 'reply.send(');

    // Fix next(error) -> throw error
    content = content.replace(/next\(([^)]+)\);/g, 'throw $1;');

    fs.writeFileSync(filePath, content);
}
console.log('Controllers patched for Fastify!');
