const fs = require('fs');
const path = require('path');

function refactorRoutes(filePath) {
    if (!fs.existsSync(filePath)) return;
    let content = fs.readFileSync(filePath, 'utf8');
    
    // Fix imports for controllers
    content = content.replace(/\.\.\/controllers/g, '../../controllers');
    
    // Fastify plugin
    content = content.replace(/import\s+\{.*Router.*\}\s+from\s+['"]express['"];?/g, "import { FastifyPluginAsync } from 'fastify';");
    content = content.replace(/const\s+router\s*=\s*Router\(\);/g, "const plugin: FastifyPluginAsync = async (fastify) => {");
    content = content.replace(/router\.(get|post|put|patch|delete)\((.*)\);/g, "fastify.$1($2);");
    content = content.replace(/export\s+default\s+router;/g, "};\nexport default plugin;");

    fs.writeFileSync(filePath, content);
}

const routes = [
    'src/modules/hr/index.ts', 
    'src/modules/omnitask/index.ts'
];
routes.forEach(f => refactorRoutes(path.join(__dirname, f)));

console.log("Routes refactored!");
