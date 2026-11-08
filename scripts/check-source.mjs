import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const ts = require(process.argv[2] || 'typescript');
const root = path.resolve(import.meta.dirname, '../src');
function files(directory) { return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => entry.isDirectory() ? files(path.join(directory, entry.name)) : [path.join(directory, entry.name)]); }
const sourceFiles = files(root).filter(file => /\.(ts|tsx|mts)$/.test(file) && !/\.d\.(ts|mts)$/.test(file));
let count = 0;
for (const file of sourceFiles) {
  const result = ts.transpileModule(fs.readFileSync(file, 'utf8'), { fileName: file, reportDiagnostics: true, compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX, isolatedModules: true } });
  const errors = (result.diagnostics ?? []).filter(d => d.category === ts.DiagnosticCategory.Error);
  if (errors.length) { console.error(ts.formatDiagnosticsWithColorAndContext(errors, { getCanonicalFileName: file => file, getCurrentDirectory: () => process.cwd(), getNewLine: () => '\n' })); process.exitCode = 1; }
  count++;
}
console.log(`Sintaxis y transpilación comprobadas en ${count} archivos TypeScript/TSX. La comprobación completa de tipos se ejecuta con npm run build.`);
