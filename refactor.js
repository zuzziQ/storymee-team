const fs = require('fs');
const path = require('path');

const controllersDir = path.join(__dirname, 'src', 'controllers');
const routesDir = path.join(__dirname, 'src', 'routes');

function refactorFile(filePath) {
    if (!fs.existsSync(filePath)) return;
    let content = fs.readFileSync(filePath, 'utf8');

    // Replace Request, Response imports
    content = content.replace(/import\s+\{.*Request,\s*Response.*\}\s+from\s+['"]express['"];?/g, '');
    
    // Remove asyncHandler wrapper
    content = content.replace(/import\s+\{\s*asyncHandler\s*\}\s+from\s+['"]\.\.\/utils\/asyncHandler['"];?/g, '');

    // Replace static method signatures
    content = content.replace(/static\s+(\w+)\s*=\s*asyncHandler\(async\s*\(\s*req(?:\s*:\s*Request)?\s*,\s*res(?:\s*:\s*Response)?\s*\)\s*=>\s*\{/g, 'static async $1(req: any, reply: any) {');
    
    // For non-asyncHandler wrapped methods
    content = content.replace(/static\s+(\w+)\s*=\s*async\s*\(\s*req(?:\s*:\s*Request)?\s*,\s*res(?:\s*:\s*Response)?\s*\)\s*=>\s*\{/g, 'static async $1(req: any, reply: any) {');
    
    // Replace res.status(x).json(...)
    content = content.replace(/res\.status\((\d+)\)\.json\(/g, 'return reply.code($1).send(');
    
    // Replace return res.status(x).json(...) -> return reply.code(x).send(...)
    content = content.replace(/return\s+res\.status\((\d+)\)\.json\(/g, 'return reply.code($1).send(');
    
    // Replace res.json(...)
    content = content.replace(/res\.json\(/g, 'return reply.send(');
    
    // Replace return res.json(...) -> return reply.send(...)
    content = content.replace(/return\s+res\.json\(/g, 'return reply.send(');

    // Replace closing brackets for asyncHandler
    content = content.replace(/\}\);/g, (match, offset, str) => {
        // Simple heuristic: if we replaced asyncHandler, we need to change `});` to `}` for those methods.
        // It's safer to just run prettier or fix manually, but let's try a regex for `});` at the end of class methods
        return match; 
    });

    // Fix the asyncHandler closing brackets hack
    content = content.replace(/\}\);\n/g, '}\n');
    content = content.replace(/\}\)\;/g, '}');

    fs.writeFileSync(filePath, content);
}

function refactorRoutes(filePath) {
    if (!fs.existsSync(filePath)) return;
    let content = fs.readFileSync(filePath, 'utf8');
    
    content = content.replace(/import\s+\{.*Router.*\}\s+from\s+['"]express['"];?/g, "import { FastifyPluginAsync } from 'fastify';");
    content = content.replace(/const\s+router\s*=\s*Router\(\);/g, "const plugin: FastifyPluginAsync = async (fastify) => {");
    content = content.replace(/router\.(get|post|put|patch|delete)\((.*)\);/g, "fastify.$1($2);");
    content = content.replace(/export\s+default\s+router;/g, "};\nexport default plugin;");

    fs.writeFileSync(filePath, content);
}

const controllers = ['hr.controller.ts', 'hrTask.controller.ts', 'admin.controller.ts', 'omnitask.controller.ts'];
controllers.forEach(f => refactorFile(path.join(controllersDir, f)));

const routes = ['hr.routes.ts', 'admin.routes.ts', 'omnitask.routes.ts'];
routes.forEach(f => refactorRoutes(path.join(routesDir, f)));

console.log("Refactoring complete");
