const net = require('node:net');

const server = net.createServer((socket) => {
    
    // socket.on('connect', () => {
        console.log("Client connected");
    // })
    socket.on('data', () => {
        // console.log(data);
    })
    socket.on('end', () => {
        console.log("Client disconnected");
        socket.write('received!\n');
        socket.end();
        // socket.destroy();
        // socket.end();
    })
    socket.on('error', (err) => {
        // Handle errors here.
        throw err;
    });
})

  
  // Grab an arbitrary unused port.
  server.listen({port: 43963, host: '0.0.0.0'}, () => {
    console.log('opened server on', server.address());
  })