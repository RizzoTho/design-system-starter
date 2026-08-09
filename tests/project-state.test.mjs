import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../js/project-state.js', import.meta.url), 'utf8');
const sandbox = { window: {} };
sandbox.window.window = sandbox.window;
vm.createContext(sandbox);
vm.runInContext(source, sandbox, { filename: 'project-state.js' });
const ProjectState = sandbox.window.ProjectState;

function validProject() {
  return {
    context: { background: '#F7F3EB', text: '#25231F' },
    roles: {},
    palettes: {},
    assignments: {},
    savedPairs: [],
  };
}

// encode stamps the schema version and returns a detached copy.
{
  const project = validProject();
  const payload = ProjectState.encode(project);
  assert.equal(payload.schemaVersion, 2);
  assert.notEqual(payload, project, 'encode returned the same object reference');
  project.context.background = '#000000';
  assert.equal(payload.context.background, '#F7F3EB', 'encode shares mutable state with its input');
}

// decode round trips an encoded payload.
{
  const payload = ProjectState.encode(validProject());
  const decoded = ProjectState.decode(JSON.stringify(payload));
  assert.deepEqual(decoded, payload);
}

// Malformed JSON fails visibly with a coded error.
{
  assert.throws(
    () => ProjectState.decode('{ not json'),
    error => error instanceof ProjectState.ProjectStateError && error.code === 'INVALID_JSON'
  );
}

// An unknown schema version fails visibly; nothing is returned or reset.
{
  const payload = ProjectState.encode(validProject());
  payload.schemaVersion = 99;
  assert.throws(
    () => ProjectState.decode(JSON.stringify(payload)),
    error => error instanceof ProjectState.ProjectStateError && error.code === 'UNSUPPORTED_SCHEMA'
  );
  assert.throws(
    () => ProjectState.validate(payload),
    error => error instanceof ProjectState.ProjectStateError && error.code === 'UNSUPPORTED_SCHEMA'
  );
}

// Missing schema version is its own coded error.
{
  const payload = validProject();
  assert.throws(
    () => ProjectState.validate(payload),
    error => error instanceof ProjectState.ProjectStateError && error.code === 'MISSING_SCHEMA_VERSION'
  );
}

// Non-object payloads fail visibly.
{
  for (const value of [null, 'text', 42, [1, 2, 3]]) {
    assert.throws(
      () => ProjectState.decode(JSON.stringify(value)),
      error => error instanceof ProjectState.ProjectStateError && error.code === 'NOT_AN_OBJECT'
    );
  }
  assert.throws(() => ProjectState.encode(null), error => error.code === 'NOT_AN_OBJECT');
}

// Missing or mistyped required sections fail visibly.
{
  const payload = ProjectState.encode(validProject());
  delete payload.context;
  assert.throws(
    () => ProjectState.decode(JSON.stringify(payload)),
    error => error instanceof ProjectState.ProjectStateError && error.code === 'MISSING_SECTION'
  );

  const mistyped = ProjectState.encode(validProject());
  mistyped.roles = [];
  assert.throws(
    () => ProjectState.validate(mistyped),
    error => error instanceof ProjectState.ProjectStateError && error.code === 'INVALID_SECTION_TYPE'
  );
}

// prepareForStorage is the same strict encode path with no second format.
{
  const stored = ProjectState.prepareForStorage(validProject());
  assert.equal(stored.schemaVersion, ProjectState.SCHEMA_VERSION);
  assert.deepEqual(stored, ProjectState.encode(validProject()));
}

console.log('project-state: schema version, strict decode, and coded failures passed');
