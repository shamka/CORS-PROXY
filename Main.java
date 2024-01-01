package cors_proxy;

import com.sun.net.httpserver.Headers;
import com.sun.net.httpserver.HttpServer;

import javax.net.ssl.HttpsURLConnection;
import javax.net.ssl.SSLContext;
import javax.net.ssl.TrustManager;
import javax.net.ssl.X509TrustManager;
import javax.swing.*;
import java.awt.*;
import java.io.Console;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.InetSocketAddress;
import java.net.URL;
import java.net.URLConnection;
import java.security.KeyManagementException;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.security.cert.CertificateException;
import java.security.cert.X509Certificate;
import java.util.List;
import java.util.Map;
import java.util.concurrent.Executors;

import static java.lang.System.setProperty;

public class Main extends JFrame {
    public Main (){
        Container c = getContentPane(); // клиентская область окна
        c.setLayout(new BorderLayout()); // выбираем компоновщик
        // добавляем какие-нибудь дочерние элементы
        // -------------------------------------------
        // настройка окна
        setTitle("CORS PROXY"); // заголовок окна
        // желательные размеры окна
        setPreferredSize(new Dimension(240, 80));
        // завершить приложение при закрытии окна
        setDefaultCloseOperation(JFrame.EXIT_ON_CLOSE);
        pack(); // устанавливаем желательные размеры
        setVisible(true); // отображаем окно
        main2(LOCAL_PORT);
    }

    private static final int LOCAL_PORT = 61988;
    public static void copyStream(InputStream input, OutputStream output) throws IOException
    {
        byte[] buffer = new byte[1024]; // Adjust if you want
        int bytesRead;
        while ((bytesRead = input.read(buffer)) != -1)
            output.write(buffer, 0, bytesRead);
    }

    public static void main2(int port){
        SSLContext context;
        try {
            context = SSLContext.getInstance("TLS");
            context.init(null, new TrustManager[]{new X509TrustManager() {
                @Override
                public void checkClientTrusted(X509Certificate[] chain, String authType) throws CertificateException {}
                @Override
                public void checkServerTrusted(X509Certificate[] chain, String authType) throws CertificateException {}
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
            throw new RuntimeException(e);
        }
        server.createContext("/", exchange -> {
            //System.out.println(exchange.getRequestMethod()+" "+exchange.getRequestURI());
            if("OPTIONS".equals(exchange.getRequestMethod())){
                Headers gds = exchange.getResponseHeaders();
                gds.set("Access-Control-Allow-Origin", "*");
                gds.set("Access-Control-Allow-Headers", "*");
                gds.set("Access-Control-Allow-Methods", "*");
                gds.set("Access-Control-Max-Age", "86400");
                exchange.sendResponseHeaders(200, -1);
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

            URLConnection conn = url.openConnection();

            if(conn instanceof HttpsURLConnection){
                ((HttpsURLConnection)conn).setRequestMethod(method);
            }
            else{
                ((HttpURLConnection)conn).setRequestMethod(method);
            }

            //conn.setRequestProperty("Connection", "close");
            for(Map.Entry<String, List<String>> pv : headers.entrySet()){
                if(pv.getKey() == null)continue;
                if(pv.getValue() == null)continue;
                //if(pv.getKey().equalsIgnoreCase("connection")) continue;
                if(pv.getKey().equalsIgnoreCase("x-cp-method")) continue;
                if(pv.getKey().equalsIgnoreCase("host")) continue;
                if(pv.getKey().equalsIgnoreCase("x-cp-url")) continue;
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
                if (conn instanceof HttpsURLConnection) {
                    stCode = ((HttpsURLConnection) conn).getResponseCode();
                } else {
                    stCode = ((HttpURLConnection) conn).getResponseCode();
                }
            }
            catch (Throwable e){
                stCode = 502;
                gds.add("X-Cp-Reason", e.toString());
            }
            Map<String, List<String>> headers2 = conn.getHeaderFields();

            InputStream sr2pr;
            try {
                sr2pr = conn.getInputStream();
            }
            catch (IOException e){
                if(conn instanceof HttpsURLConnection){
                    sr2pr = ((HttpsURLConnection)conn).getErrorStream();
                }
                else{
                    sr2pr = ((HttpURLConnection)conn).getErrorStream();
                }
            }
            for(Map.Entry<String, List<String>> pv : headers2.entrySet()){
                if(pv.getKey() == null)continue;
                if(pv.getValue() == null)continue;
                //if(pv.getKey().equalsIgnoreCase("connection")) continue;
                if(pv.getKey().equalsIgnoreCase("access-control-allow-origin")) continue;
                if(pv.getKey().equalsIgnoreCase("access-control-allow-headers")) continue;
                if(pv.getKey().equalsIgnoreCase("access-control-allow-methods")) continue;
                if(pv.getKey().equalsIgnoreCase("access-control-max-age")) continue;
                for(String v : pv.getValue())
                    gds.set(pv.getKey(), v);
            }
            gds.set("Access-Control-Allow-Origin",  "*");
            gds.set("Access-Control-Allow-Headers", "*");
            gds.set("Access-Control-Allow-Methods", "*");
            //gds.set("Connection", "close");
            gds.set("Access-Control-Max-Age", "86400");
            exchange.sendResponseHeaders(stCode, 0);
            if(sr2pr != null)copyStream(sr2pr, pr2cl);
            pr2cl.close();
        });
        server.setExecutor(Executors.newFixedThreadPool(10));
        server.start();
    }

    public static void main(String[] args) {
        setProperty("sun.net.http.allowRestrictedHeaders", "true");
        Console console = System.console();
        if(console == null){
            new Main();
        }
        else{
            //CONSOLE
            System.out.println("Press Ctrl+C to exit..");
            main2(LOCAL_PORT);
        }

    }
}
