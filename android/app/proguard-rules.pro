# Add project specific ProGuard rules here.
# You can control the set of applied configuration files using the
# proguardFiles setting in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# If your project uses WebView with JS, uncomment the following
# and specify the fully qualified class name to the JavaScript interface
# class:
#-keepclassmembers class fqcn.of.javascript.interface.for.webview {
#   public *;
#}

# Uncomment this to preserve the line number information for
# debugging stack traces.
#-keepattributes SourceFile,LineNumberTable

# If you keep the line number information, uncomment this to
# hide the original source file name.
#-renamesourcefileattribute SourceFile

# Keep Capacitor core and plugin classes to ensure bridge reflection works
-keep class com.getcapacitor.** { *; }
-keep class * extends com.getcapacitor.Plugin { *; }

# Keep Cordova bridge & plugins (used via capacitor-cordova-android-plugins)
-keep class org.apache.cordova.** { *; }
-keep class * extends org.apache.cordova.CordovaPlugin { *; }

# Ensure entry Activity is never obfuscated or removed (referenced by AndroidManifest)
-keep class host.joyful.moodflow.MainActivity { *; }

# If using WebView JS interfaces, keep methods annotated with @JavascriptInterface
-keepclassmembers class * { @android.webkit.JavascriptInterface <methods>; }

# Preserve runtime annotations so that @JavascriptInterface-based keeps are effective
-keepattributes *Annotation*
