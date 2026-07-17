import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

const SHEET_ID = "1WaxvbLx7UoSZaBqdFr1u32F2uWVLo-CJunJB4nlGUE4";

const OUTPUT_DIRECTORY = join("temp", "compendium");

/*
 * These 19 tab IDs were confirmed by the successful
 * D2Synergy Compendium Explorer workflow.
 */
const TABS = [
  { gid: "1038486120", filename: "htmlview-helper.csv" },
  { gid: "1662574278", filename: "gear-perks-traits-mods.csv" },
  { gid: "1287885342", filename: "armor-set-bonuses.csv" },
  { gid: "473308249", filename: "artifact-perks.csv" },
  { gid: "1934379638", filename: "tab-1934379638.csv" },
  { gid: "618967225", filename: "tab-618967225.csv" },
  { gid: "1186062409", filename: "tab-1186062409.csv" },
  { gid: "1907852650", filename: "tab-1907852650.csv" },
  { gid: "1088259962", filename: "tab-1088259962.csv" },
  { gid: "1870531554", filename: "tab-1870531554.csv" },
  { gid: "1918152785", filename: "tab-1918152785.csv" },
  { gid: "20898389", filename: "exotic-class-perks.csv" },
  {
    gid: "527596209",
    filename: "class-abilities-passive-traits.csv",
  },
  { gid: "441434520", filename: "exotic-weapons.csv" },
  { gid: "1500097863", filename: "exotic-armor.csv" },
  { gid: "1800463143", filename: "tab-1800463143.csv" },
  { gid: "715236319", filename: "artifact-archive-episodes.csv" },
  { gid: "70425171", filename: "artifact-archive-seasons.csv" },
  { gid: "1925335732", filename: "armor-mods.csv" },
];

function createCsvUrl(gid) {
  return (
    `https://docs.google.com/spreadsheets/d/${SHEET_ID}` +
    `/gviz/tq?tqx=out:csv&gid=${gid}`
  );
}

async function downloadTab(tab) {
  const url = createCsvUrl(tab.gid);

  console.log(`Downloading ${tab.filename}...`);

  const response = await fetch(url, {
    headers: {
      "User-Agent": "D2Synergy-Compendium-Downloader/1.0",
    },
  });

  if (!response.ok) {
    throw new Error(
      `Failed to download GID ${tab.gid}: ` +
        `${response.status} ${response.statusText}`,
    );
  }

  const csv = await response.text();

  if (!csv.trim()) {
    throw new Error(`Downloaded an empty CSV for GID ${tab.gid}.`);
  }

  const outputPath = join(OUTPUT_DIRECTORY, tab.filename);

  await writeFile(outputPath, csv, "utf8");

  return {
    gid: tab.gid,
    filename: tab.filename,
    bytes: Buffer.byteLength(csv, "utf8"),
    status: "downloaded",
  };
}

async function main() {
  console.log("========================================");
  console.log("D2SYNERGY COMPENDIUM DOWNLOADER");
  console.log("========================================");
  console.log(`Spreadsheet: ${SHEET_ID}`);
  console.log(`Tabs expected: ${TABS.length}`);
  console.log();

  await mkdir(OUTPUT_DIRECTORY, {
    recursive: true,
  });

  const results = [];

  for (const tab of TABS) {
    const result = await downloadTab(tab);

    results.push(result);

    console.log(
      `Saved ${result.filename} ` +
        `(${result.bytes.toLocaleString()} bytes)`,
    );
  }

  const index = {
    schema_version: 1,
    source: {
      name: "Destiny Data Compendium",
      spreadsheet_id: SHEET_ID,
    },
    downloaded_at: new Date().toISOString(),
    tab_count: results.length,
    tabs: results,
  };

  await writeFile(
    join(OUTPUT_DIRECTORY, "index.json"),
    `${JSON.stringify(index, null, 2)}\n`,
    "utf8",
  );

  console.log();
  console.log("========================================");
  console.log("DOWNLOAD COMPLETE");
  console.log("========================================");
  console.log(`Downloaded tabs: ${results.length}`);
  console.log(`Saved to: ${OUTPUT_DIRECTORY}`);
  console.log(`Index: ${join(OUTPUT_DIRECTORY, "index.json")}`);
}

main().catch((error) => {
  console.error();
  console.error("Compendium download failed.");
  console.error(error);

  process.exitCode = 1;
});
