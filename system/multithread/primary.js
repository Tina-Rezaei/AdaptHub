const cluster = require('node:cluster');
const fs = require('fs');
const path = require('path');
const util = require('node:util');
const execFile = util.promisify(require('node:child_process').execFile);
const kv = require('./KVStore');

console.log('I am primary');

cluster.setupPrimary({
  exec: `${path.join(__dirname,'/worker.js')}`
  // args: [],
  // silent: false,
  // uid: 1001 // user id used to run worker.js
});
console.log(cluster.settings);

async function installDependencies(appDir) {
  const { stdout, stderr } = await execFile('npm', ['i'],{cwd:`${appDir}`});
  if (stderr) {
    throw stderr;
  }
}

// Populate Redis with files from the app's 'files' folder
async function uploadResourcesToRedis(appDir) {
  try {
    const basePath = path.join(appDir, '/resources');
    const files = fs.readdirSync(basePath);
    for (let f of files) {
        const fileData = fs.readFileSync(path.join(basePath, f));
        await kv.set(f,Buffer.from(fileData).toString('base64'))
    }
  } catch (error) {
    console.error("Error reading app files", error);
  }
}

async function prepareAppPackage() {
  const appName = 'facerecognition';
  // const appName = 'speechrecognition';

  const appDir = path.join(__dirname,`apps/${appName}`);
  await installDependencies(appDir);
  await uploadResourcesToRedis(appDir);

  for (let i=0; i<10; i++) {
    let worker = cluster.fork();
    worker.send({appName:appName});
  }

}

cluster.on('disconnect', (worker) => {
  console.log(`The worker #${worker.id} has disconnected`);
});

prepareAppPackage();