const assert = require('node:assert/strict');
const test = require('node:test');
const { execFile } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const { runCacheTask } = require('../scripts/blog-contents-cache.cjs');
const {
  childFailure,
  workerFailure,
} = require('../scripts/cache-diagnostics.cjs');

test('diagnostics classify failures without disclosing child output or error payloads', () => {
  const privateText =
    'Bearer secret-value private Notion paragraph https://private.example';
  const cases = [
    [
      'Unable to authenticate. Please connect your workspace to Nx Cloud',
      'nx:cloud-authentication',
    ],
    ['Cannot find configuration for task blog:missing', 'nx:target-resolution'],
    ['command not found', 'process:shell-invocation'],
    ['CACHE_WORKER notion:unauthorized', 'worker:notion:unauthorized'],
    ['CACHE_WORKER filesystem:ENOENT', 'worker:filesystem:ENOENT'],
    [privateText, 'unknown-child-failure'],
  ];
  for (const [output, reason] of cases) {
    for (const stream of ['stdout', 'stderr']) {
      const streams = { [stream]: `${output}\n${privateText}` };
      assert.equal(
        childFailure(
          { code: 1, message: privateText },
          streams.stdout,
          streams.stderr
        ),
        `Cache child failed: ${reason}; exit=1`
      );
    }
  }
  assert.match(childFailure({ code: 'ENOENT' }), /process:ENOENT/);
  assert.match(childFailure({ killed: true }), /process:timeout-or-signal/);
  assert.equal(
    workerFailure({ code: 'unauthorized', body: privateText }),
    'CACHE_WORKER notion:unauthorized'
  );
  assert.equal(workerFailure({ code: privateText }), 'CACHE_WORKER unknown');
});

test('child invocation uses Node and argument boundaries with a sanitized rejection', async () => {
  await assert.rejects(
    runCacheTask(
      { id: 'page-id', last_edited_time: 'timestamp' },
      (command, args, options, callback) => {
        assert.equal(command, process.execPath);
        assert.deepEqual(args.slice(1), [
          'run',
          'astro-notion-blog:_fetch-notion-blocks',
          'page-id',
          'timestamp',
        ]);
        assert.equal(options.env.NX_BRANCH, 'main');
        assert.equal(options.timeout, 60000);
        callback(
          new Error('secret raw error'),
          '',
          'CACHE_WORKER notion:unauthorized secret'
        );
      }
    ),
    { message: 'Cache child failed: worker:notion:unauthorized; exit=unknown' }
  );
});

test(
  'real Nx child reaches the existing worker without Nx Cloud credentials',
  { timeout: 90000 },
  async () => {
    const id = '00000000-0000-0000-0000-000000000000';
    const output = path.resolve('tmp', `${id}.json`);
    const fixture = path
      .resolve(__dirname, 'fixtures/notion-client.cjs')
      .replaceAll('\\', '/');
    try {
      await runCacheTask(
        { id, last_edited_time: new Date().toISOString() },
        (command, args, options, callback) => {
          const env = {
            ...options.env,
            NODE_OPTIONS: `--require="${fixture}"`,
            NX_DAEMON: 'false',
          };
          delete env.NX_CLOUD_ACCESS_TOKEN;
          delete env.NX_CLOUD_AUTH_TOKEN;
          delete env.NX_NO_CLOUD;
          delete env.NOTION_API_SECRET;
          execFile(command, args, { ...options, env }, callback);
        }
      );
      assert.deepEqual(JSON.parse(fs.readFileSync(output, 'utf8')), []);
    } finally {
      fs.rmSync(output, { force: true });
    }
  }
);
