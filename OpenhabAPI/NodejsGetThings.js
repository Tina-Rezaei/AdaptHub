
var username = "Sirris";
var password = "Sirris2021";
//var auth = "Basic " + new Buffer(username + ":" + password).toString("base64");
var auth = "Basic " + Buffer(username + ":" + password).toString("base64");
var request = require('request');
var url = "http://localhost:8080/rest/things?recursive=false";

request.get( {
    url : url,
    headers : {
        "Authorization" : auth
    }
  }, function(error, response, body) {
    fs = require('fs');
    fs.writeFile('things.json', body, function (err) {
    if (err) return console.log(err);
    //console.log('Hello World > helloworld.txt');
    });
      console.log('body : ', body);
    //  console.log('test : ', test);
  //  fs.close(test);
  } );
