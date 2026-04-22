const fs = require('fs');
const { readFileSync } = require('fs');
const tf = require('@tensorflow/tfjs-node');
const Human = require('@vladmandic/human');
const path = require('path'); // To handle file paths

module.exports = class FaceRecognitionService {
    constructor() {
        this.human = null;
        this.knownFaces = [];
        this.arr = []; // Array of known faces to be used for recognition
        this.myConfig = {
            modelBasePath: 'file://' + path.resolve(__dirname, 'node_modules/@vladmandic/human/models'),
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
        await tf.ready();
        this.human = new Human.Human(this.myConfig);
        let knownFacesBuffer = readFileSync('./known-faces.json');
        this.knownFaces = JSON.parse(knownFacesBuffer);
        this.arr = this.knownFaces.map((rec) => rec.embedding);
        await this.human.load(); // Load models
//        console.log('Human:', this.human.version, 'TF:', tf.version_core);
//        console.log('Loaded:', this.human.models.loaded());
//        console.log('Memory state:', this.human.tf.engine().memory());
    }

    async detect(tensor) {
        const result = await this.human.detect(tensor, this.myConfig);
        this.human.tf.dispose(tensor);
        console.log('Detected faces:', result.face.length);
        return result;
    }

    async recognize(tensor) {
        let res2 = await this.detect(tensor);
        if (!res2 || !res2.face || res2.face.length === 0) {
            throw new Error('Could not detect face descriptors');
        }
        let people = [];
        for (let face of res2.face) {
            let res = await this.human.match.find(face.embedding, this.arr);
            if (res.similarity > 0.5) people.push(this.knownFaces[res.index].name);
            else people.push("unknown");
        }
        return people;
    }

    async init() {
        // Load the DNN models and additional files
        await this.loadModels();
    }
};
