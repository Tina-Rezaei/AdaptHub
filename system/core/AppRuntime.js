/**
 * Application Runtime
 * 
 * Manages the lifecycle of smart home applications.
 * Supports different execution modes based on configuration.
 */

const path = require('path');
const fs = require('fs');
const util = require('node:util');
const execFile = util.promisify(require('node:child_process').execFile);
const { NodeVM, VMScript } = require('vm2');
const { VM } = require('vm2');
const crypto = require('crypto');
require('dotenv').config();

const NetworkClient = require('./NetworkClient');
const Camera = require('../device-proxies/Camera');
const Light = require('../device-proxies/Light');
const Thermostat = require('../device-proxies/Thermostat');
const VoiceAssistant = require('../device-proxies/VoiceAssistant');
const { runMaster } = require('./master');
const { sendDataToPython } = require('./nodeToPythonClient');
const { idleCPURatio, totalCpuFrequency, getNumberOfCores } = require('./CPUReport');
const { EXECUTION_STRATEGY } = require('./config');

module.exports = class AppRuntime {
    constructor(kvStore, logger, config = {}) {
        this.kv = kvStore;
        this.eventEngine = null;
        this.apps = {};
        this.subscriptions = {};
        this.commands = [];
        this.serviceModules = [];
        this.modulesQuotas = [];
        this.privacyMax = 9;
        this.privacyMin = 2;
        this.logger = logger;
        
        // Store configuration
        this.config = {
            execution: config.execution || EXECUTION_STRATEGY.DECISION,
            resourceManagement: config.resourceManagement !== undefined ? config.resourceManagement : true,
            decisionMaking: config.decisionMaking !== undefined ? config.decisionMaking : true,
            algorithm: config.algorithm || 'minMaxPrivacy',
            modeName: config.modeName || 'adapthub',
            label: config.label || 'hubos',
            ...config,
        };
    }

    setEventEngine(eventEngine) {
        this.eventEngine = eventEngine;
    }

    async installDependencies(appDir) {
        const modulesPath = path.join(appDir, '/modules');
        const modules = fs.readdirSync(modulesPath);
        
        for (const module of modules) {
            const modulePath = path.join(modulesPath, module);
            const nodeModulesPath = path.join(modulePath, 'node_modules');

            if (fs.existsSync(nodeModulesPath)) {
                console.log(`Dependencies already installed for module: ${module}. Skipping...`);
                continue;
            }

            const env = Object.assign({}, process.env, {
                TFJS_BUILD_FROM_SOURCE: 'true',
                npm_config_build_from_source: 'true'
            });

            try {
                console.log(`Installing dependencies for module: ${module}`);
                const { stdout, stderr } = await execFile('yarn', ['install'], { cwd: modulePath, env });
                if (stderr) {
                    console.error(`Warnings during installation for module ${module}:`, stderr);
                }
            } catch (error) {
                console.error(`Failed to install dependencies for module ${module}:`, error);
            }
        }
    }

    async uploadResourcesToRedis(appDir) {
        try {
            const basePath = path.join(appDir, '/resources');
            const files = fs.readdirSync(basePath);
            for (const f of files) {
                const fileData = fs.readFileSync(path.join(basePath, f));
                await this.kv.set(f, Buffer.from(fileData).toString('base64'));
            }
        } catch (error) {
            console.error('Error reading app files:', error);
        }
    }

    extractAppScript(appDir, appName) {
        const file = path.join(appDir, `/modules/${appName}/index.js`);
        const appScript = new VMScript(fs.readFileSync(file), file);
        this.apps[appName] = appScript;
    }

    async extractManifestData(appDir, appName, score) {
        const manifestFilePath = path.join(appDir, '/manifest.json');
        const manifestFile = fs.readFileSync(manifestFilePath);
        const manifestData = JSON.parse(manifestFile);
        
        if (manifestData.type === 'voice-controlled') {
            this.commands.push(manifestData.commands);
        }

        const moduleRuntime = manifestData.modules
            .filter(module => module.type === 'service')
            .map(module => {
                const moduleDir = path.join(appDir, `/modules/${module.name}`);
                const file = path.join(moduleDir, `${module.name}.js`);
                return {
                    name: module.name,
                    moduleDir: moduleDir,
                    dependencies: module.dependencies,
                    file: file,
                    appDir: appDir,
                    appName: appName,
                    appID: crypto.randomBytes(4).toString('hex'),
                    comp: manifestData.comp,
                    timeBudget: manifestData.timeBudget,
                    privacyScore: score,
                    dataSize: 0,
                    decisions: {},
                };
            });

        this.serviceModules = this.serviceModules.concat(moduleRuntime);
    }

    extractTabacRules(appDir, appName) {
        const rulesFilePath = path.join(appDir, '/tabac-rules/rules.json');
        const rulesFile = fs.readFileSync(rulesFilePath);
        const appTabacRules = JSON.parse(rulesFile);

        appTabacRules.forEach(rule => {
            const triggerEventType = rule['if']['event'];
            const appRule = { appName, rule };

            if (this.subscriptions[triggerEventType]) {
                this.subscriptions[triggerEventType].push(appRule);
            } else {
                this.subscriptions[triggerEventType] = [appRule];
            }
        });
    }

    async addApp(appName, score) {
        const appDir = path.join(__dirname, `../apps/${appName}`);
        await this.installDependencies(appDir);
        await this.uploadResourcesToRedis(appDir);
        await this.extractManifestData(appDir, appName, score);
        await this.extractAppScript(appDir, appName);
        await this.extractTabacRules(appDir, appName);
    }

    async setDataSize() {
        const dataPath = {
            'SpeechRecognition': path.join(__dirname, '../resources/make-it-warmer.raw'),
            'FaceRecognition': path.join(__dirname, '../resources/camera-frame2.jpg'),
            'FallDetection': path.join(__dirname, '../resources/pose_squats.mp4'),
        };

        this.serviceModules.forEach(module => {
            if (dataPath[module.name]) {
                module.dataSize = fs.statSync(dataPath[module.name]).size / 1000;
            }
        });
    }

    async setModulesQuotas(idleCpuRatio, totalCpuFrequency, cpuCoreCount) {
        const tasks = this.serviceModules.reduce((acc, module) => {
            acc[module.appID] = {
                appName: module.appName,
                timeBudget: module.timeBudget,
                comp: module.comp,
                privacyScore: module.privacyScore,
                dataSize: module.dataSize,
            };
            return acc;
        }, {});

        const data = await sendDataToPython({
            idleCpuRatio,
            totalCpuFrequency,
            tasks,
            backHaul: 32,
            cpuCoreCount,
            decisionMakingAlgo: this.config.algorithm,
        });

        // Log decisions for each module
        this.serviceModules.forEach(module => {
            module.decisions = data[module.appID];
            const location = module.decisions.alpha === 0 ? 'LOCAL' : 'CLOUD';
            console.log(`[DECISION] ${module.name}: Execute ${location} (alpha=${module.decisions.alpha}, quota=${module.decisions.quota || 'N/A'})`);
        });
    }

    /**
     * Set default decisions for modes without decision-making
     */
    setDefaultDecisions() {
        this.serviceModules.forEach(module => {
            if (this.config.execution === EXECUTION_STRATEGY.LOCAL) {
                module.decisions = { alpha: 0 }; // Always local
            } else if (this.config.execution === EXECUTION_STRATEGY.REMOTE) {
                module.decisions = { alpha: 1 }; // Always remote
            } else {
                module.decisions = { alpha: 0 }; // Default to local
            }
        });
    }

    async runAllAppModules() {
        console.log(`[EXEC] Executing ${this.serviceModules.length} module(s)...`);

        try {
            await this.setDataSize();

            // Only run decision-making if enabled
            if (this.config.decisionMaking) {
                console.log('[CPU] Fetching system resource info...');
                this.logger.timeLog('fetch-idle-cpu-data', 'start');
            const idleCpuRatio = await idleCPURatio();
                const totalCpu = await totalCpuFrequency();
                const cpuCoreCount = getNumberOfCores();
                this.logger.timeLog('fetch-idle-cpu-data', 'end');
                console.log(`[CPU] Available: ${(idleCpuRatio * 100).toFixed(1)}% idle, ${cpuCoreCount} cores`);

                console.log('[OPTIMIZER] Connecting to decision-making server...');
                this.logger.timeLog('decision-making-send-and-receive-data', 'start');
                await this.setModulesQuotas(idleCpuRatio, totalCpu, cpuCoreCount);
                this.logger.timeLog('decision-making-send-and-receive-data', 'end');
                console.log('[OPTIMIZER] Decisions received');
            } else {
                const execType = this.config.execution === EXECUTION_STRATEGY.LOCAL ? 'LOCAL' : 'CLOUD';
                console.log(`[EXEC] Using default execution: ${execType} (no decision-making)`);
                this.setDefaultDecisions();
            }

            // Log app specs
            this.serviceModules.forEach(module => {
                this.logger.storeAppSpecs(module.appID, module);
            });

        } catch (error) {
            console.error('Failed during setup:', error);
            // Set fallback decisions
            this.setDefaultDecisions();
        }

        // Execute all modules
        const results = await Promise.all(this.serviceModules.map(async (module) => {
            try {
                const alpha = module.decisions?.alpha ?? 0;
                this.logger.timeLog(`total-run-child-${alpha}`, 'start');
                
                const { eventName, type, durations } = await runMaster(module, this.logger, this.config);
                
                this.logger.timeLog(`total-run-child-${alpha}`, 'end');
                this.logger.storeAppSpecs(module.appID, durations);
                this.eventEngine.addEvent(eventName, type);
                
                return { durations };
            } catch (error) {
                console.error(`Error processing module ${module.name}:`, error);
                return null;
            }
        }));

        return results;
    }

    processEvent(eventType, event) {
        try {
            if (!this.subscriptions[eventType]) return;

            this.subscriptions[eventType].forEach(appRule => {
                try {
                    const appName = appRule.appName;
                    const rule = appRule.rule;
                    let expectedValue = rule['if']['value'];

                    if (expectedValue === '$RegisteredVoiceCommands$') {
                        expectedValue = this.commands;
                    }

                    const triggerContext = rule['if']['context'];
                    let triggered = false;

                    switch (triggerContext) {
                        case 'equals':
                            triggered = expectedValue == event;
                            break;
                        case 'contains':
                            triggered = event.includes(expectedValue);
                            break;
                        case 'containsAny':
                            triggered = expectedValue.some(cmd => event.includes(cmd));
                            break;
                        case 'doesNotContainAny':
                            triggered = !expectedValue.some(cmd => event.includes(cmd));
                            break;
                        case 'greaterThan':
                            triggered = event > expectedValue;
                            break;
                        case 'lessThan':
                            triggered = event < expectedValue;
                            break;
                        case 'greaterThanOrEquals':
                            triggered = event >= expectedValue;
                            break;
                        case 'lessThanOrEquals':
                            triggered = event <= expectedValue;
                            break;
                        default:
                            console.error('Unknown trigger context:', triggerContext);
                            return;
                    }

                    if (triggered) {
                        this.executeTriggeredRule(appName, rule, event);
                    }
                } catch (error) {
                    console.error('Error processing app rule:', error);
                }
            });
        } catch (error) {
            console.error('Error processing event:', error);
        }
    }

    executeTriggeredRule(appName, rule, event) {
        const appScript = this.apps[appName];
        const actions = rule['then'];
        const sandbox = {
            env: process.env,
            kv: this.kv,
            logger: this.logger,
            event: event,
            console: console,
        };

        actions.forEach(action => {
            switch (action['access']) {
                case 'NetworkClient':
                    sandbox['NetworkClient'] = new NetworkClient(action);
                    break;
                case 'Doorcam':
                case 'LivingRoomCam':
                    sandbox[action['access']] = new Camera(action);
                    break;
                case 'LivingRoomLights':
                    sandbox['LivingRoomLights'] = new Light(action);
                    break;
                case 'Thermostat':
                    sandbox['Thermostat'] = new Thermostat(action);
                    break;
                case 'VoiceAssistant':
                    sandbox['VoiceAssistant'] = new VoiceAssistant(action);
                    break;
                case 'EventEngine':
                    sandbox['EventEngine'] = this.eventEngine;
                    break;
                default:
                    console.error('Unknown action access type:', action['access']);
            }
        });

        try {
            const appDir = path.join(__dirname, `../apps/${appName}/modules/${appName}`);
            const vm = new VM({
                sandbox: sandbox,
                console: 'inherit',
                require: {
                    external: true,
                    root: appDir,
                },
            });

            const file = path.join(appDir, 'index.js');
            this.logger.timeLog('event-engine-processing-event', 'end');
            vm.run(appScript, file);
        } catch (error) {
            console.error('Error running VM script:', error);
        }
    }
};
