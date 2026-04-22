const STT = require('stt');
const sox = require('sox-stream');
const MemoryStream = require('memory-stream');
const Duplex = require('stream').Duplex;
const http = require('node:http');

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

const hostname = '0.0.0.0';
const port = 3000;

const server = http.createServer((req, res) => {
	let body = [];
	let result = ''

	req.on('data', function (data) {
		body.push(data);
	});

	req.on('end', function () {
		// console.log(Buffer.concat(body));
		let audioStream = new MemoryStream();
		bufferToStream(Buffer.concat(body)).
		pipe(sox({
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
		})).
		pipe(audioStream);

		audioStream.on('finish', () => {
			let audioBuffer = audioStream.toBuffer();
			
			const audioLength = (audioBuffer.length / 2) * (1 / desiredSampleRate);
			console.log('audio length', audioLength);
			
			result = model.stt(audioBuffer);
			
			console.log('STT result:', result);
			res.statusCode = 200;
			res.setHeader('Content-Type', 'text/plain');
			res.end(result + '\n');
		});
	});
});

server.listen(port, hostname, () => {
  console.log(`CoquiSTT speech-to-text server running at http://${hostname}:${port}/`);
});