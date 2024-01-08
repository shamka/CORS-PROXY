package mtm.cors_proxy;

import static android.content.Intent.ACTION_MAIN;
import static android.content.Intent.FLAG_ACTIVITY_NEW_TASK;

import android.Manifest;
import android.app.Activity;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.provider.Settings;
import android.widget.Toast;


public class MainApk extends Activity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        if(!parseIntent(getIntent()))
            finish();
    }

    @Override
    protected void onNewIntent(Intent intent) {
        if(!parseIntent(intent)){
            super.onNewIntent(intent);
            finish();
        }
    }

    private boolean parseIntent(Intent intent){
        switch(intent.getAction()){
            default:return false;

            case ServerApk.CMD_START:
            case ACTION_MAIN: {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                    if (PackageManager.PERMISSION_GRANTED != checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS)) {
                        if(!getNotSt()) {
                            if (shouldShowRequestPermissionRationale(Manifest.permission.POST_NOTIFICATIONS)) {
                                requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS}, 102);
                            } else {
                                requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS}, 101);
                            }
                            return true;
                        }
                        else{
                            requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS}, 103);
                            return true;
                        }
                    }
                }
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O)
                    startForegroundService(new Intent(this, ServerApk.class).setAction(ServerApk.CMD_START));
                else
                    startService(new Intent(this, ServerApk.class).setAction(ServerApk.CMD_START));
                break;
            }

            case ServerApk.CMD_STOP:{
                startService(new Intent(this, ServerApk.class).setAction(ServerApk.CMD_STOP));
                break;
            }
        }
        finish();
        return true;
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        if(requestCode == 101){
            if(grantResults[0] == PackageManager.PERMISSION_GRANTED){
                parseIntent(new Intent(ServerApk.CMD_START));
            }
            else{
                Toast.makeText(this, R.string.notification_please, Toast.LENGTH_SHORT).show();
            }
            finish();
        }
        if(requestCode == 102){
            if(grantResults[0] == PackageManager.PERMISSION_GRANTED){
                parseIntent(new Intent(ServerApk.CMD_START));
            }
            else{
                Toast.makeText(this, R.string.notification_please, Toast.LENGTH_SHORT).show();
                setNotSt(true);
            }
            finish();
        }
        if(requestCode == 103){
            if(grantResults[0] == PackageManager.PERMISSION_GRANTED){
                parseIntent(new Intent(ServerApk.CMD_START));
            }
            else{
                startActivity(new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS)
                        .setData(Uri.fromParts("package", getPackageName(), null)));
                Toast.makeText(this, R.string.notification_please, Toast.LENGTH_SHORT).show();
            }
            finish();
        }
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
    }

    SharedPreferences sPref;
    void setNotSt(boolean st) {
        sPref = getPreferences(MODE_PRIVATE);
        SharedPreferences.Editor ed = sPref.edit();
        ed.putBoolean("ST", st);
        ed.apply();
    }

    boolean getNotSt() {
        sPref = getPreferences(MODE_PRIVATE);
        return sPref.getBoolean("ST", false);
    }

}
