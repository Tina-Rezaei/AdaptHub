const tf = require('@tensorflow/tfjs-core'); // wasm backend requires tfjs to be loaded first
const wasm = require('@tensorflow/tfjs-backend-wasm'); // wasm backend does not get auto-loaded in nodejs
const Human = require('./node_modules/@vladmandic/human');
const {createCanvas, Image, loadImage} = require('canvas')
const Camera = require('../../../../device-proxies/Camera');
const VoiceAssistant = require('../../../../device-proxies/VoiceAssistant');
const KVStore = require('../../../../core/KVStore');
const path = require('path');
const Logger = require('../../../../utils/logger');
const { NodeVM, VMScript } = require('vm2');
const fs = require('fs');



class FaceRecognitionService {
  constructor() {
    this.kv = new KVStore()
    this.human = null;
    this.knownFaces = []
    this.arr = [] // array of known faces to be used for recognition. Stripped knownFaces version
        this.myConfig = {
//        modelBasePath: path.join(__dirname, '/node_modules/@vladmandic/human-models/models/'), // Local path to models
//        modelBasePath: `file://${path.resolve(__dirname, 'node_modules/@vladmandic/human-models/models/').replace(/\\/g, '/')}`,
        modelBasePath: `file://${path.resolve(__dirname, 'node_modules/@vladmandic/human-models/models')}/`, // Ensure trailing slash
        cacheModels: false,
        debug: false,  // important
//      backend: 'wasm',
      backend: 'tensorflow',
      face: {
        description: { enabled: true },
        emotion: { enabled: false },
        iris: { enabled: false }
      },
      body: { enabled: false },
      hand: { enabled: false },
      gesture: { enabled: false },
    };
  }

  async loadModels() {
    wasm.setWasmPaths(__dirname + "/node_modules/@tensorflow/tfjs-backend-wasm/dist/");
    await tf.ready();
    this.human = new Human.Human(this.myConfig);
    let knownFacesBufferBase64 = await this.kv.get('known-faces.json');
    let knownFacesBuffer =  Buffer.from(knownFacesBufferBase64, 'base64');
    this.knownFaces = JSON.parse(knownFacesBuffer);
    this.arr = this.knownFaces.map((rec) => rec.embedding);
    console.log('Human:', this.human.version, 'TF:', tf.version_core);
    await this.human.load();
    console.log('Loaded:', this.human.models.loaded());
    console.log('Memory state:', this.human.tf.engine().memory());
  }

  async detect(tensor) {
    const result = await this.human.detect(tensor, this.myConfig);
    this.human.tf.dispose(tensor);
    // console.log('Detected faces:', result.face.length);
    return result;
  }

  async recognize(tensor) {
    let res2 = await this.detect(tensor);
    if (!res2 || !res2.face || res2.face.length === 0) {
      throw new Error('Could not detect face descriptors');
    }
    // console.log(res2);
    let people = [];
    for (let face of res2.face) {
      // console.log("HERE",face.embedding);
      let res = await this.human.match.find(face.embedding, this.arr);
      if (res.similarity > 0.5) people.push(this.knownFaces[res.index].name)
      else people.push("unknown")
    }
    return people
  }

  async run() {
    let camera = new Camera()
    let imageBuffer = await camera.getFrame();
    const img = await loadImage(imageBuffer);
    const canvas = createCanvas(img.width, img.height);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0)
    const tensor = tf.browser.fromPixels(canvas);
    // console.log(tensor);

    let recognizedFaces = await this.recognize(tensor)
//    this.eventEngine.addEvent('FaceRecognitionEvent',recognizedFaces);
    console.log(recognizedFaces)
    return
  };


  async init() {
      // load the DNN models and additional files
      await this.loadModels();
  }
}


(async () => {

 moduleDir = "/home/tina/hubos-dev/system/apps/SmartCamera/modules/FaceRecognition"
    moduleName = "FaceRecognition"
    const logger = new Logger(1);

    let kvStore = new KVStore();
    let vm = new NodeVM({
        wasm: true,
        eval: false,
        console: 'inherit',
        sandbox: {
            kv: kvStore,
            logger: logger,
            Camera: new Camera("service"),
        },
        require: {
            root: [moduleDir],
            external: true,
            builtin: ['path'],
        }
    });
//    let model = new FaceRecognitionService();
//    await model.init()
//    await model.run()

    let file = path.join(moduleDir, `${moduleName}.js`);
    let moduleScript = new VMScript(fs.readFileSync(file), file);
    let moduleHandler = vm.run(moduleScript, file);
    let moduleRuntime = new moduleHandler(null);
    await moduleRuntime.init();
    const [eventName, type] = await moduleRuntime.run();
    process.exit()
    }
)();
