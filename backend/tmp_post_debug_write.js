const fs = require('fs');
const http = require('http');
const data = JSON.stringify({username:'admin',password:'admin'});
const opts = {hostname:'127.0.0.1',port:5000,path:'/api/auth/debug-raw-body',method:'POST',headers:{'Content-Type':'application/json','Content-Length':Buffer.byteLength(data)}};
const req = http.request(opts,res=>{let b=''; res.on('data',c=>b+=c); res.on('end',()=>{ try{ fs.writeFileSync('logs/debug_post_response.json', b); console.log('WROTE logs/debug_post_response.json'); }catch(e){ console.error('WRITE ERR',e); } });}); req.on('error',e=>{ try{ fs.writeFileSync('logs/debug_post_response.json', JSON.stringify({error:String(e)})); }catch(err){}; console.error('ERR',e); }); req.write(data); req.end();
