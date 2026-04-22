const fs = require('fs');
const path = require('path');
const { NodeVM, VMScript } = require('vm2');
const KVStore = require('./KVStore');
//const Camera = require('../device-proxies/Camera');
const Light = require('../device-proxies/Light');
const Thermostat = require('../device-proxies/Thermostat');
const VoiceAssistant = require('../device-proxies/VoiceAssistant');
const Logger = require('../utils/logger');
const { manageCgroup, sum } = require('./cgroupManager')
const NetworkClient = require("./NetworkClient")
const Camera = require('../device-proxies/Camera');

const networkClient = new NetworkClient();
process.on('message', async (message) => {

    const childlogger = new Logger(module.appID);
    const moduleData  = message.moduleData;
    const data = moduleData.decisions
    const pid = process.pid
    let eventName;
    let eventType;

    try {

//      send data to the remote server
        if (moduleData.name == "FallDetection"){
//            childlogger.log.info("FallWatch: Trying to forward stream from a living room camera to the fall detection server.");
            childlogger.timeLog("remote-execution-of-fall-detection-total","start")

            childlogger.timeLog("remote-execution-of-fall-detection-fetching-frame","start")
            let Doorcam = new Camera()
            let frame = await Doorcam.getFrame();
            childlogger.timeLog("remote-execution-of-fall-detection-fetching-frame","end")

            childlogger.timeLog("remote-execution-of-fall-detection-transmission-computation","start")
            let response = await networkClient.sendDataViaNetSocket(process.env.FALLDETECTION_CLOUD_SERVER, 8126, frame)

            childlogger.durationLog("remote-execution-of-fall-detection-computation", response.time)

            childlogger.timeLog("remote-execution-of-fall-detection-transmission-computation","end")

            childlogger.timeLog("remote-execution-of-fall-detection-total","end")
            eventName = "FallDetectionEvent"
            eventType = true
        }
        if (moduleData.name == "FaceRecognition"){
            childlogger.timeLog("remote-execution-of-face-detection-total","start")

            childlogger.timeLog("remote-execution-of-face-detection-fetching-frame","start")
            let Doorcam = new Camera()
            let frame = await Doorcam.getFrame();
            childlogger.timeLog("remote-execution-of-face-detection-fetching-frame","end")

            childlogger.timeLog("remote-execution-of-face-detection-transmission-computation","start")
            let response = await networkClient.sendDataViaNetSocket(process.env.SMARTCAMERA_CLOUD_SERVER, 8122, frame)

            childlogger.durationLog("remote-execution-of-face-detection-computation", response.time)
            childlogger.timeLog("remote-execution-of-face-detection-transmission-computation","end")

            childlogger.timeLog("remote-execution-of-face-detection-total","end")
            eventName = "FaceRecognitionEvent"
            eventType = ['unknown']
        }

        if (moduleData.name == "SpeechRecognition"){
            childlogger.timeLog("remote-execution-of-speech-recognition-total","start")

            childlogger.timeLog("remote-execution-of-speech-recognition-fetching-audio","start")
            let voiceAssistant =  new VoiceAssistant("service")
            let originalVoiceCommand = await voiceAssistant.getLastVoiceCommandAudio();
            childlogger.timeLog("remote-execution-of-speech-recognition-fetching-audio","end")

            childlogger.timeLog("remote-execution-of-speech-recognition-transmission-computation","start")
            let response = await networkClient.sendAudioViaNetSocket(process.env.BUTLER_CLOUD_SERVER, 8124, originalVoiceCommand);
            childlogger.durationLog("remote-execution-of-speech-recognition-computation", response.time)
            childlogger.timeLog("remote-execution-of-speech-recognition-transmission-computation","end")

            childlogger.timeLog("remote-execution-of-speech-recognition-total","end")
            eventName = "SpeechRecognitionEvent"
            eventType = "thermostat make it warmer"
        }



//      get log and send it to parent
//        const [currentRoundLogStarters, currentRoundLogEnders] = childlogger.reportLoggedTimes()
        const durations = childlogger.getDurations();

        process.send({ eventName, type:eventType, durations, pid });
    } catch (error) {
        console.log("error raised in remote")
        process.send({ error: error.message + moduleData.name });

    } finally {
//        await manageCgroup('remove', cgroupName, { cgroupName }); // Clean up the cgroup
        process.exit(0); // Ensure the process exits after completion
    }
});
