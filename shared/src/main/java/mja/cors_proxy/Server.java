package mja.cors_proxy;

import android.annotation.SuppressLint;

import com.sun.net.httpserver.Headers;
import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;

import java.io.*;
import java.lang.reflect.Field;
import java.net.HttpURLConnection;
import java.net.InetSocketAddress;
import java.net.URI;
import java.net.URL;
import java.security.SecureRandom;
import java.security.cert.X509Certificate;
import java.util.*;
import java.util.concurrent.Executors;

import javax.net.ssl.HttpsURLConnection;
import javax.net.ssl.SSLContext;
import javax.net.ssl.TrustManager;
import javax.net.ssl.X509TrustManager;

public class Server {

    public static class HttpError extends RuntimeException {
        public int code;
        public String file;

        HttpError(int code, String file){
            this.code = code;
            this.file = file;
        }
        @SuppressLint("DefaultLocale")
        HttpError(int code){
            this.code = code;
            this.file = String.format("%d.html",code);
        }

    }

    public static final String VERSION = "2.5.0";
    public static final String LE_ACME_VERSION = "2.5";
    public static final String RES_HASH = getAppResourceAsString("assets.hash");
    public static final int LOCAL_PORT = 61988;
    private static final Set<String> ignoreExposeHeaders = Set.of(
            "cache-control", "content-language", "content-length",
            "content-type", "expires", "last-modified", "pragma");
    private static final Set<String> ignoreRequestHeaders = Set.of(
            "x-cp-method", "host", "cookie", "cookie2", "x-cp-url");
    private static final Set<String> ignoreRequestHeadersPrefix = Set.copyOf(
            Collections.singletonList("sec-fetch-"));
    private static final Set<String> ignoreResponseHeaders = Set.of(
            "access-control-allow-origin",
            "access-control-allow-headers",
            "access-control-allow-methods",
            "access-control-max-age",
            "access-control-expose-headers",
            "set-cookie", "set-cookie2");
    private static void copyStream(InputStream input, OutputStream output) throws IOException
    {
        byte[] buffer = new byte[1024];
        int bytesRead;
        while ((bytesRead = input.read(buffer)) != -1)
            output.write(buffer, 0, bytesRead);
    }
    private static void copyStream(InputStream input, Appendable output) throws IOException
    {
        int ch;
        while(-1 != (ch = input.read())){
            output.append((char) ch);
        }

    }

    private Server(){}

    private static HttpServer singleTonServer = null;
    private static boolean singleTonServerPrep = false;

    @SuppressWarnings("UnusedReturnValue")
    public static boolean startServer(final Runnable cb){
        if(singleTonServer == null && !singleTonServerPrep){
            singleTonServerPrep = true;
            new Thread(() -> startServer(LOCAL_PORT,cb)).start();
        }
        return singleTonServer != null || singleTonServerPrep;
    }
    @SuppressWarnings({"UnusedReturnValue", "unused"})
    public static boolean stopServer(){
        if(singleTonServer == null)return false;
        singleTonServer.stop(0);
        singleTonServer = null;
        return true;
    }

    public static InputStream getAppResource(String path) {
        return mja.cors_proxy.App.open(path);
    }
    public static String getAppResourceAsString(String path) {
        try(InputStream in = mja.cors_proxy.App.open(path)){
            StringWriter str = new StringWriter ();
            copyStream(in, str);
            return str.toString();
        } catch (IOException e) {
            return LE_ACME_VERSION;
        }
    }

    /** @noinspection SameParameterValue*/
    @SuppressLint("CustomX509TrustManager")
    private static void startServer(int port, final Runnable cb){

        SSLContext context;
        try {
            context = SSLContext.getInstance("TLS");
            context.init(null, new TrustManager[]{new X509TrustManager() {
                @SuppressLint("TrustAllX509TrustManager")
                @Override
                public void checkClientTrusted(X509Certificate[] chain, String authType) {}
                @SuppressLint("TrustAllX509TrustManager")
                @Override
                public void checkServerTrusted(X509Certificate[] chain, String authType) {}
                @Override
                public X509Certificate[] getAcceptedIssuers() {
                    return new X509Certificate[0];
                }
            }}, new SecureRandom());
        } catch (Exception e) {return;}

        HttpsURLConnection.setDefaultSSLSocketFactory(context.getSocketFactory());

        HttpServer server = null;
        try {
            server = HttpServer.create(new InetSocketAddress("localhost", port), 10);
        } catch (IOException e) {
            System.err.println(e.getMessage());
            System.exit(-1);
        }
        if(server != null) {
            server.createContext("/",exchange -> {
                String path = exchange.getRequestURI().getPath();
                try {
                    if ("/cors".equals(path)) {
                        parseCors(exchange);
                    }
                    else if ("/favicon.ico".equals(path)) {
                        getRes(exchange, "icon.png", "image/png");
                    }
                    else if ("/".equals(path)) {
                        getRes(exchange, "mainPage.html", "text/html;charset=utf-8");
                    }
                    else if (path.startsWith("/le_acme/")) {
                        parseLeAcme(exchange);
                    }
                    else {
                        throw new HttpError(404);
                    }
                }
                catch (IOException ignored) {}
                catch (HttpError e){
                    exchange.sendResponseHeaders(e.code,0);
                    try(InputStream in = App.open(e.file)){
                        try(OutputStream out = exchange.getResponseBody()) {
                            copyStream(in, out);
                        }
                    }
                    catch (HttpError ignored){}
                }
                exchange.close();
            });
            server.setExecutor(Executors.newFixedThreadPool(10));
            server.start();
            if(cb != null) cb.run();
        }
        singleTonServer = server;
        singleTonServerPrep = false;
    }
    private static void parseCors(HttpExchange exchange) throws IOException {
        if ("OPTIONS".equals(exchange.getRequestMethod())) {
            Headers gds = exchange.getResponseHeaders();
            Headers reGds = exchange.getRequestHeaders();

            String origin = reGds.getFirst("Origin");
            gds.set("Access-Control-Allow-Origin", (origin==null)?"*":origin);

            String allowMethods = reGds.getFirst("Access-Control-Request-Method");
            if(allowMethods != null)gds.set("Access-Control-Allow-Methods", "POST");

            String allowHeaders = reGds.getFirst("Access-Control-Request-Headers");
            if(allowHeaders == null)allowHeaders = "";
            else allowHeaders = "," + allowHeaders;
            allowHeaders = "Accept,Accept-Language,Content-Language,Content-Type,Range" + allowHeaders;
            gds.set("Access-Control-Allow-Headers", allowHeaders);

            gds.set("Access-Control-Max-Age", "86400");
            gds.set("Vary", "Access-Control-Request-Headers,Origin");

            gds.set("Access-Control-Allow-Credentials", "true");

            exchange.sendResponseHeaders(204, 0);
            exchange.close();
            return;
        }
        if (!"POST".equals(exchange.getRequestMethod()))throw new HttpError(405);
        Headers headers = exchange.getRequestHeaders();
        String method = headers.getFirst("x-cp-method");
        String hUrl = headers.getFirst("x-cp-url");
        if(method == null || hUrl == null){
            throw new HttpError(400);
        }
        URL url = URI.create(hUrl).toURL();

        InputStream cl2pr = exchange.getRequestBody();
        OutputStream pr2cl = exchange.getResponseBody();

        HttpURLConnection conn = (HttpURLConnection) url.openConnection();
        try {
            conn.setRequestMethod(method);
        } catch (Throwable e) {
            try {
                Field mt = HttpURLConnection.class.getDeclaredField("method");
                Field del = conn.getClass().getDeclaredField("delegate");
                mt.setAccessible(true);
                del.setAccessible(true);
                mt.set(del.get(conn), method);
            } catch (Exception ignore) {
                throw new HttpError(405);
            }
        }
        outer:
        for (Map.Entry<String, List<String>> pv : headers.entrySet()) {
            if (pv.getKey() == null) continue;
            if (pv.getValue() == null) continue;
            String key = pv.getKey().toLowerCase();
            if(ignoreRequestHeaders.contains(key))continue;
            for(String v : ignoreRequestHeadersPrefix)
                if(key.startsWith(v))continue outer;

            for (String v : pv.getValue()) {
                conn.addRequestProperty(pv.getKey(), v);
            }
        }
        conn.setConnectTimeout(10000);
        conn.setDoInput(true);
        //REQUEST
        if (cl2pr.available() > 0) {
            conn.setDoOutput(true);
            OutputStream pr2sr = conn.getOutputStream();
            copyStream(cl2pr, pr2sr);
            cl2pr.close();
        }
        //RESPONSE
        List<String> expose = new ArrayList<>();
        expose.add("Access-Control-Expose-Headers");
        Headers gds = exchange.getResponseHeaders();
        int stCode;
        try {
            stCode = conn.getResponseCode();
        } catch (Throwable e) {
            stCode = 445;
            gds.add("x-cp-reason", e.toString());
            expose.add("x-cp-reason");
        }
        Map<String, List<String>> headers2 = conn.getHeaderFields();

        InputStream sr2pr;
        try {
            sr2pr = conn.getInputStream();
        } catch (IOException e) {
            sr2pr = conn.getErrorStream();
        }
        for (Map.Entry<String, List<String>> pv : headers2.entrySet()) {
            if (pv.getKey() == null) continue;
            if (pv.getValue() == null) continue;
            String key = pv.getKey().toLowerCase();
            if(ignoreResponseHeaders.contains(key))continue;
            for (String v : pv.getValue())
                gds.add(pv.getKey(), v);
            if(!ignoreExposeHeaders.contains(key))
                expose.add(pv.getKey());
        }
        {
            String origin = headers.getFirst("Origin");
            gds.add("Access-Control-Allow-Origin", (origin==null)?"*":origin);
        }
        gds.add("Access-Control-Allow-Credentials", "true");
        gds.add("Access-Control-Expose-Headers", String.join(",", expose));
        gds.add("Access-Control-Max-Age", "86400");
        gds.add("Vary", "Origin");
        exchange.sendResponseHeaders(stCode, 0);
        if (sr2pr != null) copyStream(sr2pr, pr2cl);
        pr2cl.close();
    }
    private static void parseLeAcme(HttpExchange exchange) throws IOException{
        String path = exchange.getRequestURI().getPath();
        String query = exchange.getRequestURI().getQuery();
        if(query!=null && !query.isEmpty())query = "?"+query;
        else query = "";
        if (!path.contains("/../")) {
            if("/le_acme/".equals(path)){
                Headers gds = exchange.getResponseHeaders();
                gds.set("Location", "LetsEncryptACMEv2.html" + query);
                exchange.sendResponseHeaders(302, 0);
                return;
            }
            path = path.substring(1);
            if(path.endsWith(".js"))getRes(exchange, path, "text/javascript; charset=utf-8");
            else if(path.endsWith(".css"))getRes(exchange, path, "text/css; charset=utf-8");
            else if(path.endsWith(".html"))getRes(exchange, path, "text/html; charset=utf-8");
            else if(path.endsWith(".png"))getRes(exchange, path, "image/png");
            else getRes(exchange, path, "application/octet-stream");
        } else throw new HttpError(403);
    }
    private static void getRes(HttpExchange exchange, String file, String type) throws IOException{
        Headers gds = exchange.getRequestHeaders();
        if(RES_HASH.equals(gds.getFirst("If-None-Match"))){
            exchange.sendResponseHeaders(304, -1);
        }
        else try(InputStream in = getAppResource(file)) {
            Headers hds = exchange.getResponseHeaders();
            hds.set("Content-Type", type);
            hds.set("ETag", RES_HASH);
            exchange.sendResponseHeaders(200, in.available());
            try(OutputStream out = exchange.getResponseBody()) {
                copyStream(in, out);
            }
        }
    }
}
