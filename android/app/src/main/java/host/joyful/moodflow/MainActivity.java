package host.joyful.moodflow;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
  @Override
  protected void onCreate(Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);
    // 注册自定义原生插件：ApkUpdater，用于在应用内下载并安装 APK
    this.registerPlugin(ApkUpdater.class);
  }
}