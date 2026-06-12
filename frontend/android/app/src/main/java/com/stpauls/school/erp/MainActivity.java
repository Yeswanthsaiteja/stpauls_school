package com.stpauls.school.erp;

import android.webkit.WebSettings;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onResume() {
        super.onResume();
        if (bridge != null && bridge.getWebView() != null) {
            WebSettings settings = bridge.getWebView().getSettings();
            settings.setTextZoom(100);
            settings.setSupportZoom(false);
            settings.setBuiltInZoomControls(false);
        }
    }
}
