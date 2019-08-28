import semver from "semver";
import path from "path";
import fs from "fs";
import util from "util";

const folderPath = process.argv[2];
const yarnPath = path.resolve(folderPath, "yarn.lock");
const packagePath = path.resolve(folderPath, "package.json");
const readFileAsync = util.promisify(fs.readFile);
const writeFileAsync = util.promisify(fs.writeFile);
const dependenciesString = "dependencies";
const devDependenciesString = "devDependencies";

(async () => {
  const packageMetaData = JSON.parse(
    await readFileAsync(packagePath, { encoding: "utf8" })
  );
  const dependencies = {
    ...(packageMetaData[dependenciesString] || {}),
    ...(packageMetaData[devDependenciesString] || {})
  };

  const yarnMetaData = await readFileAsync(yarnPath, { encoding: "utf8" });
  let shouldFix = false;
  for (const packageName in dependencies) {
    const version = dependencies[packageName];
    const searchString = String(`${packageName}@${version}`).replace(
      /(\W)/g,
      "\\$1"
    );
    const regexString = `"?${searchString}"?[,:].*?version\\s"(.*?)"`;
    const regex = new RegExp(regexString, "gs");
    const searchPackage = regex.exec(yarnMetaData);
    const useVersion = searchPackage[1];
    if (semver.minVersion(version).version !== useVersion) {
      shouldFix = true;
      console.log(
        `the ${packageName} is ${useVersion} in yarn.lock, but is ${version} in package.json`
      );
      const isInDependencies =
        packageMetaData[dependenciesString][packageName] !== null;
      const setPath = isInDependencies
        ? dependenciesString
        : devDependenciesString;
      packageMetaData[setPath][packageName] = `^${useVersion}`;
    }
  }
  if (shouldFix) {
    await writeFileAsync(packagePath, JSON.stringify(packageMetaData, null, 2));
  }
})();
