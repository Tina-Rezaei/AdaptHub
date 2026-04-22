/**
 * Unified Master Module
 * 
 * Handles execution of application modules based on configuration.
 * Supports local execution, remote execution, and decision-based routing.
 */

const { fork } = require('child_process');
const path = require('path');
const Logger = require('../utils/logger');
const Camera = require('../device-proxies/Camera');
const VoiceAssistant = require('../device-proxies/VoiceAssistant');
const NetworkClient = require('./NetworkClient');
const { EXECUTION_STRATEGY } = require('./config');

const networkClient = new NetworkClient();

/**
 * Determines whether to execute remotely based on config and module decisions
 * @param {Object} module - Module data
 * @param {Object} config - Mode configuration
 * @returns {boolean} True if should execute remotely
 */
function shouldExecuteRemote(module, config) {
    switch (config.execution) {
        case EXECUTION_STRATEGY.LOCAL:
            return false;
        case EXECUTION_STRATEGY.REMOTE:
            return true;
        case EXECUTION_STRATEGY.DECISION:
            return module.decisions && module.decisions.alpha === 1;
        default:
            return false;
    }
}

/**
 * Execute module locally via forked worker process
 * @param {Object} module - Module data
 * @param {Object} logger - Logger instance
 * @param {Object} config - Mode configuration
 * @returns {Promise} Resolves with event data
 */
async function runLocal(module, logger, config) {
    return new Promise((resolve, reject) => {
        const worker = fork(path.join(__dirname, 'WorkerLocal.js'));

        worker.on('message', async (message) => {
            worker.kill();

            if (message.error) {
                console.error(`Worker error: ${message.error}`);
                return reject(new Error(message.error));
            }

            if (message.eventName == null) {
                console.error('Event name is null');
                return reject(new Error('Event name is null'));
            }

            const { eventName, type, durations } = message;
            logger.storeAppSpecs(module.appID, durations);
            return resolve({ eventName, type, durations });
        });

        worker.on('error', (error) => {
            console.error(`Worker encountered error: ${error}`);
            worker.kill();
            reject(error);
        });

        worker.on('exit', (code) => {
            if (code !== 0) {
                reject(new Error(`Worker stopped with exit code ${code}`));
            }
        });

        // Send module data and config to worker
        worker.send({ 
            moduleData: module,
            config: {
                resourceManagement: config.resourceManagement,
                modeName: config.modeName,
            }
        });
    });
}

/**
 * Execute module remotely via cloud server
 * @param {Object} module - Module data
 * @param {Object} logger - Logger instance
 * @returns {Promise} Resolves with event data
 */
async function runRemote(module, logger) {
    const moduleLogger = new Logger(module.appID);
    console.log(`[CLOUD] Offloading ${module.name} to cloud server...`);
    
    try {
        let eventName, eventType;

        if (module.name === 'FallDetection') {
            console.log(`[CLOUD] ${module.name}: Sending to ${process.env.FALLDETECTION_CLOUD_SERVER}:8126`);
            moduleLogger.log.info('FallWatch: Forwarding to remote fall detection server.');
            moduleLogger.timeLog('remote-execution-of-fall-detection-total', 'start');

            moduleLogger.timeLog('remote-execution-of-fall-detection-fetching-frame', 'start');
            const camera = new Camera();
            const frame = await camera.getFrame();
            moduleLogger.timeLog('remote-execution-of-fall-detection-fetching-frame', 'end');

            moduleLogger.timeLog('remote-execution-of-fall-detection-transmission-computation', 'start');
            const response = await networkClient.sendDataViaNetSocket(
                process.env.FALLDETECTION_CLOUD_SERVER, 
                8126, 
                frame
            );
            moduleLogger.durationLog('remote-execution-of-fall-detection-computation', response.time);
            moduleLogger.timeLog('remote-execution-of-fall-detection-transmission-computation', 'end');

            moduleLogger.timeLog('remote-execution-of-fall-detection-total', 'end');
            eventName = 'FallDetectionEvent';
            eventType = true;
        } 
        else if (module.name === 'FaceRecognition') {
            console.log(`[CLOUD] ${module.name}: Sending to ${process.env.SMARTCAMERA_CLOUD_SERVER}:8122`);
            moduleLogger.timeLog('remote-execution-of-face-detection-total', 'start');

            moduleLogger.timeLog('remote-execution-of-face-detection-fetching-frame', 'start');
            const camera = new Camera();
            const frame = await camera.getFrame();
            moduleLogger.timeLog('remote-execution-of-face-detection-fetching-frame', 'end');

            moduleLogger.timeLog('remote-execution-of-face-detection-transmission-computation', 'start');
            const response = await networkClient.sendDataViaNetSocket(
                process.env.SMARTCAMERA_CLOUD_SERVER, 
                8122, 
                frame
            );
            moduleLogger.durationLog('remote-execution-of-face-detection-computation', response.time);
            moduleLogger.timeLog('remote-execution-of-face-detection-transmission-computation', 'end');

            moduleLogger.timeLog('remote-execution-of-face-detection-total', 'end');
            eventName = 'FaceRecognitionEvent';
            eventType = ['unknown'];
        } 
        else if (module.name === 'SpeechRecognition') {
            console.log(`[CLOUD] ${module.name}: Sending to ${process.env.BUTLER_CLOUD_SERVER}:8124`);
            moduleLogger.timeLog('remote-execution-of-speech-recognition-total', 'start');

            moduleLogger.timeLog('remote-execution-of-speech-recognition-fetching-audio', 'start');
            const voiceAssistant = new VoiceAssistant('service');
            const audioCommand = await voiceAssistant.getLastVoiceCommandAudio();
            moduleLogger.timeLog('remote-execution-of-speech-recognition-fetching-audio', 'end');

            moduleLogger.timeLog('remote-execution-of-speech-recognition-transmission-computation', 'start');
            const response = await networkClient.sendAudioViaNetSocket(
                process.env.BUTLER_CLOUD_SERVER, 
                8124, 
                audioCommand
            );
            moduleLogger.durationLog('remote-execution-of-speech-recognition-computation', response.time);
            moduleLogger.timeLog('remote-execution-of-speech-recognition-transmission-computation', 'end');

            moduleLogger.timeLog('remote-execution-of-speech-recognition-total', 'end');
            eventName = 'SpeechRecognitionEvent';
            eventType = 'thermostat make it warmer';
        } 
        else {
            throw new Error(`Unknown module for remote execution: ${module.name}`);
        }

        const durations = moduleLogger.getDurations();
        return { eventName, type: eventType, durations };
    } catch (error) {
        console.error(`Remote execution error for ${module.name}:`, error);
        throw new Error(`Error in remote execution for module ${module.name}: ${error.message}`);
    }
}

/**
 * Main entry point - runs a module based on configuration
 * @param {Object} module - Module data with decisions
 * @param {Object} logger - Logger instance
 * @param {Object} config - Mode configuration from config.js
 * @returns {Promise} Resolves with event data
 */
async function runMaster(module, logger, config = {}) {
    // Default config for backward compatibility
    const effectiveConfig = {
        execution: config.execution || EXECUTION_STRATEGY.DECISION,
        resourceManagement: config.resourceManagement !== undefined ? config.resourceManagement : true,
        modeName: config.modeName || 'adapthub',
        ...config,
    };

    const executeRemote = shouldExecuteRemote(module, effectiveConfig);
    
    if (executeRemote) {
        return runRemote(module, logger);
    } else {
        return runLocal(module, logger, effectiveConfig);
    }
}

module.exports = { runMaster, runLocal, runRemote };
