// Emit only allowlisted facts, never arbitrary error messages or child output.
const notionCodes = new Set([
  'unauthorized',
  'restricted_resource',
  'object_not_found',
  'rate_limited',
  'validation_error',
  'invalid_json',
  'invalid_request',
  'invalid_request_url',
  'conflict_error',
  'internal_server_error',
  'service_unavailable',
  'notionhq_client_request_timeout',
  'notionhq_client_response_error',
]);

const workerFailure = (err) => {
  if (notionCodes.has(err?.code)) return `CACHE_WORKER notion:${err.code}`;
  if (['ENOENT', 'EACCES', 'ENOSPC'].includes(err?.code)) {
    return `CACHE_WORKER filesystem:${err.code}`;
  }
  return 'CACHE_WORKER unknown';
};

const childFailure = (err, stdout = '', stderr = '') => {
  const output = `${stdout}\n${stderr}`;
  let reason = 'unknown-child-failure';
  if (err.killed) reason = 'process:timeout-or-signal';
  else if (
    ['ENOENT', 'EACCES', 'ERR_CHILD_PROCESS_STDIO_MAXBUFFER'].includes(err.code)
  ) {
    reason = `process:${err.code}`;
  } else if (/Unable to authenticate.*Nx Cloud/i.test(output)) {
    reason = 'nx:cloud-authentication';
  } else if (
    /Cannot find (?:project|configuration for task)|Could not find.*target/i.test(
      output
    )
  ) {
    reason = 'nx:target-resolution';
  } else if (/not recognized|command not found|cannot execute/i.test(output)) {
    reason = 'process:shell-invocation';
  } else {
    const marker = output.match(
      /CACHE_WORKER (notion:[a-z_]+|filesystem:[A-Z]+|unknown)/
    );
    if (
      marker &&
      (marker[1] === 'unknown' ||
        notionCodes.has(marker[1].split(':')[1]) ||
        [
          'filesystem:ENOENT',
          'filesystem:EACCES',
          'filesystem:ENOSPC',
        ].includes(marker[1]))
    ) {
      reason = `worker:${marker[1]}`;
    } else if (/\bNX\b/.test(output)) reason = 'nx:task-runner-or-task';
  }
  return `Cache child failed: ${reason}; exit=${Number.isInteger(err.code) ? err.code : 'unknown'}`;
};

module.exports = { childFailure, workerFailure };
