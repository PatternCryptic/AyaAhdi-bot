# Coletor de alinhamentos via WhatsApp

Bot silencioso para registrar no Google Sheets somente mensagens de grupos que contenham a palavra **alinhamento**. Esta V1 guarda a mensagem encontrada, sem responder e sem associar mensagens enviadas depois.

## O que é registrado

A aba configurada recebe uma linha por mensagem, com as colunas A:H:

1. Data/hora da mensagem (UTC)
2. Nome do grupo
3. Identificador do grupo
4. Nome exibido do remetente
5. Identificador do remetente
6. Medidas escritas explicitamente com unidade (por exemplo, `6 mm`)
7. Mensagem original completa
8. Identificador da mensagem (deduplicação)

O bot não tenta inferir equipamento, lado, posição ou resultado. Esses detalhes continuam preservados no texto original para análise manual. Uma mensagem sem medida explícita deixa essa coluna vazia. A palavra é reconhecida sem diferenciar maiúsculas/minúsculas.

## Autenticação Google sem chave privada

O código usa Application Default Credentials (ADC). Em produção, execute-o em uma VM do Compute Engine e anexe a conta de serviço `bot-whatsapp-sheets` à VM. O Google fornece credenciais temporárias pelo servidor de metadados; não é necessário criar ou baixar uma chave privada JSON.

A conta de serviço precisa ter acesso de Editor à planilha e a VM deve usar o escopo `cloud-platform`. Mantenha a restrição de criação de chaves da organização ativada.

## Configuração do bot

1. Na VM, instale Node.js 18+ e as dependências com `npm install`.
2. Configure as variáveis de ambiente do `.env.example` por meio do arquivo de ambiente do serviço (por exemplo, `EnvironmentFile` do systemd).
3. Na aba `Página1`, prepare estes cabeçalhos na primeira linha: `Data/hora | Grupo | ID do grupo | Remetente | ID do remetente | Medidas | Mensagem original | ID da mensagem`.
4. Inicie com `npm start` e escaneie o QR Code com o WhatsApp que participa do grupo.

## Hospedagem e custos

O Google Cloud Free Tier inclui uma VM e2-micro não preemptiva por mês somente nas regiões elegíveis `us-west1`, `us-central1` ou `us-east1`, além de limites mensais para disco e tráfego de saída. Uso fora desses limites pode gerar cobranças. Confira a página de preços e o painel de faturamento antes de criar a VM.

## Comportamento e limites da V1

- Processa somente mensagens novas recebidas de grupos, com a palavra inteira `alinhamento`.
- Não lê mensagens seguintes como continuação, não responde nem envia comandos.
- Ignora mensagens antigas sincronizadas e mensagens enviadas pela própria conta.
- Guarda os IDs recentes processados em `processed-message-ids.json`, arquivo local ignorado pelo Git.
- A sessão WhatsApp fica em `auth_info_baileys/`, também ignorada pelo Git.
- Para evitar duplicidade quando o processo reiniciar, mantenha os dados locais junto da hospedagem.

## Segurança

Não crie nem publique chaves privadas de contas de serviço. Use uma conta de serviço com acesso mínimo, anexada somente à VM do bot.
