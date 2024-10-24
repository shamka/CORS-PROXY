# CORS PROXY
Helps the browser to make a CORS request to a resource that does not expose permissive headers<br>
<br>
Permanent link: https://github.com/shamka/CORS-PROXY

Google Play: https://play.google.com/store/apps/details?id=mja.cors_proxy

# How to compile
Start `compile.bat (Windows)`,  ~~or `compile.sh (Unix/Linux)`~~
A JDK is required. It is also necessary that the PATH contains a path to javac and jar.

# How to use
1. Start with `java -jar cors_proxy.jar` or `javaw -jar cors_proxy.jar`
2. Make http POST request from browser (fetch or XMLHttpRequest) to `http://localhost:61988/cors` with headers X-Cp-Method (GET, POST, PUT, OPTION, PATCH, DELETE, etc) and X-Cp-Url (http(s)://target-cors-domain/path/file).<br>
You can also specify other headers and the request body to be forwarded to the target server. This proxy always adds headers to the server response:<br>
`Access-Control-Allow-Origin: *`<br>
`Access-Control-Allow-Headers: *`<br>
`Access-Control-Allow-Methods: *`<br>
`Access-Control-Max-Age: 86400`<br>

Error 445 is an internal error, the header `x-cp-reason` in the response will indicate the reason.

# Example
```javascript
function corsProxy(
    method,
    url,
    headers,
    data){
 let h = headers||{};
 h["X-Cp-Url"] = url;
 h["X-Cp-Method"] = method;
 let init = {
  headers:h,
  method:"POST",
  body:data,
 };
 return fetch(
    "http://127.0.0.1:61988/cors",
    init);
}
await corsProxy(
    "GET",
    "https://v4.sh16.ru/")
 .then(r=>r.text())
// return your IPv4 address
```
`method` - request method (GET, POST, OPTIONS, etc)<br>
`url` - link to resourse (https://example.com/path)<br>
`headers` - http headers<br>
`data` - request body
