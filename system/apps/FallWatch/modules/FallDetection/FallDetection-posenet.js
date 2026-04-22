const tf = require('@tensorflow/tfjs-core');
const posenet = require('@tensorflow-models/posenet');
const {createCanvas, Image, loadImage} = require('canvas')
const tfjsWasm = require('@tensorflow/tfjs-backend-wasm');
// const tfnode = require('@tensorflow/tfjs-node');

module.exports = class FallDetection {
    constructor(device,eventEngine) {
        this.eventEngine = eventEngine;
        this.imageScaleFactor = 0.5;
        this.outputStride = 16;
        this.flipHorizontal = false;
        this.net = null;
    }

    async init() {
        tfjsWasm.setWasmPaths(__dirname + "/node_modules/@tensorflow/tfjs-backend-wasm/dist/");
        await tf.ready();
        this.net = await posenet.load({
            inputResolution: { width: 640, height: 480 },
            scale: 0.8,
        });
    }

    async run() {
        logger.timeLog("fallwatch-app-fetching-camera-frame", "start");
        let imageBuffer = await Camera.getFrame();
        logger.timeLog("fallwatch-app-fetching-camera-frame", "end");
        logger.timeLog("fallwatch-app-running-fall-detection", "start");
        // console.log(imageBuffer);
        // let imageTensor = tfnode.node.decodeImage(image)
        const img = await loadImage(imageBuffer);
        // img.src = '/home/zavalyshyn/Pictures/poncho-to-buy.png';
        const canvas = createCanvas(img.width, img.height);
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0)
        const input = tf.browser.fromPixels(canvas);
        const pose = await this.net.estimateSinglePose(input, this.imageScaleFactor, this.flipHorizontal, this.outputStride);
        // console.log(pose);
        // for(const keypoint of pose.keypoints) {
        //     console.log(`${keypoint.part}: (${keypoint.position.x},${keypoint.position.y})`);
        // }
        // compare positions of arms, legs and neck 
        // some thoughts on how to do this: https://towardsdatascience.com/fall-detection-using-pose-estimation-a8f7fd77081d
        logger.timeLog("fallwatch-app-running-fall-detection", "end");
//        this.eventEngine.addEvent('FallDetectionEvent',true);
    }
}




