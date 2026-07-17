import { mkdir, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";

import { MANIFEST } from "./config.mjs";

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

async function downloadDatabase(url, destination) {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(
      `Failed to download Manifest database (${response.status} ${response.statusText})`
    );
  }

  const buffer = Buffer.from(await response.arrayBuffer());

  await writeFile(destination, buffer);

  return buffer.length;
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

  const filename = basename(databasePath);

  const downloadUrl =
    `${MANIFEST.contentRoot}${databasePath}`;

  const outputFile =
    join(MANIFEST.outputDirectory, filename);

  console.log(`Manifest Version : ${manifest.version}`);
  console.log(`Downloading      : ${filename}`);

  const bytes =
    await downloadDatabase(downloadUrl, outputFile);

  const metadata = {
    schemaVersion: 1,
    downloadedAt: new Date().toISOString(),
    manifestVersion: manifest.version,
    language: MANIFEST.language,
    filename,
    bytes
  };

  await writeFile(
    join(MANIFEST.outputDirectory, "index.json"),
    JSON.stringify(metadata, null, 2)
  );

  console.log("");
  console.log("======================================");
  console.log(" DOWNLOAD COMPLETE");
  console.log("======================================");
  console.log(`Saved : ${outputFile}`);
  console.log(`Size  : ${bytes.toLocaleString()} bytes`);
}

main().catch((error) => {
  console.error("");
  console.error("Manifest download failed.");
  console.error(error);

  process.exit(1);
});
