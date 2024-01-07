package mtm.cors_proxy;

import static android.app.NotificationChannel.DEFAULT_CHANNEL_ID;

import android.annotation.SuppressLint;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.Service;
import android.content.Intent;
import android.graphics.Color;
import android.os.IBinder;

public class ServerApk extends Service {

    public static final String CMD_START = "cmd_start";
    public static final String CMD_STOP = "cmd_stop";

    boolean isRunning;
    int idRunning;

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    @Override
    public void onCreate() {
        super.onCreate();
        isRunning = false;
    }

    @SuppressLint("ForegroundServiceType")
    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if(CMD_START.equals(intent.getAction())){
            if(isRunning) {
                stopSelf(startId);
                return START_NOT_STICKY;
            }

            isRunning = true;
            idRunning = startId;

            startForeground(101, getNotification());
            return START_STICKY;
        }
        if(CMD_STOP.equals(intent.getAction())){
            if(!isRunning) {
                stopSelf(startId);
                return START_NOT_STICKY;
            }
            stopForeground(true);
            isRunning = false;
            stopSelf(idRunning);
            stopSelf(startId);
            return START_NOT_STICKY;
        }
        return super.onStartCommand(intent, flags, startId);
    }

    private Notification getNotification(){
        Notification.Builder notifBuilder = new Notification.Builder(this);
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
            NotificationManager notificationManager =
                    (NotificationManager) getSystemService(NOTIFICATION_SERVICE);

            NotificationChannel channel = new NotificationChannel("11", "Default",
                    NotificationManager.IMPORTANCE_HIGH);
            channel.setDescription("Default description");
            channel.enableLights(true);
            channel.setLightColor(Color.RED);
            channel.enableVibration(false);
            notificationManager.createNotificationChannel(channel);
            notifBuilder.setChannelId("11");
        }
        notifBuilder.setContentTitle("setContentTitle")
                .setContentText("setContentText")
                .setPriority(Notification.PRIORITY_HIGH)
                .setSmallIcon(R.mipmap.icon);

        return notifBuilder.build();
    }
}
