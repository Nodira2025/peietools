import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { useZxing } from "react-zxing";

export default function QRScanner() {
  const navigate = useNavigate();
  const [result, setResult] = useState("");

  const { ref } = useZxing({
    onDecodeResult(result) {
      setResult(result.getText());
      
      // Assuming the QR contains a URL like http://localhost:5173/herramientas/uuid
      // or just the UUID
      const text = result.getText();
      try {
        if (text.includes('/herramientas/')) {
          const url = new URL(text);
          navigate(url.pathname); // navigates to /herramientas/:id
        } else {
          // Si solo es el UUID
          navigate(`/herramientas/${text}`);
        }
      } catch (e) {
        // Fallback for non-url UUIDs
        navigate(`/herramientas/${text}`);
      }
    },
  });

  return (
    <div className="space-y-6 max-w-md mx-auto">
      <div className="flex items-center mb-4">
        <Button variant="ghost" onClick={() => navigate('/herramientas')} className="p-0 hover:bg-transparent">
          <ArrowLeft className="mr-2 h-4 w-4" /> Volver
        </Button>
      </div>

      <Card className="shadow-lg border-t-4 border-peie-blue">
        <CardHeader>
          <CardTitle className="text-xl text-center">Escanear Herramienta</CardTitle>
          <CardDescription className="text-center">Apunta la cámara al código QR</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center">
          <div className="w-full aspect-square rounded-lg overflow-hidden bg-black flex items-center justify-center relative">
            <video ref={ref} className="w-full h-full object-cover" />
            <div className="absolute inset-0 border-2 border-white/30 m-8 rounded-xl pointer-events-none"></div>
          </div>
          
          {result && (
            <p className="mt-4 text-sm text-center font-mono bg-gray-100 p-2 rounded w-full break-all">
              {result}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
