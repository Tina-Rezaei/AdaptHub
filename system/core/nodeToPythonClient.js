const net = require('net');
const { Buffer } = require("node:buffer");
const HEADER_SIZE = 4;

function sendDataToPython(params) {
    return new Promise((resolve, reject) => {
        const client = new net.Socket();

        client.connect(65432, '127.0.0.1', function() {
            console.log('Connected to Python server');
            const body = JSON.stringify(params);
            const header = Buffer.alloc(HEADER_SIZE);
            header.writeUint32LE(body.length)

            client.write(header);
            client.write(body);
        });

        client.on('data', function(data) {
            client.destroy(); // Close the connection after receiving the response
            resolve(JSON.parse(data)); // Resolve the promise with the received data
        });

        client.on('error', function(err) {
            console.log('Error: ' + err.message);
            reject(err); // Reject the promise if there is an error
        });

        client.on('close', function() {
            console.log('Connection closed');
        });
    });
}

module.exports = { sendDataToPython }
