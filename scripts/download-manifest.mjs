import {
  mkdir,
  open,
  readdir,
  stat,
  unlink,
  writeFile
} from "node:fs/promises";

import { execFile } from "node:child_process";
import { basename, join } from "node:path";
import { promisify } from "node:util";

import { MANIFEST } from "./config.mjs";

const execFileAsync = promisify(execFile);
const API_KEY = process.env.BUNGIE_API_KEY;

if (!API_KEY) {
  throw new Error(
    "Missing BUNGIE_API_KEY. Add it to your GitHub repository Secrets."
  );
}

async function fetchManifestMetadata() {
  const response = await fetch(MANIFEST.metadataUrl, {
    headers: {
      "X-API-Key": API_KEY,
      "User-Agent": "D2Synergy Database Builder/1.0"
    }
  });

  if (!response.ok) {
    throw new Error(
      `Failed to request Manifest metadata (${response.status} ${response.statusText})`
    );
  }

  return response.json();
}

async function downloadArchive(url, destination) {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(
      `Failed to download Manifest archive (${response.status} ${response.statusText})`
    );
  }

  const buffer = Buffer.from(await response.arrayBuffer());

  await writeFile(destination, buffer);

  return buffer.length;
}

async function isSqliteDatabase(filePath) {
  const fileHandle = await open(filePath, "r");

  try {
    const header = Buffer.alloc(16);

    await fileHandle.read(header, 0, 16, 0);

    return header.toString("utf8") === "SQLite format 3\u0000";
  } finally {
    await fileHandle.close();
  }
}

async function findExtractedDatabase(directory) {
  const filenames = await readdir(directory);

  for (const filename of filenames) {
    if (filename === "index.json" || filename.endsWith(".zip")) {
      continue;
    }

    const fullPath = join(directory, filename);
    const fileStats = await stat(fullPath);

    if (!fileStats.isFile()) {
      continue;
    }

    if (await isSqliteDatabase(fullPath)) {
      return {
        filename,
        fullPath,
        bytes: fileStats.size
      };
    }
  }

  throw new Error(
    "The Manifest archive was extracted, but no SQLite database was found."
  );
}

async function main() {
  console.log("");
  console.log("======================================");
  console.log(" D2SYNERGY MANIFEST DOWNLOADER");
  console.log("======================================");

  await mkdir(MANIFEST.outputDirectory, {
    recursive: true
  });

  console.log("Requesting latest Bungie Manifest...");

  const payload = await fetchManifestMetadata();
  const manifest = payload.Response;

  if (!manifest) {
    throw new Error("Bungie returned an empty Manifest response.");
  }

  const databasePath =
    manifest.mobileWorldContentPaths?.[MANIFEST.language];

  if (!databasePath) {
    throw new Error(
      `No "${MANIFEST.language}" Manifest database was found.`
    );
  }

  const sourceFilename = basename(databasePath);
  const downloadUrl = `${MANIFEST.contentRoot}${databasePath}`;

  const archiveFile = join(
    MANIFEST.outputDirectory,
    `${sourceFilename}.zip`
  );

  console.log(`Manifest Version : ${manifest.version}`);
  console.log(`Downloading      : ${sourceFilename}`);

  const archiveBytes = await downloadArchive(
    downloadUrl,
    archiveFile
  );

  console.log("Extracting SQLite Manifest database...");

  await execFileAsync(
    "unzip",
    [
      "-o",
      archiveFile,
      "-d",
      MANIFEST.outputDirectory
    ],
    {
      maxBuffer: 1024 * 1024 * 20
    }
  );

  const database = await findExtractedDatabase(
    MANIFEST.outputDirectory
  );

  await unlink(archiveFile);

  const metadata = {
    schemaVersion: 1,
    downloadedAt: new Date().toISOString(),
    manifestVersion: manifest.version,
    language: MANIFEST.language,
    sourceFilename,
    databaseFilename: database.filename,
    archiveBytes,
    databaseBytes: database.bytes
  };

  await writeFile(
    join(MANIFEST.outputDirectory, "index.json"),
    `${JSON.stringify(metadata, null, 2)}\n`,
    "utf8"
  );

  console.log("");
  console.log("======================================");
  console.log(" DOWNLOAD COMPLETE");
  console.log("======================================");
  console.log(`Database : ${database.fullPath}`);
  console.log(
    `Size     : ${database.bytes.toLocaleString()} bytes`
  );
}

main().catch((error) => {
  console.error("");
  console.error("Manifest download failed.");
  console.error(error);

  process.exit(1);
});
