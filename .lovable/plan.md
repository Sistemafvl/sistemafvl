

# Plano: 3 Ajustes nos Cards de Carregamento

## 1. Inverter lógica do indicador de média

**Problema atual:** Verde quando TBRs atuais >= 90% da média (bom), vermelho quando < 70% (ruim). Mas a lógica correta é: se o motorista **saiu com mais do que a média**, é ponto de atenção (vermelho/amarelo), pois ele pode não conseguir entregar tudo.

**Nova lógica:**
- **Verde:** TBRs atuais <= 100% da média (dentro da capacidade)
- **Amarelo:** TBRs atuais entre 100-110% da média (leve excesso)
- **Vermelho:** TBRs atuais > 110% da média (acima da capacidade)

Aplicar nos dois locais: focus mode (linha ~2051) e lista normal (linha ~2474).

## 2. Truncar nomes para "Nome + 1º Sobrenome"

Criar uma função helper `shortName(fullName)` que retorna apenas o primeiro nome e o primeiro sobrenome (ex: "Michael Carvalho Dé Souza" → "Michael Carvalho").

Aplicar em ambos os renders do `ride.driver_name` (linhas ~2059 e ~2482).

## 3. Mover o círculo de média para a linha do check/olho/sequência

Remover o círculo de entre o Avatar e o nome, e posicioná-lo na `div` do canto superior direito (linha ~2017), junto ao CheckCircle, Eye e Badge de sequência. Mesma mudança no focus mode header (linha ~2441).

