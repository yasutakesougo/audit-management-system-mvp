#!/usr/bin/env node

(async () => {
  const [{ readFile }, { resolve, dirname }, { File }, { default: markdownLinkCheck }] =
    await Promise.all([
      import('node:fs/promises'),
      import('node:path'),
      import('node:buffer'),
      import('markdown-link-check')
    ]);

  if (typeof global.File === 'undefined') {
    global.File = File;
  }

  const processExit = (code = 0) => process.exit(code);

  try {
    const target = process.argv[2] ?? 'README.md';
    const cwd = process.cwd();
    const markdownPath = resolve(cwd, target);
    const configPath = resolve(cwd, '.mlc.json');

    const [markdown, rawConfigJson] = await Promise.all([
      readFile(markdownPath, 'utf8'),
      readFile(configPath, 'utf8')
    ]);

    const rawConfig = JSON.parse(rawConfigJson);

    const options = {
      projectBaseUrl: `file://${cwd}`,
      baseUrl: `file://${dirname(markdownPath)}/`,
      quiet: true,
      ignorePatterns: rawConfig.ignorePatterns,
      replacementPatterns: rawConfig.replacementPatterns,
      httpHeaders: rawConfig.httpHeaders,
      timeout: rawConfig.timeout,
      ignoreDisable: rawConfig.ignoreDisable,
      retryOn429: rawConfig.retryOn429,
      retryCount: rawConfig.retryCount,
      fallbackRetryDelay: rawConfig.fallbackRetryDelay,
      aliveStatusCodes: rawConfig.aliveStatusCodes
    };

    const results = await new Promise((resolveResults, rejectResults) => {
      markdownLinkCheck(markdown, options, (error, resolvedResults) => {
        if (error) {
          rejectResults(error);
          return;
        }

        resolveResults(resolvedResults);
      });
    });

    const failed = results.filter((result) => result.status === 'dead');

    if (failed.length > 0) {
      failed.forEach((result) => {
        console.error('%s [%s]', result.link, result.statusCode ?? result.status);
      });
      processExit(1);
      return;
    }

    processExit(0);
  } catch (error) {
    console.error(error?.message ?? error);
    processExit(1);
  }
})();
