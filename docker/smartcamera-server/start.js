const net = require('node:net');
const tf = require('@tensorflow/tfjs-node'); // Ensure TensorFlow.js is installed
const FaceRecognitionService = require('./FaceRecognitionService'); // Assuming this is the class name
const path = require('path'); // For resolving model paths
const {createCanvas, Image, loadImage} = require('canvas')



async function processImage(buffer, faceRecognitionService) {
    try {
        console.log("Processing image at the server...");

        // Decode the image buffer into a tensor
//        const tensor = tf.node.decodeImage(buffer, 3);
        const tensor = tf.browser.fromPixels(buffer);


        // Use the face recognition service to detect and recognize faces
        const recognizedFaces = await faceRecognitionService.recognize(tensor);
        console.log('Recognized faces:', recognizedFaces);

        // Dispose tensor to free memory
        tensor.dispose();
    } catch (error) {
        console.error('Failed to process image:', error);
        throw error;
    }
}



const server = net.createServer((socket) => {
    try {
    // Initialize the face recognition service
    const faceRecognitionService = new FaceRecognitionService();
    faceRecognitionService.init().then(() => {
        console.log("FaceRecognition Service initialized successfully");
    }).catch(err => {
        console.error("Failed to initialize FaceRecognitionService:", err);
    });
    let startTime = new Date().getTime()
    let buffer = [];

    socket.on('data', async(chunk) => {
        try {
            const finishFlag = chunk.includes(Buffer.from('done'));
            if (finishFlag) {
                const lastChunk = chunk.subarray(0, chunk.length - 4); // 4 for 'done'
                buffer.push(lastChunk);
                const fullBuffer = Buffer.concat(buffer);

                const img = await loadImage(fullBuffer);
                const canvas = createCanvas(img.width, img.height);
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0)
                const tensor = tf.browser.fromPixels(canvas);

                // Process the image buffer
                processImage(canvas, faceRecognitionService).then(() => {
                    console.log("Client is done, image processed.");
                    let endTime = new Date().getTime()
                    let duration = endTime - startTime
                    socket.write(JSON.stringify({time:duration}));
                    buffer = []; // Discard all data received
                    socket.end();
                }).catch((err) => {
                    console.error('Error processing image:', err);
                    socket.write('error');
                    socket.end();
                });
            } else {
                buffer.push(chunk);
            }

        }catch{
            console.error('Error handling data chunk:', err);
                socket.write(JSON.stringify({ error: 'Data handling failed' }));
                buffer = []; // clear buffer
                socket.destroy(); // close the connection
        }
    });

    socket.on('end', () => {
        console.log('Client disconnected');
    });

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

server.listen(8122, () => {
    console.log('Server listening on port 8122');
});



// second service: for alarming user of an unknown recognized face at front door
const server2 = net.createServer((socket) => {
    let startTime = new Date().getTime()
    let buffer = [];
    socket.on('data', (chunk) => {
        const finishFlag = chunk.includes(Buffer.from('done'));
        if (finishFlag) {
            const lastChunk = chunk.subarray(0, chunk.length - 4); // 4 for 'done'
            buffer.push(lastChunk);
            const fullBuffer = Buffer.concat(buffer);
            let endTime = new Date().getTime()
            let duration = endTime - startTime
            socket.write(JSON.stringify({time:duration}));
        } else {
        buffer.push(chunk);
        }
    })
    socket.on('end', () => {
        console.log('Client disconnected from Echo Service');
    });
});

server2.on('error', (err) => {
    console.error('Connection error:', err);
    throw err;
});

server2.listen(8133, () => {
    console.log('Echo Service listening on port 8133');
});