const {
  Worker, isMainThread, parentPort, workerData
} = require('node:worker_threads');
const fs = require('fs');
const path = require('path');
const util = require('node:util');
const execFile = util.promisify(require('node:child_process').execFile);
const kv = require('./KVStore');

console.log('I am the main thread');

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
  const workerFile = path.join(__dirname,'/worker-thread.js');
  await installDependencies(appDir);
  await uploadResourcesToRedis(appDir);

  for (let i=0; i<10; i++) {
    const worker = new Worker(workerFile, {
      workerData: {
        appName: appName
      }
    });
    worker.on('message', (message) => {
      console.log(message); 
    });
    worker.on('error', (err) => {
      console.error(err);
      throw err;
    });
    worker.on('exit', (code) => {
      if (code !== 0)
        throw new Error(`Worker stopped with exit code ${code}`);
    });

  }





}

prepareAppPackage();