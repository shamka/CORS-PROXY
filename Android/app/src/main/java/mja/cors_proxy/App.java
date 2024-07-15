package mja.cors_proxy;

public class App extends android.app.Application {
    private boolean isRun = false;

    public void setRun(boolean run) {
        isRun = run;
    }

    public boolean isRun() {
        return isRun;
    }
}
