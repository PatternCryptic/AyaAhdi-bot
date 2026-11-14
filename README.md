# Coletor de alinhamentos — migração incompleta

**Não colocar em produção ainda.** O fluxo já lê a configuração via Google Sheets API, pode pedir em uma só mensagem os campos faltantes e acrescenta uma linha com chave de sessão. Ainda requer validar os cabeçalhos das abas nativas, integrar medição/tolerância no extrator e executar um ensaio com mocks antes de publicar.

## Fontes e permissões

- Registros: [Mr Alinhamento](https://docs.google.com/spreadsheets/d/1oc2u-thAhflrqEb3m6hxux8Yg6jEE6wGY-zFQyBRR38/edit), aba `Modelo alinhamento`. Seu ID deve ser definido em `SPREADSHEET_ID`.
- Configuração nativa: [Configuração - alinhamento](https://docs.google.com/spreadsheets/d/1E27LdQunE0QVAAT7pnEo0GOvORov090ioIshE3jLCuY/edit), com `Taxonomia`, `Glossario`, `Configurações` e `masterlist`. Configure esse ID em `CONFIG_SPREADSHEET_ID`. A conta `bot-whatsapp-sheets@project-38a010b6-380d-436b-8a3.iam.gserviceaccount.com` recebeu acesso de leitor; ela permanece editora da planilha de registros.
- Mantenha configuração e registros em arquivos separados: as permissões do Google Sheets são por arquivo, então um único arquivo não permite restringir a conta de serviço à leitura de algumas abas e escrita em outra. Use ADC com a conta anexada à VM, sem chaves no repositório. `GEMINI_API_KEY` deve vir de variável de ambiente ou gerenciador de segredos.

## Esquema inspecionado

Os títulos ficam na segunda linha, sob agrupamentos na primeira. Há títulos repetidos `Equipment Class`, `Maker` e `Model` para a máquina de acionamento e a estacionária; o mapeamento seleciona o grupo `Drive Machine` e falha diante de cabeçalhos essenciais ambíguos. Há quatro colunas direcionais de histórico e tolerâncias axial, radial e de folga, mas não há colunas distintas para antes/depois, unidade ou conclusão. O gravador acrescenta linhas e usa `Comments` para observações e a chave idempotente da sessão. A pergunta única é refeita quando a lista de campos faltantes muda.

## Fluxo atual e pendências

Baileys recebe mensagens de todos os grupos; Gemini classifica sessões separadas por grupo, faz uma pergunta consolidada e reavalia o que falta após cada resposta. A pergunta seguinte só é enviada quando o conjunto de campos conhecidos/faltantes muda. A sessão fecha após 15 minutos sem atividade relacionada e os campos comprovados podem ser gravados mesmo se outros continuarem desconhecidos. Antes de publicar, validar os nomes de cabeçalho das abas na cópia nativa. Não utilizar a planilha real para testes.

`alignment_measurements.compare` só compara medição posterior e tolerância numéricas com mesma direção e unidade explícitas. Ela retorna `Desconhecido` nos demais casos; ainda precisa ser ligada à extração com evidências verificadas.

## Testes

Execute `npm test` com Node.js compatível com `node:test`. Não é necessário conectar WhatsApp ou Google para os testes locais. Os arquivos de sessão e pendências podem conter dados pessoais e devem permanecer privados e fora do Git. Outros guias anteriores descrevem o comportamento antigo e não devem ser usados para implantação.

