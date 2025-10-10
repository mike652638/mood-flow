package host.joyful.moodflow;

import android.app.DownloadManager;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.database.Cursor;
import android.os.Environment;
import android.provider.Settings;
import androidx.core.content.FileProvider;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.PluginMethod;

import java.io.File;

@CapacitorPlugin(name = "ApkUpdater")
public class ApkUpdater extends Plugin {

    @PluginMethod
    public void download(PluginCall call) {
        String url = call.getString("url");
        String fileName = call.getString("fileName", "update.apk");
        if (url == null || url.isEmpty()) {
            call.reject("Missing url");
            return;
        }
        Context context = getContext();
        try {
            DownloadManager dm = (DownloadManager) context.getSystemService(Context.DOWNLOAD_SERVICE);
            DownloadManager.Request req = new DownloadManager.Request(Uri.parse(url));
            req.setTitle("下载更新包");
            req.setDescription(fileName);
            req.setAllowedOverMetered(true);
            req.setAllowedOverRoaming(true);
            req.setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE);
            req.setDestinationInExternalFilesDir(context, Environment.DIRECTORY_DOWNLOADS, fileName);

            long id = dm.enqueue(req);

            // 周期性查询下载进度，并通过事件通知到前端
            new Thread(() -> {
                boolean running = true;
                DownloadManager.Query query = new DownloadManager.Query();
                query.setFilterById(id);
                while (running) {
                    try {
                        Cursor cursor = dm.query(query);
                        if (cursor != null && cursor.moveToFirst()) {
                            int status = cursor.getInt(cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_STATUS));
                            long downloaded = cursor.getLong(cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_BYTES_DOWNLOADED_SO_FAR));
                            long total = cursor.getLong(cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_TOTAL_SIZE_BYTES));

                            JSObject ev = new JSObject();
                            ev.put("id", id);
                            ev.put("downloaded", downloaded);
                            ev.put("total", total);
                            notifyListeners("downloadProgress", ev);

                            if (status == DownloadManager.STATUS_SUCCESSFUL) {
                                running = false;
                            } else if (status == DownloadManager.STATUS_FAILED) {
                                running = false;
                                JSObject err = new JSObject();
                                err.put("id", id);
                                notifyListeners("downloadFailed", err);
                            }
                        }
                        if (cursor != null) cursor.close();
                    } catch (Exception ignored) {}

                    try { Thread.sleep(500); } catch (InterruptedException ignored) {}
                }
            }).start();

            BroadcastReceiver receiver = new BroadcastReceiver() {
                @Override
                public void onReceive(Context c, Intent intent) {
                    long completeId = intent.getLongExtra(DownloadManager.EXTRA_DOWNLOAD_ID, -1);
                    if (completeId == id) {
                        try {
                            c.unregisterReceiver(this);
                        } catch (Exception ignored) {}
                        File file = new File(context.getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS), fileName);
                        JSObject ret = new JSObject();
                        ret.put("ok", true);
                        ret.put("path", file.getAbsolutePath());
                        // 事件通知：下载完成
                        JSObject ev = new JSObject();
                        ev.put("id", id);
                        ev.put("path", file.getAbsolutePath());
                        notifyListeners("downloadCompleted", ev);
                        call.resolve(ret);
                    }
                }
            };
            context.registerReceiver(receiver, new IntentFilter(DownloadManager.ACTION_DOWNLOAD_COMPLETE));
        } catch (Exception e) {
            JSObject err = new JSObject();
            err.put("ok", false);
            err.put("error", e.getMessage());
            notifyListeners("downloadFailed", err);
            call.reject("Download error: " + e.getMessage());
        }
    }

    @PluginMethod
    public void install(PluginCall call) {
        String path = call.getString("path");
        if (path == null || path.isEmpty()) {
            call.reject("Missing path");
            return;
        }
        Context ctx = getContext();
        try {
            File apk = new File(path);
            if (!apk.exists()) {
                call.reject("APK not found at path");
                return;
            }

            PackageManager pm = ctx.getPackageManager();
            boolean canInstall = pm.canRequestPackageInstalls();
            if (!canInstall) {
                // 跳转设置页以授予未知来源安装权限
                try {
                    Intent permIntent = new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
                            Uri.parse("package:" + ctx.getPackageName()));
                    permIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                    ctx.startActivity(permIntent);
                } catch (Exception ignored) {}
                JSObject ret = new JSObject();
                ret.put("ok", false);
                ret.put("requiresPermission", true);
                call.resolve(ret);
                return;
            }

            Uri contentUri = FileProvider.getUriForFile(ctx, ctx.getPackageName() + ".fileprovider", apk);
            Intent intent = new Intent(Intent.ACTION_INSTALL_PACKAGE);
            intent.setData(contentUri);
            intent.putExtra(Intent.EXTRA_NOT_UNKNOWN_SOURCE, true);
            intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            ctx.startActivity(intent);

            JSObject ret = new JSObject();
            ret.put("ok", true);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Install error: " + e.getMessage());
        }
    }
}