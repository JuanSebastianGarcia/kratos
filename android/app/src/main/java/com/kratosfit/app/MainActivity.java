package com.kratosfit.app;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        // plugin propio de la app (cuenta regresiva y alarma del descanso); debe ir antes de super.onCreate
        registerPlugin(RestTimerPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
