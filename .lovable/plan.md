## Plano

### 1. Adotar a logo enviada como oficial
- Fazer upload de `user-uploads://logofederal.png` via `lovable-assets` para `src/assets/logo_federal.png.asset.json` (sobrescrevendo o pointer atual). Como o pointer é referenciado por `@/assets/logo_federal.png.asset.json` no `AppSidebar`, `auth.tsx` e `_authenticated/route.tsx`, todos os pontos do sistema passam a exibir a nova logo automaticamente — sem alterar componentes.
- Usar a mesma imagem como favicon:
  - Copiar o arquivo para `public/favicon.png`.
  - Atualizar `src/routes/__root.tsx` `links` para `{ rel: "icon", type: "image/png", href: "/favicon.png" }`.
  - Remover `public/favicon.ico`.

### 2. Corrigir tela em branco ao abrir o projeto
Diagnóstico: `src/routes/__root.tsx` tem metadata placeholder (`asdsxxasdxz` / `azxssx`) e um `og:image` apontando para um screenshot antigo do preview — não é a causa da tela branca, mas será substituído. A causa provável da tela em branco é que a rota raiz `/` faz `supabase.auth.getUser()` em `beforeLoad` com `ssr: false`, e caso a sessão inicial resolva lentamente ou haja erro silencioso, nada é renderizado. Vou:
- Ajustar `src/routes/index.tsx` para exibir um fallback de loading enquanto o redirect resolve (`component` retornando um spinner centralizado em vez de `null`), garantindo feedback visual imediato.
- Atualizar `__root.tsx` com metadados reais do sistema:
  - `title`: "Federal Invest Trustee"
  - `description`: "Plataforma Federal Invest para gestão trustee: pagamentos, boletos, CNAB e relatórios."
  - Atualizar `og:title`, `og:description`, `twitter:title`, `twitter:description` correspondentes.
  - Remover o `og:image` do root (regra: `og:image` só em rotas folha; deixar o hosting injetar a preview).
- Recarregar o dev server após as mudanças para garantir que a preview reflita a nova logo e metadados.

### Arquivos afetados
- `src/assets/logo_federal.png.asset.json` (substituído via CLI)
- `public/favicon.png` (novo), `public/favicon.ico` (removido)
- `src/routes/__root.tsx` (metadata + favicon link, sem og:image)
- `src/routes/index.tsx` (fallback de loading)

Nenhuma mudança de lógica de negócio ou schema.
