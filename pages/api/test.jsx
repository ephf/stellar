import { writeFile, readFile } from "fs";

async function async(f, ...args) {
  return new Promise((resolve, reject) => {
    f(...args, (err, data) => (err ? reject(err) : resolve(data)));
  });
}

export default async function () {
  const count = JSON.parse(await async(readFile, "data.json", "utf-8"));
  await async(writeFile, "data.json", JSON.stringify(count + 1));
  return count + 1;
}
