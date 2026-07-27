import { useState, useEffect } from 'react';
import { 
  checkNotificationSupport, 
  getNotificationPermissionState, 
  requestNotificationPermission, 
  showNativeNotification 
} from '../lib/pushNotifications';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Bell, BellOff, CheckCircle2, Smartphone, Monitor, Sparkles } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function NotificationPermissionBanner() {
  const { toast } = useToast();
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [isSupported, setIsSupported] = useState(true);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const supported = checkNotificationSupport();
    setIsSupported(supported);
    if (supported) {
      setPermission(getNotificationPermissionState());
    }
  }, []);

  const handleRequestPermission = async () => {
    const result = await requestNotificationPermission();
    setPermission(result);

    if (result === 'granted') {
      toast({
        title: '¡Notificaciones Activadas!',
        description: 'Ahora recibirás alertas de traslados y pedidos en la barra de tu dispositivo.',
      });
      // Emitir notificación de bienvenida de prueba
      showNativeNotification('🔔 PEIE Tools Notificaciones', {
        body: '¡Excelente! Tu dispositivo ya recibe notificaciones de traslados y pedidos.',
        onClickUrl: '/notificaciones',
      });
    } else if (result === 'denied') {
      toast({
        variant: 'destructive',
        title: 'Permiso Bloqueado',
        description: 'Debes habilitar las notificaciones desde la configuración de tu navegador.',
      });
    }
  };

  if (!isSupported || permission === 'granted' || dismissed) {
    return null;
  }

  return (
    <Card className="bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border-amber-300 dark:border-amber-700/50 my-3 shadow-sm">
      <CardContent className="p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="p-2 bg-amber-500 text-white rounded-xl shadow-xs mt-0.5">
            <Bell className="h-5 w-5 animate-pulse" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
              Activar avisos en barra de Celular / PC
              <span className="flex items-center gap-1 text-[10px] bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 px-2 py-0.5 rounded-full font-medium">
                <Smartphone className="h-3 w-3" /> <Monitor className="h-3 w-3" /> PWA Push
              </span>
            </h4>
            <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">
              Recibí notificaciones instantáneas en tu pantalla de inicio o escritorio cuando haya nuevos pedidos o traslados.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <Button
            size="sm"
            onClick={handleRequestPermission}
            className="bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs gap-1.5 shadow-sm"
          >
            <Sparkles className="h-3.5 w-3.5" /> Activar Avisos
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setDismissed(true)}
            className="text-xs text-slate-500"
          >
            Ahora no
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
