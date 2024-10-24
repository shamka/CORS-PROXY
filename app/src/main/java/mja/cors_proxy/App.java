package mja.cors_proxy;

import java.io.IOException;
import java.io.InputStream;

public class App extends android.app.Application {
    private boolean isRun = false;
    private static App inst;

    public void setRun(boolean run) {
        isRun = run;
    }

    public boolean isRun() {
        return isRun;
    }

    @Override
    public void onCreate() {
        super.onCreate();
        inst = this;
    }
    public static App getContext(){
        return inst;
    }
    public static InputStream open(String path){
        try {
            return getContext().getAssets().open(path);
        } catch (IOException e) {
            throw new Server.HttpError(404);
        }
    }
}
