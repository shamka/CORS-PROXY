package mtm.cors_proxy;

import android.annotation.SuppressLint;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.graphics.Color;
import android.graphics.drawable.Icon;
import android.os.Build;
import android.os.IBinder;
import android.widget.Toast;

import cors_proxy.Server;

public class ServerApk extends Service {

    public static final String CMD_START = "cmd_start";
    public static final String CMD_STOP = "cmd_stop";
    public static final String CMD_NOTIFICATION = "need_notification";

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
        if(intent == null){
            Toast.makeText(this, "NULL", Toast.LENGTH_LONG).show();
            stopSelf();
            return START_NOT_STICKY;
        }
        if(CMD_START.equals(intent.getAction())){
            if(isRunning) {
                return START_NOT_STICKY;
            }

            isRunning = true;
            Toast.makeText(this,R.string.starting, Toast.LENGTH_SHORT).show();
            idRunning = startId;

            if (Build.VERSION.SDK_INT <= Build.VERSION_CODES.TIRAMISU) {
                startForeground(101, getNotification());
            }
            else{
                startForeground(101, getNotification(), ServiceInfo.FOREGROUND_SERVICE_TYPE_MANIFEST);
            }
            Server.startServer();
            return START_REDELIVER_INTENT;
        }
        if(CMD_STOP.equals(intent.getAction())){
            if(!isRunning) {
                stopSelf();
                return START_NOT_STICKY;
            }
            Toast.makeText(getBaseContext(),R.string.stopping, Toast.LENGTH_SHORT).show();
            Server.stopServer();
            stopForeground(true);
            isRunning = false;
            stopSelf(idRunning);
            stopSelf(startId);
            return START_NOT_STICKY;
        }
        return super.onStartCommand(intent, flags, startId);
    }

    private Notification getNotification(){
        Notification.Builder notificationBuilder = new Notification.Builder(this);
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
            NotificationManager notificationManager =
                    (NotificationManager) getSystemService(NOTIFICATION_SERVICE);

            NotificationChannel channel = new NotificationChannel("11", "Default",
                    NotificationManager.IMPORTANCE_HIGH);
            channel.setDescription("Default description");
            channel.enableLights(true);
            channel.setLightColor(Color.RED);
            channel.enableVibration(false);
            channel.setImportance(NotificationManager.IMPORTANCE_NONE);
            notificationManager.createNotificationChannel(channel);
            notificationBuilder.setChannelId("11");
        }

        notificationBuilder.setContentTitle(getString(R.string.is_running))
                .setContentText(String.format(getString(R.string.version), Server.VERSION))
                .setPriority(Notification.PRIORITY_MIN)
                .setOngoing(true)
                .setContentIntent(PendingIntent.getActivity(this,
                        0,
                        new Intent(this, MainApk.class).setAction(CMD_STOP),
                        PendingIntent.FLAG_IMMUTABLE))
                .setSmallIcon(R.mipmap.notif);

        return notificationBuilder.build();
    }
}
