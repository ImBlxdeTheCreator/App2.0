import {
  access,
  mkdir,
  readdir,
  readFile,
  stat,
  writeFile
} from "node:fs/promises";

import { execFile } from "node:child_process";
import { join } from "node:path";
import { promisify } from "node:util";

import { COMPENDIUM, MANIFEST } from "./config.mjs";

const execFileAsync = promisify(execFile);

const OUTPUT_DIRECTORY = "generated";
const OUTPUT_FILE = join(
  OUTPUT_DIRECTORY,
  "d2synergy-database.json"
);

async function pathExists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function findManifestDatabase() {
  const files = await readdir(MANIFEST.outputDirectory);

  const databaseFiles = files.filter((filename) =>
    filename.endsWith(".db") ||
    filename.endsWith(".sqlite") ||
    filename.startsWith("world_sql_content")
  );

  if (databaseFiles.length === 0) {
    throw new Error(
      `No Bungie Manifest database found in ${MANIFEST.outputDirectory}`
    );
  }

  if (databaseFiles.length > 1) {
    console.log(
      `Found ${databaseFiles.length} Manifest databases. Using the newest file.`
    );
  }

  const candidates = await Promise.all(
    databaseFiles.map(async (filename) => {
      const fullPath = join(
        MANIFEST.outputDirectory,
        filename
      );

      const fileStats = await stat(fullPath);

      return {
        filename,
        fullPath,
        modifiedAt: fileStats.mtimeMs,
        bytes: fileStats.size
      };
    })
  );

  candidates.sort(
    (left, right) =>
      right.modifiedAt - left.modifiedAt
  );

  return candidates[0];
}

async function runSqlite(databasePath, sql) {
  const { stdout } = await execFileAsync(
    "sqlite3",
    [
      "-readonly",
      "-json",
      databasePath,
      sql
    ],
    {
      maxBuffer: 1024 * 1024 * 100
    }
  );

  const output = stdout.trim();

  if (!output) {
    return [];
  }

  return JSON.parse(output);
}

async function readManifestTables(databasePath) {
  const tables = await runSqlite(
    databasePath,
    `
      SELECT name
      FROM sqlite_master
      WHERE type = 'table'
      ORDER BY name;
    `
  );

  const results = [];

  for (const table of tables) {
    const tableName = table.name;

    if (!/^Destiny[A-Za-z0-9_]+Definition$/.test(tableName)) {
      continue;
    }

    const countResult = await runSqlite(
      databasePath,
      `SELECT COUNT(*) AS count FROM "${tableName}";`
    );

    results.push({
      name: tableName,
      records: Number(countResult[0]?.count ?? 0)
    });

    console.log(
      `Manifest: ${tableName} (${results.at(-1).records.toLocaleString()} records)`
    );
  }

  return results;
}

async function readCompendiumFiles() {
  if (!(await pathExists(COMPENDIUM.outputDirectory))) {
    throw new Error(
      `Compendium directory not found: ${COMPENDIUM.outputDirectory}`
    );
  }

  const filenames = await readdir(
    COMPENDIUM.outputDirectory
  );

  const csvFiles = filenames
    .filter((filename) =>
      filename.toLowerCase().endsWith(".csv")
    )
    .sort();

  const results = [];

  for (const filename of csvFiles) {
    const fullPath = join(
      COMPENDIUM.outputDirectory,
      filename
    );

    const contents = await readFile(fullPath, "utf8");
    const fileStats = await stat(fullPath);

    const rows = contents
      .split(/\r?\n/)
      .filter((line) => line.trim().length > 0)
      .length;

    results.push({
      filename,
      bytes: fileStats.size,
      nonEmptyRows: rows
    });

    console.log(
      `Compendium: ${filename} (${rows.toLocaleString()} rows)`
    );
  }

  return results;
}

async function readJsonIfPresent(path) {
  if (!(await pathExists(path))) {
    return null;
  }

  const contents = await readFile(path, "utf8");

  return JSON.parse(contents);
}

async function main() {
  console.log("");
  console.log("======================================");
  console.log(" D2SYNERGY DATABASE BUILDER");
  console.log("======================================");
  console.log("");

  await mkdir(OUTPUT_DIRECTORY, {
    recursive: true
  });

  const manifestDatabase =
    await findManifestDatabase();

  console.log(
    `Using Manifest: ${manifestDatabase.filename}`
  );

  const manifestMetadata =
    await readJsonIfPresent(
      join(MANIFEST.outputDirectory, "index.json")
    );

  const compendiumMetadata =
    await readJsonIfPresent(
      join(COMPENDIUM.outputDirectory, "index.json")
    );

  const manifestTables =
    await readManifestTables(
      manifestDatabase.fullPath
    );

  const compendiumFiles =
    await readCompendiumFiles();

  const database = {
    schemaVersion: 1,

    generatedAt: new Date().toISOString(),

    status: "source-inventory",

    description:
      "Initial D2Synergy database build containing verified source inventories. Definition extraction and Compendium mechanic normalization follow in the next stage.",

    sources: {
      bungieManifest: {
        version:
          manifestMetadata?.manifestVersion ?? null,

        language:
          manifestMetadata?.language ??
          MANIFEST.language,

        filename: manifestDatabase.filename,

        bytes: manifestDatabase.bytes,

        definitionTableCount:
          manifestTables.length,

        definitionRecordCount:
          manifestTables.reduce(
            (total, table) =>
              total + table.records,
            0
          ),

        tables: manifestTables
      },

      destinyDataCompendium: {
        sheetId: COMPENDIUM.sheetId,

        downloadedAt:
          compendiumMetadata?.downloadedAt ??
          compendiumMetadata?.downloaded_at ??
          null,

        fileCount: compendiumFiles.length,

        files: compendiumFiles
      }
    }
  };

  await writeFile(
    OUTPUT_FILE,
    `${JSON.stringify(database, null, 2)}\n`,
    "utf8"
  );

  console.log("");
  console.log("======================================");
  console.log(" DATABASE BUILD COMPLETE");
  console.log("======================================");
  console.log(`Saved: ${OUTPUT_FILE}`);
  console.log(
    `Manifest tables: ${manifestTables.length}`
  );
  console.log(
    `Compendium files: ${compendiumFiles.length}`
  );
}

main().catch((error) => {
  console.error("");
  console.error("Database build failed.");
  console.error(error);

  process.exit(1);
});
