//01.Content otnovo
var http = require("http");

function readStreamAsString(stream, callback) {
  var content = "";
  stream.on("data", function(chunk) {
    content += chunk;
  });
  stream.on("end", function() {
    callback(null, content);
  });
  stream.on("error", function(error) {
    callback(error);
  });
}

["text/plain", "text/html", "application/json"].forEach(function(type) {
  http.request({
    hostname: "eloquentjavascript.net",
    path: "/author",
    headers: {Accept: type}
  }, function(response) {
    if (response.statusCode != 200) {
      console.error("Request for " + type + " failed: " + response.statusMessage);
      return;
    }
    readStreamAsString(response, function(error, content) {
      if (error) throw error;
      console.log("Type " + type + ": " + content);
    });
  }).end();
});


//02.Ficing a leak
function urlToPath (url) {
	var path=require('url').parse(url).pathname;
	var doceded=decodeURLComoponent(path);
	return '.'+ decoded.replace(/(\/|\\)\.\.(\/|\\|$)/g,'/');
}

//03.Създаване на директории

methods.MKCOL = function(path, respond) {
  fs.stat(path, function(error, stats) {
    if (error && error.code == "ENOENT")
      fs.mkdir(path, respondErrorOrNothing(respond));
    else if (error)
      respond(500, error.toString());
    else if (stats.isDirectory())
      respond(204);
    else
      respond(400, "File exists");
  });
};



