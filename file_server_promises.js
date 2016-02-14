var http = require("http"), fs = require("fs");
var Promise = require("promise");

var methods = Object.create(null);

// Не забравяй, че обещанията могат или да се провалят или да успеят. 
// Метода `then` взема две обратини повиквания едно да се справи с успех
// и едно да се справи с неуспех.
// Стратегията за справяне с изключения и друга повреда е да ги забележите
// през второто обратно повикване подадено тук и да върне 500 за отговор.
// При успех, обещанието върнато от отговора трябва да върне обект с 'code'
// свойство посочвашо кода на отговора и по желание 'body'и'type' свойства.
// Тялото може да бъде поток с директно 'pipe' или 'string'.

http.createServer(function(request, response) {
  respondTo(request).then(function(data) {
    response.writeHead(data.code, {"Content-Type": data.type || "text/plain"});
    if (data.body && data.body.pipe)
      data.body.pipe(response);
    else
      response.end(data.body);
  }, function(error) {
    response.writeHead(500);
    response.end(error.toString());
    console.log("Response failed: ", error.stack);
  });
}).listen(8000);

function respondTo(request) {
  if (request.method in methods)
    return methods[request.method](urlToPath(request.url), request);
  else
    return Promise.resolve({code: 405,
                            body: "Method " + request.method + " not allowed."});
}

function urlToPath(url) {
  var path = require("url").parse(url).pathname;
  var decoded = decodeURIComponent(path);
  return "." + decoded.replace(/(\/|\\)\.\.(\/|\\|$)/g, "/");
}

// Увийте 'fs' функциите, които ни трябват с 'Promise.denodeify', така че 
// да върнат обещания вместо директен разговор с обратно извикване и
// и ги подайте, като аргумент за грешка.

var fsp = {};
["stat", "readdir", "rmdir", "unlink", "mkdir"].forEach(function(method) {
  fsp[method] = Promise.denodeify(fs[method]);
});

// Няколко функции трябва да извикат`fsp.stat`и да се справят с отказите,
// които показват несъществуващи файлове, по специален начин, това е удобна
// обвивка, която преобразува 'file-not-found'-неизправностите в успех с
// нулева стойност.
//
// Не забравяйте,че това извикване на метода'then'връща друго обещане и че
// наличието на манипулатор за неизправност обикновенно замества провала с
// успех(с помоща на върнатата стойност). Ние подаваме null за успех тук
// (позволявайки на нормалния успех да не се промени) и променяме един вид 
// провал в успех.

function inspectPath(path) {
  return fsp.stat(path).then(null, function(error) {
    if (error.code == "ENOENT") return null;
    else throw error;
  });
}

// Може да използвате много по-малка категорична обработка на грешки, но
// сега неуспехите автоматично се разпространяват обратно.
// Новото обещание върнато от 'then', като се върне от тази функция, ще 
// използва едан от стойностите върнати тук(обекти с 'code' свойства),
// като негова стойност. Когато един манипулатор подаден към 'then' връща
// друго обещание(както е в случая, когато пътя се отнася до директорията)
// това обещанеие ше бъде свързано с обещанието върнато от 'then' и определя 
// кога и как е разрешено.

methods.GET = function(path) {
  return inspectPath(path).then(function(stats) {
    if (!stats) // Does not exist
      return {code: 404, body: "File not found"};
    else if (stats.isDirectory())
      return fsp.readdir(path).then(function(files) {
        return {code: 200, body: files.join("\n")};
      });
    else
      return {code: 200,
              type: require("mime").lookup(path),
              body: fs.createReadStream(path)};
  });
};

var noContent = {code: 204};
function returnNoContent() { return noContent; }

// Макар грешките да се разпространяват автоматично, ние все още имаме
// да организирваме 'noContent' да бъде върнато, когато дадено действие
// завършва, което е в ролята на манипулатор за успех на'returnNoContent'.

methods.DELETE = function(path) {
  return inspectPath(path).then(function(stats) {
    if (!stats)
      return noContent;
    else if (stats.isDirectory())
      return fsp.rmdir(path).then(returnNoContent);
    else
      return fsp.unlink(path).then(returnNoContent);
  });
};

// За да увием поток, трябва да дефинираме наше собствено обещание, тъй
// като 'Promise.denodeify' е за увиване на само прости функции.

methods.PUT = function(path, request) {
  return new Promise(function(success, failure) {
    var outStream = fs.createWriteStream(path);
    outStream.on("error", failure);
    outStream.on("finish", success.bind(null, noContent));
    request.pipe(outStream);
  });
};

methods.MKCOL = function(path, request) {
  return inspectPath(path).then(function(stats) {
    if (!stats)
      return fsp.mkdir(path).then(returnNoContent);
    if (stats.isDirectory())
      return noContent;
    else
      return {code: 400, body: "File exists"};
  });
};
