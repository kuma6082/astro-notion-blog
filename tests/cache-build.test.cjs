const assert = require('node:assert/strict');
const test = require('node:test');

const { fetchPageContents } = require('../scripts/blog-contents-cache.cjs');
const {
  retrieveAndWriteBlockChildren,
} = require('../scripts/retrieve-block-children.cjs');

test('normal build runs cache prefetch before Astro', async () => {
  const packageJson = require('../package.json');

  assert.equal(packageJson.scripts.build, 'npm run cache:fetch && astro build');
});

test('cache worker failures are propagated', async () => {
  const progressBar = {
    increment() {},
    stop() {},
  };
  const failure = new Error('cache worker failed');
  const execCommand = (command, args, options, callback) => {
    callback(failure);
  };

  await assert.rejects(
    fetchPageContents(
      [{ id: 'page-id', last_edited_time: '2026-09-25T00:00:00.000Z' }],
      1,
      progressBar,
      execCommand
    ),
    /Cache child failed/
  );
});

test('recursive child retrieval completes before the parent resolves', async () => {
  const writes = new Map();
  const calls = [];
  const notionClient = {
    blocks: {
      children: {
        list: async ({ block_id: blockId }) => {
          calls.push(blockId);
          if (blockId === 'root') {
            return {
              results: [{ id: 'child', type: 'paragraph', has_children: true }],
              has_more: false,
            };
          }

          return { results: [], has_more: false };
        },
      },
    },
  };
  const fileSystem = {
    writeFileSync(path, contents) {
      writes.set(path, contents);
    },
  };

  await retrieveAndWriteBlockChildren('root', {
    notionClient,
    fileSystem,
    wait: async () => {},
  });

  assert.deepEqual(calls, ['root', 'child']);
  assert.ok(writes.has('tmp/root.json'));
  assert.ok(writes.has('tmp/child.json'));
});

test('single-worker prefetch waits for each child before starting the next', async () => {
  const events = [];
  await fetchPageContents(
    ['first', 'second'].map((id) => ({ id, last_edited_time: 'timestamp' })),
    1,
    { increment() {}, stop() {} },
    (command, args, options, callback) => {
      const id = args[3];
      events.push(`start:${id}`);
      setImmediate(() => {
        events.push(`end:${id}`);
        callback(null, '', '');
      });
    }
  );
  assert.deepEqual(events, [
    'start:first',
    'end:first',
    'start:second',
    'end:second',
  ]);
});
