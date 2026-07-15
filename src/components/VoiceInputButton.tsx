import React, { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Mic, MicOff } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface VoiceInputButtonProps {
  onTranscript: (text: string) => void;
  className?: string;
}

export default function VoiceInputButton({ onTranscript, className = "" }: VoiceInputButtonProps) {
  const { toast } = useToast();
  const [isListening, setIsListening] = useState(false);
  const [recognition, setRecognition] = useState<any>(null);
  const [isSupported, setIsSupported] = useState(true);

  useEffect(() => {
    // Configurar reconocimiento de voz nativo de HTML5
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setIsSupported(false);
      return;
    }

    const rec = new SpeechRecognition();
    rec.continuous = false;
    rec.lang = 'es-AR'; // Localización español de Argentina
    rec.interimResults = false;
    rec.maxAlternatives = 1;

    rec.onstart = () => {
      setIsListening(true);
    };

    rec.onend = () => {
      setIsListening(false);
    };

    rec.onerror = (event: any) => {
      console.error('Speech recognition error', event.error);
      setIsListening(false);
      if (event.error === 'not-allowed') {
        toast({
          variant: 'destructive',
          title: 'Acceso al micrófono denegado',
          description: 'Por favor, habilitá los permisos del micrófono en tu navegador para poder dictar.',
        });
      } else if (event.error !== 'no-speech') {
        toast({
          variant: 'destructive',
          title: 'Error de dictado',
          description: 'No pudimos reconocer lo que dijiste. Intentá hablar más claro o en un ambiente menos ruidoso.',
        });
      }
    };

    rec.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      if (transcript) {
        onTranscript(transcript);
      }
    };

    setRecognition(rec);
  }, [onTranscript, toast]);

  const toggleListening = (e: React.MouseEvent) => {
    e.preventDefault(); // Evitar que el botón active un submit accidental en formularios
    if (!recognition) return;

    if (isListening) {
      recognition.stop();
    } else {
      try {
        recognition.start();
      } catch (err) {
        console.error('Error starting recognition', err);
      }
    }
  };

  if (!isSupported) {
    return null; // Ocultamos el micrófono en navegadores que no soportan SpeechRecognition
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      onClick={toggleListening}
      className={`h-9 w-9 rounded-xl transition-all ${
        isListening 
          ? 'bg-rose-100 text-rose-600 hover:bg-rose-200 animate-pulse ring-2 ring-rose-300' 
          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
      } ${className}`}
      title={isListening ? "Escuchando... Hacé click para detener" : "Dictar por voz"}
    >
      {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
    </Button>
  );
}
