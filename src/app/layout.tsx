import type { Metadata, Viewport } from 'next';
import './globals.css';

const title = 'PontoFácil - Sistema de Registro e Gestão de Ponto';
const description =
  'Sistema de controle de jornada, terminal de ponto e painel de gestão com regras avançadas de tolerância e banco de horas.';

export const metadata: Metadata = {
  title,
  description,
  openGraph: {
    title,
    description,
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
