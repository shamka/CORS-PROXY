package cors_proxy;

import javax.imageio.ImageIO;
import javax.swing.*;
import java.awt.*;
import java.awt.image.BufferedImage;
import java.io.InputStream;
import java.lang.management.ManagementFactory;

import static java.lang.System.setProperty;

public class JarMain extends JFrame {

    public static final String GUI_VERSION = "1.0.0";
    public static void main(String[] args) {
        setProperty("sun.net.http.allowRestrictedHeaders", "true");
        boolean useWin;
        boolean hasConsole = System.console() != null;
        boolean hasStdIn = System.in != null;
        boolean hasStdOut = System.out != null;

        if(hasConsole)
            useWin = false;
        else if(hasStdIn && hasStdOut)
            useWin = !ManagementFactory.getRuntimeMXBean().getInputArguments().contains("-Djava.awt.headless=true");
        else
            useWin = true;
        if(useWin){
            new JarMain();
        }
        else{
            //CONSOLE
            if(hasStdOut) {
                System.out.println("Gui version: " + GUI_VERSION);
                System.out.println("Server version: " + Server.VERSION);
                System.out.println("Press Ctrl+C to exit..");
            }
            Server.startServer();
        }

    }
    public JarMain(){
        Container c = getContentPane();
        c.setLayout(new BorderLayout());
        setTitle("CORS PROXY");
        setPreferredSize(new Dimension(240, 90));
        JLabel ver = new JLabel("<html>Gui version: "+GUI_VERSION+"<br>Server Version: "+Server.VERSION+"</html>",JLabel.CENTER);
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
                if(iconImage==null)throw new RuntimeException();
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

            MenuItem versionGui = new MenuItem("Gui version: "+GUI_VERSION);
            MenuItem version = new MenuItem("Server version: "+Server.VERSION);
            version.setEnabled(false);
            versionGui.setEnabled(false);
            MenuItem exitItem = new MenuItem("Exit");
            exitItem.setActionCommand("EXIT");
            exitItem.addActionListener(e -> {
                if("EXIT".equals(e.getActionCommand()))
                    System.exit(0);
            });
            popup.add(versionGui);
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

        Server.startServer();
    }
}
