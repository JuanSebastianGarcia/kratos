package com.kratosfit.app;

import android.app.AlarmManager;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import androidx.core.app.NotificationCompat;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Descanso entre series en Android:
 * - start: muestra una notificación fija con cuenta regresiva (cronómetro del sistema, se ve en la
 *   barra y en la pantalla bloqueada) y programa una alarma exacta para el fin del descanso.
 *   Con fin = 0 (descanso libre) muestra un cronómetro hacia arriba y no programa alarma.
 * - stop: quita todo (notificación fija, alarma pendiente y aviso que esté sonando).
 * Al llegar la hora, RestTimerReceiver quita la cuenta regresiva y publica el aviso que suena y vibra.
 */
@CapacitorPlugin(name = "RestTimer")
public class RestTimerPlugin extends Plugin {

    /** true mientras la app está en primer plano: entonces la propia app hace sonar la alarma. */
    static volatile boolean appVisible = false;

    @Override
    protected void handleOnResume() {
        appVisible = true;
    }

    @Override
    protected void handleOnPause() {
        appVisible = false;
    }

    @PluginMethod
    public void start(PluginCall call) {
        Context ctx = getContext();
        Long inicioObj = call.getLong("inicio");
        Long finObj = call.getLong("fin");
        long ahora = System.currentTimeMillis();
        long inicio = inicioObj != null ? inicioObj : ahora;
        long fin = finObj != null ? finObj : 0L;
        String titulo = call.getString("titulo", "Descanso");
        String texto = call.getString("texto", "");
        String color = call.getString("color", RestTimerReceiver.COLOR_DEFECTO);

        RestTimerReceiver.crearCanales(ctx);
        cancelarAlarma(ctx);
        NotificationManager nm = (NotificationManager) ctx.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm != null) nm.cancel(RestTimerReceiver.ID_ALARMA);

        boolean libre = fin <= 0;
        if (!libre && fin <= ahora + 500) {
            // el descanso ya terminó: no hay nada que contar ni programar
            if (nm != null) nm.cancel(RestTimerReceiver.ID_CRONO);
            call.resolve();
            return;
        }

        NotificationCompat.Builder b = new NotificationCompat.Builder(ctx, RestTimerReceiver.CANAL_CRONO)
            .setSmallIcon(R.drawable.ic_stat_kratos)
            .setColor(RestTimerReceiver.parseColor(color))
            .setContentTitle(libre ? titulo + " libre" : titulo)
            .setContentText(texto)
            .setStyle(new NotificationCompat.BigTextStyle().bigText(texto))
            .setContentIntent(RestTimerReceiver.abrirApp(ctx))
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .setSilent(true)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setShowWhen(true)
            .setUsesChronometer(true)
            .setWhen(libre ? inicio : fin)
            .setChronometerCountDown(!libre);
        if (!libre) {
            // respaldo: si la alarma se retrasa, la cuenta regresiva no se queda en negativo
            b.setTimeoutAfter(fin - ahora + 2000);
        }
        try {
            if (nm != null) nm.notify(RestTimerReceiver.ID_CRONO, b.build());
        } catch (Exception e) {
            // sin permiso de notificaciones: la app sigue funcionando sin aviso
        }

        if (!libre) programarAlarma(ctx, fin, texto, color);
        call.resolve();
    }

    @PluginMethod
    public void stop(PluginCall call) {
        Context ctx = getContext();
        cancelarAlarma(ctx);
        NotificationManager nm = (NotificationManager) ctx.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm != null) {
            nm.cancel(RestTimerReceiver.ID_CRONO);
            nm.cancel(RestTimerReceiver.ID_ALARMA);
        }
        call.resolve();
    }

    private static PendingIntent intentAlarma(Context ctx, String texto, String color) {
        Intent i = new Intent(ctx, RestTimerReceiver.class);
        i.setAction(RestTimerReceiver.ACCION_FIN);
        if (texto != null) i.putExtra("texto", texto);
        if (color != null) i.putExtra("color", color);
        return PendingIntent.getBroadcast(ctx, 0, i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    private static void cancelarAlarma(Context ctx) {
        AlarmManager am = (AlarmManager) ctx.getSystemService(Context.ALARM_SERVICE);
        if (am == null) return;
        try {
            am.cancel(intentAlarma(ctx, null, null));
        } catch (Exception e) {}
    }

    private static void programarAlarma(Context ctx, long fin, String texto, String color) {
        AlarmManager am = (AlarmManager) ctx.getSystemService(Context.ALARM_SERVICE);
        if (am == null) return;
        PendingIntent pi = intentAlarma(ctx, texto, color);
        boolean exacta = Build.VERSION.SDK_INT < Build.VERSION_CODES.S || am.canScheduleExactAlarms();
        try {
            if (exacta) {
                // setAlarmClock: hora exacta y no lo frena el ahorro de batería (Doze)
                am.setAlarmClock(new AlarmManager.AlarmClockInfo(fin, RestTimerReceiver.abrirApp(ctx)), pi);
                return;
            }
        } catch (SecurityException e) {
            // sin permiso de alarmas exactas: se usa la inexacta de abajo
        }
        try {
            am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, fin, pi);
        } catch (Exception e) {}
    }
}
