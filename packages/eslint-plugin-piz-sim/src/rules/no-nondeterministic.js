// Enforces the determinism-harness §7 / ADR-0003 §4.1 banned-API list inside
// packages/sim/**. Flag-only rule — fixes are author judgment (PIZ-36 scope).

const TRANSCENDENTALS = new Set(["sin", "cos", "tan", "exp", "log", "pow", "sqrt"]);

const NODE_IO_PREFIXES = ["node:fs", "node:net", "fs", "net"];

function isMember(node, objectName, propertyName) {
  return (
    node?.type === "MemberExpression" &&
    !node.computed &&
    node.object?.type === "Identifier" &&
    node.object.name === objectName &&
    node.property?.type === "Identifier" &&
    (propertyName === undefined || node.property.name === propertyName)
  );
}

function isImportMetaEnv(node) {
  return (
    node?.type === "MemberExpression" &&
    !node.computed &&
    node.object?.type === "MetaProperty" &&
    node.object.meta?.name === "import" &&
    node.object.property?.name === "meta" &&
    node.property?.type === "Identifier" &&
    node.property.name === "env"
  );
}

function isInTypePosition(node) {
  // Walk up. Bail on TS type nodes — those are erased at runtime, no
  // determinism risk. Identifiers like `Date` in `let x: Date = ...` are fine.
  let cur = node.parent;
  while (cur) {
    if (typeof cur.type === "string" && cur.type.startsWith("TS")) {
      return true;
    }
    cur = cur.parent;
  }
  return false;
}

function isMapOrSetCtor(node) {
  return (
    node?.type === "NewExpression" &&
    node.callee?.type === "Identifier" &&
    (node.callee.name === "Map" || node.callee.name === "Set")
  );
}

function isMapOrSetIteratorCall(node) {
  // .values() / .keys() / .entries() — heuristic: any such method call is
  // suspect; the author can opt in by sorting first.
  return (
    node?.type === "CallExpression" &&
    node.callee?.type === "MemberExpression" &&
    !node.callee.computed &&
    node.callee.property?.type === "Identifier" &&
    (node.callee.property.name === "values" ||
      node.callee.property.name === "keys" ||
      node.callee.property.name === "entries")
  );
}

function isLiteralNumber(node) {
  return node?.type === "Literal" && typeof node.value === "number";
}

function isIntegerLiteral(node) {
  return isLiteralNumber(node) && Number.isInteger(node.value);
}

export default {
  meta: {
    type: "problem",
    docs: {
      description: "Forbid non-deterministic APIs inside @piz/sim (determinism-harness §7).",
      recommended: true,
    },
    schema: [],
    messages: {
      bannedClock:
        "`{{name}}` is banned in @piz/sim — use the injected `clock` shim (determinism-harness §7).",
      bannedRng:
        "`{{name}}` is banned in @piz/sim — use the injected `rng` shim (determinism-harness §7).",
      bannedTrans:
        "`{{name}}` is banned in @piz/sim — use a build-time LUT (e.g. `expClampedQ12`) per determinism-harness §6.5/§7.",
      bannedLocale:
        "`{{name}}` is locale-sensitive and banned in @piz/sim — sort/format by code point (determinism-harness §7).",
      bannedIo:
        "`{{name}}` is banned in @piz/sim — no network, env, or filesystem reads (determinism-harness §7).",
      bannedMapSetIter:
        "Iterating a Map/Set without an explicit sort is non-deterministic — wrap in `[...m].sort(...)` or `Array.from(m).sort(...)` first (determinism-harness §7).",
      warnPow:
        "Avoid `**` operator in @piz/sim — prefer integer multiply or a LUT (determinism-harness §7, early-warning).",
      warnDiv:
        "Division by non-integer literal in @piz/sim — confirm fixed-point intent or precompute (determinism-harness §7, early-warning).",
    },
  },

  create(context) {
    function flagBannedClock(node, name) {
      if (isInTypePosition(node)) return;
      context.report({ node, messageId: "bannedClock", data: { name } });
    }

    function flagBannedRng(node, name) {
      if (isInTypePosition(node)) return;
      context.report({ node, messageId: "bannedRng", data: { name } });
    }

    function flagBannedTrans(node, name) {
      if (isInTypePosition(node)) return;
      context.report({ node, messageId: "bannedTrans", data: { name } });
    }

    function flagBannedLocale(node, name) {
      if (isInTypePosition(node)) return;
      context.report({ node, messageId: "bannedLocale", data: { name } });
    }

    function flagBannedIo(node, name) {
      if (isInTypePosition(node)) return;
      context.report({ node, messageId: "bannedIo", data: { name } });
    }

    return {
      // ── Date constructor / direct call ─────────────────────────────
      NewExpression(node) {
        if (node.callee?.type === "Identifier" && node.callee.name === "Date") {
          flagBannedClock(node, "new Date()");
        }
      },

      // ── CallExpression covers Date(), fetch(), .localeCompare(), .toLocaleString() ─
      CallExpression(node) {
        const callee = node.callee;

        // bare Date(...)
        if (callee?.type === "Identifier" && callee.name === "Date") {
          flagBannedClock(node, "Date()");
          return;
        }

        // bare fetch(...)
        if (callee?.type === "Identifier" && callee.name === "fetch") {
          flagBannedIo(node, "fetch");
          return;
        }

        // .localeCompare(...) / .toLocaleString(...) — any object
        if (
          callee?.type === "MemberExpression" &&
          !callee.computed &&
          callee.property?.type === "Identifier"
        ) {
          const propName = callee.property.name;
          if (propName === "localeCompare") {
            flagBannedLocale(node, ".localeCompare()");
            return;
          }
          if (propName === "toLocaleString") {
            flagBannedLocale(node, ".toLocaleString()");
            return;
          }
        }
      },

      // ── MemberExpression covers Date.now, Math.*, crypto.*, Intl.*, process.env, Deno.env, import.meta.env ─
      MemberExpression(node) {
        // Date.now / Date.parse / Date.UTC — clock-side
        if (isMember(node, "Date", "now")) {
          return flagBannedClock(node, "Date.now");
        }

        // performance.now
        if (isMember(node, "performance", "now")) {
          return flagBannedClock(node, "performance.now");
        }

        // Math.random
        if (isMember(node, "Math", "random")) {
          return flagBannedRng(node, "Math.random");
        }

        // Math.<transcendental>
        if (
          node.object?.type === "Identifier" &&
          node.object.name === "Math" &&
          !node.computed &&
          node.property?.type === "Identifier" &&
          TRANSCENDENTALS.has(node.property.name)
        ) {
          return flagBannedTrans(node, `Math.${node.property.name}`);
        }

        // crypto.randomUUID / crypto.getRandomValues
        if (
          node.object?.type === "Identifier" &&
          node.object.name === "crypto" &&
          !node.computed &&
          node.property?.type === "Identifier" &&
          (node.property.name === "randomUUID" || node.property.name === "getRandomValues")
        ) {
          return flagBannedRng(node, `crypto.${node.property.name}`);
        }

        // Intl.* (anything)
        if (
          node.object?.type === "Identifier" &&
          node.object.name === "Intl" &&
          !node.computed &&
          node.property?.type === "Identifier"
        ) {
          return flagBannedLocale(node, `Intl.${node.property.name}`);
        }

        // process.env (only the .env access; allow `process` for non-env)
        if (isMember(node, "process", "env")) {
          return flagBannedIo(node, "process.env");
        }

        // Deno.env
        if (isMember(node, "Deno", "env")) {
          return flagBannedIo(node, "Deno.env");
        }

        // import.meta.env
        if (isImportMetaEnv(node)) {
          return flagBannedIo(node, "import.meta.env");
        }
      },

      // ── ImportDeclaration covers node:fs / node:net etc. ─────────
      ImportDeclaration(node) {
        const src = node.source?.value;
        if (typeof src !== "string") return;
        for (const prefix of NODE_IO_PREFIXES) {
          if (src === prefix || src.startsWith(`${prefix}/`)) {
            flagBannedIo(node, src);
            return;
          }
        }
      },

      // ── Floating-point: `**` (warn) and `/` with non-integer literal RHS (warn) ─
      BinaryExpression(node) {
        if (node.operator === "**") {
          context.report({ node, messageId: "warnPow" });
          return;
        }
        if (node.operator === "/") {
          // Warn only when RHS is a literal number that's not an integer.
          if (isLiteralNumber(node.right) && !isIntegerLiteral(node.right)) {
            context.report({ node, messageId: "warnDiv" });
          }
        }
      },

      // ── Map/Set iteration heuristic ──────────────────────────────
      // Wrapped iterations like `for (const x of [...m].sort(...))` or
      // `Array.from(m).sort(...)` are implicitly allowed — `right` is then a
      // CallExpression on `.sort(...)`, not on the bare Map/Set, so it never
      // matches the patterns below.
      ForOfStatement(node) {
        const it = node.right;
        if (
          isMapOrSetCtor(it) ||
          isMapOrSetIteratorCall(it) ||
          (it?.type === "SequenceExpression" &&
            isMapOrSetCtor(it.expressions[it.expressions.length - 1]))
        ) {
          context.report({ node, messageId: "bannedMapSetIter" });
        }
      },
    };
  },
};
