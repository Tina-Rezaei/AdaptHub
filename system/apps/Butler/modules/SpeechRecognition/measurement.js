const VoiceAssistant = require('../../../../device-proxies/VoiceAssistant');
const Thermostat = require('../../../../device-proxies/Thermostat');
const KVStore = require('../../../../core/KVStore');
const Logger = require('../../../../utils/logger');
const { NodeVM, VMScript } = require('vm2');
const fs = require('fs');
const path = require('path')


class SpeechRecognition {
    constructor(device) {
        this.decoder = null;
    }


    async init() {
        const ssjs = await require("./imports/soundswallower")();
        this.decoder = new ssjs.Decoder();
        await this.decoder.initialize();
        const grammar = this.decoder.parse_jsgf(`
        #JSGF V1.0;
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
        await this.decoder.set_fsg(grammar);
        grammar.delete();
    }

    async run() {
        let voiceAssistant = new VoiceAssistant();
        let pcm = await voiceAssistant.getLastVoiceCommandAudio();
        await this.decoder.start();
        await this.decoder.process(pcm);
        await this.decoder.stop();
        let hypothesis = await this.decoder.get_hyp();
        return hypothesis;
    }
}

(async () => {
    moduleDir = "/home/tina/hubos-dev/system/apps/Butler/modules/SpeechRecognition"
    moduleName = "SpeechRecognition"
    const logger = new Logger(1);

    let kvStore = new KVStore();
    let vm = new NodeVM({
        wasm: true,
        eval: false,
        console: 'inherit',
        sandbox: {
            kv: kvStore,
            logger: logger,
            Thermostat: new Thermostat("service") ,
            VoiceAssistant: new VoiceAssistant("service"),
        },
        require: {
            root: [moduleDir],
            external: true,
            builtin: ['path'],
        }
    });

    let file = path.join(moduleDir, `${moduleName}.js`);
    let moduleScript = new VMScript(fs.readFileSync(file), file);
    let moduleHandler = vm.run(moduleScript, file);
    let moduleRuntime = new moduleHandler(null);
    await moduleRuntime.init();
    const [eventName, type] = await moduleRuntime.run();


//    const model = new SpeechRecognition();
//    await model.init(); // Await the initialization before running
//    const result = await model.run(); // Wait for the run method to complete
    console.log(type); // Log the result
    process.exit()
})();
