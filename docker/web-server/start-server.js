const http = require('http');

const hostname = '0.0.0.0';
const port = 4250;

const server = http.createServer((req, res) => {
    if (req.method == 'POST') {
        let dataObject = '';
        req.on('data', function (chunk) {
            dataObject += chunk;
        });
        req.on('end', function () {
            try {
                // dataObject = dataObject.concat();
                frameBase64 = JSON.parse(dataObject)['frame'];
                // console.log(frameBase64);
                // var post = JSON.parse(body);
            //   // deal_with_post_data(request,post);
            //   console.log(post); // <--- here I just output the parsed JSON
                res.statusCode = 200;
                res.setHeader('Content-Type', 'text/plain');
              res.end();
            } catch (err){
              res.writeHead(500, {"Content-Type": "text/plain"});
              res.write("Bad Post Data.  Is your data a proper JSON?\n");
              res.end();
            }
        });
    }
    // res.statusCode = 200;
    // res.setHeader('Content-Type', 'text/plain');
    // res.end('Hello World');
  });

server.listen(port, hostname, () => {
    console.log(`Server running at http://${hostname}:${port}/`);
  });
