// Origens extras (separadas por vírgula) autorizadas a carregar os assets do `next dev`.
// Ex.: ALLOWED_DEV_ORIGINS="meu-preview.exemplo.com,**.tunel.exemplo.com"
const extraDevOrigins = (process.env.ALLOWED_DEV_ORIGINS || '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  // Em desenvolvimento o Next bloqueia scripts/HMR vindos de outro domínio. Sem isso, o
  // preview do Google AI Studio (rodando em outro host) renderiza o HTML mas não hidrata,
  // e botões como "Acesso Master Admin" não respondem. Só afeta `next dev`.
  allowedDevOrigins: [
    '**.run.app',
    '**.usercontent.goog',
    '**.googleusercontent.com',
    ...extraDevOrigins,
  ],
};

export default nextConfig;
