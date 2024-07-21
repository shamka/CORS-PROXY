package cors_proxy;

import android.annotation.SuppressLint;

import com.sun.net.httpserver.Headers;
import com.sun.net.httpserver.HttpServer;

import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.lang.reflect.Field;
import java.net.HttpURLConnection;
import java.net.InetSocketAddress;
import java.net.URI;
import java.net.URL;
import java.security.KeyManagementException;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.security.cert.X509Certificate;
import java.util.*;
import java.util.concurrent.Executors;

import javax.net.ssl.HttpsURLConnection;
import javax.net.ssl.SSLContext;
import javax.net.ssl.TrustManager;
import javax.net.ssl.X509TrustManager;

public class Server {
    public static final String VERSION = "1.1.3";
    public static final int LOCAL_PORT = 61988;
    private static final Set<String> ignoreExposeHeaders = Set.of(
            "cache-control", "content-language", "content-length",
            "content-type", "expires", "last-modified", "pragma");
    private static final Set<String> ignoreRequestHeaders = Set.of(
            "x-cp-method", "host", "cookie", "cookie2", "x-cp-url");
    private static final Set<String> ignoreRequestHeadersPrefix = Set.copyOf(Collections.singletonList("sec-fetch-"));
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

    private Server(){}

    private static HttpServer singleTonServer = null;
    private static boolean singleTonServerPrep = false;

    @SuppressWarnings("UnusedReturnValue")
    public static boolean startServer(){
        if(singleTonServer == null && !singleTonServerPrep){
            singleTonServerPrep = true;
            new Thread(() -> startServer(LOCAL_PORT)).start();
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
    /** @noinspection SameParameterValue*/
    @SuppressLint("CustomX509TrustManager")
    private static void startServer(int port){

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
        } catch (NoSuchAlgorithmException | KeyManagementException e) {return;}

        HttpsURLConnection.setDefaultSSLSocketFactory(context.getSocketFactory());

        HttpServer server = null;
        try {
            server = HttpServer.create(new InetSocketAddress("localhost", port), 10);
        } catch (IOException e) {
            System.err.println(e.getMessage());
            System.exit(-1);
        }
        if(server != null) {
            server.createContext("/cors", exchange -> {
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

                    exchange.sendResponseHeaders(204, -1);
                    exchange.close();
                    return;
                }
                if (!"POST".equals(exchange.getRequestMethod())) {
                    exchange.sendResponseHeaders(400, -1);
                    exchange.close();
                    return;
                }
                Headers headers = exchange.getRequestHeaders();
                String method = headers.getFirst("x-cp-method");
                String hUrl = headers.getFirst("x-cp-url");
                if(method == null || hUrl == null){
                    exchange.sendResponseHeaders(400, -1);
                    exchange.close();
                    return;
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
                        exchange.sendResponseHeaders(405, -1);
                        exchange.close();
                        return;
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
                }
                //RESPONSE
                List<String> expose = new ArrayList<>();
                Headers gds = exchange.getResponseHeaders();
                int stCode;
                try {
                    stCode = conn.getResponseCode();
                } catch (Throwable e) {
                    stCode = 445;
                    gds.add("X-Cp-Reason", e.toString());
                    expose.add("X-Cp-Reason");
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
            });
            server.setExecutor(Executors.newFixedThreadPool(10));
            server.start();
        }
        singleTonServer = server;
        singleTonServerPrep = false;
    }

}
