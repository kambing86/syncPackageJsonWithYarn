import path from "path";
import fs from "fs";
import util from "util";
import minVersion from "semver/ranges/min-version";
import yargs from "yargs";

const argv = yargs.argv;
const path1 = argv._[0];
const path2 = argv._[1] || path1;
const yarnPath = path.resolve(path1, "yarn.lock");
const packagePath = path.resolve(path2, "package.json");
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
    ...(packageMetaData[devDependenciesString] || {}),
  };

  const yarnMetaData = await readFileAsync(yarnPath, { encoding: "utf8" });
  let shouldFix = false;
  for (const packageName in dependencies) {
    const version = dependencies[packageName];
    const searchString = `${packageName}@${version}`.replace(/(\W)/g, "\\$1");
    const regexString = `"?${searchString}"?[,:].*?version\\s"(.*?)"`;
    const regex = new RegExp(regexString, "gs");
    const searchPackage = regex.exec(yarnMetaData);
    if (searchPackage === null) {
      console.error(
        "package.json and yarn.lock not in sync, please run yarn install again"
      );
      return;
    }
    const useVersion = searchPackage[1];
    try {
      if (minVersion(version).version !== useVersion) {
        shouldFix = argv.fix || false;
        console.warn(
          `${packageName} is ${useVersion} in yarn.lock, but is ${version} in package.json`
        );
        const isInDependencies =
          packageMetaData[dependenciesString][packageName] !== undefined;
        const setPath = isInDependencies
          ? dependenciesString
          : devDependenciesString;
        packageMetaData[setPath][packageName] = `^${useVersion}`;
      }
    } catch (e) {
      console.error(e);
    }
  }
  if (shouldFix) {
    console.log("fixing package.json...");
    await writeFileAsync(packagePath, JSON.stringify(packageMetaData, null, 2));
  }
})();
