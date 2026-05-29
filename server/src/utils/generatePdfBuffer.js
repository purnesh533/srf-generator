import puppeteer from "puppeteer";
import { access } from "fs/promises";
import { constants as fsConstants } from "fs";
import { buildSrfHtml } from "./pdfTemplate.js";

async function pathExists(filePath) {
  try {
    await access(filePath, fsConstants.F_OK);
    return true;
  } catch {
    return false;
  }
}

function getChromeCandidates() {
  const paths = [];
  if (process.env.PUPPETEER_EXECUTABLE_PATH) {
    paths.push(process.env.PUPPETEER_EXECUTABLE_PATH);
  }
  try {
    const bundled = puppeteer.executablePath?.();
    if (bundled) paths.push(bundled);
  } catch {
    // bundled Chrome not installed
  }
  if (process.platform === "win32") {
    paths.push(
      "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
      "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
      `${process.env.LOCALAPPDATA || ""}\\Google\\Chrome\\Application\\chrome.exe`,
      `${process.env.PROGRAMFILES || ""}\\Google\\Chrome\\Application\\chrome.exe`,
      `${process.env["PROGRAMFILES(X86)"] || ""}\\Google\\Chrome\\Application\\chrome.exe`
    );
  } else if (process.platform === "linux") {
    paths.push(
      "/usr/bin/chromium",
      "/usr/bin/chromium-browser",
      "/usr/bin/google-chrome"
    );
  }
  return [...new Set(paths.filter(Boolean))];
}

function getLaunchOptions(executablePath) {
  const options = { headless: "new" };
  if (executablePath) options.executablePath = executablePath;
  if (process.platform === "linux") {
    options.args = [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage"
    ];
  }
  return options;
}

async function launchBrowser() {
  const failures = [];

  try {
    return await puppeteer.launch(getLaunchOptions());
  } catch (err) {
    failures.push(err.message);
  }

  for (const executablePath of getChromeCandidates()) {
    if (!(await pathExists(executablePath))) continue;
    try {
      return await puppeteer.launch(getLaunchOptions(executablePath));
    } catch (err) {
      failures.push(`${executablePath}: ${err.message}`);
    }
  }

  throw new Error(
    "Could not launch Chrome for PDF generation. Install Google Chrome or run " +
      "`npx puppeteer browsers install chrome` in the server folder."
  );
}

export async function generatePdfBuffer(data) {
  const browser = await launchBrowser();
  try {
    const page = await browser.newPage();
    await page.setContent(buildSrfHtml(data), { waitUntil: "networkidle0" });
    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "22px", right: "22px", bottom: "22px", left: "22px" }
    });
    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}
