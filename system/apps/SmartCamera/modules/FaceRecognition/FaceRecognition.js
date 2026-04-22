const tf = require('@tensorflow/tfjs-core'); // wasm backend requires tfjs to be loaded first
const wasm = require('@tensorflow/tfjs-backend-wasm'); // wasm backend does not get auto-loaded in nodejs
//const Human = require('./imports/human.node-wasm'); // use this when using human in dev mode
const Human = require('./node_modules/@vladmandic/human');
const {createCanvas, Image, loadImage} = require('canvas')
const path = require('path');


module.exports = class FaceRecognitionService {
  constructor(cameraDevice,eventEngine) {
    this.cameraDevice = cameraDevice;
    this.eventEngine = eventEngine;
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
    let knownFacesBufferBase64 = await kv.get('known-faces.json');
    let knownFacesBuffer =  Buffer.from(knownFacesBufferBase64, 'base64');
    this.knownFaces = JSON.parse(knownFacesBuffer);
    this.arr = this.knownFaces.map((rec) => rec.embedding);
    console.log('Human:', this.human.version, 'TF:', tf.version_core);
    await this.human.load();
//    console.log('Loaded:', this.human.models.loaded());
//    console.log('Memory state:', this.human.tf.engine().memory());
  }


  async detect(tensor) {
    const result = await this.human.detect(tensor, this.myConfig);
    this.human.tf.dispose(tensor);
    // console.log('Detected faces:', result.face.length);
    return result;
  }

//  async recognize(tensor) {
//    let res2 = await this.detect(tensor);
//    if (!res2 || !res2.face || res2.face.length === 0) {
//      throw new Error('Could not detect face descriptors');
//    }
//    // console.log(res2);
//    let people = [];
//    for (let face of res2.face) {
//      // console.log("HERE",face.embedding);
//      let res = await this.human.match.find(face.embedding, this.arr);
//      if (res.similarity > 0.5) people.push(this.knownFaces[res.index].name)
//      else people.push("unknown")
//    }
//    return people
//  }

  async recognize(tensor) {
  let res2 = await this.detect(tensor);
  if (!res2 || !res2.face || res2.face.length === 0) {
    console.warn('No faces detected in the input image.');
    return ["No faces detected"];
  }
  // Process recognized faces as usual
  let people = [];
  for (let face of res2.face) {
    let res = await this.human.match.find(face.embedding, this.arr);
    people.push(res.similarity > 0.5 ? this.knownFaces[res.index].name : "unknown");
  }
  return people;
}


  async run() {
    logger.timeLog("local-execution-smartcamera-app-fetchingCameraFrame", "start");
    let imageBuffer = await Camera.getFrame();
    logger.timeLog("local-execution-smartcamera-app-fetchingCameraFrame", "end");

    logger.timeLog("local-execution-smartcamera-app-faceRecognition", "start");
    const img = await loadImage(imageBuffer);
    const canvas = createCanvas(img.width, img.height);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0)
    const tensor = tf.browser.fromPixels(canvas);
    // console.log(tensor);
        
    let recognizedFaces = await this.recognize(tensor)
    logger.timeLog("local-execution-smartcamera-app-faceRecognition", "end");
//    this.eventEngine.addEvent('FaceRecognitionEvent',recognizedFaces);
//    console.log("here is the recognized faces")
//    console.log(recognizedFaces)
    return ['FaceRecognitionEvent',recognizedFaces]
  };


  async init() {
      // load the DNN models and additional files
      await this.loadModels();
  }
}