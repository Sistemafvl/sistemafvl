

# Remover AdBanner e Google AdSense

## Alterações

1. **Deletar** `src/components/AdBanner.tsx`
2. **`index.html`** — remover o script do Google AdSense (linha com `pagead2.googlesyndication.com`)
3. **Remover imports e uso do `AdBanner`** em todos os arquivos que o utilizam (provavelmente `DriverHome.tsx` ou outros arquivos da visão do motorista)

## Arquivos alterados
- `src/components/AdBanner.tsx` — deletar
- `index.html` — remover script AdSense
- Arquivos que importam `AdBanner` — remover import e uso do componente

