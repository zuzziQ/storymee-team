const assert = require('node:assert/strict');
const test = require('node:test');

const packageJson = require('../package.json');
const packageLock = require('../package-lock.json');

test('StoryMee packages stay pinned to published versions', () => {
  const expected = {
    '@storymeedev/api-client': '1.0.0',
    '@storymeedev/fastify-common': '1.0.1',
    '@storymeedev/prisma-client': '1.2.0',
  };

  for (const [name, version] of Object.entries(expected)) {
    assert.equal(packageJson.dependencies[name], version);
    assert.equal(packageLock.packages[`node_modules/${name}`].version, version);
  }
});

test('shared runtime dependencies resolve from a standalone consumer', () => {
  const fastifyCommon = require('@storymeedev/fastify-common');

  assert.equal(typeof fastifyCommon.setupCors, 'function');
  assert.equal(typeof fastifyCommon.globalErrorHandler, 'function');
  assert.doesNotThrow(() => require.resolve('fastify-plugin'));
});
