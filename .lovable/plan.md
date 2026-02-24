

# Melhorias: Campo de Busca TBR, Icones de Ajuda e Botoes Folha de Pagamento

## 1. Campo de busca TBR com visual destacado (Anexo 1)

**Problema**: O campo "Buscar TBR..." parece um input comum, sem destaque visual.

**Solucao**: Aplicar estilo com sombra, gradiente de borda e animacao de pulse sutil no icone de busca. Adicionar `shadow-lg`, borda colorida com `ring` e uma animacao de glow pulsante via CSS customizado.

**Arquivo**: `src/pages/dashboard/DashboardHome.tsx` (linhas 306-316)
- Envolver o input em um container com `shadow-lg border-2 border-primary/30 rounded-xl` e animacao de glow
- Aumentar levemente o tamanho do icone Search e adicionar animacao de pulse
- Adicionar classe CSS customizada em `src/index.css` para o efeito de glow/vibration

**Arquivo**: `src/index.css`
- Adicionar keyframe `@keyframes tbr-glow` com box-shadow pulsante verde/teal
- Classe `.tbr-search-glow` que aplica a animacao

## 2. Icones "?" com textos explicativos (Anexos 2-7)

**Problema**: Os cards e graficos nao tem contexto explicativo para usuarios novos.

**Solucao**: Criar um componente `InfoButton` reutilizavel que exibe um icone "?" pequeno. Ao clicar, abre um Popover com texto explicativo detalhado. Nao usar Tooltip (conforme memoria do projeto).

**Componente**: `src/components/dashboard/InfoButton.tsx` (novo arquivo)
- Icone `HelpCircle` de 14px, cor `text-muted-foreground`
- Ao clicar, abre um `Popover` com texto explicativo
- Props: `text: string`

**Arquivos que recebem o InfoButton**:

| Local | Texto explicativo |
|---|---|
| DNR Abertos (DashboardHome) | "Total de DNRs (Did Not Receive) abertos na unidade. Representam pacotes que o cliente declarou nao ter recebido e estao pendentes de analise." |
| DNR Analisando (DashboardHome) | "DNRs em processo de analise pela equipe. Esses pacotes estao sendo investigados para confirmar ou negar a entrega." |
| DNR Finalizados (DashboardHome) | "DNRs finalizados no periodo. Inclui casos confirmados e descartados." |
| Carregamentos (DashboardMetrics) | "Total de carregamentos realizados no periodo. Cada carregamento representa uma viagem de entrega iniciada por um motorista." |
| TBRs escaneados (DashboardMetrics) | "Total de pacotes (TBRs) escaneados no periodo. Cada TBR e um pacote individual conferido antes do carregamento." |
| PS abertos (DashboardMetrics) | "PS (Problem Solve) abertos. Pacotes com problemas que precisam de resolucao manual." |
| RTO abertos (DashboardMetrics) | "RTO (Return to Origin) abertos. Pacotes que precisam ser devolvidos ao centro de distribuicao." |
| Retornos Piso (DashboardMetrics) | "Pacotes que retornaram ao piso da unidade sem serem entregues." |
| Carregando agora (DashboardMetrics) | "Motoristas com carregamento em andamento neste momento." |
| Grafico Carregamentos (DashboardMetrics) | "Evolucao diaria do numero de carregamentos realizados na unidade." |
| Grafico TBRs (DashboardMetrics) | "Evolucao diaria do numero de TBRs escaneados na unidade." |
| Grafico Status (DashboardMetrics) | "Distribuicao dos carregamentos por status: Pendente, Em carregamento e Finalizado." |
| Top Motoristas (DashboardInsights) | "Ranking dos motoristas com mais entregas (TBRs concluidos) no periodo." |
| Maiores Ofensores (DashboardInsights) | "Motoristas com mais TBRs retornados (Piso, PS, RTO) no periodo." |
| Conferentes mais ativos (DashboardInsights) | "Conferentes que mais escanearam TBRs no periodo." |
| Media TBRs (DashboardInsights) | "Media de TBRs por carregamento no periodo." |
| Taxa de Retorno (DashboardInsights) | "Percentual de TBRs que retornaram em relacao ao total escaneado." |
| Tempo Medio (DashboardInsights) | "Tempo medio entre inicio e fim do carregamento." |
| Dia Mais Movimentado (DashboardInsights) | "Dia da semana com maior volume de carregamentos no periodo." |
| Operacao cards (OperacaoPage) | Cards de resumo com icone de ajuda nos titulos |
| Financeiro cards (FinanceiroPage) | Cards de resumo do financeiro |
| Feedbacks cards (FeedbacksPage) | Cards de media, total e distribuicao |

## 3. Compactar botoes da Folha de Pagamento (Anexo 8)

**Problema**: O terceiro botao (Gerar) esta saindo do card.

**Solucao**: Reduzir o texto e tamanho dos botoes no card "Folha de Pagamento".

**Arquivo**: `src/pages/dashboard/RelatoriosPage.tsx` (linhas 483-497)
- Adicionar `text-xs` nos botoes
- Reduzir padding com `px-2`
- Remover gap dos icones para economizar espaco
- Usar `size="sm"` nos botoes

## Detalhes Tecnicos

### index.css - Animacao do campo TBR

```css
@keyframes tbr-glow {
  0%, 100% { box-shadow: 0 0 8px 2px rgba(0, 128, 128, 0.15); }
  50% { box-shadow: 0 0 16px 4px rgba(0, 128, 128, 0.3); }
}
.tbr-search-glow {
  animation: tbr-glow 2s ease-in-out infinite;
  border: 2px solid hsl(var(--primary) / 0.4);
  border-radius: 0.75rem;
  transition: box-shadow 0.3s, border-color 0.3s;
}
.tbr-search-glow:focus-within {
  border-color: hsl(var(--primary));
  box-shadow: 0 0 20px 6px rgba(0, 128, 128, 0.35);
}
```

### InfoButton.tsx

```tsx
import { HelpCircle } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

const InfoButton = ({ text }: { text: string }) => (
  <Popover>
    <PopoverTrigger asChild>
      <button className="ml-1 inline-flex items-center text-muted-foreground hover:text-primary transition-colors">
        <HelpCircle className="h-3.5 w-3.5" />
      </button>
    </PopoverTrigger>
    <PopoverContent className="text-xs max-w-[260px] p-3">{text}</PopoverContent>
  </Popover>
);

export default InfoButton;
```

### RelatoriosPage.tsx - Botoes compactos

```tsx
<div className="flex gap-1.5">
  <Button variant="outline" size="sm" className="flex-1 gap-1 text-xs px-2" onClick={r.secondAction}>
    <Search className="h-3.5 w-3.5" /> Consultar
  </Button>
  <Button variant="outline" size="sm" className="flex-1 gap-1 text-xs px-2" onClick={espelhoAction}>
    <Eye className="h-3.5 w-3.5" /> Espelho
  </Button>
  <Button size="sm" className="flex-1 gap-1 text-xs px-2" onClick={r.action}>
    <FileText className="h-3.5 w-3.5" /> Gerar
  </Button>
</div>
```

### Resumo de arquivos modificados

| Arquivo | Alteracao |
|---|---|
| `src/index.css` | Adicionar animacao tbr-glow |
| `src/pages/dashboard/DashboardHome.tsx` | Estilo do campo TBR + InfoButtons nos DNR cards |
| `src/components/dashboard/InfoButton.tsx` | Novo componente reutilizavel |
| `src/components/dashboard/DashboardMetrics.tsx` | InfoButtons nos 6 cards e 3 graficos |
| `src/components/dashboard/DashboardInsights.tsx` | InfoButtons nos rankings e metricas |
| `src/pages/dashboard/OperacaoPage.tsx` | InfoButtons nos cards de resumo |
| `src/pages/dashboard/FinanceiroPage.tsx` | InfoButtons nos cards de resumo |
| `src/pages/dashboard/FeedbacksPage.tsx` | InfoButtons nos cards de resumo |
| `src/pages/dashboard/RelatoriosPage.tsx` | Compactar botoes da Folha de Pagamento |

