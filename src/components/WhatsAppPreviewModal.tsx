import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { CheckCircle } from 'lucide-react';

interface WhatsAppPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  phone: string;
  message: string;
  onConfirm?: (finalPhone: string, finalMessage: string) => void;
  recipientName?: string;
}

export function WhatsAppPreviewModal({
  isOpen,
  onClose,
  phone,
  message,
  onConfirm,
  recipientName
}: WhatsAppPreviewModalProps) {
  const [editedPhone, setEditedPhone] = useState(phone);
  const [editedMessage, setEditedMessage] = useState(message);

  useEffect(() => {
    setEditedPhone(phone);
    setEditedMessage(message);
  }, [phone, message]);

  const handleSend = () => {
    const cleanPhone = editedPhone.replace(/[^0-9]/g, '');
    window.open(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(editedMessage)}`, '_blank');
    if (onConfirm) {
      onConfirm(cleanPhone, editedMessage);
    }
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="rounded-3xl w-[95%] max-w-md bg-white border-slate-100 shadow-xl overflow-hidden p-0">
        <div className="bg-gradient-to-r from-emerald-600 to-teal-700 text-white p-5 pb-6">
          <DialogHeader className="text-left space-y-1">
            <DialogTitle className="text-xl font-extrabold tracking-tight flex items-center gap-2">
              <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.06 5.348 5.397.01 12.008.01c3.202.001 6.212 1.246 8.477 3.514 2.266 2.268 3.507 5.28 3.505 8.484-.004 6.657-5.34 11.997-11.953 11.997-2.005-.001-3.973-.502-5.724-1.455L0 24zm6.09-3.846c1.62.963 3.426 1.47 5.278 1.471 5.516 0 10.01-4.498 10.014-10.02.002-2.673-1.04-5.187-2.936-7.086-1.897-1.9-4.411-2.946-7.083-2.947-5.525 0-10.02 4.5-10.024 10.022-.002 1.737.452 3.427 1.316 4.939l-1.002 3.66 3.737-.98zm11.378-7.79c-.3-.15-1.77-.874-2.045-.975-.276-.1-.476-.15-.676.15-.2.3-.775.975-.95 1.174-.175.2-.35.225-.65.075-.3-.15-1.263-.465-2.403-1.485-.888-.79-1.487-1.77-1.663-2.07-.175-.3-.019-.461.13-.61.135-.133.3-.349.45-.523.15-.174.2-.3.3-.5.1-.2.05-.375-.025-.525-.075-.15-.676-1.625-.925-2.225-.244-.595-.513-.51-.676-.51-.162-.008-.349-.01-.536-.01-.187 0-.49.07-.747.349-.257.276-.98.958-.98 2.337s1.003 2.707 1.143 2.894c.14.188 1.974 3.014 4.782 4.228.668.288 1.19.46 1.597.59.672.214 1.28.184 1.762.11.536-.08 1.77-.724 2.02-1.388.25-.664.25-1.233.175-1.353-.075-.12-.275-.22-.575-.37z"/>
              </svg>
              <span>Notificación de WhatsApp</span>
            </DialogTitle>
            <p className="text-emerald-100 text-xs font-semibold">
              Revisá y enviá el mensaje {recipientName ? `a ${recipientName}` : ''}
            </p>
          </DialogHeader>
        </div>

        <div className="p-6 space-y-4">
          <div className="space-y-1">
            <Label htmlFor="preview-phone" className="text-xs font-bold text-slate-500 uppercase tracking-wider">Número de Teléfono</Label>
            <Input
              id="preview-phone"
              value={editedPhone}
              onChange={e => setEditedPhone(e.target.value)}
              className="rounded-xl border-slate-200 focus-visible:ring-emerald-600 font-semibold text-slate-800"
              placeholder="Ej: 549381..."
            />
            <p className="text-[10px] text-slate-400">Debe incluir el código de país (ej: 54 para Argentina) sin espacios ni símbolos.</p>
          </div>

          <div className="space-y-1">
            <Label htmlFor="preview-msg" className="text-xs font-bold text-slate-500 uppercase tracking-wider">Mensaje a Enviar</Label>
            <textarea
              id="preview-msg"
              value={editedMessage}
              onChange={e => setEditedMessage(e.target.value)}
              rows={5}
              className="w-full rounded-xl border border-slate-200 p-3 text-xs bg-white text-slate-800 font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 shadow-sm"
            />
          </div>
        </div>

        <DialogFooter className="bg-slate-50 p-4 border-t border-slate-100 gap-2 sm:gap-0 rounded-b-3xl">
          <DialogClose asChild>
            <Button 
              variant="ghost" 
              className="rounded-xl hover:bg-slate-200 text-slate-600 font-bold text-xs"
            >
              Omitir
            </Button>
          </DialogClose>
          <Button
            onClick={handleSend}
            disabled={!editedPhone.trim() || !editedMessage.trim()}
            className="bg-emerald-600 text-white hover:bg-emerald-700 rounded-xl font-extrabold text-xs px-5 shadow-md shadow-emerald-600/10 flex items-center gap-1.5"
          >
            <CheckCircle className="h-3.5 w-3.5" />
            Enviar WhatsApp
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
