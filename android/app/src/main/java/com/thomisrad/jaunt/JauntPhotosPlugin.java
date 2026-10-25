package com.thomisrad.jaunt;

import android.Manifest;
import android.app.Activity;
import android.content.ClipData;
import android.content.Intent;
import android.media.ExifInterface;
import android.net.Uri;
import android.os.Build;
import android.provider.MediaStore;

import androidx.activity.result.ActivityResult;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Logger;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.util.ArrayList;
import java.util.List;

/**
 * Jaunt's photo picker.
 *
 * Android hides where a photo was taken from browsers and from its newer photo picker.
 * This uses the system file picker (ACTION_OPEN_DOCUMENT), which hands over the original
 * file with its location intact, and asks for ACCESS_MEDIA_LOCATION as a backup route.
 *
 * Each picked photo is copied (byte for byte, so nothing is lost) into the app's cache,
 * and its location and capture time are read with ExifInterface.
 */
@CapacitorPlugin(
    name = "JauntPhotos",
    permissions = { @Permission(alias = "mediaLocation", strings = { Manifest.permission.ACCESS_MEDIA_LOCATION }) }
)
public class JauntPhotosPlugin extends Plugin {

    private static final int MAX_PHOTOS = 9;
    private static final String CACHE_PREFIX = "jaunt-photo-";

    @PluginMethod
    public void pick(PluginCall call) {
        boolean needsPermission = Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q
            && getPermissionState("mediaLocation") != PermissionState.GRANTED;
        if (needsPermission) {
            // Ask once; we open the picker either way.
            requestPermissionForAlias("mediaLocation", call, "afterPermission");
        } else {
            openPicker(call);
        }
    }

    @PermissionCallback
    private void afterPermission(PluginCall call) {
        openPicker(call);
    }

    private void openPicker(PluginCall call) {
        Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT);
        intent.addCategory(Intent.CATEGORY_OPENABLE);
        intent.setType("image/*");
        intent.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true);
        startActivityForResult(call, intent, "afterPick");
    }

    @ActivityCallback
    private void afterPick(PluginCall call, ActivityResult result) {
        if (call == null) return;
        if (result.getResultCode() != Activity.RESULT_OK || result.getData() == null) {
            JSObject empty = new JSObject();
            empty.put("photos", new JSArray());
            call.resolve(empty);
            return;
        }

        final List<Uri> uris = new ArrayList<>();
        Intent data = result.getData();
        ClipData clip = data.getClipData();
        if (clip != null) {
            for (int i = 0; i < clip.getItemCount(); i++) uris.add(clip.getItemAt(i).getUri());
        } else if (data.getData() != null) {
            uris.add(data.getData());
        }

        // Copying files can take a moment, so do it off the main thread.
        new Thread(() -> {
            clearOldCopies();
            JSArray photos = new JSArray();
            int count = Math.min(uris.size(), MAX_PHOTOS);
            for (int i = 0; i < count; i++) {
                try {
                    photos.put(readPhoto(uris.get(i), i));
                } catch (Exception e) {
                    Logger.error("JauntPhotos", "Could not read photo " + uris.get(i), e);
                }
            }
            JSObject ret = new JSObject();
            ret.put("photos", photos);
            ret.put("skipped", Math.max(0, uris.size() - MAX_PHOTOS));
            call.resolve(ret);
        }).start();
    }

    private JSObject readPhoto(Uri uri, int index) throws Exception {
        String mime = getContext().getContentResolver().getType(uri);
        String ext = (mime != null && mime.contains("heic")) ? ".heic" : ".jpg";
        File copy = new File(getContext().getCacheDir(), CACHE_PREFIX + System.currentTimeMillis() + "-" + index + ext);
        copyUri(uri, copy);

        ExifInterface exif = new ExifInterface(copy.getAbsolutePath());
        float[] latLong = new float[2];
        boolean hasLocation = exif.getLatLong(latLong);

        // Backup route: ask the media store for the unredacted original.
        if (!hasLocation && Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q
                && getPermissionState("mediaLocation") == PermissionState.GRANTED
                && "media".equals(uri.getAuthority())) {
            try {
                copyUri(MediaStore.setRequireOriginal(uri), copy);
                exif = new ExifInterface(copy.getAbsolutePath());
                hasLocation = exif.getLatLong(latLong);
            } catch (Exception e) {
                Logger.debug("JauntPhotos", "Original not available for " + uri + ": " + e.getMessage());
            }
        }

        // (0, 0) is a placeholder some cameras write when they had no GPS fix.
        if (hasLocation && latLong[0] == 0f && latLong[1] == 0f) hasLocation = false;

        JSObject photo = new JSObject();
        photo.put("path", copy.getAbsolutePath());
        photo.put("mimeType", mime);
        photo.put("lat", hasLocation ? (Object) (double) latLong[0] : JSObject.NULL);
        photo.put("lon", hasLocation ? (Object) (double) latLong[1] : JSObject.NULL);
        String taken = exif.getAttribute(ExifInterface.TAG_DATETIME_ORIGINAL);
        if (taken == null) taken = exif.getAttribute(ExifInterface.TAG_DATETIME);
        photo.put("taken", taken != null ? taken : JSObject.NULL); // "yyyy:MM:dd HH:mm:ss", camera's local time
        return photo;
    }

    private void copyUri(Uri uri, File dest) throws Exception {
        try (InputStream in = getContext().getContentResolver().openInputStream(uri);
             OutputStream out = new FileOutputStream(dest)) {
            if (in == null) throw new Exception("Could not open " + uri);
            byte[] buffer = new byte[64 * 1024];
            int n;
            while ((n = in.read(buffer)) != -1) out.write(buffer, 0, n);
        }
    }

    private void clearOldCopies() {
        File[] files = getContext().getCacheDir().listFiles();
        if (files == null) return;
        for (File f : files) {
            if (f.getName().startsWith(CACHE_PREFIX)) {
                //noinspection ResultOfMethodCallIgnored
                f.delete();
            }
        }
    }
}
