
var express = require("express");
const http = require('http');
var app = express();

function postrulestoopenhab(hostname,postpath,username,password,payloadFilepath){


// original 3000
app.listen(3001, function () {
  //var username = username1;//'Sirris';
  //var password = password1; //'Sirris2021';
  var auth = 'Basic ' + Buffer.from(username + ':' + password).toString('base64');
  //var request = require('request');
  fs1 = require('fs');
  let content1 = JSON.parse(fs1.readFileSync(payloadFilepath, 'utf8'));
  // 'post-payload.json'
  const data = JSON.stringify(content1);

  var hostName = hostname; //"localhost";
  var pathpost = postpath; //"/rest/rules";


  const options = {
      hostname: hostName,
      path: pathpost,
      port: 8080,
      method: 'POST',
      headers: {
          'Content-Type': 'application/json',
          'Authorization': auth,
          'Content-Length': Buffer.byteLength(data)
      }
  };

  const req = http.request(options, (res) => {
    console.log(`statusCode: ${res.statusCode}`)
    res.on('data', (chunk) => {
      console.log(`BODY: ${chunk}`);
    });
    res.on('end', () => {
      console.log('No more data in response.');
    });
  });

  req.on('error', (error) => {
    console.log('error is ' + error);
  });

  req.write(data);
  req.end();
});
} // end function

module.exports = {postrulestoopenhab};
