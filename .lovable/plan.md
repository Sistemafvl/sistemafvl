

# Melhorias no Cadastro de Motorista

## Alteracoes no arquivo `src/components/DriverRegistrationModal.tsx`

### 1. Mascara para Placa do Carro (formato AAA-0AAA)

Criar uma funcao `maskPlate` que formata automaticamente a placa no padrao Mercosul:
- Aceita letras nas posicoes 1-3, digito na posicao 4, letra na posicao 5, e alfanumerico nas posicoes 6-7
- Insere o hifen automaticamente apos o terceiro caractere
- Converte tudo para maiusculo
- Exemplo: digitando "fag6e14" resulta em "FAG-6E14"

### 2. Novo campo "Cor do carro"

Adicionar campo `car_color` ao formulario, posicionado junto aos campos de veiculo (Placa e Modelo), formando uma grade de 3 campos.

### 3. Auto-correcao de primeira letra maiuscula (capitalize)

Criar funcao `capitalize` que converte a primeira letra de cada palavra para maiuscula. Aplicar nos campos:
- Modelo do carro (ex: "cobalt" vira "Cobalt")
- Cor do carro (ex: "prata" vira "Prata")
- Nome completo (ex: "joao silva" vira "Joao Silva")
- Endereco, Bairro, Cidade

### 4. Migracao de banco

Adicionar coluna `car_color` (text, nullable) na tabela `drivers`.

### Detalhes tecnicos

- A funcao `maskPlate` usa regex para aceitar apenas caracteres validos em cada posicao e forca maiusculas
- A funcao `capitalize` e aplicada no `onChange` de cada campo relevante, usando `word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()`
- O campo `car_color` nao sera obrigatorio

