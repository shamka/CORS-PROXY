package mtm.cors_proxy;

import android.app.Activity;
import android.content.Intent;
import android.os.Build;
import android.os.Bundle;


public class MainApk extends Activity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        Intent intent = getIntent();

        if(ServerApk.CMD_STOP.equals(intent.getAction())){
            stopService(new Intent(this, ServerApk.class).setAction(ServerApk.CMD_STOP));
        }
        else {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O)
                startForegroundService(new Intent(this, ServerApk.class).setAction(ServerApk.CMD_START));
            else
                startService(new Intent(this, ServerApk.class).setAction(ServerApk.CMD_START));
        }
        finish();
    }
}
