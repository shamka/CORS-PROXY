import {Asn1} from "./classes.js";

async function compress(ar, def=true) {
    if(ar === null || ar.length===0)return null;
    const compressedStream = new Blob([ar]).stream().pipeThrough(
        new CompressionStream(def?"deflate-raw":"gzip")
    );
    const chunks = [];
    for await (const chunk of compressedStream) {
        chunks.push(chunk);
    }
    return await concatUint8Arrays(chunks);
}
async function decompress(ar,def=true) {
    if(ar === null || ar.length===0)return null;
    const decompressedStream = new Blob([ar]).stream().pipeThrough(
        new DecompressionStream(def?"deflate-raw":"gzip")
    );
    const chunks = [];
    for await (const chunk of decompressedStream) {
        chunks.push(chunk);
    }
    return (await concatUint8Arrays(chunks));
}
async function concatUint8Arrays(uint8arrays) {
    return new Uint8Array(await new Blob(uint8arrays).arrayBuffer());
}
function extension(...ar){
    let qw = (a,v)=>{
        if(typeof v==='string')a.push(v);
        else if(typeof v==='number')a.push(v);
        else if(typeof v==='object') {
            if(v?.constructor.name==='Array')a.push(...v);
            else if(v===null)a.push(v);
        }
    };
    return ar.reduce((a,v)=>{
        if(Array.isArray(v))v.forEach(w=>qw(a,w));
        else qw(a,v);
        return a;
    },[]);
}
function parseSearch(a = document.location.search.substring(1)){
    return a.split('&')
        .filter(b=>b!=="")
        .map(c=>c.split("=")
            .map(d=>decodeURIComponent(d)))
        .reduce((e,f)=>{e[f[0]]=[...e[f[0]]??[],f[1]]??null;return e;},{})
}
function delay(ms, ret){
    return new Promise((r)=> {
        setTimeout(()=>r(ret), ms);
    });
}
function delayP(ms){
    return (r)=>delay(ms,r);
}
function puny(q, i = 0){
    let M=0x7fffffff,F=String.fromCodePoint,
        D="abcdefghijklmnopqrstuvwxyz0123456789".split(''),L=Math.floor;
    function u(d,n,f){
        d=f?d/700:d>>1;
        d+=L(d/n);
        let k=0;
        for(;d>455;k+=36)d=L(d/35);
        return k+L((36*d)/(d+38));
    }
    function en(q){
        try {return q.toLowerCase().replaceAll(/[\x2E\u3002\uFF0E\uFF61]/g, ".")
            .split('.').map(q => {
                let n = 128, d = 0, b = 72, s = [], h, a, m;
                q = q.split('').map(v => v.codePointAt(0));
                q.forEach(v => ((v < n) && s.push(F(v))));
                s = s.join('');
                if (!/^[0-9a-z\-_]*$/.test(s)) throw new Error("Bad symbol detect.");
                h = a = s.length;
                if (a === q.length) return s;
                if (a) s += '-';
                while (h < q.length) {
                    m = M;
                    q.forEach(v => ((v >= n) && (v < m) && (m = v)));
                    if ((m - n) > L((M - d) / (h + 1))) throw new Error("Overflow delta update.");
                    d += (m - n) * (h + 1);
                    n = m;
                    q.forEach(v => {
                        if (v < n) {
                            if (d === M) throw new Error("Overflow delta increment.");
                            ++d;
                        }
                        if (v === n) {
                            let q = d;
                            for (let k = 36; ; k += 36) {
                                let t = k <= b ? 1 : k >= b + 26 ? 26 : k - b;
                                if (q < t) break;
                                s += (D[t + ((q - t) % (36 - t))]);
                                q = L((q - t) / (36 - t));
                            }
                            s += (D[q]);
                            b = u(d, h + 1, h === a);
                            d = 0;
                            ++h;
                        }
                    });
                    ++d;
                    ++n;
                }
                return "xn--" + s;
            }).join('.');
        }
        catch(e){
            return null;
        }
    }
    function de(q){
        try{return q.split('.').map(q=>{
            if(!q.startsWith(`xn--`))return q;
            q=q.substring(4).split('');
            let n=128,i=0,b=72,s=[];
            let x = q.lastIndexOf('-');
            if(x===-1)x=0;
            s.splice(0,0,...q.slice(0,x));
            if(x>0)x+=1;
            for(let z=x;z<q.length;++z){
                let o=i,w=1;
                for (let k=36;;k+=36,++z){
                    if(z>=q.length)throw new Error("Premature termination");
                    let d=D.indexOf(q[z]);
                    if(d>L((M-i)/w))throw new Error("Overflow on i.");
                    i+=d*w;
                    let t=k<=b?1:k>=b+26?26:k-b;
                    if(d<t)break;
                    if(w>L(M/(36-t)))throw new Error("Overflow on w.");
                    w*=(36-t);
                }
                b=u(i-o,s.length+1,o===0);
                if(L(i/(s.length+1))>(M-n))throw new Error("Overflow on n.");
                n+=L(i/(s.length+1));
                i%=s.length+1;
                s.splice(i,0,F(n));
                ++i;
            }
            return s.join('');
        }).join('.');}
        catch(e){return null;}
    }
    let q1 = en(q);
    if(q1===null)return [null,null];
    let q2 = de(q1);
    if(q2===null)return [i>1?q1:null,null];
    if(i<2)if(q2!==q2.toLowerCase())return [null,null];
    return [q1,q2];
}
async function loadData(f) {
    let pem = [];
    if(typeof f !== "string") {
        if ((f.byteLength >= 20) && f[0] === 45 && f[1] === 45 && f[2] === 45 && f[3] === 45 && f[4] === 45) {
            f = new TextDecoder().decode(f);
        } else {
            try{pem.push({type: false, data: await Asn1.parse(f)});}
            catch(_){pem.push({type: false, data: f});}
            return pem;
        }
    }
    let pat = /-----BEGIN ([^\n]*)-----\r?\n([A-Za-z0-9\/+=\r\n]+)-----END ([^\n]*)-----(\r?\n)?/g;
    let lp;
    while ((lp = pat.exec(f)) != null) {
        if (lp[1] !== lp[3]) continue;
        let el = {type: lp[1]};
        try{el.data = await Asn1.parse(lp[2]);}
        catch(_){el.data = Asn1.b64.da(lp[2]);}
        pem.push(el);
    }

    return pem;
}
async function fixPrivate(prKey) {
    if(prKey.type === false) try{
        if(prKey.data.length===4 && prKey.data.c(0).b === 1n && prKey.data.c(2).tag===0n && prKey.data.c(2).cl===2 &&
            ["1.3.132.0.34","1.2.840.10045.3.1.7"].includes(prKey.data.c(2).c(0)?.o??"")){
            prKey.type = 'EC PRIVATE KEY';
        }
        else if(prKey.data.length===9 && prKey.data.c(0).b === 0n && prKey.data.c(2).b === 65537n){
            prKey.type = 'RSA PRIVATE KEY';
        }
        else if(prKey.data.length===3 && prKey.data.c(0).b === 0n && prKey.data.c(2).tag === 4n){
            prKey.type = 'PRIVATE KEY';
        }
    }catch(e){}
    switch (prKey.type) {
        default:
            throw new Error("Unknown type");
        case 'PRIVATE KEY':
            break;
        case 'RSA PRIVATE KEY': {
            prKey.type = 'PRIVATE KEY';
            prKey.data = Asn1.m.a([
                0, [Asn1.m.v(0, 6, Asn1.enc.obj("1.2.840.113549.1.1.1")), null],
                Asn1.m.v(0, 4, await prKey.data.encode()),
            ]);
            break;
        }
        case 'EC PRIVATE KEY': {
            prKey.type = 'PRIVATE KEY';
            let anyParam = prKey.data.c(2).c(0);
            prKey.data.splice(2,1);
            prKey.data = Asn1.m.a([
                0, [Asn1.m.v(0, 6, Asn1.enc.obj("1.2.840.10045.2.1")),anyParam],
                Asn1.m.v(0, 4, await prKey.data.encode()),
            ]);
            break;
        }
    }
    if (Asn1.enc.obj(prKey.data.c(1).c(0).v) === "1.2.840.113549.1.1.1") {
        let rawKey = prKey.data.c(2).e;
        prKey.pin = Asn1.b64.ea(await Asn1.hash.sha256(await Asn1.m.a([
            [Asn1.m.v(0, 6, Asn1.enc.obj("1.2.840.113549.1.1.1")), null],
            Asn1.m.v(0, 3, [0, ...await Asn1.m.a([rawKey.c(1), rawKey.c(2)]).encode()]),
        ]).encode(), true));
        prKey.format = "RSA";
        prKey.keyLength = (rawKey.c(1).v.length - (((rawKey.c(1).v[0] === 0) && ((rawKey.c(1).v[1] & 0x80) === 0x80)) ? 1 : 0)) * 8;
        if (prKey.keyLength !== 4096 && prKey.keyLength !== 3072 && prKey.keyLength !== 2048) {
            throw new RangeError("RSA key length must 4096, 3072 or 2048");
        }
        return prKey;
    }
    else if (Asn1.enc.obj(prKey.data.c(1).c(0).v) === "1.2.840.10045.2.1") {
        let rawKey = prKey.data.c(2).e;
        if(rawKey.length === 4){
            rawKey.splice(2,1);
            prKey.data.c(2).v = await rawKey.encode();
        }
        prKey.pin = Asn1.b64.ea(await Asn1.hash.sha256(await Asn1.m.a([
            prKey.data.c(1),
            rawKey.c(2).c(0),
        ]).encode(), true));
        prKey.format = "EC";
        prKey.keyLength = 0;

        let sw = Asn1.enc.obj(prKey.data.c(1).c(1).v);
        switch (sw) {
            default:
                throw new RangeError("Expected ["+sw+"]. EC key must namedCurve P-256 or P-384");
            case "1.3.132.0.34":
                prKey.keyLength = 384;
                break;
            case "1.2.840.10045.3.1.7":
                prKey.keyLength = 256;
                break;
        }
        return prKey;
    }
    else throw new Error("Unknown type");
}
function isError(obj){
    return Object.prototype.toString.call(obj) === "[object Error]";
}
const validateEmail=(email)=>{return String(email).toLowerCase().match(/^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|.(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-z\-0-9]{1,63}\.)+[a-z\-0-9]{2,20}))$/)!==null;};
const validateDomain=(domain)=>{return String(domain).toLowerCase().match(/^(\*\.)?([a-z\-0-9]{1,63}\.)+[a-z\-0-9]{2,20}$/)!==null;};

export {compress,decompress,concatUint8Arrays,extension,parseSearch,delay,delayP,puny,loadData,fixPrivate,isError,validateEmail,validateDomain}