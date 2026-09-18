# Organzza Debutantes

Site responsivo com catálogo de 7 vestidos, 12 fotos originais agrupadas por modelo, filtros por cor, favoritos e galerias com navegação por teclado. A sacola reúne os modelos escolhidos e abre o WhatsApp real da loja com uma mensagem pronta com os vestidos, referências, cores, tamanhos e dados da cliente. Não envia mensagens automaticamente; a cliente conclui o envio no WhatsApp.

Para visualizar, execute `npm start` nesta pasta e acesse http://localhost:4173. O painel está em http://localhost:4173/admin.html, com a seção Agendamentos. Use o endereço do servidor para registrar provas; abrir o HTML diretamente não registra pedidos compartilhados. `npm run check` e `npm run check:bookings` executam os testes no Chrome com servidores temporários e dados isolados.

O painel reutiliza a estrutura do Achei Meu Vestido para editar fotos, nomes, cores, tamanhos, valores, promoções, visibilidade e disponibilidade. Catálogo, favoritos e sacola continuam no `localStorage` do navegador. Os agendamentos são compartilhados pelo servidor, persistidos em `data/appointments.json`, com escrita em sequência e substituição atômica do arquivo. A lista de Agendamentos reúne pedidos de todas as datas, com filtros por status, busca, aceite, recusa com motivo, remarcação e links de WhatsApp personalizados. Recusar, cancelar ou concluir libera o horário. As decisões e mudanças de data ficam no histórico do registro. Nenhuma mensagem é enviada automaticamente. O painel atualiza os pedidos a cada cinco segundos enquanto estiver visível e ao voltar à janela.

Pedidos antigos deste navegador são importados uma vez ao abrir o painel; a importação é identificada no servidor para evitar duplicação. A API pública divulga somente horários ocupados, sem dados pessoais. Em uso local, o servidor escuta apenas em `127.0.0.1`. Para publicar ou disponibilizar na rede, use hospedagem com Node e armazenamento persistente, defina `ADMIN_PASSWORD`, `HOST` e, se necessário, `PORT`. O painel solicitará a senha e usará uma sessão com cookie HttpOnly. Use HTTPS na publicação. Não é suficiente uma hospedagem exclusivamente estática. Você pode definir `ORGANZZA_DATA_DIR` para um volume persistente fora da pasta do site. Faça backup desse diretório. A grade de provas respeita os horários fornecidos: segunda a sexta, 09h–18h; sábado, 08h–16h; domingo fechado. Provas duram uma hora, com o último início às 17h nos dias úteis e 15h aos sábados. A configuração compartilhada entre site e servidor está em `business-info.js`. Pedidos de prova ficam pendentes até confirmação pela equipe.

As fotos fornecidas estão em `assets`, com cópias WebP para o site. A marca em `assets/logo.svg` é uma recriação vetorial baseada na referência pequena e cortada enviada; `logo-light.svg` é a versão clara sobre a foto. Aurora, Céu, Lavanda, Aqua, Rosé, Rubi e Jardim são nomes editoriais atribuídos para organizar o catálogo, com referências ORG-01 a ORG-07. Não foram informados tamanhos ou condições de contratação; a consulta é direcionada à loja.

O tema usa vinho, creme e dourado. A pedido do usuário, todos os vestidos têm preços e promoções simulados, com R$ 1.000 / R$ 850 como referência: Aurora 1.000 / 850; Céu 1.100 / 930; Lavanda 950 / 800; Aqua 1.400 / 1.190; Rosé 1.200 / 1.020; Rubi 1.300 / 1.100; Jardim 1.150 / 980. São valores demonstrativos, sinalizados no catálogo. A migração `organzza-demo-pricing-v1` aplica esses valores uma única vez ao catálogo já salvo, preservando fotos e demais dados. Após a migração, os valores continuam editáveis no painel. Substitua pelos valores oficiais e remova o aviso de demonstração antes de uso comercial.

Contatos: Instagram @organzzadebutantes · WhatsApp +55 27 99907-3556.

Endereço informado pelo usuário: Av. Nossa Sra. da Penha, 817 — Santa Lucia, Vitória — ES, CEP 29056-245. A seção A loja inclui mapa incorporado do Google Maps, rotas e horários de funcionamento.

No painel, o botão Horário personalizado permite informar a hora combinada com a cliente, inclusive fora da grade de funcionamento. A mesma opção aparece ao marcar ou editar uma visita. O servidor valida a data e a hora e impede sobreposições considerando uma hora por prova. Exceções de horário são exclusivas do painel; o checkout continua seguindo a grade da loja.

## Hospedagem e repositório

Repositório: https://github.com/situacional42-lang/organzza-debutantes

O projeto inclui `render.yaml` para um serviço Node com disco permanente e um `Dockerfile` para outras hospedagens. Consulte [o guia de hospedagem](docs/HOSPEDAGEM.md). A senha do painel é definida em `ADMIN_PASSWORD` pela hospedagem; dados de clientes e senhas não são enviados ao GitHub.

A API de agendamentos é compartilhada; o catálogo ainda é salvo no navegador e alterações feitas no painel não se propagam para outros dispositivos. Essa limitação está detalhada no guia.

A apresentação comercial em PDF, seu HTML e as capturas de tela são materiais locais e ficam fora do repositório, seguindo a organização dos outros sites.
