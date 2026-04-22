const tf = require('@tensorflow/tfjs-node');
const Camera = require('../../../../device-proxies/Camera');
const poseDetection = require('@tensorflow-models/pose-detection');
const {createCanvas, Image, loadImage} = require('canvas')
//const tfjsWasm = require('@tensorflow/tfjs-backend-wasm');
const { setWasmPaths } = require('@tensorflow/tfjs-backend-wasm');
// const tfnode = require('@tensorflow/tfjs-node');
const path = require('path')
const KVStore = require('../../../../core/KVStore');
const { NodeVM, VMScript } = require('vm2');
const fs = require('fs');
const Logger = require('../../../../utils/logger');




class FallDetection {
    constructor(device) {
    }

    async init() {
        console.log("Initializing FallDetection...");
        setWasmPaths(path.join(__dirname, "node_modules/@tensorflow/tfjs-backend-wasm/dist/"));

        await tf.ready();
        console.log("TensorFlow.js is ready.");

        const modelJson = path.resolve(__dirname, './models/movenet/model.json');
        console.log("Model path:", modelJson);

        const detectorConfig = {
            modelType: poseDetection.movenet.modelType.SINGLEPOSE_LIGHTNING,
            modelUrl: tf.io.fileSystem(modelJson),
        };

        try {
            console.log("Creating detector...");
            this.detector = await poseDetection.createDetector(poseDetection.SupportedModels.MoveNet, detectorConfig);
            console.log("Detector created successfully.");
        } catch (error) {
            console.error("Failed to initialize detector:", error);
            throw new Error(`Detector initialization error: ${error.message}`);
        }
    }


    async run() {
        console.log("Starting run method...");
        let camera = new Camera();

        try {
            console.log("Fetching image from camera...");
            let imageBuffer = await camera.getFrame();
            console.log("Image fetched successfully.");

            const img = await loadImage(imageBuffer);
            console.log("Image loaded successfully into canvas.");

            const canvas = createCanvas(img.width, img.height);
            const ctx = canvas.getContext('2d');
            console.log("Canvas context obtained.");

            ctx.drawImage(img, 0, 0);
            console.log("Image drawn on canvas.");

            const input = tf.browser.fromPixels(canvas);
            console.log("Tensor created from canvas pixels.");

            const poses = await this.detector.estimatePoses(input);
            console.log("Poses estimated:", poses);

            return "1";
        } catch (error) {
            console.error("Error in run method:", error);
            throw error;
        }
    }

}


async function load() {
    try {
        moduleDir = "/home/tina/hubos-dev/system/apps/FallWatch/modules/FallDetection";
        moduleName = "FallDetection";
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

        let file = path.join(moduleDir, `${moduleName}.js`);
        let moduleScript = new VMScript(fs.readFileSync(file), file);
        let moduleHandler = vm.run(moduleScript, file);
        let moduleRuntime = new moduleHandler(null);

        await moduleRuntime.init();
        console.log("Run method started...");
        poses = await moduleRuntime.run();
        console.log(poses)
        process.exit()
    } catch (error) {
        console.error("Error in load function:", error);
    }
}

load();
