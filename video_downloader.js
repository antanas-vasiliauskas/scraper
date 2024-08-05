const linkFile = "links/leagueoflegends-links.txt";
const videoFolder = "karma 07-31";
const alreadyDownloadedFile = "_ALREADY-DOWNLOADED.txt"; // Nekeisti

const https = require("https");
const { Queue } = require("async-await-queue");
const fs = require("fs");
const { log } = require("console");
const prompt = require("prompt-sync")({ sigint: true });

var batchNumber = 1;

async function main() {
  var linkLines = [];
  try {
    const data = fs.readFileSync(linkFile, "utf-8");
    linkLines = data.split("\n");
  } catch (err) {
    console.error("Error reading link file:", err);
    return;
  }

  console.log(`Found ${linkLines.length} video links in ${linkFile}`);
  if (linkLines.length == 0) {
    console.log("Ending work, because there are no links.");
    return;
  }

  var alreadyDownloadedVideoNames = [];
  try {
    const alreadyDownloadedData = fs.readFileSync(`${videoFolder}/${alreadyDownloadedFile}`, "utf-8");
    alreadyDownloadedVideoNames = alreadyDownloadedData.split("\n");
    alreadyDownloadedVideoNames = alreadyDownloadedVideoNames.filter((name) => {
      return name.includes(".mp4");
    });
  } catch (err) {
    if (err) {
      // If the file doesn't exist, create one with default content
      if (err.code === "ENOENT") {
        try {
          fs.mkdirSync(videoFolder);
          fs.writeFileSync(`${videoFolder}/${alreadyDownloadedFile}`, "");
        } catch (err) {
          console.error("Error creating video folder:", err);
        }
      } else {
        console.error("Error reading the file:", err);
      }
    }
  }

  for (let i = 1; i < 10000; i++) {
    try {
      if (!fs.existsSync(`${videoFolder}/${i}`)) {
        batchNumber = i;
        break;
      }
    } catch {
      console.error("Error checking folder existence:", err);
      return;
    }
  }

  linkLines = linkLines.filter((linkLine) => {
    return !alreadyDownloadedVideoNames.some((name) => linkLine.includes(name));
  });
  console.log(
    `Of which ${linkLines.length} video links are not yet downloaded.`
  );

  var howManyToDownload = 0;

  while (true) {
    console.log(`How many videos to download? (From 1 to ${linkLines.length})`);
    let userInput = prompt();
    let number = parseInt(userInput);

    if (!isNaN(number) && number >= 1 && number <= linkLines.length) {
      howManyToDownload = number;
      break;
    } else {
      console.log(`Incorrect input. Type number from 1 to ${linkLines.length}`);
    }
  }

  linkLines = linkLines.slice(0, howManyToDownload);

  // removing any extra info, like date, views or resolution
  linkLines = linkLines.map((str) => {
    const indexOfSpace = str.indexOf(" ");
    if (indexOfSpace !== -1) {
      return str.substring(0, indexOfSpace);
    } else {
      return str;
    }
  });

  try {
    fs.mkdirSync(videoFolder + "/" + batchNumber);
  } catch (err) {
    console.error("Error creating video folder:", err);
  }

  await downloadFiles(linkLines);
}

function downloadFile(url, filePath, fileName, index, redirect = false) {
  return new Promise((resolve, reject) => {
    if (!redirect) console.log(index + 1 + ". Downloading " + fileName);
    const file = fs.createWriteStream(filePath);
    const request = https.get(url, (response) => {
      if (response.statusCode === 307) {
        // Extract the new URL from the 'Location' header
        const newUrl = response.headers.location;
        //console.log(`Received 307 Temporary Redirect. Redirecting to: ${newUrl}`);
        // Initiate a new download request to the redirected URL
        downloadFile(newUrl, filePath, fileName, index, true)
          .then(() => resolve())
          .catch(reject);
      } else {
        response.pipe(file);
        file.on("finish", () => {
          console.log(index + 1 + ". Finished downloading " + fileName);
          fs.appendFileSync(
            `${videoFolder}/${alreadyDownloadedFile}`,
            fileName + "\n"
          );
          file.close(resolve); // close() is async, resolve after close completes
        });
      }
    });
    request.on("error", (err) => {
      fs.unlink(filePath, () => {
        reject(err); // Delete the file async
      });
    });
  });
}

async function downloadFiles(urls) {
  const queue = new Queue(10, 100);
  let promises = [];
  for (let i = 0; i < urls.length; i++) {
    if (!isUrlValid(urls[i])) {
      console.error("Invalid URL: ", urls[i]);
      continue;
    }
    promises.push(
      (async () => {
        const me = Symbol();
        await queue.wait(me, 0);
        try {
          var fileName = urls[i].split("?")[0].split("/").pop();
          var filePath = `${videoFolder}/${batchNumber}/${fileName}`;
          await downloadFile(urls[i], filePath, fileName, i);
        } catch (err) {
          console.error("Something went wrong: ", err.message);
        } finally {
          queue.end(me);
        }
      })()
    );
  }
  await Promise.allSettled(promises);
}

function isUrlValid(url){
  try {
    new URL(url);
    return true;
  } catch (err) {
    return false;
  }
}

main();
