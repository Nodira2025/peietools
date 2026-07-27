import React from 'react';

interface LogoLoaderProps {
  text?: string;
  size?: 'sm' | 'md' | 'lg';
  fullScreen?: boolean;
  className?: string;
}

export default function LogoLoader({
  text = 'Cargando PEIE Tools...',
  size = 'md',
  fullScreen = false,
  className = ''
}: LogoLoaderProps) {
  const logoSizes = {
    sm: 'w-10 h-10',
    md: 'w-16 h-16',
    lg: 'w-24 h-24'
  };

  const ringSizes = {
    sm: 'w-14 h-14',
    md: 'w-24 h-24',
    lg: 'w-36 h-36'
  };

  const textSizes = {
    sm: 'text-xs',
    md: 'text-sm font-bold tracking-wide',
    lg: 'text-base font-extrabold tracking-wider'
  };

  const loaderContent = (
    <div className={`flex flex-col items-center justify-center gap-4 ${className}`}>
      {/* Resplandor y animación pulso/giro con el logo de PEIE */}
      <div className="relative flex items-center justify-center">
        {/* Anillo de pulso exterior */}
        <div className={`absolute ${ringSizes[size]} rounded-full bg-peie-blue/15 animate-ping`} />
        
        {/* Anillo de luz giratorio */}
        <div className={`absolute ${ringSizes[size]} rounded-full border-2 border-transparent border-t-peie-blue border-r-amber-400 animate-spin`} />

        {/* Logo de la empresa animado */}
        <div className={`relative z-10 ${logoSizes[size]} bg-white rounded-2xl p-2 shadow-lg shadow-peie-blue/20 flex items-center justify-center animate-pulse border border-slate-100`}>
          <img 
            src="/logo-peie.png" 
            alt="PEIE Tools" 
            className="w-full h-full object-contain"
          />
        </div>
      </div>

      {/* Texto de carga animado */}
      {text && (
        <div className="flex items-center gap-1">
          <span className={`${textSizes[size]} text-peie-blue animate-pulse`}>
            {text}
          </span>
        </div>
      )}
    </div>
  );

  if (fullScreen) {
    return (
      <div className="min-h-[100svh] w-full flex items-center justify-center bg-peie-bg">
        {loaderContent}
      </div>
    );
  }

  return loaderContent;
}
