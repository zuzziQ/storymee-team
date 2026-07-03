const fs = require('fs');
const ts = require('typescript'); // Note: just using basic string regexes

function processFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');

  // 1. Add import if needed
  if (!content.includes('@storymee/api-client')) {
    content = `import { CoreApiClient } from "@storymee/api-client";\n` + content;
  }

  // 2. Change CORE_API_URL
  content = content.replace(
    /const CORE_API_URL = process\.env\.CORE_API_URL \|\| "http:\/\/localhost:4500\/api\/omnitask";/,
    'const CORE_API_URL = process.env.CORE_API_URL || "http://localhost:4500";\nconst apiClient = new CoreApiClient({ baseURL: CORE_API_URL });'
  );

  // 3. Find and replace fetch blocks
  // A typical block:
  // const resName = await fetch(`${CORE_API_URL}/endpoint`[, options]);
  // if (!resName.ok) { ... throw ... }
  // const dataName = await resName.json();
  
  // We'll use a regex that matches:
  // (const|let) (\w+) = await fetch\(`\$\{CORE_API_URL\}([^`]+)`(?:, (\{[\s\S]*?\}))?\);
  // (\s*if \(!\2\.ok\)[\s\S]*?(?:throw[^;]+;|\{.*?\}))?
  // (\s*(?:const|let) (\w+) = await \2\.json\(\)[^;]*;)?

  const fetchRegex = /(?:const|let) (\w+) = await fetch\(`\$\{CORE_API_URL\}([^`]+)`(?:, (\{[\s\S]*?\}))?\);(\s*if \(!\1\.ok\)[\s\S]*?(?:throw[^;]+;|\{[\s\S]*?\}))?(?:\s*(?:const|let|return) (\w+)?(?: = )?await \1\.json\(\)[^;]*;)?/g;
  
  // We need to parse options to see if it's GET/POST/etc and extract body
  content = content.replace(fetchRegex, (match, resName, endpoint, optionsStr, okCheck, dataName) => {
    let method = 'get';
    let body = 'undefined';
    
    if (optionsStr) {
      if (optionsStr.includes('method: "POST"') || optionsStr.includes("method: 'POST'")) method = 'post';
      if (optionsStr.includes('method: "PUT"') || optionsStr.includes("method: 'PUT'")) method = 'put';
      if (optionsStr.includes('method: "PATCH"') || optionsStr.includes("method: 'PATCH'")) method = 'patch';
      if (optionsStr.includes('method: "DELETE"') || optionsStr.includes("method: 'DELETE'")) method = 'delete';
      
      const bodyMatch = optionsStr.match(/body:\s*(JSON\.stringify\(([^)]+)\)|([^,}]+))/);
      if (bodyMatch) {
        body = bodyMatch[2] || bodyMatch[3];
      }
    }
    
    const apiCall = method === 'get' || method === 'delete' 
      ? `await apiClient.${method}(\`/omnitask${endpoint}\`)`
      : `await apiClient.${method}(\`/omnitask${endpoint}\`, ${body})`;
      
    // What about the error check?
    // We can wrap it in a catch. Let's see what the error check threw.
    let errorThrow = 'throw err;';
    if (okCheck) {
      const throwMatch = okCheck.match(/throw\s+new\s+[^{}]+;/);
      if (throwMatch) {
        errorThrow = throwMatch[0].replace(/\$\{.*?\.text\(\)\}/g, '${err.message || err}');
      } else {
        const innerThrow = okCheck.match(/throw\s+[^;]+;/);
        if (innerThrow) {
          errorThrow = innerThrow[0];
        }
      }
    }

    let finalStr = ``;
    if (dataName) {
       finalStr = `let ${dataName};\n      try {\n        ${dataName} = ${apiCall};\n      } catch (err: any) {\n        ${errorThrow}\n      }`;
    } else {
       // if there is no dataName assigned (e.g. it was just an await or returning directly)
       // check if the match included `return await resName.json()`
       if (match.includes(`return await ${resName}.json()`)) {
         finalStr = `try {\n        return ${apiCall};\n      } catch (err: any) {\n        ${errorThrow}\n      }`;
       } else {
         finalStr = `try {\n        await ${apiCall};\n      } catch (err: any) {\n        ${errorThrow}\n      }`;
       }
    }
    return finalStr;
  });

  fs.writeFileSync(filePath, content, 'utf8');
  console.log(`Processed ${filePath}`);
}

processFile('src/index.ts');
processFile('src/telegram_agent.ts');
