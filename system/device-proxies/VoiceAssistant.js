const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');
// const fr = require('../utils/file-reader');

module.exports = class VoiceAssistant {

    constructor(context = {"access": "VoiceAssistant","context":{"period": "5"}}) { // default context value if not provided
        if (context == "service") {
            this.context = context;
        } else {
            this.voiceAssistantName = context['access'];
            this.activityPeriod = context['context']['period'];
            this.startTime = null;
        }
        // this.lastVoiceCommandAudio = fr.getAudioSample();
        this.lastVoiceCommand = null;
    }

    async getLastVoiceCommandAudio() {
        if (this.context !== "service") {
            if (this.startTime!=null) {
                const millisdiff = Date.now() - this.startTime;
                if (millisdiff>this.activityPeriod*1000) return;
            } else {
                this.startTime = Date.now();
            }
        }
        // let audioFilePath = path.join(__dirname,'../smart.raw');
        let audioFilePath = path.join(__dirname,'../resources/make-it-warmer.raw');
        let audioFile = fs.readFileSync(audioFilePath);
        // logger.timeLog("voice-assistant-audio-sending","start")
        // this.lastVoiceCommandAudio = audioFile;
        return audioFile;
        // return this.lastVoiceCommandAudio;

    }


    async say(text) {
        if (this.context !== "service") {
            if (this.startTime!=null) {
                const millisdiff = Date.now() - this.startTime;
                if (millisdiff>this.activityPeriod*1000) return;
            } else {
                this.startTime = Date.now();
            }
        }
        // pass a text to a TTS engine
    }

}