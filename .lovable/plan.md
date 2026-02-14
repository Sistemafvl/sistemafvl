

# Aumentar logo na tela de login (desktop) e adicionar olho no campo senha

## 1. Aumentar o logo na pagina de login (desktop)

**Arquivo:** `src/components/LogoHeader.tsx`

Adicionar um tamanho extra `xl` para uso na tela de login desktop, com classes responsivas maiores:

```
xl: "h-24 sm:h-40"
```

**Arquivo:** `src/pages/Index.tsx`

Trocar `<LogoHeader ... size="lg" />` para `size="xl"` para que no desktop o logo fique visivelmente maior.

## 2. Adicionar icone de olho para mostrar/esconder senha

**Arquivo:** `src/components/UnitLoginForm.tsx`

- Adicionar estado `showPassword` (boolean).
- Envolver o Input de senha em um `div relative`.
- Adicionar um botao com icone `Eye` / `EyeOff` do lucide-react posicionado dentro do campo (absolute right).
- Alternar o `type` do input entre `"password"` e `"text"` conforme o estado.

## Detalhes tecnicos

- Nenhuma dependencia nova necessaria (lucide-react ja tem `Eye` e `EyeOff`).
- Dois arquivos editados: `LogoHeader.tsx`, `UnitLoginForm.tsx`, e `Index.tsx`.
