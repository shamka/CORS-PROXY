import './bootstrap.js';
import {Asn1,DnsZoner,Le} from "./classes.js";
import {
    compress,
    decompress,
    extension,
    parseSearch,
    puny,
    loadData,
    fixPrivate,
    validateEmail,
    validateDomain,
    delayP, concatUint8Arrays
} from "./utils.js";

window.fetch=(()=>{
    let originFetch = window.fetch;
    let newFetch = function (url, opts = {}) {
        if(newFetch.disablenet)throw new Error("Net is disabled");
        const controller = new AbortController();
        opts.signal = controller.signal;
        if(opts.mode === "cors"){
            if(opts.headers === undefined)
                opts.headers = {};
            opts.headers["x-cp-method"] = opts.method??"GET";
            opts.headers["x-cp-url"] = url;
            url = "http://127.0.0.1:61988/cors";
            opts.mode = "cors";
            opts.method = "POST";
        }
        let store = opts.store;
        delete opts.store;
        let timerHandler = setTimeout(() => {
            controller.abort();
        }, opts.timeout ?? 10000);
        return originFetch(url, opts)
            .then(r=>{
                clearTimeout(timerHandler);
                r.store=store;
                if(!r.ok){
                    if(r.status === 445)throw new Error(r.headers.get('x-cp-reason')??"status error: 445");
                }
                return r;
            },e=>{
                clearTimeout(timerHandler);
                e.store=store;
                throw e;
            })
    };
    newFetch.disablenet = (parseSearch().disablenet?.[0] !== undefined);
    newFetch.originalFetch = originFetch.originalFetch??[];
    newFetch.originalFetch.push(originFetch.bind(window));
    return newFetch;
})();
function log(...r){
    console.log(...r);
    return r;
}
function download(filename, arr) {
    let element = document.createElement('a');
    const blob = URL.createObjectURL(new Blob([arr]));
    element.setAttribute('href', blob);
    element.setAttribute('download', filename);
    element.click();
    setTimeout(()=>URL.revokeObjectURL(blob),30000);
    //URL.revokeObjectURL(blob);
}
function escapeHtml(text) {
    let map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, function(m) { return map[m]; });
}

async function saveStates() {
    if (!userStore.states) return sessionStorage.removeItem('statesZip');
    // noinspection JSCheckFunctionSignatures
    sessionStorage.setItem('statesZip', await packer(true, userStore.states)
        .then(v => v.encode('bin')));
}
window.addEventListener("load", async ()=>{
    window.fKeys=[16,17,18];
    window.userStore = {
        id:{
            configBtnReset:document.querySelector("#btnConfigReset"),
            configBtnLoad:document.querySelector("#btnConfigLoad"),
            configLabelLoad:document.querySelector('label[for="btnConfigLoad"]'),
            configBtnSaveAsPem:document.querySelector("#btnConfigSaveAsPem"),
            configBtnSaveAsDer:document.querySelector("#btnConfigSaveAsDer"),
            configTextInfo:document.querySelector("span.loading"),

            userKeyBtnSet:document.querySelector("#btnUserKeySet"),
            userKeyBtnGenerate:document.querySelector("#btnUserKeyGenerate"),
            userKeyBtnRegistration:document.querySelector("#btnUserKeyRegistration"),
            userKeyBtnSetEmail:document.querySelector("#btnUserKeySetEmail"),
            userKeyBtnLoad:document.querySelector("#btnUserKeyLoad"),
            userKeyBtnReset:document.querySelector("#btnUserKeyReset"),
            userKeyBtnShow:document.querySelector("#btnUserKeyShow"),
            userKeyTxtStatus:document.querySelector("#txtUserKeyStatus"),
            userKeyTxtPin:document.querySelector("#txtUserKeyPin"),
            userKeyTxtType:document.querySelector("#txtUserKeyType"),
            userKeyTxtEmail:document.querySelector("#txtUserKeyEmail"),
            userKeyTxtKid:document.querySelector("#txtUserKeyKid"),
            userKeyTxtInfo:document.querySelector("#txtUserKeyInfo"),
            userKeyTxtHeader:document.querySelector("#txtUserKeyHeader"),
            userKeyBtnCache:document.querySelector("#btnUserKeyCache"),

            dnsBtnSet:document.querySelector("#btnDnsSet"),
            dnsTxtHeader:document.querySelector("#txtDnsHeader"),
            dnsBtnAdd:document.querySelector("#btnDnsAdd"),
            dnsInputNewKey:document.querySelector("#inputDnsKey"),
            dnsList:document.querySelector("#listDnsGroup"),

            privateBtnSet:document.querySelector("#btnPrivatesSet"),
            privateTxtHeader:document.querySelector("#txtPrivatesHeader"),
            privateBtnAdd:document.querySelector("#btnPrivatesAdd"),
            privateBtnGenerate:document.querySelector("#btnPrivateGenerate"),
            privateList:document.querySelector("#listPrivatesGroup"),

            profileBtnSet:document.querySelector("#btnProfileSet"),
            profileTxtHeader:document.querySelector("#txtProfileHeader"),
            profileList:document.querySelector("#listProfileGroup"),
            profileCreate:document.querySelector("#btnProfileCreate"),

            mainWorker:document.querySelector("#mainWorker"),
            orderCreate:document.querySelector("#orderCreate"),
        },
        data:{dns:new DnsZoner(),domains:{}},
    };

    await updateByState().then();
    document.querySelectorAll("[data-cb]").
    forEach(v=>v.dataset['cb'].split(',')?.
    forEach(e=>v.addEventListener(e.trim(),mainEventHandler)));

    userStore.id.modals = [...document.querySelectorAll("div.modal.fade")].
    reduce((s,c)=>{s[c.dataset.modal]=new bootstrap.Modal(c);return s;},{});
    // noinspection JSUnresolvedReference
    parseSearch().modal?.join(',').split(',').forEach(e=>userStore.id.modals[e]?.show())

    userStore.id.userKeyBtnGenerate.classList.remove("disabled");
    userStore.id.privateBtnGenerate.classList.remove("disabled");
    userStore.id.userKeyBtnLoad.labels.forEach(e=>e.classList.remove("disabled"));

});
async function updateByState(states){
    setInfo(userStore.id.configTextInfo,"Loading info...", 6);
    userStore.id.dnsList.querySelectorAll(':scope>*').forEach(removeDns);
    userStore.id.privateList.querySelectorAll(':scope>*').forEach(removePrivate);
    userStore.id.profileList.querySelectorAll(':scope>*').forEach(removeProfile);

    if(states===undefined){
        //let a=sessionStorage.getItem("states");
        let b=sessionStorage.getItem("statesZip");
        if(b!==null) {
            userStore.states = await packer(false, b).catch(()=>{return {};});
        }
        else{
            userStore.states = {};
        }
    }
    else{
        userStore.states = states;
        await saveStates();
    }

    afterUserKeyUpdate();
    if(userStore.states.userKey){
        await Asn1.parse(userStore.states.userKey)
            .then(r=>r.encode("B64","PRIVATE KEY"))
            .then(loadData)
            .then(r=>fixPrivate(r[0]))
            .then(setUserKey)
            .finally(afterUserKeyUpdate)
    }
    else{
        await setUserKey(null)
            .finally(afterUserKeyUpdate);
    }

    if(userStore.states.privates){
        for (const pin in userStore.states.privates) {
            if (Object.hasOwn(userStore.states.privates, pin)) {
                let prv = userStore.states.privates[pin];
                let name = '';
                if(prv instanceof Array){
                    name = prv[0];
                    prv = prv[1];
                }
                await Asn1.parse(prv)
                    .then(r=>r.encode("B64","PRIVATE KEY"))
                    .then(loadData)
                    .then(r=>fixPrivate(r[0]))
                    .then(r=>{
                        if(name.length)r.name=name;
                        return r;
                    })
                    .then(r=>addPrivate(r, true, false))
                ;
            }
        }
    }

    if(userStore.states.profiles){
        for (const name in userStore.states.profiles) {
            if (Object.hasOwn(userStore.states.profiles, name))
                await addProfile(name, userStore.states.profiles[name], true, false);
        }
    }

    if(userStore.states.dns)
        for (const v of userStore.states.dns)
            addDnsApiKeys(v).then()

    updateTotalDomains();
    updateTotalPrivates();
    updateTotalProfiles();

    let inf = Le.isRelease?"LeMode: Release":"LeMode: Staging";
    if(fetch.disablenet)inf+=` + Net is disabled`;
    setInfo(userStore.id.configTextInfo, inf, 2, "Let's Encrypt MODE");
}
function updateTotalDomains(){
    setInfo(userStore.id.dnsTxtHeader, "Total domains is "+Object.keys(userStore.data.domains).length);
}
function updateTotalPrivates(){
    setInfo(userStore.id.privateTxtHeader, "Total privates is "+Object.keys(userStore.states.privates??{}).length);
}
function updateTotalProfiles(){
    setInfo(userStore.id.profileTxtHeader, "Total profiles is "+(Object.keys(userStore.states.profiles??{}).length));
}
function removeDns(p){
    let key = p.querySelector('.key').innerText;
    p.parentNode.removeChild(p);
    p.dataset.domains?.split(',')
        .forEach(v=>delete userStore.data.domains[v]);
    let index = userStore.states.dns?.indexOf(key)??-1;
    if (index !== -1)
        userStore.states.dns.splice(index, 1);
    updateTotalDomains();
    //sessionStorage.removeItem(DnsZoner.getCacheKey(key));
    return key;
}
function removePrivate(p){
    let pin;
    if(typeof p==='string'){
        pin = p;
        p = userStore.id.privateList.querySelector(`[data-hash="${pin}"]`)
    }
    else{
        pin = p.querySelector('.pin').innerText;
    }
    if(p === null)return;
    p.parentNode.removeChild(p);
    delete userStore.states.privates?.[pin];
    updateTotalPrivates();
    return pin;
}
function removeProfile(name){
    let p=(typeof name!=='string')?name:userStore.id.profileList.querySelector(`[data-hash="${name}"]`);
    if(p === null)return;
    p.parentNode.removeChild(p);
    delete userStore.states.profiles?.[name];
    updateTotalProfiles();
    return p;
}
async function updateDns(p){
    let random = Math.random().toString();
    p.dataset.random = random;
    let key = p.querySelector('.key').innerText;
    sessionStorage.removeItem(DnsZoner.getCacheKey(key));
    p.dataset.domains?.split(',')
        .forEach(v=>delete userStore.data.domains[v]);
    updateTotalDomains();
    await loadDnsData(p,key,random);
    return key;
}
function setUserEmail(newEmail){
    if (validateEmail(newEmail)) {
        if ((userStore.data.userKey.leStatus?.status ?? "") === "valid") {
            modal("Correct email. Wait!...","Info",true);
            Le.setAcc(newEmail, false).finally(() => {
                afterUserKeyUpdate();
                modal();
            })
        } else {
            modal();
            userStore.states.userEmail = newEmail;
            setInfo(userStore.id.userKeyTxtEmail, newEmail, 7, "User sets");
            afterUserKeyUpdate();
        }
    } else {
        if(newEmail!=='')modal("Wrong email",undefined,true);
        else{
            delete userStore.states.userEmail;
            afterUserKeyUpdate();
            modal();
        }
    }
}
function generateModal(id){
    modal("" +
        "<label data-action='none' data-module=\"4096\" data-origin=\"" + id + "\" class=\"mb-2 btn btn-info\">RSA 4096</label>\n" +
        "<label data-action='none' data-module=\"3072\" data-origin=\"" + id + "\" class=\"mb-2 btn btn-info\">RSA 3072</label>\n" +
        "<label data-action='none' data-module=\"2048\" data-origin=\"" + id + "\" class=\"mb-2 btn btn-info\">RSA 2048</label>\n" +
        "<label data-action='none' data-module=\"384\" data-origin=\"" + id + "\" class=\"mb-2 btn btn-info\">ECDSA P-384</label>\n" +
        "<label data-action='none' data-module=\"256\" data-origin=\"" + id + "\" class=\"mb-2 btn btn-info\">ECDSA P-256</label>"
        , "Generate special types",true);
}
async function generateKey(bits){
    let type = 'RSA';
    switch(bits){
        default:return false;
        case 4096:
        case 3072:
        case 2048:
            break;
        case 384:
        case 256:
            type="ECDSA";
            break;
    }

    // noinspection SpellCheckingInspection
    let alg = type !== "ECDSA" ? {
        name: "RSASSA-PKCS1-v1_5",
        //name: "RSA-OAEP",
        modulusLength: Number(bits),
        publicExponent: new Uint8Array([1, 0, 1]),
        hash: "SHA-256",
    } : {
        name: "ECDSA",
        namedCurve: "P-" + bits,
    };
    return await crypto.subtle.generateKey(alg, true, ['sign'])
        .then(r => crypto.subtle.exportKey("pkcs8", (r.privateKey)))
}
function presentCandidate(key){
    return loadData(key)
        .then(r => fixPrivate(r[0]))
        .then(key=>{
            modal(`<span class="text-primary m-1">${key.format}-${key.keyLength}: ${key.pin}</span><br/>
<label class="m-2 btn btn-info" data-action="none" data-module="${key.keyLength}" data-origin="${userStore.id.privateBtnGenerate.id}">Regenerate</label>
<label class="m-2 btn btn-info" data-action="addPrivateKey">Apply</label>`,"Key Candidate",true);
            userStore.data.candidate = key;
        })
}
function afterUserKeyUpdate(){
    if(!validateEmail(userStore.states?.userEmail))delete userStore.states?.userEmail;
    delete userStore.data.leEmail;
    userStore.id.userKeyBtnRegistration.classList.add("disabled");
    userStore.id.userKeyBtnSetEmail.classList.add("disabled");
    userStore.id.userKeyBtnGenerate.classList.remove("disabled");
    userStore.id.userKeyBtnLoad.labels.forEach(e=>e.classList.remove("disabled"));
    setInfo(userStore.id.userKeyBtnCache);
    if(userStore.data.userKey){
        userStore.id.userKeyBtnSetEmail.classList.remove("disabled");
        userStore.id.userKeyBtnShow.classList.remove("disabled");
        if(userStore.data.userKey.leError){
            setInfo(userStore.id.userKeyTxtKid);
            setInfo(userStore.id.userKeyTxtEmail,userStore.states.userEmail??null,7, "User sets");
            setInfo(userStore.id.userKeyTxtStatus,userStore.data.userKey.leError.message??null,7, "Let's Encrypt error message");
            if(userStore.data.userKey.leError.name==="urn:ietf:params:acme:error:accountDoesNotExist"){
                if(userStore.states.userEmail)userStore.id.userKeyBtnRegistration.classList.remove("disabled");
                userStore.id.userKeyBtnSetEmail.classList.remove("disabled");
            }
        }
        else if(userStore.data.userKey.leStatus){
            setInfo(userStore.id.userKeyTxtKid,userStore.data.userKey.le.kid,3);
            let email = null;
            if(userStore.data.userKey.leStatus.contact){
                email = userStore.data.userKey.leStatus.contact?.[0]??null;
                if(email?.startsWith("mailto:")){
                    email = email.slice(7);
                    if(validateEmail(email)) {
                        setInfo(userStore.id.userKeyTxtEmail, email, 3, "Let's Encrypt sets");
                        delete userStore.states.userEmail;
                        userStore.data.leEmail = email;
                    }
                    else email = null;
                }else email = null;
            }
            if(email===null)
                setInfo(userStore.id.userKeyTxtEmail,userStore.states.userEmail??null,7, "User sets");
            setInfo(
                userStore.id.userKeyTxtStatus,
                userStore.data.userKey.leStatus.status??null,
                ((userStore.data.userKey.leStatus.status??null)==="valid")?5:6,
                "Let's Encrypt status");
        }
        else if(userStore.data.userKey.isNew){
            setInfo(userStore.id.userKeyTxtKid);
            setInfo(userStore.id.userKeyTxtEmail,userStore.states.userEmail??null,7, "User sets");
            setInfo(userStore.id.userKeyTxtStatus,"This is a new key. Do you want another one? Click here");
        }
        if(userStore.data.userKey.le?.cache) {
            let dt = new Date(userStore.data.userKey.le.cache)
            setInfo(userStore.id.userKeyBtnCache, "Loaded from cache. Click for reload",
                -1,
                dt.getDate().toString().padStart(2,'0')+'.'+
                (dt.getMonth()+1).toString().padStart(2,'0')+'.'+
                dt.getFullYear().toString().padStart(4,'0') + ' ' +
                dt.getHours().toString().padStart(2,'0')+':' +
                dt.getMinutes().toString().padStart(2,'0')+':'+
                dt.getSeconds().toString().padStart(2,'0')
            );
        }
        else setInfo(userStore.id.userKeyBtnCache,"Click for reload");
        setInfo(userStore.id.userKeyTxtHeader,escapeHtml(userStore.data?.userKey?.pin??null), ((userStore.data?.userKey?.leStatus?.status??"")==="valid")?3:7);
    }
    else {
        userStore.id.userKeyBtnShow.classList.add("disabled");
        userStore.id.userKeyBtnRegistration.classList.add("disabled");
        userStore.id.userKeyBtnSetEmail.classList.add("disabled");
        setInfo(userStore.id.userKeyTxtEmail);
        setInfo(userStore.id.userKeyTxtKid);
        setInfo(userStore.id.userKeyTxtPin);
        setInfo(userStore.id.userKeyTxtType);
        setInfo(userStore.id.userKeyTxtStatus);
        setInfo(userStore.id.userKeyTxtHeader, "User key not loaded", 6);

    }
}
function setInfo(obj, text = null, level = 0, title = '', megan=null){
    if(typeof(text)==='number'){
        if((obj.dataset.megan !== undefined) && (Number(obj.dataset.megan)===text)) {
            text=null;
            delete obj.dataset.megan;
        }
        else return;
    }
    let style_new = "";
    switch(level){
        default:break;
        case 0: style_new = "secondary";break;
        case 1: style_new = "light";break;
        case 2: style_new = "dark";break;
        case 3: style_new = "info";break;
        case 4: style_new = "primary";break;
        case 5: style_new = "success";break;
        case 6: style_new = "warning";break;
        case 7: style_new = "danger";break;
    }
    let style = obj.dataset.style;
    if(style !== style_new){
        obj.classList.replace
        ("text-"+style+"-emphasis","text-"+style_new+"-emphasis");
        obj.classList.replace
        ("bg-"+style+"-subtle","bg-"+style_new+"-subtle");
        obj.classList.replace
        ("border-"+style+"-subtle","border-"+style_new+"-subtle");
        obj.dataset.style = style_new;
    }
    if(megan===null)
        delete obj.dataset.megan;
    else obj.dataset.megan=megan;
    if(!(text?.length??false)){
        obj.innerHTML = "";
        obj.title = '';
        obj.classList.add("visually-hidden");
        return;
    }
    obj.innerHTML = text;
    if(title!==undefined && title!==null)obj.title = title;
    else obj.removeAttribute("title");
    obj.classList.remove("visually-hidden");
    if(!obj.matches('[data-cb]'))
        obj.onclick = (e)=>{navigator.clipboard.writeText(e.target.innerText).then(()=>modal("Copied", "Notification",true));};
}
function modal(text = undefined, title = 'Message', closeOrCopy = null){
    let md = userStore.id.modals["main"];
    if(text===undefined)return md.hide();
    md._dialog.querySelector(".modal-body").innerHTML = '';
    if(typeof text==='string')md._dialog.querySelector(".modal-body").innerHTML = text;
    else md._dialog.querySelector(".modal-body").append(...text);
    closeOrCopy = (v=>{
        if(typeof v ==='boolean')return v?"closeModal":"copy";
        return {
            'close':'closeModal',
            'copy':'copy',
            'ignore':'ignore',
        }[v]??null;
    })(closeOrCopy);
    if(closeOrCopy!==null)md._dialog.querySelector(".modal-body").dataset.action = closeOrCopy;
    md._dialog.querySelector(".modal-title").innerHTML = title;
    md._dialog.querySelector(".modal-body").querySelectorAll("[data-cb]").
    forEach(v=>v.dataset['cb'].split(',')?.
    forEach(e=>v.addEventListener(e.trim(),mainEventHandler)));
    md.show();
}
async function setUserKey(pKey) {
    delete userStore.states.userKey;
    delete userStore.data.userKey;
    if(!pKey)return;
    setInfo(userStore.id.userKeyTxtStatus, "Get info from Let's Encrypt...", 6);
    setInfo(userStore.id.userKeyTxtHeader, "Get info from Let's Encrypt...", 6);
    setInfo(userStore.id.userKeyTxtEmail,"Loading...", 6);
    setInfo(userStore.id.userKeyTxtKid,"Loading...", 6);
    setInfo(userStore.id.userKeyTxtPin,escapeHtml(pKey?.pin??""), 3);
    let t = escapeHtml((pKey?.format??"")+((pKey?.format??"")==="EC"?" P-":" ")+(pKey?.keyLength??""));
    if(t===' ')t = null;
    setInfo(userStore.id.userKeyTxtType,t,
        (((pKey?.format??"")==="EC")||((pKey?.keyLength??0)===4096))?5:(((pKey?.keyLength??0)===3072)?6:7));
    delete pKey.leError;
    delete pKey.leStatus;
    if(!pKey.isNew)await Le.setUserKey(pKey)
        .then(r=>r.getAcc())
        .catch(k=>{
            pKey.leError= {
                message: k.message,
                name: k.name,
                code: k.code
            };
            if(pKey.leError.name==='AbortError')pKey.leError.message="TIMEOUT ERROR"
        });
    userStore.states.userKey = await pKey?.data.encode();
    userStore.data.userKey = pKey;
}
async function addDnsApiKeys(val){
    let random = Math.random().toString();
    if(val==null)return;
    let hash = Asn1.hash.sha1(val,true).then(Asn1.b64.eau);
    let div = document.createElement('div');
    div.className = "list-group-item list-group-item-action flex-column align-items-start bg-gradient";
    div.dataset.random = random;
    hash = await hash;
    {
        let oDiv = userStore.id.dnsList.querySelector(`div.list-group-item[data-hash="${hash}"]`);
        if (oDiv) {
            modal("Key already exists", "Info",true);
            return;
        }
    }
    div.dataset.hash = hash;
    userStore.id.dnsList.prepend(div);
    if(!Object.hasOwn(userStore.states,"dns"))
        userStore.states.dns=[];
    if(!userStore.states.dns.includes(val))
        userStore.states.dns.push(val);
    //userStore.id.dnsInputNewKey.value='';
    await loadDnsData(div,val,random);
}
function loadDnsData(div,val,random){
    if(div.dataset.random !== random)throw new ReferenceError();
    div.innerHTML = `<div class="d-flex w-100 justify-content-between">
<div class="align-self-center">
<div class="btn btn-sm key" data-action="copy">${val}</div><br/>
<small class="keyInfo">get info...</small>
</div>
<div class="align-self-center">
<div class="btn btn-sm btn-outline-info visually-hidden" data-action="updateDns">&#11118;</div>
<div class="btn btn-sm btn-outline-info" data-action="removeDns">&#128938;</div>
</div>`;
    let sm = div.querySelector("small.keyInfo");
    sm.innerHTML="get info...";
    div.classList.remove('bg-success-sh');
    div.classList.remove('bg-danger-sh');
    div.classList.remove('bg-waited-sh');
    return userStore.data.dns.checkUnknownToken(val)
        .then(async r => {
            if(div.dataset.random !== random)throw new ReferenceError();
            if (div.parentNode === null) return;
            div.querySelector(`div.btn[data-action="updateDns"]`).classList.remove('visually-hidden');
            if (r.type === false) {
                div.classList.add('bg-danger-sh');
                sm.innerHTML = '';
                Object.keys(r).forEach(v=>{
                    if(v==='type')return;
                    let sp = document.createElement('span');
                    sp.innerHTML = `<s title="${r[v]}" data-action="title">${v}</s>`;
                    sp.className ='btn btn-sm p-0 m-0';
                    sm.append(sp);
                });
            } else {
                div.classList.add('bg-waited-sh');
                sm.innerHTML=r.type + ": loading..";
                if(div.dataset.random !== random)throw new ReferenceError();
                let domains = await userStore.data.dns.getDomainsByToken(r.type, val);
                if(div.dataset.random !== random)throw new ReferenceError();
                domains = domains.filter(v=>!Object.hasOwn(userStore.data.domains,v.name));
                domains.forEach(v=>userStore.data.domains[v.name]={id:v.id,token:v.token,type:v.type});
                let dl = domains.map(v=>v.name).join(',');
                div.dataset.domains=dl;
                div.classList.add('bg-success-sh');
                div.classList.remove('bg-waited-sh');
                sm.innerHTML=r.type + ": "+dl.replaceAll(',',' ')
                if(div.dataset.random !== random)throw new ReferenceError();
                updateTotalDomains();
            }
        }).catch(()=>{})
}
async function packer(pack, data){
    async function packKey(val){
        let name = '';
        if(val instanceof Array){
            name = val[0];
            val = val[1];
        }
        let key = await Asn1.parse(val);
        key = key.c(2).e;
        if(Number(key.c(0).b)){
            val = Uint8Array.from([
                ...key.c(1).v,
                ...key.c(2).c(0).v.slice(2),
            ]);
        }
        else{
            val = Uint8Array.from([1,3,4,5,6,7,8].map(q=>{
                let len = key.c(q).v.length;
                if(len&1)
                    if(len&2)return Asn1.u8concat([0],key.c(q).v);
                    else return key.c(q).v.slice(1);
                else return key.c(q).v.slice(0);
            }).reduce((a,c)=>{
                a.push(...c);
                return a;
            },[]));
        }
        if(name.length===0)return val;
        name = Asn1.txt.e(name);
        return concatUint8Arrays([Uint8Array.from(Asn1.encodeLength(name.length)),name,val]);
    }
    async function unpackKey(val){
        let name = '';
        let key = null;
        while (true) {
            switch (val.length) {
                default: {
                    if(name.length>0)return null;
                    let pos = 0;
                    let nameLen = val[pos++];
                    if (nameLen > 0x80) {
                        let t = nameLen & 0x7F;
                        nameLen = 0;
                        while(t--) {
                            nameLen = (nameLen * 256) + val[pos++];
                        }
                    }
                    if(nameLen === 0)return null;
                    name = Asn1.txt.d(val.subarray(pos, pos+nameLen));
                    pos+=nameLen;
                    val = val.subarray(pos);
                    continue;
                }
                case 2304:
                case 1728:
                case 1152: {
                    let mx = (val.length === 2304) ? 256 : ((val.length === 1728) ? 192 : 128);
                    key = await Asn1.m.a([
                        0,
                        Asn1.m.n(Asn1.u2b([0], val.subarray(0, mx * 2))),
                        65537n,
                        Asn1.m.n(Asn1.u2b([0], val.subarray(mx * 2, mx * 4))),
                        Asn1.m.n(Asn1.u2b([0], val.subarray(mx * 4, mx * 5))),
                        Asn1.m.n(Asn1.u2b([0], val.subarray(mx * 5, mx * 6))),
                        Asn1.m.n(Asn1.u2b([0], val.subarray(mx * 6, mx * 7))),
                        Asn1.m.n(Asn1.u2b([0], val.subarray(mx * 7, mx * 8))),
                        Asn1.m.n(Asn1.u2b([0], val.subarray(mx * 8, mx * 9))),
                    ]).encode("B64", "RSA PRIVATE KEY")
                        .then(loadData)
                        .then(r => r[0])
                        .then(fixPrivate).then(r => r.data.encode())
                    break;
                }
                case 96:
                case 144: {
                    let mx = (val.length === 144) ? 48 : 32;
                    key = await Asn1.m.a([
                        1,
                        Asn1.m.v(0, 4, val.subarray(0, mx)),
                        Asn1.m.c(2, 0, Asn1.m.v(0, 6, Asn1.enc.obj((val.length === 144) ?
                            "1.3.132.0.34" : "1.2.840.10045.3.1.7"
                        ))),
                        Asn1.m.c(2, 1, Asn1.m.v(0, 3, Asn1.u8concat([0, 4], val.slice(mx)))),
                    ]).encode("B64", "EC PRIVATE KEY")
                        .then(loadData)
                        .then(r => r[0])
                        .then(fixPrivate).then(r => r.data.encode())
                    break;
                }
            }
            if(name.length){
                return [name,key];
            }
            else{
                return key;
            }
        }
    }
    if(data===null)return {};
    try {
        if (pack) {
            let zip = Asn1.m.c(2,16);
            if(data.dns && data.dns.length) {
                let stDns = Asn1.txt.e(data.dns.join("\t"));
                let stDnsZ = await compress(stDns);
                if(stDnsZ.length<stDns.length)zip.add(Asn1.m.v(2, 1, stDnsZ));else
                    zip.add(Asn1.m.v(2, 0, stDns));
            }
            if(data.userKey){
                let uKey = await packKey(data.userKey);
                let uKeyZ = await compress(uKey);
                if(uKeyZ.length<uKey.length)zip.add(Asn1.m.v(2, 3, uKeyZ));else
                    zip.add(Asn1.m.v(2, 2, uKey));
            }
            if(data.userEmail){
                let uEmail = Asn1.txt.e(data.userEmail);
                let uEmailZ = await compress(uEmail);
                if(uEmailZ.length<uEmail.length)zip.add(Asn1.m.v(2, 5, uEmailZ));else
                    zip.add(Asn1.m.v(2, 4, uEmail));
            }
            if(data.privates){
                for (const prop in data.privates) {
                    if (Object.hasOwn(data.privates, prop)) {
                        let pKey = await packKey(data.privates[prop]);
                        let pKeyZ = await compress(pKey);
                        if(pKeyZ.length<pKey.length)zip.add(Asn1.m.v(2, 7, pKeyZ));else
                            zip.add(Asn1.m.v(2, 6, pKey));
                    }
                }
            }
            if(data.profiles) {
                for (const prop in data.profiles) {
                    if (Object.hasOwn(data.profiles, prop)) {
                        let pKey = Asn1.txt.e(prop+`\t`+data.profiles[prop].join(','));
                        let pKeyZ = await compress(pKey);
                        if(pKeyZ.length<pKey.length)zip.add(Asn1.m.v(2, 9, pKeyZ));else
                            zip.add(Asn1.m.v(2, 8, pKey));
                    }
                }
            }
            return zip;
        }
        else{
            let unZip = {privates:{},profiles:{}};
            await Asn1.parse(data).then(q=>q.aMap(async v=>{
                if(v.cl===2){
                    let val = v.v;
                    if((v.tag & 1n)===1n)
                        val = await decompress(val);

                    switch (v.tag & (~1n)){
                        case 0n:{
                            unZip.dns=(Asn1.txt.d(val).split('\t'));
                            break;
                        }
                        case 2n:{
                            unZip.userKey = await unpackKey(val);
                            break;
                        }
                        case 4n:{
                            unZip.userEmail=(Asn1.txt.d(val));
                            break;
                        }
                        case 6n:{
                            val = await unpackKey(val);
                            let name = '';
                            if(val instanceof Array){
                                name = val[0];
                                val = val[1];
                            }
                            let pin = await Asn1.parse(val)
                                .then(r=>r.encode("B64","PRIVATE KEY"))
                                .then(loadData)
                                .then(r=>fixPrivate(r[0]))
                                .then(r=>{
                                    if(name.length)r.name = name;
                                    return r.pin;
                                })
                                .catch(()=>null)
                            if(pin){
                                if(name.length)unZip.privates[pin] = [name,val];
                                else unZip.privates[pin] = val;
                            }
                            break;
                        }
                        case 8n:{
                            let profile=(Asn1.txt.d(val)).split(`\t`);
                            if(profile[1])unZip.profiles[profile[0]]=profile[1].split(',');
                            break;
                        }
                    }
                }
                return v;
            }));
            return unZip;
        }
    }
    catch (e){
        log(e);
    }
    return null;
}
async function addPrivate(key, silent = false, ats = true) {
    if (!silent) modal();
    let div = document.createElement('div');
    div.className = "list-group-item list-group-item-action flex-column align-items-start bg-gradient";
    {
        let oDiv = userStore.id.privateList.querySelector(`div.list-group-item[data-hash="${key.pin}"]`);
        if (oDiv || (userStore.data?.userKey?.pin === key.pin)) {
            if (!silent) modal("Key already exists", "Info", true);
            return;
        }
    }
    div.dataset.hash = key.pin;
    userStore.id.privateList.prepend(div);
    if(ats) {
        if (!Object.hasOwn(userStore.states, "privates"))
            userStore.states.privates = {};
        if (!Object.hasOwn(userStore.states.privates, key.pin))
            userStore.states.privates[key.pin] = await key.data.encode();
    }
    div.innerHTML = `<div class="d-flex w-100 justify-content-between break" data-action="showData">
<div class="align-self-center">
<div class="btn btn-sm pin" data-action="copy">${key.pin}</div><br/>
<div class="btn btn-sm name" data-action="rename">${key.name??'<i>Rename</i>'}</div><br/>
<small class="keyInfo">${key.format}-${key.keyLength}</small>
<a data-action="ignore" href="https://crt.sh/?spkisha256=${Asn1.u2x(Asn1.b64.da(key.pin))}&exclude=expired" target="_blank">crt.sh</a>
<a data-action="ignore" href="https://crt.sh/?spkisha256=${Asn1.u2x(Asn1.b64.da(key.pin))}" target="_blank">all</a>
</div>
<div class="align-self-center">
<div class="btn btn-sm btn-outline-info" data-action="removePrivate">&#128938;</div>
</div>`;
}
async function addProfile(name,domains,silent = false, ats = true){
    if (!silent) modal();
    let div = document.createElement('div');
    div.className = "list-group-item list-group-item-action flex-column align-items-start bg-gradient";
    {
        if (userStore.id.privateList.querySelector(`div.list-group-item[data-hash="${name}"]`)) {
            if (!silent) modal("Profile NAME already exists. Enter other name", "Info", true);
            return false;
        }
    }
    div.dataset.hash = name;
    userStore.id.profileList.prepend(div);
    if(ats) {
        if (!Object.hasOwn(userStore.states, "profiles"))
            userStore.states.profiles = {};
        if (Object.hasOwn(userStore.states.profiles, name))return false;
        userStore.states.profiles[name] = domains;
    }
    div.innerHTML = `<div class="d-flex w-100 justify-content-between" data-action="showDomains">
<div class="align-self-center">
<div class="btn btn-sm pin">${name} [${domains.length}]</div><br/>
</div>
<div class="align-self-center">
<div class="btn btn-sm btn-outline-info" data-action="editProfile">&#9998;</div>
<div class="btn btn-sm btn-outline-info" data-action="removeProfile">&#128938;</div>
</div>`;
    return true;
}
function createEditProfile(name,domains, edit = false){
    modal(`
<div class="container">
<div class="row">
<div class="col">
<div class="input-group">
<span class="input-group-text">Name</span>
<input type="text" class="form-control" data-cb="change" data-save-v="newProf.name" placeholder="Profile's name" value="${name}">
<label class="btn btn-info" type="button" data-action="none" ${edit?`data-update="${name}"`:''} data-origin="${userStore.id.profileCreate.id}">${edit?"Update":"Create"}</label>
</div>
</div>
</div>
<div class="row mt-3">
<div class="form-group">
<label class="form-group w-100">Domains
<textarea data-cb="change" class="form-control editable-area" data-save-v="newProf.ta">${domains}</textarea>
</label>
</div>
</div>
</div>
`,`Profile ${edit?"editor":"creator"}`,'ignore');

}
function mainEventHandler(e) {
    if (e.type === 'click') {
        switch (e.target.dataset.action ?? (e.target.closest('[data-action]')?.dataset.action) ?? this?.dataset.action ?? "none") {
            default:
            case 'none':
                break;
            case 'ignore':
                return;
            case 'copy':
                navigator.clipboard.writeText(e.target.innerText).then(() => modal("Copied", "Notification",true))
                return;
            case 'showData':(async()=> {
                let pin = e.target.querySelector('.pin')?.innerText;
                if(!pin)
                    pin = e.target.closest(`div[data-action="showData"]`)?.querySelector('.pin')?.innerText;
                if(pin)
                    modal('<pre data-action="copy">' + (await Asn1.encType(
                        (userStore.states.privates[pin] instanceof Array)?
                        userStore.states.privates[pin][1]:
                            userStore.states.privates[pin]??[]
                        ,"B64", "PRIVATE KEY")) + '</pre>', pin);
            })();return;
            case 'closeModal':
                userStore.id.modals[e.target.closest(".modal.fade").dataset.modal].hide();
                return;
            case 'setEmail': {
                setUserEmail(e.target.closest("form").querySelector('input').value)
                return;
            }
            case 'setPrName': {
                let pr = document.querySelector(`#setPrName`);
                setPrivateName(pr.dataset.pin,pr.value);
                return;
            }
            case 'removeDns': {
                removeDns(e.target.closest('div.list-group-item'));
                saveStates().then();
                return;
            }
            case 'updateDns': {
                updateDns(e.target.closest('div.list-group-item')).then(saveStates)
                return;
            }
            case 'title': {
                modal(e.target.title, e.target.innerText);
                return;
            }
            case 'addPrivateKey': {
                e.target.classList.add('disabled');
                addPrivate(userStore.data.candidate)
                    .then(saveStates)
                    .finally(()=>{
                        e.target.classList.remove('disabled');
                        delete userStore.data.candidate;
                        updateTotalPrivates();
                    });
                return;
            }
            case 'removePrivate': {
                removePrivate(e.target.closest('div.list-group-item'));
                saveStates().then();
                return;
            }
            case 'showDomains':{
                let name = e.target.closest('[data-hash]')?.dataset.hash;
                if(name===null || name.length<1)return;
                modal(userStore.states.profiles?.[name]?.join(', '),`Domains in ${name} profile`);
                return;
            }
            case 'removeProfile': {
                let name = e.target.closest('[data-hash]')?.dataset.hash;
                if(name===null || name.length<1)return;
                removeProfile(name);
                saveStates().then();
                return;
            }
            case 'editProfile': {
                let name = e.target.closest('[data-hash]')?.dataset.hash;
                if(name===null || name.length<1)return;
                createEditProfile(name,userStore.states.profiles?.[name]?.join(','),true);
                return;
            }
            case 'makeOrder':{
                makeOrder(e.target.closest('.order_request')
                    ?.querySelector('select.key')
                    ?.value??null,

                    e.target.closest('.order_request')
                        ?.querySelector('select.prof')
                        ?.value??null
                ).catch(log);
                return;
            }
            case 'download':{
                decompress(Asn1.b64.da(e.target.dataset.content)).then(r=>download(e.target.dataset.filename??'download',r));
                return;
            }
            case 'rename':{
                let dv = e.target.closest('[data-action]');
                let pin = dv.closest('div[data-hash]')?.dataset.hash;
                let name = userStore.states.privates[pin];
                if(name instanceof Uint8Array){
                    name="";
                }
                else{
                    name=name[0];
                }
                modal(`
<form class="row">
    <div class="col">
        <label for="setPrName" class="visually-hidden" data-action="none">Name</label>
        <input type="text" data-pin="${pin}" value="${name}" data-action="none" class="act-ignore form-control" id="setPrName"/>
    </div>
    <div class="col-auto">
        <label class="btn btn-info mb-3" data-action="setPrName" data-type="act">Set Name</label>
    </div>

</form>
`, "Set name for private key",true);
                let el = document.querySelector("#setPrName");
                el.focus({focusVisible: true});
                el.dataset.stype = 'submit';
                el.dataset.sact = 'setPrName';
                el.onkeydown = mainEventHandler;
                return;
            }
        }
        if(!e.target.classList.contains("act-ignore"))switch (e.target.dataset.origin ?? e.target.id) {
            default:
                log(`Click on ${e.target.dataset.origin??e.target.id}`)
                log(e.target)
                log(this)
                break;
            case userStore.id.configBtnReset.id: {
                updateByState({}).then();
                break;
            }
            case userStore.id.configBtnSaveAsDer.id:{
                Promise.resolve(Asn1.s2a(sessionStorage.statesZip??''))
                    .then(compress)
                    .then(r=>download("config.sder",r))
                    .catch(()=>{});
                break;
            }
            case userStore.id.configBtnSaveAsPem.id:{
                Promise.resolve(Asn1.s2a(sessionStorage.statesZip??''))
                    .then(compress)
                    .then(r=>{return Asn1.encType(r,"B64","LE ACME CONFIG")})
                    .then(r=>download("config.spem",r))
                    .catch(()=>{});
                break;
            }

            case userStore.id.userKeyBtnSet.id: {
                userStore.id.modals["1"].show();
                break;
            }
            case userStore.id.userKeyBtnGenerate.id: {
                if (e.target.id === userStore.id.userKeyBtnGenerate.id) return generateModal(userStore.id.userKeyBtnGenerate.id);
                modal();
                setInfo(userStore.id.userKeyTxtStatus, "Generation...", 6);
                setInfo(userStore.id.userKeyTxtHeader, "Generation...", 6);
                setInfo(userStore.id.userKeyTxtPin);
                setInfo(userStore.id.userKeyTxtEmail);
                setInfo(userStore.id.userKeyTxtKid);
                setInfo(userStore.id.userKeyBtnCache);
                setInfo(userStore.id.userKeyTxtType);
                setInfo(userStore.id.userKeyTxtInfo);
                userStore.id.userKeyBtnGenerate.classList.add("disabled");
                userStore.id.userKeyBtnShow.classList.add("disabled");
                userStore.id.userKeyBtnSetEmail.classList.add("disabled");
                userStore.id.userKeyBtnLoad.labels.forEach(e => e.classList.add("disabled"));
                generateKey(Number(e.target.dataset.module))
                    .then(Asn1.parse)
                    .then(r => r.encode("B64", "PRIVATE KEY"))
                    .then(loadData)
                    .then(r => fixPrivate(r[0]))
                    .then(r=>{r.isNew=true;return r;})
                    .then(setUserKey)
                    .then(saveStates)
                    .finally(afterUserKeyUpdate)
                break;
            }
            case userStore.id.userKeyBtnShow.id:(async()=> {
                modal('<pre data-action="copy">' + (await userStore.data.userKey.data.encode("B64", "PRIVATE KEY")) + '</pre>', userStore.data.userKey.pin);
            })();break;
            case userStore.id.userKeyBtnSetEmail.id: {
                let email = userStore.data.leEmail ?? userStore.states.userEmail ?? '';
                modal(`
<form class="row">
    <div class="col">
        <label for="setEmail" class="visually-hidden" data-action="none">Email</label>
        <input type="email" data-email="setEmail" value="${email}" data-action="none" class="act-ignore form-control" id="setEmail"/>
    </div>
    <div class="col-auto">
        <label class="btn btn-info mb-3" data-action="setEmail" data-type="act">Set Email</label>
    </div>

</form>
`, "Set User Email",true);
                let el = document.querySelector("input[data-email='setEmail']");
                el.focus({focusVisible: true});
                el.dataset.stype = 'submit';
                el.dataset.sact = 'setEmail';
                el.onkeydown = mainEventHandler;
                break;
            }
            case userStore.id.userKeyBtnRegistration.id: {
                if (!validateEmail(userStore.states.userEmail)) return;
                modal("Registration. Wait!...", "Let's Encrypt",true);
                setInfo(userStore.id.userKeyTxtStatus, "Registration. Wait!...", 6)
                Le.setAcc(userStore.states.userEmail, true).then(delayP(1000)).finally(() => {
                    modal();
                    afterUserKeyUpdate();
                })
                break;
            }
            case userStore.id.userKeyBtnReset.id:{
                delete userStore.states.userKey;
                delete userStore.data.userKey;
                afterUserKeyUpdate();
                break;
            }
            case userStore.id.userKeyBtnCache.id:(async ()=>{
                sessionStorage.removeItem(Le.getCacheKey(userStore.data.userKey.pin));
                delete userStore.data.userKey.le?.kid;
                delete userStore.data.userKey.isNew;
                setInfo(userStore.id.userKeyBtnCache);
                await setUserKey(userStore.data.userKey).finally(afterUserKeyUpdate)
            })();break;
            case userStore.id.userKeyTxtStatus.id:(async ()=>{
                if(!userStore.data.userKey.isNew)return;
                userStore.id.userKeyTxtStatus.dataset.origin = userStore.id.userKeyBtnGenerate.id;
                switch(userStore.data.userKey.keyLength){
                    default:return;
                    case 4096:
                    case 3072:
                    case 2048:
                        delete userStore.id.userKeyTxtStatus.dataset.type;
                        break;
                    case 384:
                    case 256:
                        userStore.id.userKeyTxtStatus.dataset.type = "ECDSA";
                        break;
                }
                userStore.id.userKeyTxtStatus.dataset.module = userStore.data.userKey.keyLength;
                mainEventHandler(e);
                delete userStore.id.userKeyTxtStatus.dataset.origin;
            })();break;

            case userStore.id.dnsBtnSet.id: {
                userStore.id.modals["2"].show();
                break;
            }
            case userStore.id.dnsBtnAdd.id: (async ()=>{
                let value = userStore.id.dnsInputNewKey.value;
                userStore.id.dnsInputNewKey.value = '';
                if (value === '') return;
                for(const v of value.split(' ').filter(v => v.trim() !== ''))
                    await addDnsApiKeys(v);
                await saveStates();
            })();break;

            case userStore.id.privateBtnSet.id: {
                userStore.id.modals["3"].show();
                break;
            }
            case userStore.id.privateBtnGenerate.id:{
                if (e.target.id === userStore.id.privateBtnGenerate.id) return generateModal(userStore.id.privateBtnGenerate.id);
                modal(`<span class="text-info">Wait...</span>`,"Key generation");
                userStore.id.privateBtnGenerate.classList.add('disabled');
                generateKey(Number(e.target.dataset.module))
                    .then(Asn1.parse)
                    .then(r => r.encode("B64", "PRIVATE KEY"))
                    .then(presentCandidate)
                    .finally(()=>{
                        userStore.id.privateBtnGenerate.classList.remove('disabled');
                    })
                break;
            }

            case userStore.id.profileBtnSet.id:{
                userStore.id.modals["4"].show();
                return;
            }
            case userStore.id.profileCreate.id:{
                if (e.target.id === userStore.id.profileCreate.id){
                    createEditProfile(sessionStorage["newProf.name"]??'',sessionStorage["newProf.ta"]??'');
                    return;
                }
                let name = (e.target.parentElement
                    .querySelector(":scope > input")
                    ?.value??'')
                    .trim();
                if(!/^[a-z0-9_\-.]{3,16}$/i.test(name))return;
                let domains = (e.target
                    .closest('div.container')
                    ?.querySelector('div.row+div.row textarea')
                    ?.value??'')
                    .trim()
                    .split(/[,;:\s]/)
                    .map(v=>{
                        v=v.trim();
                        let q='';
                        if(v.startsWith("*.")){
                            q="*.";
                            v=puny(v.substring(2))[0];
                        }
                        else v=puny(v)[0];
                        if(v===null)return null;
                        return q+v;

                    })
                    .filter(validateDomain)
                    .filter((v,i,a)=>a.indexOf(v)===i)
                    .sort((a,b)=>{
                        if(a.length===b.length){
                            if (a.startsWith('*') !== b.startsWith('*')) return (a.startsWith('*')) ? 1 : -1;
                            return a > b;
                        }
                        return a.length-b.length;
                    })
                if(e.target.dataset.update){
                    if(e.target.dataset.update!==name)
                        if(userStore.states.profiles?.[name])
                            return;
                    modal();
                    delete userStore.states.profiles[e.target.dataset.update];
                    let m = userStore.id.profileList.querySelector(`[data-hash="${e.target.dataset.update}"]`)
                    m.dataset.hash = name;
                    m = m.querySelector('.pin').innerText=`${name} [${domains.length}]`;
                    userStore.states.profiles[name] = domains;
                    saveStates().finally(()=>updateTotalProfiles);
                }
                else{
                    modal();
                    userStore.id.profileCreate.classList.add('disabled');
                    addProfile(name,domains).then(async r => {
                        if (r) {
                            await saveStates();
                            sessionStorage.removeItem("newProf.name");
                            sessionStorage.removeItem("newProf.ta");
                        }
                    })
                        .finally(()=>{
                            userStore.id.profileCreate.classList.remove('disabled');
                            updateTotalProfiles();
                        });
                }
                return;
            }

            case userStore.id.orderCreate.id:{
                let key_options = Object.keys(userStore.states.privates??{})
                    .map(v=>`<option value="${v}" title="${userStore.id.privateList.querySelector('div[data-hash="'+v+'"] small.keyInfo').innerText}">${(userStore.states.privates[v] instanceof Array)?userStore.states.privates[v][0]:v}</option>`).join('');
                let profile_options = Object.keys(userStore.states.profiles??{}).map(v=>`<option value="${v}">${v}</option>`).join('');
                modal(`<div class="order_request">
<label class='btn btn-info' data-action="makeOrder">Make order</label><br/>
<label>Keys:<select class="form-select key" size="7">
<option selected>--- --- --- --- ---</option>
  ${key_options}
</select></label>
<label>Profiles:<select class="form-select prof" size="7">
  <option selected>--- --- --- --- ---</option>
  ${profile_options}
</select></label></div>
                        `,`Order creator`,'ignore');
                return;
            }
        }
    }
    else if (e.type === 'keydown') {
        if (e.repeat) {
            if (!(e.target.dataset.rp ?? false)) return;
        }
        switch (e.target.dataset.stype ?? "none") {
            default:
            case 'none':
                break;
            case 'submit': {
                //if(fKeys.find(v=>v===event.keyCode))break;
                if (13 !== e.keyCode) break;
                if (e.altKey || e.ctrlKey || e.shiftKey) break;
                e.stopPropagation();
                e.preventDefault();
                if (e.target.dataset.sact) {
                    if (e.target.dataset.sact === 'setEmail')
                        setUserEmail(e.target.value);
                    else if (e.target.dataset.sact === 'setPrName')
                        setPrivateName(e.target.dataset.pin,e.target.value);
                } else if (e.target.dataset.btn) document.querySelector("#" + e.target.dataset.btn)?.click?.();
                break;
            }
        }
    }
    else if (e.type === 'change' || e.type === 'blur') {
        switch (e.target.dataset.origin ?? e.target.id) {
            default:{
                if(e.target.dataset.saveV || e.target.dataset.saveT){
                    sessionStorage[e.target.dataset[(e.target.dataset.saveV)?'saveV':'saveT']]=
                        (e.target.dataset.saveV)?e.target.value:e.target.innerText;
                }
                break;
            }
            case userStore.id.userKeyBtnLoad.id: {
                delete userStore.states.userKey;
                delete userStore.data.userKey;
                afterUserKeyUpdate();
                userStore.id.userKeyBtnGenerate.classList.add("disabled");
                userStore.id.userKeyBtnLoad.labels.forEach(e => e.classList.add("disabled"));
                // noinspection JSUnresolvedReference
                e.target.files[0].arrayBuffer()
                    .then(a => new Uint8Array(a))
                    .then(loadData)
                    .then(r => fixPrivate(r[0]))
                    .then(r=>{
                        removePrivate(r.pin)
                        return r;
                    })
                    .then(setUserKey)
                    .then(saveStates)
                    .catch(e => modal(
                        `<b class="text-danger">${e.message}<br/>${e.fileName}:${e.lineNumber}:${e.columnNumber}</b>`,
                        `<b class="text-danger">Error: ${e.name}</b>`,true))
                    .finally(afterUserKeyUpdate);
                break;
            }
            case userStore.id.configBtnLoad.id: {
                let file = this.files[0];
                if(file.size > 10485760)return modal("File is too large","Error",true);
                this.files[0].arrayBuffer()
                    .then(a => new Uint8Array(a))
                    .then(loadData)
                    .then(a=>decompress(a[0].data))
                    //.then(log)
                    .then(a=>packer(false,a))
                    .then(updateByState)
                    .catch(log)
                break;
            }
            case userStore.id.privateBtnAdd.id: {
                userStore.id.privateBtnAdd.labels.forEach(v=>v.classList.add("disabled"));
                Promise.all([...this.files].map(file => {
                    if (file.size > 10485760) {
                        console.error(`File "${file.name}" is too large`);
                        return Promise.resolve(null);
                    }
                    return file.arrayBuffer()
                        .then(a => new Uint8Array(a))
                        .then(loadData)
                        .catch(() => null)
                }))
                    .then(extension)
                    .then(r=>r.filter(v=>v!==null))
                    .then(r=>r.map(v=>fixPrivate(v).catch(()=>null)))
                    .then(r=>Promise.all(r))
                    .then(r=>r.filter(v=>v!==null))
                    .then(r=>r.map(k=>addPrivate(k,true)))
                    .then(r=>Promise.all(r))
                    .then(saveStates)
                    .finally(()=>{
                        updateTotalPrivates();
                        userStore.id.privateBtnAdd.labels.forEach(v=>v.classList.remove("disabled"));
                    })
                break;
            }
        }
    }
    else log(e);
}
function setPrivateName(pin,name){
    modal();
    let div = document.querySelector(`[data-hash='${pin}'] [data-action='rename']`);
    let pr = userStore.states.privates[pin];
    let key,keyName;
    if(pr instanceof Uint8Array){
        key = pr;
        keyName = '';
    }
    else{
        keyName = pr[0];
        key = pr[1];
    }
    if(typeof name !== 'string' || name===''){
        div.innerHTML = "<i>Rename</i>";
        userStore.states.privates[pin] = key;
        if(keyName !== '')saveStates().then();
    }
    else{
        div.innerHTML = escapeHtml(name);
        userStore.states.privates[pin] = [name,key];
        if(keyName !== name)saveStates().then();
    }
}
async function makeOrder(key,prof){
    key = userStore.states.privates?.[key]??null;
    prof = userStore.states.profiles?.[prof]??null;
    if(key===null || prof===null)return;
    if(key instanceof Array)key = key[1];
    modal();
    document.querySelectorAll("body > div.container.mainWin").forEach(v=>v.classList.add('d-none'));
    let orderWin = document.querySelector("body > div.container.orderWin");
    let oWin = orderWin.querySelector(":scope > div");
    oWin.innerHTML="";
    orderWin.classList.remove('d-none');
    function print(block, text, chLast = false){
        if(block === null){
            console.warn(text);
            return;
        }
        let div = document.createElement('div');
        div.className="d-flex w-100 justify-content-between break";
        div.innerHTML = text;
        if(chLast)div.dataset.rep = '1';
        let last = block.lastChild;
        if(last?.dataset.rep??false)block.removeChild(last);
        block.append(div);
        div.querySelectorAll("[data-cb]").
        forEach(v=>v.dataset['cb'].split(',')?.
        forEach(e=>v.addEventListener(e.trim(),mainEventHandler)));
    }
    let chanM1block = document.createElement('div');
    chanM1block.className="list-group-item list-group-item-action flex-column align-items-start bg-gradient";
    chanM1block.dataset.channel = '-1';
    oWin.append(chanM1block);
    try {
        if(!await Le.makeOrder(key, prof, async (...ar) => {
            switch(ar[0]?.[0]){
                default:throw "unknown "+ar[0]?.[0];
                case 'text':{
                    switch(ar[0]?.[1]){
                        default:
                            print(chanM1block,ar[0][1]);
                            break;
                        case 'CERT OK':{
                            print(chanM1block,`<label class='btn btn-info' data-cb="click" data-action="download" data-filename="cert.crt" data-content="${Asn1.b64.eau(await compress(ar[1][1]))}">CERT DOWNLOAD</label>`);
                            break;
                        }
                    }
                    break;
                }
                case 'toast':{
                    print(chanM1block,ar[0][1],true);
                    break;
                }
            }
        })){
            print(chanM1block, "We have not certificate");
        }
    }
    catch(e){
        print(chanM1block, e.toString());
    }
    //orderWin.classList.add('d-none');
    document.querySelectorAll("body > div.container.mainWin").forEach(v=>v.classList.remove('d-none'));
}