// const fs = require('fs')

module.exports = class SpeechRecognition {
    constructor(device,eventEngine) {
        this.eventEngine = eventEngine;
        this.decoder = null;
    }

    async init() {
        // setup necessary libs (if any)
        const ssjs = await require("./imports/soundswallower")();
        // const ssjs = await require("./soundswallower")();
        // Load the library and pre-load the default model
        this.decoder = new ssjs.Decoder();
        // Initialization is asynchronous
        await this.decoder.initialize();
        const grammar = this.decoder.parse_jsgf(`
        #JSGF V1.0;
        /**
        * JSGF Grammar for Hello World example
        */
        grammar lamp_commands;
        public <command> = <key> <commands>;
        <key> = ( lights | music | fan | tv | door | thermostat );
        <commands> = ( <simple_commands> | <settable_commands_list>);
        <simple_commands> = ( on | off | hotter | colder | lock | unlock | warmer);
        <settable_command> = ( bright | color | channel );
        <settable_commands_list> = ( set <settable_command> (<numbers> | <colors>) | make it <simple_commands>);
        <numbers> = ( zero | one | two | three | four | five | six | seven | eight | nine | ten );
        <colors> = ( yellow | pink | red | blue );
          `);
    
        // Anything that changes decoder state is asynchronous
        await this.decoder.set_fsg(grammar);
        // We must manually release memory, because JavaScript
        // has no destructors, whose great idea was that?
        grammar.delete();
    }

    async run(cameraDevice, eventEngine) {
        // Default input is 16kHz, 32-bit floating-point PCM
        // try to record the following phrases using the following command:
        // sox -c 1 -r 44100 -b 32 -e floating-point -d smart.raw trim 0 3
        // "lights set color red"
        // "tv set channel five"
        // "door lock"
        // let pcm = fs.readFileSync(__dirname + "/resources/smart.raw"); 
        // let pcm = fs.readFileSync(__dirname + "/resources/make-it-warmer.raw"); 
        // console.log("Butler: started speech recognition");
        logger.log.info("ButlerLocal: started speech recognition");
        logger.timeLog("local-execution-butler-app-fetchingAudio", "start");
        let pcm = await VoiceAssistant.getLastVoiceCommandAudio();
        logger.timeLog("local-execution-butler-app-fetchingAudio", "end");
        // console.log(pcm);
        logger.timeLog("local-execution-butler-app-speechRecognition","start")
        // Start speech processing
        await this.decoder.start();
        // Takes a typed array, as returned by readFile
        await this.decoder.process(pcm);
        // Finalize speech processing
        await this.decoder.stop();
        // Get recognized text (NOTE: synchronous method)
        let hypothesis = await this.decoder.get_hyp();
        // console.log(hypothesis);
        // Again we must manually release memory
        // this.decoder.delete();
        logger.timeLog("local-execution-butler-app-speechRecognition","end")
//        this.eventEngine.addEvent('SpeechRecognitionEvent',hypothesis);
        return["SpeechRecognitionEvent", hypothesis]

        // this.eventEngine.addEvent('SpeechRecognitionEvent','light on');
        
    }
}