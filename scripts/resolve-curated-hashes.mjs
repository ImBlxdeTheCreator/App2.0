#!/usr/bin/env node

/**
 * One-time D2Synergy curated hash resolver.
 *
 * GitHub Actions supplies BUNGIE_API_KEY through repository secrets.
 *
 * Local usage example:
 *   BUNGIE_API_KEY=your_api_key_here \
 *   node scripts/resolve-curated-hashes.mjs js/data/exotics.js
 *
 * It resolves EXOTIC_ARMOR and EXOTIC_WEAPONS through Bungie's Armory search,
 * writes exact DestinyInventoryItemDefinition hashes into the source file,
 * and emits a JSON report beside the file.
 *
 * Ambiguous, redacted, or missing results are never guessed.
 */

import fs from 'node:fs/promises';
import vm from 'node:vm';
import path from 'node:path';

const file = path.resolve(
  process.argv[2] || 'js/data/exotics.js'
);

const apiKey = process.env.BUNGIE_API_KEY;

if (!apiKey) {
  throw new Error(
    'BUNGIE_API_KEY was not supplied to the resolver.'
  );
}

const base = 'https://www.bungie.net/Platform';

const classType = {
  Titan: 0,
  Hunter: 1,
  Warlock: 2
};

const sleep = (milliseconds) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

const norm = (value) =>
  String(value || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[’'`]/g, '')
    .replace(/[–—]/g, '-')
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .trim()
    .toLowerCase();

async function bungie(pathname) {
  let lastError;

  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const url = base + pathname;

      const response = await fetch(url, {
        headers: {
          'X-API-Key': apiKey,
          Accept: 'application/json'
        }
      });

      const rawBody = await response.text();

      let body;

      try {
        body = JSON.parse(rawBody);
      } catch {
        throw new Error(
          `HTTP ${response.status} returned non-JSON: ` +
          rawBody.slice(0, 300)
        );
      }

      if (
        response.ok &&
        body?.ErrorCode === 1
      ) {
        return body.Response;
      }

      throw new Error(
        `HTTP ${response.status}; ` +
        `ErrorCode=${body?.ErrorCode ?? 'unknown'}; ` +
        `ErrorStatus=${body?.ErrorStatus ?? 'unknown'}; ` +
        `Message=${body?.Message ?? 'No Bungie message'}`
      );
    } catch (error) {
      lastError = error;

      const message = error instanceof Error
        ? error.message
        : String(error);

      console.error(
        `\nAttempt ${attempt + 1}/4 failed: ${message}`
      );
    }

    if (attempt < 3) {
      await sleep(600 * (2 ** attempt));
    }
  }

  throw lastError ??
    new Error('Unknown Bungie API failure');
}

async function searchOne(target) {
  const response = await bungie(
    `/Destiny2/Armory/Search/` +
    `DestinyInventoryItemDefinition/` +
    `${encodeURIComponent(target.name)}/`
  );

  const rows = response?.results?.results || [];

  const exact = rows.filter((row) =>
    norm(row.displayProperties?.name) === norm(target.name) &&
    !row.redacted
  );

  const typed = exact.filter((row) =>
    Number(row.itemType) === target.itemType
  );

  const classMatched = target.className
    ? typed.filter((row) =>
        Number(row.classType) === classType[target.className]
      )
    : typed;

  const pool = classMatched.length
    ? classMatched
    : typed;

  if (pool.length === 1) {
    return {
      status: 'resolved',
      hash: String(pool[0].hash),
      candidate: pool[0]
    };
  }

  if (pool.length > 1) {
    return {
      status: 'ambiguous',
      candidates: pool.map((item) => ({
        hash: String(item.hash),
        name: item.displayProperties?.name,
        itemType: item.itemType,
        classType: item.classType,
        icon: item.displayProperties?.icon || null
      }))
    };
  }

  return {
    status: 'missing',
    candidates: exact.map((item) => ({
      hash: String(item.hash),
      name: item.displayProperties?.name,
      itemType: item.itemType,
      classType: item.classType,
      redacted: Boolean(item.redacted)
    }))
  };
}

function escapeRegExp(value) {
  return value.replace(
    /[.*+?^${}()|[\]\\]/g,
    '\\$&'
  );
}

function insertHashInRange(
  source,
  startMarker,
  endMarker,
  name,
  hash
) {
  const start = source.indexOf(startMarker);

  if (start < 0) {
    throw new Error(
      `Missing marker ${startMarker}`
    );
  }

  const end = endMarker
    ? source.indexOf(endMarker, start)
    : source.length;

  if (end < 0) {
    throw new Error(
      `Missing marker ${endMarker}`
    );
  }

  const segment = source.slice(start, end);

  const expression = new RegExp(
    `\\{name:(['"])${escapeRegExp(name)}\\1,` +
    `(?!\\s*hash:)`
  );

  if (!expression.test(segment)) {
    return {
      source,
      changed: false
    };
  }

  const changedSegment = segment.replace(
    expression,
    `{name:$1${name}$1, hash:${hash},`
  );

  return {
    source:
      source.slice(0, start) +
      changedSegment +
      source.slice(end),
    changed: true
  };
}

let source = await fs.readFile(
  file,
  'utf8'
);

const context = {};

vm.createContext(context);

vm.runInContext(
  source +
    '\n;globalThis.__D2_HASH_TARGETS=' +
    '{EXOTIC_ARMOR,EXOTIC_WEAPONS};',
  context,
  {
    filename: file
  }
);

const {
  EXOTIC_ARMOR,
  EXOTIC_WEAPONS
} = context.__D2_HASH_TARGETS;

if (
  !EXOTIC_ARMOR ||
  !EXOTIC_WEAPONS
) {
  throw new Error(
    'EXOTIC_ARMOR or EXOTIC_WEAPONS could not be read from the source file.'
  );
}

const targets = [];

for (
  const [className, items]
  of Object.entries(EXOTIC_ARMOR)
) {
  for (const item of items) {
    if (!item.hash) {
      targets.push({
        section: 'armor',
        className,
        name: item.name,
        itemType: 2
      });
    }
  }
}

for (const item of EXOTIC_WEAPONS) {
  if (!item.hash) {
    targets.push({
      section: 'weapon',
      className: null,
      name: item.name,
      itemType: 3
    });
  }
}

const report = {
  file,
  startedAt: new Date().toISOString(),
  total: targets.length,
  resolved: [],
  ambiguous: [],
  missing: [],
  errors: []
};

for (
  let index = 0;
  index < targets.length;
  index++
) {
  const target = targets[index];

  process.stdout.write(
    `[${index + 1}/${targets.length}] ` +
    `${target.name} ... `
  );

  try {
    const result = await searchOne(target);

    if (result.status === 'resolved') {
      const marker =
        target.section === 'armor'
          ? 'const EXOTIC_ARMOR ='
          : 'const EXOTIC_WEAPONS =';

      const endMarker =
        target.section === 'armor'
          ? 'const EXOTIC_CLASS_ITEM_PERKS ='
          : null;

      const patched = insertHashInRange(
        source,
        marker,
        endMarker,
        target.name,
        result.hash
      );

      if (patched.changed) {
        source = patched.source;

        report.resolved.push({
          ...target,
          hash: result.hash
        });

        console.log(result.hash);
      } else {
        report.errors.push({
          ...target,
          error: 'Source entry not uniquely patchable'
        });

        console.log(
          'source-match-failed'
        );
      }
    } else {
      report[result.status].push({
        ...target,
        candidates: result.candidates
      });

      console.log(result.status);
    }
  } catch (error) {
    const message = error instanceof Error
      ? error.message
      : String(error);

    report.errors.push({
      ...target,
      error: message
    });

    console.log(
      `error: ${message}`
    );
  }

  await sleep(55);
}

report.finishedAt =
  new Date().toISOString();

await fs.writeFile(
  file,
  source
);

const reportPath = file.replace(
  /\.js$/,
  '-hash-report.json'
);

await fs.writeFile(
  reportPath,
  JSON.stringify(report, null, 2) + '\n'
);

console.log(
  `\nResolved ${report.resolved.length}/${report.total}; ` +
  `ambiguous ${report.ambiguous.length}; ` +
  `missing ${report.missing.length}; ` +
  `errors ${report.errors.length}.`
);

console.log(
  `Report: ${reportPath}`
);
