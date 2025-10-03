const http = require('http');
const data = JSON.stringify({username:'beantobin',password:'Bean2bin'});
const opts = {hostname:'127.0.0.1',port:5000,path:'/api/auth/debug-raw-body',method:'POST',headers:{'Content-Type':'application/json','Content-Length':Buffer.byteLength(data)}};
const req = http.request(opts,res=>{let b=''; res.on('data',c=>b+=c); res.on('end',()=>{console.log('STATUS',res.statusCode); try{console.log(JSON.parse(b));}catch(e){console.log('RAW',b);} });}); req.on('error',e=>console.error('ERR',e)); req.write(data); req.end();
