const pw = require(process.env.PLAYWRIGHT_MODULE || (process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES ? process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES + '/playwright' : 'playwright'));
const localBrowser = require('node:path').resolve(__dirname,'../../browser-preview/chromium');
const executablePath = process.env.CHROMIUM_PATH || (require('node:fs').existsSync(localBrowser) ? localBrowser : undefined);
module.exports = {...pw, chromium: {...pw.chromium, launch: opts => pw.chromium.launch({...opts,
  executablePath,
  args: ['--no-sandbox','--no-zygote','--disable-gpu','--disable-software-rasterizer']
})}};
