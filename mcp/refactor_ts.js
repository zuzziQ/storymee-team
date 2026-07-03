const { Project, SyntaxKind } = require("ts-morph");

const project = new Project();
project.addSourceFilesAtPaths("src/**/*.ts");

function processFile(file) {
  let changed = false;

  // 1. Add import
  const hasImport = file.getImportDeclaration(decl => decl.getModuleSpecifierValue() === "@storymee/api-client");
  if (!hasImport) {
    file.addImportDeclaration({
      moduleSpecifier: "@storymee/api-client",
      namedImports: ["CoreApiClient"],
    });
    changed = true;
  }

  // 2. Change CORE_API_URL
  const varDecls = file.getDescendantsOfKind(SyntaxKind.VariableDeclaration);
  for (const decl of varDecls) {
    if (decl.getName() === "CORE_API_URL") {
      const init = decl.getInitializer();
      if (init && init.getText().includes("/api/omnitask")) {
        init.replaceWithText('process.env.CORE_API_URL || "http://localhost:4500"');
        
        const stmt = decl.getFirstAncestorByKind(SyntaxKind.VariableStatement);
        if (stmt) {
          file.insertVariableStatement(stmt.getChildIndex() + 1, {
            declarations: [{
              name: "apiClient",
              initializer: "new CoreApiClient({ baseURL: CORE_API_URL })"
            }]
          });
        }
        changed = true;
      }
    }
  }

  // 3. Process fetch calls
  const allCallExprs = file.getDescendantsOfKind(SyntaxKind.CallExpression);
  const fetchCalls = allCallExprs.filter(c => {
    try {
      return c.getExpression().getText() === "fetch";
    } catch { return false; }
  });
  
  // Iterate backwards to prevent AST invalidation
  for (let i = fetchCalls.length - 1; i >= 0; i--) {
    const callExpr = fetchCalls[i];

    const args = callExpr.getArguments();
    if (args.length === 0) continue;
    const urlArgText = args[0].getText();
    if (!urlArgText.includes("CORE_API_URL")) continue;

    let newUrl = urlArgText.replace("${CORE_API_URL}", "/omnitask");
    if (newUrl.startsWith("`/") && newUrl.endsWith("`") && !newUrl.includes("${")) {
      newUrl = '"' + newUrl.substring(1, newUrl.length - 1) + '"';
    }

    let method = "get";
    let bodyText = "";

    if (args.length > 1) {
      const optionsArg = args[1];
      if (optionsArg.isKind(SyntaxKind.ObjectLiteralExpression)) {
        const methodProp = optionsArg.getProperty("method");
        if (methodProp && methodProp.isKind(SyntaxKind.PropertyAssignment)) {
          method = methodProp.getInitializer().getText().replace(/['"]/g, "").toLowerCase();
        }
        const bodyProp = optionsArg.getProperty("body");
        if (bodyProp && bodyProp.isKind(SyntaxKind.PropertyAssignment)) {
          bodyText = bodyProp.getInitializer().getText();
        }
      }
    }

    const apiCallStr = (method === 'get' || method === 'delete') 
      ? `apiClient.${method}(${newUrl})`
      : `apiClient.${method}(${newUrl}, ${bodyText || "undefined"})`;

    const awaitExpr = callExpr.getFirstAncestorByKind(SyntaxKind.AwaitExpression);
    if (!awaitExpr) {
       // it's just fetch(...) without await
       callExpr.replaceWithText(apiCallStr);
       changed = true;
       continue;
    }

    // Usually: const res = await fetch(...)
    const varDecl = awaitExpr.getFirstAncestorByKind(SyntaxKind.VariableDeclaration);
    if (!varDecl) {
      // not assigned, maybe just `await fetch(...)`
      callExpr.replaceWithText(apiCallStr);
      changed = true;
      continue;
    }

    const resName = varDecl.getName();
    const varStmt = varDecl.getFirstAncestorByKind(SyntaxKind.VariableStatement);
    if (!varStmt) continue;

    const block = varStmt.getParentIfKind(SyntaxKind.Block) || varStmt.getParentIfKind(SyntaxKind.SourceFile) || varStmt.getParent();
    if (!block || typeof block.getStatements !== 'function') continue;

    const stmts = block.getStatements();
    const index = stmts.findIndex(s => s === varStmt);

    // Find the `.ok` check and `.json()` usage
    let okStmtIndex = -1;
    let jsonStmtIndex = -1;
    let dataName = "";
    let dataCast = "";
    let throwText = "throw err;";
    let isReturnJson = false;

    for (let i = index + 1; i < stmts.length && i < index + 3; i++) {
      const s = stmts[i];
      const sText = s.getText();
      if (sText.includes(`${resName}.ok`)) {
        okStmtIndex = i;
        const throwMatch = sText.match(/throw\s+[^;]+;/);
        if (throwMatch) {
          throwText = throwMatch[0].replace(new RegExp(`\\$\\{${resName}\\.text\\(\\)\\}`, 'g'), '${err.message || err}');
        }
      } else if (sText.includes(`${resName}.json()`)) {
        jsonStmtIndex = i;
        if (s.isKind(SyntaxKind.VariableStatement)) {
            const jDecl = s.getDescendantsOfKind(SyntaxKind.VariableDeclaration)[0];
            if (jDecl) {
                dataName = jDecl.getName();
                const typeNode = jDecl.getTypeNode();
                if (typeNode) dataCast = `: ${typeNode.getText()}`;
                else {
                    const init = jDecl.getInitializer();
                    if (init && init.isKind(SyntaxKind.AsExpression)) {
                        dataCast = ` as ${init.getTypeNode().getText()}`;
                    }
                }
            }
        } else if (s.isKind(SyntaxKind.ReturnStatement)) {
            isReturnJson = true;
        }
      }
    }

    if (jsonStmtIndex !== -1 && okStmtIndex !== -1) {
      // We have both
      let replacement = ``;
      if (isReturnJson) {
          replacement = `try {\n  return await ${apiCallStr};\n} catch (err: any) {\n  ${throwText}\n}`;
      } else {
          replacement = `let ${dataName};\ntry {\n  ${dataName} = (await ${apiCallStr})${dataCast};\n} catch (err: any) {\n  ${throwText}\n}`;
      }
      
      stmts[index].replaceWithText(replacement);
      // Remove the next two statements
      stmts[okStmtIndex].remove();
      stmts[jsonStmtIndex].remove();
      changed = true;
    } else if (okStmtIndex !== -1) {
        // Only `.ok` check, no json (e.g. DELETE or POST without response body reading)
        const replacement = `try {\n  await ${apiCallStr};\n} catch (err: any) {\n  ${throwText}\n}`;
        stmts[index].replaceWithText(replacement);
        stmts[okStmtIndex].remove();
        changed = true;
    } else {
        // Neither, just replace fetch with apiCallStr
        callExpr.replaceWithText(apiCallStr);
        changed = true;
    }
  }

  if (changed) {
    file.saveSync();
    console.log(`Updated ${file.getFilePath()}`);
  }
}

for (const file of project.getSourceFiles()) {
  processFile(file);
}
