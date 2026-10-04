const path = require('path');
const ts = require('typescript');

describe('TypeScript project integrity', () => {
  it('has no syntactic or semantic diagnostics', () => {
    const projectRoot = path.resolve(__dirname, '..');
    const configPath = ts.findConfigFile(projectRoot, ts.sys.fileExists, 'tsconfig.json');

    expect(configPath).toBeDefined();

    const configFile = ts.readConfigFile(configPath, ts.sys.readFile);
    const config = ts.parseJsonConfigFileContent(
      configFile.config,
      ts.sys,
      path.dirname(configPath)
    );
    const program = ts.createProgram(config.fileNames, {
      ...config.options,
      incremental: false,
    });
    const diagnostics = ts.getPreEmitDiagnostics(program);

    const formatted = ts.formatDiagnosticsWithColorAndContext(diagnostics, {
      getCanonicalFileName: (fileName) => fileName,
      getCurrentDirectory: () => projectRoot,
      getNewLine: () => ts.sys.newLine,
    });

    expect(formatted).toBe('');
  }, 30_000);
});
