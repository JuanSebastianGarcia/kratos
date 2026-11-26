package com.kratosfit.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.graphics.Color;
import android.media.AudioAttributes;
import android.media.AudioManager;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;
import androidx.core.app.NotificationCompat;

/**
 * Se ejecuta a la hora exacta del fin del descanso (AlarmManager), aunque la app esté en segundo
 * plano, cerrada o con la pantalla apagada. Quita la cuenta regresiva y, si la app no está a la
 * vista, publica un aviso que suena (como alarma) y vibra hasta que lo toques o lo descartes.
 */
public class RestTimerReceiver extends BroadcastReceiver {

    static final String ACCION_FIN = "com.kratosfit.app.FIN_DESCANSO";
    static final int ID_CRONO = 2001;
    static final int ID_ALARMA = 2002;
    // Los canales de Android no se pueden cambiar después de creados: si se cambia el sonido o la
    // vibración hay que usar un id nuevo.
    static final String CANAL_CRONO = "descanso_crono";
    static final String CANAL_ALARMA = "descanso_alarma_v1";
    static final String COLOR_DEFECTO = "#FF6A1A";
    static final long[] VIBRACION = { 0, 600, 300, 600, 300, 600 };
    /** El aviso deja de sonar solo después de este tiempo si nadie lo toca. */
    static final long DURACION_AVISO = 60000L;

    @Override
    public void onReceive(Context ctx, Intent intent) {
        NotificationManager nm = (NotificationManager) ctx.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm == null) return;
        nm.cancel(ID_CRONO);
        // con la app abierta, la alarma la hace sonar la propia app (evita sonar dos veces)
        if (RestTimerPlugin.appVisible) return;

        crearCanales(ctx);
        String texto = intent.getStringExtra("texto");
        if (texto == null || texto.isEmpty()) texto = "Toca para continuar.";
        String color = intent.getStringExtra("color");

        NotificationCompat.Builder b = new NotificationCompat.Builder(ctx, CANAL_ALARMA)
            .setSmallIcon(R.drawable.ic_stat_kratos)
            .setColor(parseColor(color))
            .setContentTitle("¡Descanso terminado!")
            .setContentText(texto)
            .setStyle(new NotificationCompat.BigTextStyle().bigText(texto))
            .setContentIntent(abrirApp(ctx))
            .setAutoCancel(true)
            .setCategory(NotificationCompat.CATEGORY_ALARM)
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setShowWhen(true)
            .setWhen(System.currentTimeMillis())
            .setTimeoutAfter(DURACION_AVISO)
            // Android 7 (sin canales): sonido y vibración van en la notificación
            .setSound(sonido(), AudioManager.STREAM_ALARM)
            .setVibrate(VIBRACION);
        Notification n = b.build();
        // repite sonido y vibración hasta que el usuario toque o descarte el aviso (o pase DURACION_AVISO)
        n.flags |= Notification.FLAG_INSISTENT;
        try {
            nm.notify(ID_ALARMA, n);
        } catch (Exception e) {
            // sin permiso de notificaciones
        }
    }

    static Uri sonido() {
        Uri u = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION);
        if (u == null) u = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM);
        return u;
    }

    static void crearCanales(Context ctx) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationManager nm = (NotificationManager) ctx.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm == null) return;
        if (nm.getNotificationChannel(CANAL_CRONO) == null) {
            NotificationChannel c = new NotificationChannel(CANAL_CRONO, "Descanso en curso", NotificationManager.IMPORTANCE_LOW);
            c.setDescription("Cuenta regresiva del descanso entre series");
            c.setSound(null, null);
            c.enableVibration(false);
            c.setShowBadge(false);
            c.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
            nm.createNotificationChannel(c);
        }
        if (nm.getNotificationChannel(CANAL_ALARMA) == null) {
            NotificationChannel c = new NotificationChannel(CANAL_ALARMA, "Fin del descanso", NotificationManager.IMPORTANCE_HIGH);
            c.setDescription("Suena y vibra cuando termina el descanso, aunque la app esté en segundo plano");
            // uso ALARMA: suena con el volumen de alarma, también con el celular en silencio o vibración
            AudioAttributes aa = new AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_ALARM)
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .build();
            c.setSound(sonido(), aa);
            c.enableVibration(true);
            c.setVibrationPattern(VIBRACION);
            c.enableLights(true);
            c.setLightColor(parseColor(COLOR_DEFECTO));
            c.setBypassDnd(true);
            c.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
            nm.createNotificationChannel(c);
        }
    }

    static PendingIntent abrirApp(Context ctx) {
        Intent i = new Intent(ctx, MainActivity.class);
        i.setAction(Intent.ACTION_MAIN);
        i.addCategory(Intent.CATEGORY_LAUNCHER);
        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        return PendingIntent.getActivity(ctx, 1, i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    static int parseColor(String hex) {
        try {
            if (hex != null && !hex.isEmpty()) return Color.parseColor(hex);
        } catch (IllegalArgumentException e) {}
        return Color.parseColor(COLOR_DEFECTO);
    }
}
