const fs = require("fs");
const filePath = "./package.json";

const packageJson = JSON.parse(fs.readFileSync(filePath).toString());
packageJson.buildDate = new Date().getTime();

fs.writeFileSync(filePath, JSON.stringify(packageJson, null, 2));

const jsonData = {
  buildDate: packageJson.buildDate,
};

const jsonContent = JSON.stringify(jsonData);

fs.writeFile("./public/meta.json", jsonContent, "utf8", function (error) {
  if (error) {
    console.log("An error Occured while saving build date and time to meta.json");
    return console.log(error);
  }

  console.log("Latest build date and time updated in meta.json file");
});

const swPath = "./public/service-worker.js";
const swContent = fs.readFileSync(swPath, "utf8");
const updatedSwContent = swContent.replace(
  /const CACHE_VERSION = ['"][^'"]*['"];/,
  `const CACHE_VERSION = '${packageJson.buildDate}';`
);

fs.writeFileSync(swPath, updatedSwContent);
console.log("Service worker cache version updated");
