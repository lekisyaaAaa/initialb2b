const fs = require('fs');
const http = require('http');
(async function(){
  try{
    const out = 'scripts/latest-fetch.json';
    const req = http.request({hostname:'localhost',port:5000,path:'/api/sensors/latest',method:'GET'}, res=>{
      let b='';
      res.on('data', c=> b+=c);
      res.on('end', ()=>{
        const payload = { statusCode: res.statusCode, body: null };
        try{ payload.body = JSON.parse(b); }catch(e){ payload.body = b; }
        fs.writeFileSync(out, JSON.stringify(payload, null, 2), 'utf8');
        console.log('WROTE', out);
      });
    });
    req.on('error', e=>{ console.error('ERR', e && e.message ? e.message : e); process.exit(2); });
    req.end();
  }catch(e){ console.error('EX', e); process.exit(3); }
})();
