// var Readable = require('stream').Readable;
// var rs = Readable();
//
// var c = 97;
// rs._read = function () {
//     rs.push(String.fromCharCode(c++));
//     if (c > 'z'.charCodeAt(0)) rs.push(null);
// };
// process.stdin.pipe(printConsole);


// rs.on('readable', function () {
//     var buf = process.stdin.read();
//     buf = buf.toString();
//     console.log(buf);
// });

// var readline = require('readline');
// var rl = readline.createInterface({
//   input: process.stdin,
//   output: process.stdout,
//   terminal: true
// });
//
// rl.on('line', function(line){
//     console.log('line is: ',line);
// });




// var Writable = require('stream').Writable;
// var ws = Writable();
// ws._write = function (chunk, enc, next) {
//     console.dir(chunk);
//     next();
// };
//
// process.stdin.pipe(ws);





// var x = 'learn_Code/ex4.dSYM/Contents/Info.plist';
// x = x.split('/');
// y = x.splice(-1);
//
// console.log(x);
// console.log(y);



// let x = ['1.4.2.5:2356','2.4.2.5:2356','3.4.2.5:2356','4.4.2.5:2356' ];
//
// let peer = x.shift().split(':');
//
// console.log(x);
// console.log(peer);

// let x = ['a'];
//
// if (!x.length) {
//   console.log('yay')
// }


var ppr = require('./modules/prep-piece-requests')(962416635, 1048576, 918, 872443);

// const ppr = new PPR(962416635, 1048576, 918, 872443);
let x = ppr.prepareRequest(0);


//x = Buffer.concat(x);

console.log(x);
