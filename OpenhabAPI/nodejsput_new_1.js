var express = require("express");
const http = require('http');
var app = express();

function putrulestoopenhab(hostName,putpath,username,password,payloadFilepath){

app.listen(3000, function () {
//  var username = 'Sirris';
//  var password = 'Sirris2021';
  var auth = 'Basic ' + Buffer.from(username + ':' + password).toString('base64');
  //var request = require('request');
  fs1 = require('fs');
  let content1 = JSON.parse(fs1.readFileSync(payloadFilepath, 'utf8'));
  //'put-payload.json'
  const data = JSON.stringify(content1);

  //var hostName = hostname; //"localhost";
  //var pathpost = putpath; //"/rest/rules/87289fc299";


  const options = {
      hostname: hostName,
      path: putpath,
      port: 8080,
      method: 'PUT',
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
}//end function
module.exports = {putrulestoopenhab};
