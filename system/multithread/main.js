const {NodeVM, VMScript} = require('vm2');
const fs = require('fs');
const kv = require('./KVStore');
const path = require('path');
// const { execFile } = require('node:child_process');
const util = require('node:util');
const execFile = util.promisify(require('node:child_process').execFile);

let vm = null;

async function installDependencies(appDir) {
  const { stdout, stderr } = await execFile('npm', ['i'],{cwd:`${appDir}`});
  if (stderr) {
    throw stderr;
  }
  // console.log(stdout);
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
    log.error("Error reading app files", error);
  }
}

function intializeVM(appDir) {
  vm = new NodeVM({
    wasm: true,     // allow wasm binary compilation
    eval: false,    // prevent calls to eval or function constructors
    console: 'inherit',
    sandbox: {
        kv: kv,
        event: event
    },
    require: {  
      root: [appDir],
      external: true
      // builtin: ['fs','path']
    }
  });
}

function runAppInVM(appDir) {
  const file = path.join(appDir,'index.js');
  // By providing a file name as second argument you enable breakpoints
  const script = new VMScript(fs.readFileSync(file), file);
  vm.run(script,file);
  
  // Running a simple js module with add.wasm and add() function
  // vm.run(`
  //     const fs = require('fs');
  //     const Module = require('./a.out');
  
  //     Module().then(MyModule => {
  //         console.log('WebAssembly loaded!');
  //         // Access your functions (if bound by Embind):
  //         console.log(MyModule._add(5,6));
  //     });        
  // `, 'vm.js');
}


async function processAppPackage(appName) {
  const appDir = path.join(__dirname,`apps/${appName}`);
  await installDependencies(appDir);
  await uploadResourcesToRedis(appDir);
  intializeVM(appDir);
  runAppInVM(appDir);
}

const appName = 'facerecognition';
// const appName = 'speechrecognition';

processAppPackage(appName);