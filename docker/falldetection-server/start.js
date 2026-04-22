const net = require('node:net');
const tf = require('@tensorflow/tfjs-node'); // Import TensorFlow.js for Node.js
const poseDetection = require('@tensorflow-models/pose-detection');
const { setWasmPaths } = require('@tensorflow/tfjs-backend-wasm');
const path = require('path')

let detector;

async function setupPoseDetection() {
    try {
        // Set the path for the WASM backend
        setWasmPaths(path.join(__dirname, "node_modules/@tensorflow/tfjs-backend-wasm/dist/"));

        // Ensure TensorFlow.js is ready
        await tf.ready();

        // Load the MoveNet model configuration
        const modelJson = path.resolve(__dirname, './models/movenet/model.json');

        const detectorConfig = {
            modelType: poseDetection.movenet.modelType.SINGLEPOSE_LIGHTNING, // Choose the model type
            enableSmoothing: true,
            minPoseScore: 0.15,
            enableTracking: true,
            modelUrl: tf.io.fileSystem(modelJson),  // Using TensorFlow.js fileSystem API
        };

        // Create the pose detector
        detector = await poseDetection.createDetector(
            poseDetection.SupportedModels.MoveNet,
            detectorConfig
        );

        console.log('Pose detection model loaded successfully');
    } catch (error) {
        console.error('Error during pose detection setup:', error);
        throw new Error('Pose detection setup failed');
    }
}


async function processImage(buffer) {
    try {
        // Decode the image buffer into a tensor
        const tensor = tf.node.decodeImage(buffer, 3); // 3 for RGB channels

        // Run pose detection using the MoveNet model
        const poses = await detector.estimatePoses(tensor, {
            flipHorizontal: false, // Flip if needed for webcam images
        });

        console.log('Poses detected');

        // Dispose of the tensor to free memory
        tensor.dispose();

        return poses;
    } catch (error) {
        console.error('Failed to process image:', error);
        throw error;
    }
}


const server = net.createServer(async (socket) => {
    try {
        // Initialize pose detection on server startup
        await setupPoseDetection();

        let startTime = Date.now();
        let buffer = [];

        /**
         * Handles incoming data chunks from the client.
         */
        socket.on('data', (chunk) => {
            try {
                const finishFlag = chunk.includes(Buffer.from('done'));
                if (finishFlag) {
                    const lastChunk = chunk.subarray(0, chunk.length - 4); // 4 for 'done'
                    buffer.push(lastChunk);
                    const fullBuffer = Buffer.concat(buffer);

                    // Process the image buffer
                    processImage(fullBuffer)
                        .then((poses) => {
                            console.log("Client is done, image processed.");
                            let endTime = Date.now();
                            let duration = endTime - startTime;

                            // Send the duration and detected poses back to the client
                            socket.write(JSON.stringify({ time: duration, poses: poses }));
                            buffer = []; // Discard all data received
                            console.log("buffer got empty")
                            socket.end();
                        })
                        .catch((err) => {
                            let endTime = Date.now();
                            let duration = endTime - startTime;
                            console.error('Error processing image:', err);
                            socket.write(JSON.stringify({ time: duration, error: 'Image processing failed' }));
                            buffer = []; // Clear buffer to prevent potential memory leaks
                            socket.end();
                        });
                } else {
                    buffer.push(chunk);
                }
            } catch (err) {
                let endTime = Date.now();
                let duration = endTime - startTime;
                console.error('Error handling data chunk:', err);
                socket.write(JSON.stringify({ time: duration, error: 'Data handling failed' }));
                buffer = []; // Clear buffer
                socket.destroy(); // Forcefully close the connection
            }
        });

        /**
         * Handles the end of the client connection.
         */
        socket.on('end', () => {
            console.log('Client disconnected');
        });

        /**
         * Handles socket-level errors.
         */
        socket.on('error', (err) => {
            console.error('Socket error:', err);
            socket.destroy(); // Ensure the socket is closed on error
        });
    } catch (error) {
        console.error('Error during client setup:', error);
        socket.write(JSON.stringify({ error: 'Server setup failed' }));
        socket.destroy(); // Close the connection if setup fails
    }
});


server.on('error', (err) => {
    throw err;
});


server.listen(8126, async () => {
    console.log('Server listening on port 8126');
});
