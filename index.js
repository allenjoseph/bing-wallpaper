import fs from "node:fs";
import path from "node:path";
import { tmpdir } from "node:os";
import { execSync } from "node:child_process";
import { WritableStream } from "node:stream/web";

/**
 * RESTful API to fetch daily wallpaper from Bing.com
 * See: https://github.com/TimothyYe/bing-wallpaper
 */
const bingWallpaper =
  "https://bing.biturl.top/?resolution=UHD&format=json&index=0&mkt=en-US";

fetch(bingWallpaper)
  .then((res) => res.json())
  .then((data) => fetch(data.url))
  // Save the picture to the temp directory OS
  .then((res) => savePicture(res))
  // Refresh the desktop picture based on the OS
  .then((pic) => setDesktopPicture(pic));

function setDesktopPicture(pic) {
  try {
    const commandBuilder = commandByOS[process.platform];
    if (!commandBuilder) throw new Error("Unsupported platform");

    commandBuilder(pic).forEach((cmd) => execSync(cmd));
    console.log(`Desktop picture set to: ${pic}`);

    if (process.platform === "win32") return retryWinDesktopRefresh();
  } catch (err) {
    console.error(err);
  }
}

function savePicture(res) {
  const filename = new URL(res.url).searchParams.get("id");
  const filepath = path.join(tmpdir(), filename);

  return res.body
    .pipeTo(writeFile(filepath))
    .then(() => delay(300)) // Wait for the file to be written
    .then(() => filepath);
}

function writeFile(filepath) {
  const writeStream = fs.createWriteStream(filepath);
  return new WritableStream({
    write(chunk) {
      writeStream.write(chunk);
    },
  });
}

async function retryWinDesktopRefresh(count = 1) {
  if (count === 5) {
    console.log(
      "If your Desktop picture did not change, try restarting your session."
    );
    return;
  }

  await delay(1000);
  execSync("RUNDLL32.EXE user32.dll,UpdatePerUserSystemParameters");
  console.log(`...`);

  retryWinDesktopRefresh(count + 1);
}

function delay(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

const commandByOS = {
  darwin: (pic) => [
    `osascript -e 'tell application "System Events" to tell every desktop to set picture to POSIX file "${pic}"'`,
  ],
  linux: (pic) => [
    `gsettings set org.gnome.desktop.background picture-uri file://${pic}`,
  ],
  win32: (pic) => [
    `reg add "HKEY_CURRENT_USER\\Control Panel\\Desktop" /v Wallpaper /t REG_SZ /d ${pic} /f`,
    `RUNDLL32.EXE user32.dll,UpdatePerUserSystemParameters`,
  ],
};
