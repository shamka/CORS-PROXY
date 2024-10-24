import {parseSearch,delay,puny,loadData,fixPrivate,validateEmail,isError} from "./utils.js";

class Asn1{
    static hash={
        hash : async function(alg, ar,bin = false){
            if(typeof ar === 'string')
                ar = Asn1.txt.e(ar);
            if(ar instanceof Uint8Array)
                ar=ar.buffer;
            if(!(ar instanceof ArrayBuffer))
                throw new Error("expect string or instance of Uint8Array or ArrayBuffer");
            let digest = new Uint8Array(await crypto.subtle.digest(alg, ar));
            if(bin)return digest;
            return Array.from(digest).
            map(b => b.toString(16).padStart(2, '0')).
            join('');
        },
        sha1(ar,bin = false) {
            return Asn1.hash.hash("SHA-1", ar, bin);
        },
        sha256(ar,bin = false) {
            return Asn1.hash.hash("SHA-256", ar, bin);
        },
        sha384(ar,bin = false) {
            return Asn1.hash.hash("SHA-384", ar, bin);
        },
        sha512(ar,bin = false) {
            return Asn1.hash.hash("SHA-512", ar, bin);
        },
    };
    static async clone(asn1) {
        if (asn1 instanceof Asn1) {
            return Asn1.parse(await asn1.encode());
        }
    }
    static b64= {
        u2s(...u){
            let r = "";
            u.forEach(q=>q.forEach(w=>r+=String.fromCharCode(w)));
            return r;
        },
        s2u(s){
            let t=s.length,e=new Uint8Array(t);
            for (let i = 0; i < t; i++) e[i] = s.charCodeAt(i);
            return e
        },

        da(n) {
            return Asn1.b64.s2u(atob(Asn1.b64.c4u(n)));
        },
        ea(...n) {
            return btoa(Asn1.b64.u2s(...n))
        },
        eau(...n){
            return Asn1.b64.c2u(Asn1.b64.ea(...n));
        },
        c2u(str){return str.replaceAll("+", "-").replaceAll("/","_").replaceAll("=", "");},
        c4u(str){return str.replaceAll("-", "+").replaceAll("_","/");},
        d(r){return Asn1.txt.d(Asn1.b64.da(r))},
        e(n){return Asn1.b64.ea(Asn1.txt.e(n))},
        eu(n){return Asn1.b64.eau(Asn1.txt.e(n))}
    };
    static txt = {
        e(utf8){return new TextEncoder().encode(utf8);},
        d(ar){return new TextDecoder("utf-8",{fatal:true}).decode(ar);}
    };
    static u2x(ar, delim=''){
        if(ar.length < 1)return '';
        return [].map.call(ar,v=>v.toString(16).padStart(2,'0')).join(delim);
    }
    static u8concat(...ar){
        let newAr = new Uint8Array(ar.reduce((a,c)=>a+c.length,0));
        if(newAr.length===0)return newAr;
        ar.reduce((p,c)=>{
            newAr.set(c,p);
            return p+c.length;
        },0);
        return newAr;
    }
    static u2b(...ar){
        ar = Asn1.u8concat(...ar);
        if(ar.length===0)return 0n;
        let a = "0x" + Asn1.u2x(ar);
        let negative = (ar[0] & 0x80) === 0x80;
        let n = "0x".padEnd(a.length,"f")
        a = BigInt(a);
        if(negative){
            n = BigInt(n);
            a = ((a^n)+1n)*(-1n);
        }
        return a;
    }
    static b2u(bi,leadingZero=false){
        if(typeof bi === 'string'){
            if((/^\s*0b[01]+\s*$/i).test(bi)){
                bi=bi.replaceAll(/\s/g,"");
            }
            else if((/^\s*0o[0-7]+\s*$/i).test(bi)){
                bi=bi.replaceAll(/\s/g,"");
            }
            else if((/^\s*0x[0-9a-f]+\s*$/i).test(bi)){
                bi=bi.replaceAll(/\s/g,"");
            }
            else if((/^\s*([0-9a-f]{2}\s*)+$/i).test(bi)){
                bi=bi.replaceAll(/\s/g,"");
                bi = bi.match(/.{1,2}/g);
                bi.forEach((v,i,a)=>a[i]=Number("0x"+v))
                return Uint8Array.from(bi);
            }
            else if((/^[0-9A-Z_+=\-\/\s]+$/i).test(bi)){
                return Asn1.b64.da(bi);
            }
        }
        bi = BigInt(bi);
        let negative = false;
        if(bi<0n){
            negative = true;
            bi *=-1n;
        }
        let hex = bi.toString(16);
        let hex_len = hex.length;
        if(hex_len & 1){
            hex_len++;
            hex = '0'+hex;
        }
        else{
            if (leadingZero && (Number('0x' + hex.substring(0, 1)) >= 8)) {
                hex = '00' + hex;
                hex_len += 2;
            }
        }
        if(negative){
            let neg = BigInt("0x".padEnd(hex_len+2,"f"));
            hex = ((bi^neg)+1n).toString(16);
        }
        return Uint8Array.from(hex.match(/.{1,2}/g).map(v=>Number('0x'+v)));
    }
    static enc={
        b7e(num){
            let q = [];
            let bin = BigInt(num).toString(2);
            let o = bin.length % 7;
            if (o !== 0) {
                bin = "".padEnd(7 - o, '0') + bin;
            }
            let i = 0;
            bin = bin.match(/.{1,7}/g);
            for(;i<bin.length - 1;i++)
                q.push(0x80|parseInt(bin[i],2));
            q.push(parseInt(bin[i],2));
            return q;
        },
        e7b(obj){
            if(obj.input.length<=obj.inOffset)return false;

            if(obj.output[obj.outOffset]===undefined)
                obj.output[obj.outOffset] = 0n;

            let cur = BigInt(obj.input[obj.inOffset]);
            obj.output[obj.outOffset] = (obj.output[obj.outOffset]<<7n)+(cur&0x7fn);
            obj.inOffset++;
            if((cur&0x80n)!==0x80n)obj.outOffset++;
            return true;
        },

        obj(id){
            if(typeof id === 'string'){
                if(!/^([0-9]+)(\.[0-9]+)*$/.test(id))throw new Error("unknown format");
                let seg = id.split('.').map(r=>Number(r));
                let ar = [];
                if(seg.length<2)throw new Error("wrong format");
                if(seg[0]>2)throw new Error("wrong format");
                if(seg[1]>39 && seg[0]<2)throw new Error("wrong format");
                ar.push(...Asn1.enc.b7e(seg[0]*40+seg[1]));
                seg.forEach((v,i)=>{
                    if(i<2)return;
                    ar.push(...Asn1.enc.b7e(v));
                });
                return Uint8Array.from(ar);
            }
            else if(id instanceof Uint8Array){
                let obj={
                    input:id,
                    inOffset:0,
                    output:[],
                    outOffset:0,
                };
                while (Asn1.enc.e7b(obj)){}
                let f = obj.output[0];
                let r = 0n;
                if(f>=40n){
                    f-=40n;
                    r++;
                }
                if(f>=40n){
                    f-=40n;
                    r++;
                }
                obj.output[0] = f;
                obj.output.unshift(r);
                obj.outOffset++;
                return obj.output.join('.');
            }
            else throw new Error("expect string or Uint8Array");
        }
    }
    static m={
        a(...q){
            let m = [];
            q.forEach(v=>{
                switch(typeof v) {
                    default:
                        m.push(Asn1.m.s("TYPEOF: (" + (typeof v) + "): " + v?.toString()));break;
                    case "boolean":
                        m.push(Asn1.m.b(v));break;
                    case "string":
                        m.push(Asn1.m.s(v));break;
                    case "number":
                    case "bigint":
                        m.push(Asn1.m.n(v));break;
                    case "object":
                        if(v===null)m.push(Asn1.m.v(0,5));
                        else switch (v.constructor.name) {
                            default:
                                m.push(Asn1.m.s("OBJECT: " + v.toString()));break;
                            case "Array":m.push(Asn1.m.c(0, 16n, ...(v.map(c => Asn1.m.a(c)))));break;
                            case "Asn1":m.push(v);break;
                            case "Object":
                                let dict=Asn1.m.c(2,16n)
                                Object.keys(v).forEach(q=>dict.splice(dict.length,0,q,v[q]));
                                m.push(dict);
                                break;
                            case "Uint8Array":
                                m.push(Asn1.m.v(0,4n,v));
                                break;
                        }
                }
            });
            if(m.length>1)return Asn1.m.c(0, 16n, ...m);
            else return m[0];
        },
        s(t){
            return Asn1.m.v(0,12n,Asn1.txt.e(t));
        },
        b(t){
            return Asn1.m.v(0,1n,[t?0xFF:0]);
        },
        n(t){
            if(typeof t === 'number')
                t=BigInt(Math.round(t));
            if(typeof t !== 'bigint')throw new Error("wrong format");
            return Asn1.m.v(0,2,Asn1.b2u(t, true));
        },
        c(cl,tag,...val){
            let asn = new Asn1(Asn1.#instantiationToken);
            asn.#tag = (typeof tag === 'bigint')?tag:BigInt(tag);
            asn.#class = cl&3;
            asn.#container = true;
            asn.#value = null;
            asn.#children = val.map(c=>Asn1.m.a(c));
            return asn;
        },
        v(cl,tag,v){
            let asn = new Asn1(Asn1.#instantiationToken);
            asn.#tag = BigInt(tag);
            asn.#class = cl&3;
            asn.#container = false;
            asn.#children = null;
            asn.#value = (v instanceof Uint8Array)?v.slice(0):Uint8Array.from(v??[]);
            if(asn.#tag === 4n && asn.#value[0]===0x30)
                try{asn.#pseudo = Asn1.#parse(asn.#value);}catch(e){}
            return asn;
        },
    }
    static encodeLength(length){
        length = BigInt(length)
        if((length.toString(16).length)>254)throw new Error("very long length value");
        if(length < 0x80n){
            return [Number(length)];
        }
        else{
            let q = [];
            let l = length;
            while(l>0){
                q.push(Number(l & 0xFFn));
                l >>=8n;
            }
            q.push(0x80 + q.length);
            return q.reverse();
        }
    }
    static encodeTag(cl,ct,tg){
        let q = [];
        if(tg < 31n){
            q.push((cl<<6)|(ct?0x20:0)|Number(tg));
        }
        else{
            q.push((cl<<6)|(ct?0x20:0)|31);
            q.push(...Asn1.enc.b7e(tg));
        }
        return q;
    }
    static s2a(ber_ar){
        let l = ber_ar.length;
        let ar = new Uint16Array(l);
        for(let i=0;i<l;i++)ar[i]=ber_ar.charCodeAt(i);
        ber_ar = new Uint8Array(ar.buffer);
        if(ber_ar[0]===0)ber_ar=ber_ar.subarray(1);
        return ber_ar;
    }
    static async parse(ber_ar){
        if(ber_ar?.constructor.name === "ArrayBuffer"){
            ber_ar = new Uint8Array(ber_ar);
        }
        else if(ber_ar?.constructor.name !== "Uint8Array"){
            try {
                ber_ar = Asn1.b2u(ber_ar);
            }
            catch(ignore){
                if(typeof ber_ar === 'string'){
                    ber_ar=Asn1.s2a(ber_ar);
                }
            }
        }
        if(ber_ar === null || ber_ar.length===0)return null;
        let ans = Asn1.#parse(ber_ar);
        if(ans.#outerLen !== ber_ar.length)throw new Error("loses bytes detected");
        return ans;
    }
    static #parse(ber_ar){
        let pos = 0;
        let maxPos = ber_ar.length;
        let cl = ber_ar[pos]>>6;
        let cnt = ((ber_ar[pos]>>5) & 1) === 1;
        let tag = BigInt(ber_ar[pos] & 0x1F);
        if(tag === 31n){
            tag = 0n;
            do{
                pos++;
                if(pos >= maxPos)throw new Error("out of index");
                tag = (tag << 7n) + BigInt(ber_ar[pos] & 0x7F);
            }while((ber_ar[pos] & 0x80) === 0x80);
        }
        pos++;
        if(pos >= maxPos)throw new Error("out of index");
        let len = ber_ar[pos];
        if(len === 0x80){
            len = -1;
            if(!cnt)throw new Error("Can't skip over an invalid tag with undefined length");
        }
        else if((len & 0x80) === 0x80){
            let length_length = len & 0x7f;
            len = 0;
            while(length_length > 0){
                pos++;
                if(pos >= maxPos)throw new Error("out of index");
                len = (len << 8) + ber_ar[pos];
                length_length--;
            }
        }
        pos++;
        let asn = new Asn1(Asn1.#instantiationToken);
        asn.#container = cnt;
        asn.#len = len;
        asn.#tag = tag;
        asn.#class = cl;
        asn.#outerLen = pos;
        if(cnt){
            asn.#children = [];
            asn.#value = null;
            let unkLen = (len === -1);
            if((len > 0) && (pos+len) > maxPos)throw new Error("out of index");
            if(unkLen)
                len = maxPos - pos;
            while(len > 0) {
                let ch = Asn1.#parse(ber_ar.subarray(pos, unkLen ? maxPos : pos + len));
                pos += ch.#outerLen;
                asn.#outerLen += ch.#outerLen;
                len -= ch.#outerLen;
                if(unkLen && ch.#class === 0 && ch.#tag === 0n) {
                    if ((pos > maxPos) || (len<0)) throw new Error("out of index");
                    break;
                } else {
                    if ((pos > maxPos) || (len<0)) throw new Error("out of index");
                    asn.#children.push(ch)
                }
            }
        }
        else{
            if(len === -1)throw new Error("unknown length on non container element");
            asn.#children = null;
            if(len>0){
                if((pos+len) > maxPos)throw new Error("out of index");
                asn.#value = ber_ar.subarray(pos,pos+len);
                asn.#outerLen += len;
                if(asn.#tag === 4n && asn.#value[0]===0x30)
                    try{asn.#pseudo = Asn1.#parse(asn.#value);}catch(e){}
            }
            else asn.#value = ber_ar.subarray(pos,pos);
        }
        return asn;
    }
    constructor(sym) {
        if(sym !== Asn1.#instantiationToken) throw new Error("Private constructor forbidden for user call. Use Asn1.parse()");
    }
    static #instantiationToken = Symbol("myBin");
    #class;
    #tag;
    #container;
    #outerLen;
    #len;
    #children;
    #value;
    #pseudo = undefined
    #triple;
    #needCalc = true;
    #setNeedCalc(v){
        if(this.isCnt){
            this.#children.forEach(v => v.#setNeedCalc(v));
        }
        this.#needCalc = v;
    }
    #encode(ar,pos,len,cer){
        let triple = this.size(true, cer);
        let total = this.size(false, cer);
        if(total>len)throw new Error("len<children total");
        let sArr = ar.subarray(pos, pos+total);
        sArr.set(Asn1.encodeTag(this.cl,this.isCnt,this.tag), 0);
        if(this.isCnt && cer)
            sArr[triple[0]] = 0x80;
        else sArr.set(Asn1.encodeLength(triple[2]), triple[0]);
        if(this.isCnt){
            let chPos = triple[0] + triple[1];
            this.#children.forEach(v=>chPos+=v.#encode(sArr,chPos,total - chPos,cer));
            if(cer)
                sArr.set([0,0], chPos);
        }
        else{
            sArr.set(this.#value, triple[0] + triple[1]);
        }
        return total;
    }
    toString(){
        return "Asn1";
    }
    get cl(){
        return this.#class;
    }
    set cl(v){
        if(v<0 || v>3)throw new RangeError();
        this.#class = v;
    }
    setCl(v){
        this.cl=v;
        return this;
    }
    get tag(){
        return this.#tag;
    }
    set tag(v){
        this.#tag = BigInt(v);
    }
    setTag(v){
        this.tag=v;
        return this;
    }
    get isCnt(){
        return this.#container;
    }
    set isCnt(v){
        if(this.isCnt()) {
            if(v)return;
            this.#children = null;
            this.#value = new Uint8Array(0);
        }
        else{
            if(!v)return;
            this.#value = null;
            this.#children = [];
        }
    }
    setIsCnt(v){
        this.isCnt = v;
        return this;
    }
    get e() {
        if (this.isCnt) return;
        return this.#pseudo;
    }
    get v(){
        if(this.isCnt)return;
        return this.#value;
    }
    get vw(){
        let v = this.v;
        if(v[0]===0)return v.slice(1);
        return v.slice(0);
    }
    get o(){
        return Asn1.enc.obj(this.v);
    }
    set o(str){
        this.v = Asn1.enc.obj(str);
    }
    set v(v){
        if(this.isCnt)throw "not cnt";
        this.#pseudo = null;
        if(v instanceof Uint8Array){
            this.#value = v.slice(0);
        }
        else if(typeof(v) === 'string'){
            this.#value = Asn1.txt.e(v);
        }
        else if(typeof(v) === 'number' || typeof(v) === 'bigint'){
            this.#value = Asn1.b2u(BigInt(v),true);
        }
        try{this.#pseudo = Asn1.#parse(this.#value);}catch(e){}
    }
    setV(v){
        this.v=v;
        return this;
    }
    get s(){
        return Asn1.txt.d(this.v??[]);
    }
    get b(){
        return Asn1.u2b(this.v??[]);
    }
    get length(){
        if(this.isCnt)
            return this.#children.length;
        return -1;
    }
    async aMap(fun){
        if(!this.isCnt)throw "not cnt";
        let nA = [];
        for(const v of this.#children)
            nA.push(await fun(v));
        return nA;
    }
    map(fun){
        if(!this.isCnt)throw "not cnt";
        return this.#children.map(v =>fun(v));
    }
    c(i){
        if(!this.isCnt)return null;
        if(i===undefined)return this.#children.length;
        if(i<0)i = this.length + i;
        if(i >= this.#children.length)return null;
        return this.#children[i];
    }
    add(v){
        if(!this.isCnt)throw "not cnt";
        this.#children.push(Asn1.m.a(v));
    }
    splice(start,deleteCount,...asn){
        if(!this.isCnt)return;
        let ar = [];
        asn.forEach(v=>ar.push(Asn1.m.a(v)));
        return this.#children.splice(start,deleteCount,...ar)
    }
    size(triple = false, cer = false){
        let total;
        if(this.#needCalc) {
            if (this.isCnt) {
                let chLen = this.#children.reduce((a,v) => a+v.size(false,cer),0);
                total = [Asn1.encodeTag(this.cl, 1, this.tag).length, cer?1:(Asn1.encodeLength(chLen).length), chLen+(cer?2:0)];
            } else {
                total = [Asn1.encodeTag(this.cl, 0, this.tag).length, Asn1.encodeLength(this.#value.length).length, this.#value.length];
            }
            this.#triple = total;
        }
        else{
            total = this.#triple;
        }
        if(triple)
            return total;
        return total[0] + total[1] + total[2];
    }
    static encType(ar,type,ext){
        switch(type){
            default:throw new Error("Unknown encode type");
            case undefined:
            case null:
            case "array":
                return ar;
            case "hex":
                return Asn1.u2x(ar);
            case "HEX":
                return Asn1.u2x(ar).toUpperCase();
            case "h":
                return Asn1.u2x(ar, ' ');
            case "H":
                return Asn1.u2x(ar, ' ').toUpperCase();
            case "B64": {
                let a = Asn1.b64.ea(ar).match(/.{1,76}/g).join("\n");
                if(((typeof (ext)) === 'string') && (/^[A-Z0-9 ]+$/).test(ext))
                    return "-----BEGIN "+ext.trim()+"-----\n"+ a + "\n-----END "+ext.trim()+"-----\n";
                return a;
            }
            case "b64":
                return Asn1.b64.ea(ar);
            case "u64":
                return Asn1.b64.eau(ar);
            case "bin": {
                let len = ar.length;
                let pos = 0;
                let arr = ar;
                if ((len & 1)===1) {
                    len++;
                    pos++;
                    arr = new Uint8Array(len);
                    arr.set(ar, pos);
                }
                ar = new Uint16Array(arr.buffer);
                let rr = [];
                ar.forEach(v => rr.push(String.fromCharCode(v)));
                return rr.join('');
            }
        }
    }
    async encode(type=null,ext=undefined,cer=false){
        let triple = this.size(true, cer);
        this.#setNeedCalc(false)
        let ar = new Uint8Array(triple[0]+triple[1]+triple[2]);
        try {
            this.#encode(ar, 0, this.size(false, cer), cer);
        }
        finally {
            this.#setNeedCalc(true);
        }
        return Asn1.encType(ar,type,ext);
    }
    async decode(){
        let me = null;
        if(this.tag === 16n){
            if(!this.isCnt)throw new SyntaxError();
            if(this.cl === 0){
                me=[];
                for(let i=0;i<this.length;i++)me.push(await this.c(i).decode());
            }
            else if(this.cl === 2){
                if((this.length&1)!==0)throw new SyntaxError();
                me={};
                for(let i=0;i<this.length;i+=2)me[await this.c(i).decode()]=await this.c(i+1).decode();
            }
            else throw new SyntaxError();
        }
        else if(this.tag === 12n){
            return this.s;
        }
        else if(this.tag === 4n){
            if(this.cl === 0){
                return this.v;
            }
        }
        else if(this.tag === 2n){
            let b = this.b;
            let n = Number(b);
            if(BigInt(n) === b)return n;
            return b;
        }
        return me;
    }
}
class DnsZoner{
    #apiBase = {
        cf:"https://api.cloudflare.com/client/v4/"
    }
    async #cfApi(token, api, method = "GET", data = null){
        let opt = {
            mode:"cors",
            headers:{
                "Authorization":"Bearer " + token,
            },
            method
        };
        if(data!==null){
            opt.headers["content-type"] = "application/json";
            opt.body = JSON.stringify(data);
        }
        return await fetch(this.#apiBase.cf + api,opt).catch(e=>{throw {fetch_error:e};});
    }
    static getCacheKey(token){return `dns-${Asn1.b64.eu(token)}`;}
    #checkCfTokenRegExp(key){
        if(!/^[0-9A-Za-z_\-]{40}$/.test(key))throw "regexp:test:failed";
    }
    async #checkCfToken(key){
        this.#checkCfTokenRegExp(key);
        return await this.#cfApi(key, "user/tokens/verify")
            .then(async (r)=>{
                if(!r.ok)
                    throw (await r.json())?.errors?.[0]?.message??null;
                return ((await r.json())?.result?.status)==='active';
            });
    }
    async checkUnknownToken(token){
        let results = [],current;
        let saved = JSON.parse(sessionStorage.getItem(DnsZoner.getCacheKey(token))??"null");
        if((saved?.type??false) !== false)return saved;

        if(!saved?.cloudflare) {
            current = this.#checkCfToken(token)
                .then(
                    r => {
                        return {cloudflare: r};
                    }
                    , e => {
                        throw isError(e) ? {cloudflare: e.name + ": " + e.message} : {cloudflare: e};
                    });
            results.push(current);
        }
        else results.push(Promise[saved.type?'resolve':'reject']({cloudflare:saved.cloudflare}));
        current = Promise.any(results)
            .then(r => {
                r.type = Object.keys(r)[0];
                return r;
            })
            .catch(e => {
                return e.errors.reduce((p, c) => {
                    return {...p, ...c};
                }, { type: false});
            });
        current = await current;
        if(current.type){
            sessionStorage.setItem(DnsZoner.getCacheKey(token), JSON.stringify(current));
        }
        else{
            let toSave = {};
            Object.keys(current).forEach(v=>{
                if(v==='type'){
                    toSave[v]=current[v];
                    return;
                }
                if(Object.hasOwn(current[v],'fetch_error')) {
                    return current[v]=isError(current[v]['fetch_error']) ?
                        current[v]['fetch_error'].name + ": " + current[v]['fetch_error'].message
                        : current[v]['fetch_error'];
                }
                toSave[v] = current[v];
            })
            sessionStorage.setItem(DnsZoner.getCacheKey(token), JSON.stringify(toSave));
        }
        return current;
    }
    async getDomainsByToken(type, token){
        let current = JSON.parse(sessionStorage.getItem(DnsZoner.getCacheKey(token))??"null");
        let domains = [];
        if((current?.type===type) && current[type] && current[type]!==true){
            domains = current[type];
        }
        else {
            switch (type) {
                default:
                    return domains;
                case 'cloudflare': {
                    this.#checkCfTokenRegExp(token);
                    let page = 1;
                    do {
                        let response = await this.#cfApi(token, `zones?order=name&per_page=50&status=active&page=${page}`)
                            .then(r => {
                                if (!r.ok) throw false;
                                return r.json();
                            })
                            .then(r => {
                                if (!r.success) throw false;
                                domains.push(...r['result'].map(v => {
                                    return {id: v.id, name: v.name};
                                }));
                                return (r['result_info'].page < r['result_info']['total_pages']);
                            })
                            .catch(() => false);
                        if (response === false) break;
                    }
                    while (true);
                }
            }
            sessionStorage.setItem(DnsZoner.getCacheKey(token),JSON.stringify({
                type:"cloudflare",
                cloudflare:domains,
            }))
        }
        domains.forEach(v=>{
            v.type=type;
            v.token=token;
        })
        return domains;

    }
    #getDomainRec(domain){
        let idn = puny(domain)[0];
        let r = userStore.data.domains[Object.keys(userStore.data.domains)
            .find(v=>(v===idn)||idn.endsWith(`.${v}`))??null]??null;
        if(r===null)return null;
        return {...r,name:idn};
    }
    async listRecords(domain,type = null, content = null, fullText = true, reg = null){
        let r = this.#getDomainRec(domain);
        if(r===null)throw null;
        switch(r.type){
            default:throw null;
            case 'cloudflare':{
                let name = fullText?`&name=${encodeURIComponent(r.name)}`:"";
                let tp = type?`&type=${encodeURIComponent(type)}`:"";
                if(content===null)content='';
                else content = `&content=${encodeURIComponent(content)}`;
                let p = 1;
                let z = [];
                do {
                    let a = await this.#cfApi(r.token,
                        `zones/${r.id}/dns_records?page=${p}${tp}${name}${content}`)
                        .then(async r => {
                            r = await r.json();
                            if (!r.success) return null;
                            return [r.result,r[`result_info`]];
                        }).catch(() => null);
                    if(a===null)break;
                    z.push(...a[0]
                        .filter(v=>reg===null?true:new RegExp(reg).test(v.name))
                        .map(v=> {return {
                        a:r.token,
                        i:v.id,
                        n:v.name,
                        t:v.type,
                        v:v.content,
                        z:v['zone_id'],
                    };}));
                    if(z.length>=a[1]['total_count'])break;
                    if(p>=a[1]['total_pages'])break;
                    p++;
                }while(true);
                return z;
            }
        }
    }
    async addRecord(domain,type,value){
        let r = this.#getDomainRec(domain);
        if(r===null)throw null;
        return await this.#cfApi(r.token,
            `zones/${r.id}/dns_records?`,'POST',{
                name:r.name,
                content:value,
                type:type,
            })
            .then(async r => {
                r = await r.json();
                if (!r.success) return null;
                let v = r.result;
                return {
                    i:v.id,
                    n:v.name,
                    t:v.type,
                    v:v.content,
                    z:v['zone_id'],
                };

            }).catch(() => null);
    }
    async removeRecords(domain, type = null, value = null,fullText = true, reg = null){
        if(typeof domain==='object'){
            return this.#cfApi(domain.a,
                `zones/${domain.z}/dns_records/${domain.i}`,'DELETE')
                .then(r=>r.json())
                .then(r=>r['success']??false)
                .catch(()=>null)

        }
        else {
            return this.listRecords(domain,type,value,fullText,reg)
                .then(r => Promise.allSettled(r.map(v=>this.#cfApi(v.a,
                    `zones/${v.z}/dns_records/${v.i}`,'DELETE')
                    .then(r=>r.json()).catch(()=>null))))
                .then(r=>r.map(r=>r.value?.success??false))
                .catch(() => null);
        }
    }
}
class Le{
    static #DEBUG_MODE = (parseSearch().le?.[0] === "debug")
    static #STAGING = "https://acme-staging-v02.api.letsencrypt.org/directory";
    static #PROD = "https://acme-v02.api.letsencrypt.org/directory";
    static get DIR(){return this.#DEBUG_MODE?this.#STAGING:this.#PROD;}
    static get isRelease(){return !this.#DEBUG_MODE;}
    static #dirLinks
    static get links(){return {...this.#dirLinks};}
    static #userKey
    static async #req(url, payload= undefined, key = null){
        let opt = {};
        if(parseSearch?.().proxy?.[0]==="true")opt.mode = "cors";
        if(payload !== undefined){
            if(key===null)key = this.#userKey;
            if(!key.le)throw new Error("Key not setup");
            opt.method = "POST";
            opt.headers={
                "Content-Type":"application/jose+json",
            };
            payload = JSON.stringify(payload);

            let protect;
            let signature;

            if(key.le.kid){
                protect = {
                    "alg": key.le.alg,
                    "kid": key.le.kid,
                    "nonce": await this.#getNonce(),
                    "url":url
                };
            }
            else{
                protect = {
                    "alg": key.le.alg,
                    "jwk": key.le.jwk,
                    "nonce": await this.#getNonce(),
                    "url":url
                };
            }
            protect = Asn1.b64.eu(JSON.stringify(protect));
            payload = Asn1.b64.eu(payload);

            if(key.format==='RSA') {
                signature = await window.crypto.subtle.sign(
                    key.le.cryptoKey.algorithm.name,
                    key.le.cryptoKey,
                    Asn1.txt.e(protect + '.' + payload)
                );
            }
            else{
                signature = await window.crypto.subtle.sign(
                    {name:key.le.cryptoKey.algorithm.name,hash:"SHA-"+key.le.alg.slice(-3)},
                    key.le.cryptoKey,
                    Asn1.txt.e(protect + '.' + payload)
                );
            }
            signature = Asn1.b64.eau(new Uint8Array(signature));
            opt.body = JSON.stringify( {"protected":protect, payload, signature} );
        }
        return await (fetch(url, opt).then(async a => {
            this.#putNonce(a?.headers.get('replay-nonce'));
            return [(a.headers.get("content-type")?.endsWith('json')) ?
                await a.json() :
                {text: await a.text()}, a];
        },e=>{throw {fetch_error:e};}));
    }
    static getCacheOrders(kid){return `le_${Le.#DEBUG_MODE?"d":"r"}-${kid.substring(kid.lastIndexOf('/')+1)}`;}
    static getCacheKey(pin){return `le_${Le.#DEBUG_MODE?"d":"r"}-${Asn1.b64.c2u(pin)}`;}
    static getCacheDir(){return `le_${Le.#DEBUG_MODE?"d":"r"}-dir`;}
    static #nonceStorage = [];
    static async #getNonce(){
        return this.#nonceStorage.shift() ??
            await this.#req(this.links['newNonce'])
                .then(() => this.#nonceStorage.shift());
    }
    static #putNonce(nonce){
        if(!nonce)return;
        this.#nonceStorage.push(nonce);
        sessionStorage.setItem('nonce',JSON.stringify(this.#nonceStorage));
    }
    static async #init(){
        if(this.#dirLinks == null){
            this.#dirLinks = JSON.parse(sessionStorage.getItem(this.getCacheDir())??"null")??
                await this.#req(this.DIR).then(r=>{
                    sessionStorage.setItem(this.getCacheDir(),JSON.stringify(r[0]))
                    return r[0];
                });
            if(this.#dirLinks == null)throw new Error("directory link load error");
        }
    }
    static async setUserKey(pk){
        let initPr = this.#init().catch(e=>e);
        if(!pk.le) {
            pk.le = {};
            if (pk.format === "RSA") {
                pk.le.jwk = {
                    "e": Asn1.b64.eau(pk.data.c(2).e.c(2).vw),
                    "kty": "RSA",
                    "n": Asn1.b64.eau(pk.data.c(2).e.c(1).vw),
                };
                pk.le.alg = "RS256";
                pk.le.cryptoKey = await window.crypto.subtle.importKey("pkcs8", await pk.data.encode(), {
                    name: "RSASSA-PKCS1-v1_5",
                    hash: "SHA-256",
                }, false, ["sign"]);
            } else {
                let pubXY = pk.data.c(2).e.c(2).c(0).v;
                if(pubXY[0]!==0 || pubXY[1]!==4)throw new Error("Wrong EC publicKey format");
                let xyLen = (pubXY.length-2)>>1;
                let x = pubXY.slice(2,2+xyLen);
                let y = pubXY.slice(2+xyLen,2+xyLen*2);
                pk.le.jwk = {
                    "crv": "P-"+pk.keyLength,
                    "kty": "EC",
                    "x": Asn1.b64.eau(x),
                    "y": Asn1.b64.eau(y),
                };
                pk.le.alg = "ES"+pk.keyLength;
                pk.le.cryptoKey = await window.crypto.subtle.importKey("pkcs8", await pk.data.encode(), {
                    name: "ECDSA",
                    hash: "SHA-256",
                }, false, ["sign"]);
            }
            pk.le.jwkPrint = await Asn1.hash.sha256(JSON.stringify(pk.le.jwk),true).then(Asn1.b64.eau);
        }
        this.#userKey = pk;
        let error = await initPr;
        if(error)throw error;
        return this;
    }
    static async getAcc(){
        if(!this.#userKey.le.kid){
            let toSave = false;
            let ans = JSON.parse(sessionStorage.getItem(Le.getCacheKey(this.#userKey.pin))??"null");
            if(ans === null){
                ans = await this.#req(
                    this.links['newAccount'],
                    {'onlyReturnExisting':true},
                    this.#userKey
                );
                toSave = true;
            }
            try{this.#parseKid(ans);}
            finally {
                if (toSave) {
                    let sv = [{}, {}, Date.now()];
                    sv[1].ok = ans[1].ok;
                    if (sv[1].ok) {
                        sv[1].headers = {location: ans[1].headers.get("location")};
                        sv[0] = {...ans[0]};
                        delete sv[0].key;
                    } else {
                        sv[0].detail = ans[0].detail;
                        sv[0].type = ans[0].type;
                        sv[0].status = ans[0].status;
                    }
                    sessionStorage.setItem(Le.getCacheKey(this.#userKey.pin), JSON.stringify(sv));
                }
            }
        }
        return true;
    }
    static #parseKid(ans){
        if(ans[2])this.#userKey.le.cache = ans[2];
        else delete this.#userKey.le.cache;
        if(ans[1].ok){
            if(!this.#userKey.le.kid)this.#userKey.le.kid = ans[1].headers.get?.("location")??ans[1].headers.location;
            if(!this.#userKey.le.kid)throw new Error("Empty KID");
            this.#userKey.leStatus = ans[0];
        }
        else {
            let er = new Error(ans[0].detail);
            er.name = ans[0].type;
            er.code = ans[0].status;
            throw er;
        }

    }
    static async setAcc(email, create = false){
        let ans;
        if(this.#userKey.leError){
            if(!create)return;
            if(!validateEmail(email))return;
            delete this.#userKey.le.kid;
            delete this.#userKey.leError;
            ans = await this.#req(
                this.links['newAccount'],
                {"contact": ["mailto:"+email],"termsOfServiceAgreed":true},
                this.#userKey
            );
        }
        else if(this.#userKey.leStatus){
            ans = await this.#req(
                this.#userKey.le.kid,
                {"contact": ["mailto:"+email]},
                this.#userKey
            );
        }
        else return;
        this.#parseKid(ans);
        let sv = JSON.parse(sessionStorage.getItem(Le.getCacheKey(this.#userKey.pin))??"null");
        if(sv===null)return;
        if(sv[1]?.status) {
            sv[0].contact = ans[0].contact;
        }
        else{
            sv = [{}, {}];
            sv[1].ok = ans[1].ok;
            sv[1].headers = {location: ans[1].headers.get("location")};
            sv[0] = {...ans[0]};
            delete sv[0].key;
        }
        sv[2] = Date.now();
        sessionStorage.setItem(Le.getCacheKey(this.#userKey.pin), JSON.stringify(sv));
    }
    static async makeOrder(key,prof,cb = ()=>{}){
        if(key===null||prof===null)return;
        await cb(['text', 'init']);
        key = await loadData(key).then(r=>fixPrivate(r[0]))
            .then(async key => {
                key.cryptoKey = await window.crypto.subtle.importKey("pkcs8", await key.data.encode(), {
                    name: key.format === 'RSA' ? "RSASSA-PKCS1-v1_5" : 'ECDSA',
                    hash: "SHA-256",
                }, false, ["sign"]);
                return key;
            });
        await cb(['text', 'key loaded'],['obj',{key}]);
        let csr = await Asn1.m.a([[
            0,
            [Asn1.m.c(0,17n,[
                Asn1.m.v(0,6n,Asn1.enc.obj('2.5.4.3')),prof[0]
            ])],
        ]]);
        {
            let rawKey = key.data.c(2).e;
            if (key.format === "RSA") {
                csr.c(0).add([
                    [Asn1.m.v(0, 6, Asn1.enc.obj("1.2.840.113549.1.1.1")), null],
                    Asn1.m.v(0, 3, [0, ...await Asn1.m.a([rawKey.c(1), rawKey.c(2)]).encode()]),
                ])
                csr.add([Asn1.m.v(0, 6, Asn1.enc.obj("1.2.840.113549.1.1.11")), null]);
            } else {
                csr.c(0).add([
                    key.data.c(1),
                    rawKey.c(2).c(0),
                ]);
                csr.add([Asn1.m.v(0, 6, Asn1.enc.obj("1.2.840.10045.4.3.2"))]);
            }
            csr.c(0).add(Asn1.m.c(2,0n,[
                Asn1.m.v(0,6n,Asn1.enc.obj("1.2.840.113549.1.9.14")),
                Asn1.m.c(0,17n,[[
                    Asn1.m.v(0,6n,Asn1.enc.obj('2.5.29.17')),
                    Asn1.m.v(0,4, await Asn1.m.a(prof.map(v=>Asn1.m.v(2,2,Asn1.txt.e(v)))).encode())
                ]])
            ]));
        }
        let sign = await csr.c(0).encode();
        if(key.format==='RSA') {
            sign = new Uint8Array(await window.crypto.subtle.sign(
                key.cryptoKey.algorithm.name,
                key.cryptoKey,
                sign
            ));
            csr.add(Asn1.m.v(0,3, [0, ...sign]));

        }
        else{
            sign = new Uint8Array(await window.crypto.subtle.sign(
                {name:key.cryptoKey.algorithm.name,hash:"SHA-256"},
                key.cryptoKey,
                sign
            ));
            sign = await Asn1.m.a(
                Asn1.m.n(Asn1.u2b([0],sign.slice(0,sign.length>>1))),
                Asn1.m.n(Asn1.u2b([0],sign.slice(sign.length>>1)))
            ).encode();
            csr.add(Asn1.m.v(0,3, [0, ...sign]));
        }
        csr = await csr.encode('u64');
        await cb(['text', 'csr generated'],['obj',{csr}]);
        await cb(['text', 'create order']);
        this.#nonceStorage=[];
        let profHash = await Asn1.hash.sha1(key.pin+prof.join(','),true).then(Asn1.b64.eau);
        let orders = JSON.parse(sessionStorage.getItem(Le.getCacheOrders(this.#userKey.le.kid))??null)??{};
        let order = orders[profHash]??null;
        if(order!==null&&(order.status==='pending')){
            order = await this.#req(order.location).then(o => {
                o[0].location = o[1].headers.get('location')??order.location;
                return o[0];
            }).catch(()=>null);
            orders[profHash] = order;
        }
        if(order===null||order.status==='invalid'||((order.status!=='ready')&&(order.status!=='pending')&&(order.status!=='valid'))){
            order = await this.#req(
                this.links['newOrder'],
                {
                    "identifiers": prof.map(v => {
                        return {"type": "dns", "value": v};
                    })
                },
                this.#userKey
            ).then(o => {
                o[0].location = o[1].headers.get('location')??order.location;
                return o[0];
            });
            orders[profHash] = order;
            sessionStorage.setItem(Le.getCacheOrders(this.#userKey.le.kid),JSON.stringify(orders));
        }
        await cb(['text', 'parse order'],['obj',{order}]);
        let cleanerArray = [];
        if(order['status']==='pending') {
            await cb(['text', 'get authZ']);
            for(let i=0;i<order['authorizations'].length;i++){
                await cb(['toast', `${i+1}/${order['authorizations'].length}`]);
                let authI = order['authorizations'][i];
                let authZ = await this.#req(authI)
                    .then(r => r[0])
                    .catch((e) => {return {error: e};});
                if(authZ.status !== "pending")continue;
                let dns01 = authZ['challenges'].find(v => v.type === 'dns-01');
                if (dns01.status !== 'pending') break;
                let authKey = dns01.token + '.' + this.#userKey.le.jwkPrint;
                dns01.print = await Asn1.hash.sha256(authKey, true).then(Asn1.b64.eau);
                let pair = {};
                pair.domain = '_acme-challenge.' + authZ.identifier.value;
                pair.domain_ = authZ.identifier.value;
                pair.value = dns01.print;
                pair.prom=(userStore.data.dns.addRecord(pair.domain, 'TXT', pair.value));
                pair.url=(dns01.url);
                pair.authKey=(authKey);
                cleanerArray.push(pair);
            }
            //wait cloudflare
            await cb(['text', `wait dns sets`]);
            let validation = await Promise.allSettled(cleanerArray.map(r=>r.prom));
            if(validation.find(v=>v.status!=="fulfilled")){
                await cb(['text', `error cleanup`]);
                cleanerArray.forEach(v=>userStore.data.dns.removeRecords(v.domain, 'TXT', v.value));
                return false;
            }
            for(let time=30;time>=0;time--){
                await cb(['toast', `wait dns zone updates ${time} seconds`]);
                await delay(1000);
            }

            await cb(['toast', `valid is 0/${cleanerArray.length}`]);
            let vvv = 0;
            let query = [];
            for(let i=0;i<cleanerArray.length;i++)query.push(i);
            {
                let proms = [0,0,0];
                for(let i=proms.length-1;i>=0;i--) {
                    proms[i] = new Promise(async (resolve) => {
                        let i = query.pop();
                        if(i!==undefined) {
                            let st = await this.#req(cleanerArray[i].url, {
                                keyAuthorization: cleanerArray[i].authKey
                            })
                                .then(r => r[0]);
                            await delay(1000);
                            while (true) {
                                if (st.status === 'pending') {
                                    await delay(5000);
                                    st = await this.#req(cleanerArray[i].url)
                                        .then(r => r[0]);
                                } else break;
                            }
                            await userStore.data.dns.removeRecords(cleanerArray[i].domain, 'TXT', cleanerArray[i].value).then();
                            cleanerArray[i].status = st.status;
                            vvv++;
                            await cb(['toast', `valid is ${vvv}/${cleanerArray.length}`]);
                            await delay(1000);
                        }
                        resolve();
                    });
                }
                await Promise.allSettled(proms);
            }
            if(cleanerArray.find(v=>v.status!=='valid') === undefined) {
                order['status'] = 'ready';
                orders[profHash] = order;
                sessionStorage.setItem(Le.getCacheOrders(this.#userKey.le.kid), JSON.stringify(orders));
            }else return false;
        }
        if(order['status']==='ready') {
            await cb( ['text', 'finalize'], ['url', order['finalize']]);
            await delay(5000);
            let retry;
            while(true) {
                let fin = await this.#req(order['finalize'], {csr: csr});
                retry = (fin[1]?.headers?.get('retry-after') ?? 3) * 1000;
                if(fin[1].status === 200)break;
                await cb( ['text', `retry finalize[${fin[0].type??''} ${fin[0].detail??''}]`], ['url', order['finalize']]);
                console.log(fin);
                let s=120;
                while(s--){
                    await cb(['toast', `retry after ${s} second[s]`]);
                    await delay(1000);
                }

            }
            while (order.status !== 'valid') {
                await cb( ['text', 'cert pending'], ['obj', order]);
                await delay(retry);
                order = await this.#req(order.location).then(o => {
                    o[0].location = o[1].headers.get('location')??order.location;
                    return o[0];
                });
            }
            orders[profHash] = order;
            sessionStorage.setItem(Le.getCacheOrders(this.#userKey.le.kid),JSON.stringify(orders));
        }
        if(order['status']==='valid') {
            await cb( ['text', 'check cert'], ['obj', order]);
            if (!order['certificate']) return false;
            let cert = await this.#req(order['certificate'])
                .then(r => r[0]);
            await cb( ['text', 'CERT OK'], ['cert', cert.text]);
            orders = JSON.parse(sessionStorage.getItem(Le.getCacheOrders(this.#userKey.le.kid)) ?? null) ?? {};
            delete orders[profHash];
            sessionStorage.setItem(Le.getCacheOrders(this.#userKey.le.kid), JSON.stringify(orders));
            return cert;
        }
        return true;
    }
}

export {Asn1,DnsZoner,Le}