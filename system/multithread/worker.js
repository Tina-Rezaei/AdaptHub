const cluster = require('node:cluster');
const {NodeVM, VMScript} = require('vm2');
const path = require('path');
const fs = require('fs');
const kv = require('./KVStore'); 

console.log(`I am worker #${cluster.worker.id}`);

let appName = null;
let vm = null;

process.on('message',(msg) => {
    // console.log("Message from primary:", msg);
    appName = msg.appName;
    processAppPackage();
});

function intializeVM(appDir) {
    vm = new NodeVM({
        wasm: true,     // allow wasm binary compilation
        eval: false,    // prevent calls to eval or function constructors
        console: 'inherit',
        sandbox: {
            kv: kv
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

    // Running a CPU intensive function for testing
    // vm.run(`
    //     function blockCpuFor(ms) {
    //         var now = new Date().getTime();
    //         var result = 0
    //         while(true) {
    //             result += Math.random() * Math.random();
    //             if (new Date().getTime() > now +ms)
    //                 return;
    //         }	
    //     }
    //     blockCpuFor(10000);
    // `, 'vm.js');
}


async function processAppPackage() {
    const appDir = path.join(__dirname,`apps/${appName}`);

    intializeVM(appDir);
    runAppInVM(appDir);
    cluster.worker.disconnect();
}
