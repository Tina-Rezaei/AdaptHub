const Sox = require('sox-stream');
const MemoryStream = require('memory-stream');
const Duplex = require('stream').Duplex;
const Wav = require('node-wav');
const fs = require('fs');


let audiofile = fs.readFileSync('./smart.raw');

var src = fs.createReadStream('./smart.raw')
var transcode = Sox({
    input: {
        bits: 32,
        rate: 44100,
        channels: 1,
        type: 'raw',
        e: 'floating-point'
    },
    output: {
        bits: 16,
        rate: 16000,
        channels: 1,
        type: 'wav'
    }
})
var dest = fs.createWriteStream('song.wav')
src.pipe(transcode).pipe(dest)
 
transcode.on('error', function (err) {
    console.log('oh no! ' + err.message)
})