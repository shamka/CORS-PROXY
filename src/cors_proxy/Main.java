package cors_proxy;

import com.sun.net.httpserver.Headers;
import com.sun.net.httpserver.HttpServer;

import javax.imageio.ImageIO;
import javax.net.ssl.HttpsURLConnection;
import javax.net.ssl.SSLContext;
import javax.net.ssl.TrustManager;
import javax.net.ssl.X509TrustManager;
import javax.swing.*;
import java.awt.*;
import java.awt.image.BufferedImage;
import java.io.Console;
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

import static java.lang.System.setProperty;

public class Main extends JFrame {
    private static final String VERSION = "1.0.1";
    public Main (){
        Container c = getContentPane();
        c.setLayout(new BorderLayout());
        setTitle("CORS PROXY");
        setPreferredSize(new Dimension(240, 80));
        JLabel ver = new JLabel("Version: "+VERSION,JLabel.CENTER);
        getContentPane().add(ver);
        setDefaultCloseOperation(JFrame.EXIT_ON_CLOSE);
        addWindowStateListener(e -> {
            if((e.getNewState() == 1) && SystemTray.isSupported()) {
                setVisible(false);
            }
        });
        pack();
        boolean trayB = false;
        BufferedImage iconImage;
        try(InputStream is = this.getClass().getClassLoader().getResourceAsStream("res/mipmap/icon.png")){
            if(is != null) {
                iconImage = ImageIO.read(is);
                trayB = true;
            }
            else throw new RuntimeException();
        } catch (Exception ignored) {
            iconImage = new BufferedImage(32,32,BufferedImage.TYPE_INT_RGB);
        }

        if (trayB && !SystemTray.isSupported()) {
            setVisible(true);
        }
        else{
            setVisible(false);
            final PopupMenu popup = new PopupMenu();
            final SystemTray tray = SystemTray.getSystemTray();

            MenuItem version = new MenuItem("Version: "+VERSION);
            version.setEnabled(false);
            MenuItem exitItem = new MenuItem("Exit");
            exitItem.setActionCommand("EXIT");
            exitItem.addActionListener(e -> {
                if("EXIT".equals(e.getActionCommand()))
                    System.exit(0);
            });
            popup.add(version);
            popup.add(exitItem);
            final TrayIcon trayIcon = new TrayIcon(iconImage.getScaledInstance(16,-1,Image.SCALE_SMOOTH));
            trayIcon.setPopupMenu(popup);
            trayIcon.setActionCommand("OPEN");
            trayIcon.addActionListener(e -> {
                if("OPEN".equals(e.getActionCommand())) {
                    setVisible(true);
                    setState(Frame.NORMAL);
                    requestFocus();
                }
            });
            try {
                tray.add(trayIcon);
            } catch (AWTException e) {
                setVisible(true);
            }
        }

        main2(LOCAL_PORT);
    }

    private static final int LOCAL_PORT = 61988;
    public static void copyStream(InputStream input, OutputStream output) throws IOException
    {
        byte[] buffer = new byte[1024];
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
                if(pv.getKey().equalsIgnoreCase("x-cp-method")) continue;
                if(pv.getKey().equalsIgnoreCase("host")) continue;
                if(pv.getKey().equalsIgnoreCase("cookie")) continue;
                if(pv.getKey().toLowerCase().startsWith("sec-fetch-")) continue;
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
                if(pv.getKey().equalsIgnoreCase("access-control-allow-origin")) continue;
                if(pv.getKey().equalsIgnoreCase("access-control-allow-headers")) continue;
                if(pv.getKey().equalsIgnoreCase("access-control-allow-methods")) continue;
                if(pv.getKey().equalsIgnoreCase("access-control-max-age")) continue;
                if(pv.getKey().equalsIgnoreCase("access-control-expose-headers")) continue;
                if(pv.getKey().equalsIgnoreCase("set-cookie")) continue;
                if(pv.getKey().equalsIgnoreCase("set-cookie2")) continue;
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
    }

    public static void main(String[] args) {
        setProperty("sun.net.http.allowRestrictedHeaders", "true");
        Console console = System.console();
        if(console == null){
            new Main();
        }
        else{
            //CONSOLE
            System.out.println("Version: " + VERSION);
            System.out.println("Press Ctrl+C to exit..");
            main2(LOCAL_PORT);
        }

    }
}
