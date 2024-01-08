package cors_proxy;

import com.sun.net.httpserver.Headers;
import com.sun.net.httpserver.HttpServer;

import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.lang.reflect.Field;
import java.net.HttpURLConnection;
import java.net.InetSocketAddress;
import java.net.URL;
import java.security.KeyManagementException;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.security.cert.X509Certificate;
import java.util.List;
import java.util.Map;
import java.util.concurrent.Executors;

import javax.net.ssl.HttpsURLConnection;
import javax.net.ssl.SSLContext;
import javax.net.ssl.TrustManager;
import javax.net.ssl.X509TrustManager;

public class Server {
    public static final String VERSION = "1.1.0";
    public static final int LOCAL_PORT = 61988;
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
    @SuppressWarnings("UnusedReturnValue")
    public static boolean stopServer(){
        if(singleTonServer == null)return false;
        singleTonServer.stop(0);
        singleTonServer = null;
        return true;
    }
    private static void startServer(int port){

        SSLContext context;
        try {
            context = SSLContext.getInstance("TLS");
            context.init(null, new TrustManager[]{new X509TrustManager() {
                @Override
                public void checkClientTrusted(X509Certificate[] chain, String authType) {}
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
        server.createContext("/cors", exchange -> {
            if("OPTIONS".equals(exchange.getRequestMethod())){
                Headers gds = exchange.getResponseHeaders();
                gds.set("Access-Control-Allow-Origin", "*");
                gds.set("Access-Control-Allow-Headers", "*");
                gds.set("Access-Control-Allow-Methods", "*");
                gds.set("Access-Control-Expose-Headers", "*");
                gds.set("Access-Control-Max-Age", "86400");
                exchange.sendResponseHeaders(204, -1);
                exchange.close();
                return;
            }
            if(!"POST".equals(exchange.getRequestMethod())){
                exchange.sendResponseHeaders(400, -1);
                exchange.close();
                return;
            }
            Headers headers = exchange.getRequestHeaders();
            String method = headers.get("x-cp-method").get(0);
            URL url = new URL(headers.get("x-cp-url").get(0));

            InputStream cl2pr = exchange.getRequestBody();
            OutputStream pr2cl = exchange.getResponseBody();

            HttpURLConnection conn = (HttpURLConnection)url.openConnection();
            try {
                conn.setRequestMethod(method);
            }
            catch (Throwable e){
                try {
                    Field mt = HttpURLConnection.class.getDeclaredField("method");
                    Field del = conn.getClass().getDeclaredField("delegate");
                    mt.setAccessible(true);
                    del.setAccessible(true);
                    mt.set(del.get(conn), method);
                }
                catch (Exception ignore) {
                    exchange.sendResponseHeaders(405, -1);
                    exchange.close();
                    return;
                }
            }
            for(Map.Entry<String, List<String>> pv : headers.entrySet()){
                if(pv.getKey() == null)continue;
                if(pv.getValue() == null)continue;
                if(pv.getKey().equalsIgnoreCase("x-cp-method")
                    ||pv.getKey().equalsIgnoreCase("host")
                    ||pv.getKey().equalsIgnoreCase("cookie")
                    ||pv.getKey().toLowerCase().startsWith("sec-fetch-")
                    ||pv.getKey().equalsIgnoreCase("x-cp-url")) continue;
                for(String v : pv.getValue()) {
                    conn.addRequestProperty(pv.getKey(), v);
                }
            }
            conn.setConnectTimeout(10000);
            conn.setDoInput(true);
            //REQUEST
            if(cl2pr.available() > 0) {
                conn.setDoOutput(true);
                OutputStream pr2sr = conn.getOutputStream();
                copyStream(cl2pr, pr2sr);
            }
            //RESPONSE
            Headers gds = exchange.getResponseHeaders();
            int stCode;
            try {
                stCode = conn.getResponseCode();
            }
            catch (Throwable e){
                stCode = 445;
                gds.add("X-Cp-Reason", e.toString());
            }
            Map<String, List<String>> headers2 = conn.getHeaderFields();

            InputStream sr2pr;
            try {
                sr2pr = conn.getInputStream();
            }
            catch (IOException e){
                sr2pr = conn.getErrorStream();
            }
            for(Map.Entry<String, List<String>> pv : headers2.entrySet()){
                if(pv.getKey() == null)continue;
                if(pv.getValue() == null)continue;
                if(pv.getKey().equalsIgnoreCase("access-control-allow-origin")
                    ||pv.getKey().equalsIgnoreCase("access-control-allow-headers")
                    ||pv.getKey().equalsIgnoreCase("access-control-allow-methods")
                    ||pv.getKey().equalsIgnoreCase("access-control-max-age")
                    ||pv.getKey().equalsIgnoreCase("access-control-expose-headers")
                    ||pv.getKey().equalsIgnoreCase("set-cookie")
                    ||pv.getKey().equalsIgnoreCase("set-cookie2")) continue;
                for(String v : pv.getValue())
                    gds.set(pv.getKey(), v);
            }
            gds.set("Access-Control-Allow-Origin",  "*");
            gds.set("Access-Control-Allow-Headers", "*");
            gds.set("Access-Control-Allow-Methods", "*");
            gds.set("Access-Control-Expose-Headers", "*");
            gds.set("Access-Control-Max-Age", "86400");
            exchange.sendResponseHeaders(stCode, 0);
            if(sr2pr != null)copyStream(sr2pr, pr2cl);
            pr2cl.close();
        });
        server.setExecutor(Executors.newFixedThreadPool(10));
        server.start();
        singleTonServer = server;
        singleTonServerPrep = false;
    }

}
