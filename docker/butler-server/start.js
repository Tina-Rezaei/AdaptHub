const STT = require('stt');
const sox = require('sox-stream');
const MemoryStream = require('memory-stream');
const Duplex = require('stream').Duplex;
const net = require('net');

let modelPath = './models/model.tflite';
let model = new STT.Model(modelPath);
let desiredSampleRate = model.sampleRate();
let scorerPath = './models/coqui-stt-0.9.3-models.scorer';
model.enableExternalScorer(scorerPath);

function bufferToStream(buffer) {
	let stream = new Duplex();
	stream.push(buffer);
	stream.push(null);
	return stream;
}

const server = net.createServer((socket) => {
    let startTime = new Date().getTime()
    let buffer = [];
    let result = '';

    socket.on('data', (chunk) => {
        const finishFlag = chunk.includes(Buffer.from('done'));

        if (finishFlag) {
            const lastChunk = chunk.subarray(0, chunk.length - 4); // 4 for 4 letters in 'done'
            buffer.push(lastChunk);
            console.log("Client is done");
            processReceivedData();
        } else {
            buffer.push(chunk);
        }
    });

    socket.on('end', () => {
        console.log('client disconnected');
    });

    socket.on('error', (err) => {
        console.error('Socket error:', err);
    });

    async function processReceivedData() {
        try {
            console.log("Server finished writing response.");
            let audioStream = new MemoryStream();
            bufferToStream(Buffer.concat(buffer))
                .pipe(sox({
                    global: {
                        'no-dither': true,
                    },
                    input: {
                        bits: 32,
                        rate: 44100,
                        channels: 1,
                        type: 'raw',
                        e: 'floating-point'
                    },
                    output: {
                        bits: 16,
                        rate: desiredSampleRate,
                        channels: 1,
                        encoding: 'signed-integer',
                        endian: 'little',
                        compression: 0.0,
                        type: 'raw'
                    }
                }))
                .pipe(audioStream);

            audioStream.on('error', (err) => {
                console.error('Audio stream error:', err);
                socket.end();
            });

            audioStream.on('finish', async () => {
                try {
                    let audioBuffer = audioStream.toBuffer();
                    result = await model.stt(audioBuffer);
                    console.log('STT result:', result);
                    let endTime = new Date().getTime();
                    let duration = endTime - startTime
                    socket.write(JSON.stringify({result, time:duration}));
                    socket.end();
                } catch (err) {
                    console.error('STT processing error:', err);
                    socket.end();
                }
            });
        } catch (err) {
            console.error('Processing received data error:', err);
            socket.end();
        } finally {
            // Free up resources for other connections
            buffer = [];
            result = '';
        }
    }
});

server.on('error', (err) => {
    console.error('Server error:', err);
});

server.listen(8124, '0.0.0.0',() => {
    console.log('opened server on', server.address());
});
