const tf = require('@tensorflow/tfjs-node');
const poseDetection = require('@tensorflow-models/pose-detection');
const {createCanvas, Image, loadImage} = require('canvas')
//const tfjsWasm = require('@tensorflow/tfjs-backend-wasm');
const { setWasmPaths } = require('@tensorflow/tfjs-backend-wasm');
// const tfnode = require('@tensorflow/tfjs-node');
const path = require('path')

module.exports = class FallDetection {
    constructor(device) {
    }

    async init() {
//        tfjsWasm.setWasmPaths(__dirname + "/node_modules/@tensorflow/tfjs-backend-wasm/dist/");

        // Set up the path for WASM files
        setWasmPaths(path.join(__dirname, "node_modules/@tensorflow/tfjs-backend-wasm/dist/"));

        // Initialize TensorFlow.js
        await tf.ready();

        // Load the model manually from the file system
        const modelJson = path.resolve(__dirname, './models/movenet/model.json');
        const detectorConfig = {
            modelType: poseDetection.movenet.modelType.SINGLEPOSE_LIGHTNING,
            modelUrl: tf.io.fileSystem(modelJson),  // Using TensorFlow.js fileSystem API };
        }
        try {
            this.detector = await poseDetection.createDetector(poseDetection.SupportedModels.MoveNet, detectorConfig);
        } catch (error) {
            console.error("Failed to initialize detector:", error);
            throw new Error(`Detector initialization error: ${error.message}`);
        }
    }



    async run() {
        logger.timeLog("local-execution-fallwatch-app-fetchingCameraFrame", "start");
        let imageBuffer = await Camera.getFrame();

        logger.timeLog("local-execution-fallwatch-app-fetchingCameraFrame", "end");
        logger.timeLog("local-execution-fallwatch-app-running-fallDetection", "start");
        // console.log(imageBuffer);
        // let imageTensor = tfnode.node.decodeImage(image)

        const img = await loadImage(imageBuffer);

        // img.src = '/home/zavalyshyn/Pictures/poncho-to-buy.png';
        const canvas = createCanvas(img.width, img.height);
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0)
        const input = tf.browser.fromPixels(canvas);

        const poses = await this.detector.estimatePoses(input);

        // console.log(pose);
        // for(const keypoint of poses[0].keypoints) {
        //     console.log(`${keypoint.name}: (${keypoint.x},${keypoint.y}), score: ${keypoint.score}`);
        // }
        // compare positions of arms, legs and neck 
        // some thoughts on how to do this: https://towardsdatascience.com/fall-detection-using-pose-estimation-a8f7fd77081d
        logger.timeLog("local-execution-fallwatch-app-running-fallDetection", "end");


//            this.performCalculations();
            // Wait for 10 seconds and then stop the calculations
//        await new Promise(resolve => setTimeout(resolve, 10000));
//        this.broke = false;
        return ["FallDetectionEvent", true];
    }
}




