const https = require('node:https');
const http = require('node:http');
const net = require('node:net');
const logger = require('../utils/logger');
const {WebSocket, createWebSocketStream} = require('ws');

module.exports = class NetworkClient {

    constructor(setup) {
        if (setup) {
            this.startTime = null;
            this.activityPeriod = setup['context']['period'];
            // if (period=='once') {
            //     switch (method) {
            //         case 'httpPost':
            //             this.httpPostUsed = false;
            //             break;
            //         case 'httpGet':
            //             this.httpGetUsed = false;
            //             break;
            //         case 'httpPut':
            //             this.httpPutUsed = false;
            //             break;
            //         case 'httpDelete':
            //             this.httpDeleteUsed = false;
            //             break;
            //         default:
            //             console.error('Wrong HttpClient method requested');
            //             break;
            //     }
            // }
            // process the case of min duration
        }
    }

    async httpGet(url) {
        if (this.startTime!=null) {
            const millisdiff = Date.now() - this.startTime;
            if (millisdiff>this.activityPeriod*1000) return;
        } else {
            this.startTime = Date.now();
        }
        let that = this;
        return new Promise((resolve) => {
            let data ='';
            https.get(url, res => {
    
                res.on('data', chunk => { data += chunk }) 
    
                res.on('end', () => {
                    that.httpGetUsed = true;
                    resolve(data,res.headers,res.statusCode);
                })
            })
        })
    }
    
    async httpPost(options,postData) {
        if (this.startTime!=null) {
            const millisdiff = Date.now() - this.startTime;
            if (millisdiff>this.activityPeriod*1000) return;
        } else {
            this.startTime = Date.now();
        }
        let that = this;
        return new Promise((resolve) => {
            let data ='';
            const req = http.request(options, (res) => {
    
                res.on('data', chunk => { data += chunk }) 
    
                res.on('end', () => {
                    that.httpPostUsed = true;
                    resolve(data,res.headers,res.statusCode);
                })
            });
            req.on('error', (e) => {
                console.error("Post error:",e);
              });
            req.write(postData);
            req.end();
        })
    }
    
    async httpPut(options,postData) {
        if (this.startTime!=null) {
            const millisdiff = Date.now() - this.startTime;
            if (millisdiff>this.activityPeriod*1000) return;
        } else {
            this.startTime = Date.now();
        }
        let that = this;
        return new Promise((resolve) => {
            let data ='';
            const req = https.request(options, (res) => {
    
                res.on('data', chunk => { data += chunk }) 
    
                res.on('end', () => {
                    that.httpPutUsed = true;
                    resolve(data,res.headers,res.statusCode);
                })
            });
            req.on('error', (e) => {
                console.error("Post error:",e);
              });
            req.write(postData);
            req.end();
        })
    }
    
    async httpDelete(options) {
        if (this.startTime!=null) {
            const millisdiff = Date.now() - this.startTime;
            if (millisdiff>this.activityPeriod*1000) return;
        } else {
            this.startTime = Date.now();
        }
        let that = this;
        return new Promise((resolve) => {
            let data ='';
            const req = https.request(options, (res) => {
    
                res.on('data', chunk => { data += chunk }) 
    
                res.on('end', () => {
                    that.httpDeleteUsed = true;
                    resolve(data,res.headers,res.statusCode);
                })
            });
            req.on('error', (e) => {
                console.error("Post error:",e);
              });
            req.end();
        })
    }

    async createWebSocketStream(address,encoding) {
        let ws = new WebSocket(address);
        let wsStream = createWebSocketStream(ws, { encoding: encoding }); // use ut8 encoding
        return wsStream;
    }

    async sendDataViaNetSocket(host,port, dataBuffer) {

        return new Promise((resolve,reject) => {
    
            const client = net.createConnection({ port: port , host: host}, () => {

                // 'connect' listener.
                // console.log('connected to server!');
                client.write(dataBuffer, () => {
                    finishedWritingData();
                });
            });
            let responseParsed = '';
            client.on('data', (data) => {
                responseParsed+=data.toString()
                // console.log("Received this response:", response);

            });
            client.on('end', () => {
//                client.end();
                resolve(JSON.parse(responseParsed))
            });
            
            function finishedWritingData() {
                // console.log("Client finished writing file data");
                client.write('done');
            }
        })
    }

    async sendAudioViaNetSocket(host, port, bufferData) {

        return new Promise((resolve,reject) => {

            let client = net.createConnection({ port: port , host: host}, () => {
                // 'connect' listener.
                // console.log('connected to server!');
                client.write(bufferData, () => {
                    finishedWritingData();
                });
              });
              
          client.on('data', (data) => {

                processIncomingData(data);
                // console.log(data.toString());
                // client.end();
          });

          client.on('end', () => {
          //   client.write('done');
          });

          function finishedWritingData() {
              client.write('done'); // important! to finish the end of the data stream to the server
          }


          function processIncomingData(data) {
              let response = data.toString();
              //   console.log("Received this response:", response);
              client.end();
              resolve(JSON.parse(response))
          }

          client.on('error', (err) => {
                console.error(`Socket error: ${err.message}`);
                reject(err);
            });

        })
    }


}


// async function testGet() {
//     const response =  await get('https://www.google.com');
//     console.log(response);
// }

// async function testPost() {

//     const postData = JSON.stringify({
//         'msg': 'Hello World!'
//       });
      
//     const options = {
//         hostname: 'www.google.com',
//         port: 443,
//         path: '/upload',
//         method: 'POST',
//         headers: {
//             'Content-Type': 'application/json',
//             'Content-Length': Buffer.byteLength(postData)
//         }
//     };
//     const response =  await post(options,postData);
//     console.log(response);
// }

