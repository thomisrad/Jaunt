package com.thomisrad.jaunt;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Jaunt's own photo picker that keeps photo locations
        registerPlugin(JauntPhotosPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
