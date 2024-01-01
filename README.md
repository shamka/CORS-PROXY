# CORS_PROXY
Enables the browser to make requests to sites that do not support CORS headers

# How to use
1. Start with `java -jar cors_proxy.jar` or `javaw -jar cors_proxy.jar`
2. Make http POST request from browser (fetch or XMLHttpRequest) to `http://localhost:61988/` with headers X-Cp-Method (GET, POST, PUT, OPTION, PATCH, DELETE, etc) and X-Cp-Url (http(s)://target-cors-domain/path/file).<br>
You can also specify other headers and the request body to be forwarded to the target server. This proxy always adds headers to the server response:<br>
`Access-Control-Allow-Origin: *`<br>
`Access-Control-Allow-Headers: *`<br>
`Access-Control-Allow-Methods: *`<br>
`Access-Control-Max-Age: 86400`<br>

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
    "http://127.0.0.1:61988/",
    init);
}
corsProxy(
    "GET",
    "https://v4.sh16.ru/")
.then(console.log)
```
`method` - request method (GET, POST, OPTIONS, etc)<br>
`url` - link to resourse (https://example.com/path)<br>
`headers` - http headers<br>
`data` - request body