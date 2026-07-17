import { mkdir, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";

import { MANIFEST } from "./config.mjs";

const API_KEY = process.env.BUNGIE_API_KEY;

if (!API_KEY) {
  throw new Error(
    "Missing BUNGIE_API_KEY. Add it to your GitHub repository secrets."
  );
}

async function fetchManifest() {
  const response = await fetch(MANIFEST.metadataUrl, {
    headers: {
      "X-API-Key": API_KEY,
      "User-Agent": "D2Synergy/1.0"
    }
  });

  if (!response.ok) {
    throw new Error(
      `Manifest request failed: ${response.status} ${response.statusText}`
    );
  }

  return response.json();
}

async function downloadFile(url, outputPath) {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(
      `Download failed: ${response.status} ${response.statusText}`
    );
  }

  const buffer = Buffer.from(await response.arrayBuffer());

  await writeFile(outputPath, buffer);

  return buffer.length;
}

async function main() {
  console.log("==================================");
  console.log("D2SYNERGY MANIFEST DOWNLOADER");
  console.log("==================================");

  await mkdir(MANIFEST.outputDirectory, {
    recursive: true
  });

  console.log("Requesting Bungie Manifest...");

  const manifestResponse = await fetchManifest();

  const manifest = manifestResponse.Response;

  if (!manifest) {
    throw new Error("Manifest response was empty.");
  }

  const manifestPath =
    manifest.mobileWorldContentPaths?.[MANIFEST.language];

  if (!manifestPath) {
    throw new Error(
      `No ${MANIFEST.language} Manifest database found.`
    );
  }

  const downloadUrl =
    `${MANIFEST.contentRoot}${manifestPath}`;

  const filename = basename(manifestPath);

  const outputFile = join(
    MANIFEST.outputDirectory,
    filename
  );

  console.log(`Manifest Version: ${manifest.version}`);
  console.log(`Downloading ${filename}...`);

  const bytes = await downloadFile(
    downloadUrl,
    outputFile
  );

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

  console.log();
  console.log("Download complete!");
  console.log(`Saved: ${outputFile}`);
  console.log(`Size : ${bytes.toLocaleString()} bytes`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
