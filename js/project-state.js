// Project state: schema version, strict encode/decode/validation, and storage
// payload preparation. Pure module: no DOM access, no rendering, no silent
// fallback. Invalid payloads throw a coded error so the caller can show the
// failure; the active project is never reset by a bad decode.
(() => {
  'use strict';

  const SCHEMA_VERSION = 2;

  // Required top-level sections for any schema v2 payload. Sections that arrive
  // in later phases (generation, websiteTokens, validation) become required as
  // the running product produces them.
  const REQUIRED_SECTIONS = {
    context: 'object',
    roles: 'object',
    palettes: 'object',
    assignments: 'object',
  };

  class ProjectStateError extends Error {
    constructor(code, message) {
      super(message);
      this.name = 'ProjectStateError';
      this.code = code;
    }
  }

  function isPlainObject(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
  }

  function validate(payload) {
    if (!isPlainObject(payload)) {
      throw new ProjectStateError('NOT_AN_OBJECT', 'Project payload must be a plain object');
    }
    if (!Number.isInteger(payload.schemaVersion)) {
      throw new ProjectStateError('MISSING_SCHEMA_VERSION', 'Project payload has no schemaVersion');
    }
    if (payload.schemaVersion !== SCHEMA_VERSION) {
      throw new ProjectStateError(
        'UNSUPPORTED_SCHEMA',
        `Project schema v${payload.schemaVersion} is not supported; expected v${SCHEMA_VERSION}`
      );
    }
    for (const [section, expectedType] of Object.entries(REQUIRED_SECTIONS)) {
      const value = payload[section];
      if (value === undefined || value === null) {
        throw new ProjectStateError('MISSING_SECTION', `Project payload is missing section "${section}"`);
      }
      if (expectedType === 'object' && !isPlainObject(value)) {
        throw new ProjectStateError('INVALID_SECTION_TYPE', `Project section "${section}" must be an object`);
      }
    }
    return { ok: true, project: payload };
  }

  // Returns a detached payload with schemaVersion stamped. Never mutates input.
  function encode(project) {
    if (!isPlainObject(project)) {
      throw new ProjectStateError('NOT_AN_OBJECT', 'Cannot encode a non-object project');
    }
    const payload = JSON.parse(JSON.stringify(project));
    payload.schemaVersion = SCHEMA_VERSION;
    validate(payload);
    return payload;
  }

  // Strict decode: throws a coded ProjectStateError on malformed JSON, an
  // unknown schema, or a missing section. Never returns a partial fallback.
  function decode(json) {
    let payload;
    try {
      payload = JSON.parse(json);
    } catch (error) {
      throw new ProjectStateError('INVALID_JSON', `Project JSON is not valid: ${error.message}`);
    }
    return validate(payload).project;
  }

  // Storage payload preparation: the same version-stamped, validated shape the
  // app persists and later imports. Kept as a named step so Phase 6 storage
  // binding has one entry point and no second serialization path.
  function prepareForStorage(project) {
    return encode(project);
  }

  window.ProjectState = {
    SCHEMA_VERSION,
    ProjectStateError,
    validate,
    encode,
    decode,
    prepareForStorage,
  };
})();
