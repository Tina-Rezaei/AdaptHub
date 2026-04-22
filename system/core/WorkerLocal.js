/**
 * Local Worker Process
 * 
 * Executes application modules locally in a sandboxed VM.
 * Optionally applies cgroup resource limits based on configuration.
 */

const fs = require('fs');
const path = require('path');
const { NodeVM, VMScript } = require('vm2');
const KVStore = require('./KVStore');
const Camera = require('../device-proxies/Camera');
const Light = require('../device-proxies/Light');
const Thermostat = require('../device-proxies/Thermostat');
const VoiceAssistant = require('../device-proxies/VoiceAssistant');
const Logger = require('../utils/logger');
const { manageCgroup } = require('./cgroupManager');

/**
 * Setup cgroup for resource management
 * @param {number} pid - Process ID
 * @param {Object} decisions - Resource allocation decisions
 * @returns {Promise<boolean>} True if cgroup was set up successfully
 */
async function setupCgroup(pid, decisions) {
    const cgroupName = `module${pid}`;
    try {
        await manageCgroup('create', cgroupName);
        await manageCgroup('set', cgroupName, decisions);
        await manageCgroup('addpid', cgroupName, { pid });
        return true;
    } catch (error) {
        console.warn(`Cgroup setup failed (running without resource limits): ${error.message}`);
        return false;
    }
}

/**
 * Create sandbox for VM execution
 * @param {Object} kvStore - Key-value store instance
 * @param {Object} logger - Logger instance
 * @param {string[]} dependencies - List of required dependencies
 * @returns {Object} Sandbox configuration
 */
function createSandbox(kvStore, logger, dependencies) {
    return {
        kv: kvStore,
        logger: logger,
        Camera: dependencies.includes('Camera') ? new Camera('service') : null,
        Light: dependencies.includes('Light') ? new Light('service') : null,
        Thermostat: dependencies.includes('Thermostat') ? new Thermostat('service') : null,
        VoiceAssistant: dependencies.includes('VoiceAssistant') ? new VoiceAssistant('service') : null,
    };
}

/**
 * Main message handler for worker process
 */
process.on('message', async (message) => {
    const { moduleData, config = {} } = message;
    const useResourceManagement = config.resourceManagement !== false;
    
    console.log(`[WORKER] Starting local execution: ${moduleData.name} (PID: ${process.pid})`);
    
    const childLogger = new Logger(moduleData.appID);
    childLogger.timeLog(`local-execution-of-${moduleData.name}-total`, 'start');
    childLogger.timeLog(`local-execution-of-${moduleData.name}-initialization`, 'start');

    const pid = process.pid;

    // Setup cgroups if resource management is enabled and decisions exist
    if (useResourceManagement && moduleData.decisions) {
        console.log(`[WORKER] Setting up cgroup resource limits for ${moduleData.name}`);
        await setupCgroup(pid, moduleData.decisions);
    }

    // Initialize KV store and VM
    const kvStore = new KVStore();
    const sandbox = createSandbox(kvStore, childLogger, moduleData.dependencies);
    
    const vm = new NodeVM({
        wasm: true,
        eval: false,
        console: 'inherit',
        sandbox: sandbox,
        require: {
            root: [moduleData.moduleDir],
            external: true,
            builtin: ['path'],
        }
    });

    // Load and run the module
    const file = path.join(moduleData.moduleDir, `${moduleData.name}.js`);
    const moduleScript = new VMScript(fs.readFileSync(file), file);
    const moduleHandler = vm.run(moduleScript, file);
    const moduleRuntime = new moduleHandler(null);
    
    childLogger.timeLog(`local-execution-of-${moduleData.name}-initialization`, 'end');

    try {
        // Initialize module
        childLogger.timeLog(`local-execution-of-${moduleData.name}-init`, 'start');
        await moduleRuntime.init();
        childLogger.timeLog(`local-execution-of-${moduleData.name}-init`, 'end');

        // Run module
        childLogger.timeLog(`local-execution-of-${moduleData.name}-run`, 'start');
        const [eventName, type] = await moduleRuntime.run();
        childLogger.timeLog(`local-execution-of-${moduleData.name}-run`, 'end');

        childLogger.timeLog(`local-execution-of-${moduleData.name}-total`, 'end');

        // Send results back to parent
        const durations = childLogger.getDurations();
        process.send({ eventName, type, durations, pid });
    } catch (error) {
        console.error(`Error in child process for ${moduleData.name}:`, error);
        process.send({ error: error.message });
    } finally {
        process.exit();
    }
});
