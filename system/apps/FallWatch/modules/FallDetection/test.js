const tf = require('@tensorflow/tfjs-core');
const posenet = require('@tensorflow-models/posenet');
const {createCanvas, Image} = require('canvas')
const imageScaleFactor = 0.5;
const outputStride = 16;
const flipHorizontal = false;

const tfjsWasm = require('@tensorflow/tfjs-backend-wasm');

tfjsWasm.setWasmPaths("node_modules/@tensorflow/tfjs-backend-wasm/dist/");

tf.ready().then(() => main());


const main = async() => {
    console.log('start');
    const net = await posenet.load({
       inputResolution: { width: 640, height: 480 },
       scale: 0.8,
     });
    const img = new Image();
    // img.src = '/home/zavalyshyn/Pictures/poncho-to-buy.png';
    img.src = '/home/zavalyshyn/Pictures/man-on-a-floor.jpeg';
    const canvas = createCanvas(img.width, img.height);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0);
    const input = tf.browser.fromPixels(canvas);
    const pose = await net.estimateSinglePose(input, imageScaleFactor, flipHorizontal, outputStride);
    // console.log(pose);
    for(const keypoint of pose.keypoints) {
        console.log(`${keypoint.part}: (${keypoint.position.x},${keypoint.position.y})`);
    }
    console.log('end');
}



// main();

