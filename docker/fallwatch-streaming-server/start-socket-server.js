const { WebSocketServer } = require('ws');
const {createCanvas, Image, loadImage} = require('canvas')


const createWebSocketServer = () => {
    const wss = new WebSocketServer({ host: '0.0.0.0', port: 8123, maxPayload: 1024 * 1024 });

    wss.on('connection', function connection(ws) {
      console.log("New connection!");

      // Move buffer inside the connection handler
      let buffer = [];

        ws.on('message', function message(data) {
            // Check if the data contains an end-of-stream marker
            // Assuming end-of-stream marker is 'END' (change this to suit your needs)
//            console.log(data)
            if (data.toString() === 'END') {
                console.log('End of stream');
                // Process the buffered data
                //processStreamData(buffer);
                // Clear the buffer
                buffer = [];
                // Optionally close the connection from the server side
                ws.close();
            } else {
                // Add received data to this connection's buffer
                buffer.push(data);
//                console.log("Buffer length:", data.length);
            }
        });

      ws.on('close', () => {
        // Clear the buffer when the connection closes
        buffer = [];
      });

      // ws.send('something');
    });

    wss.on('error', (err) => {
      console.error('WebSocket server error:', err);
    });

    console.log('server listening on //0.0.0.0:8123');
};

createWebSocketServer();