# Hospedar a Organzza Debutantes

O projeto reúne a vitrine e a API de agendamentos no mesmo servidor Node. Use Node 24 e um diretório permanente para os dados. Não precisa de build da interface nem de banco externo.

## Render com GitHub

1. Conecte a conta **situacional42-lang** ao Render e escolha o repositório **organzza-debutantes**.
2. Em **New → Blueprint**, selecione esse repositório e use o arquivo `render.yaml` da raiz.
3. Defina uma senha forte em **ADMIN_PASSWORD**. A senha não fica no GitHub.
4. Confira e aceite os custos do serviço Node e do disco permanente apresentados pelo Render.
5. Após o deploy, acesse o endereço fornecido pelo Render. O painel fica em `/admin.html`.

O Blueprint configura uma instância, um disco de 1 GB em `/var/data`, dados em `/var/data/organzza`, build `npm ci --omit=dev` e inicialização `npm start`. A plataforma define `PORT`; a aplicação respeita esse valor. O teste de saúde é `/api/health`.

Também é possível criar **New → Web Service**, selecionar Node e informar esses mesmos comandos, variáveis e disco manualmente.

O Render exige um serviço pago para anexar disco permanente. Os preços da plataforma são custos de infraestrutura, separados do código publicado. A configuração não contrata nem publica uma hospedagem automaticamente.

Documentação oficial: [Web Services](https://render.com/docs/web-services), [Blueprint](https://render.com/docs/blueprint-spec), [discos permanentes](https://render.com/docs/disks), [variáveis de ambiente](https://render.com/docs/configure-environment-variables).

## Outras hospedagens Node

Use `npm ci --omit=dev` e `npm start`, com as variáveis:

| Variável | Configuração |
| --- | --- |
| `HOST` | `0.0.0.0` |
| `PORT` | Porta definida pela plataforma |
| `ADMIN_PASSWORD` | Senha definida pela loja |
| `ORGANZZA_DATA_DIR` | Diretório de um volume permanente |
| `NODE_ENV` | `production` |

Configure HTTPS e execute **uma instância** do servidor. A persistência usa um arquivo JSON e uma fila de escrita no processo; não distribua várias instâncias escrevendo no mesmo volume.

As variáveis devem ser definidas no ambiente da hospedagem. `.env.example` é um modelo e não é carregado automaticamente pelo servidor.

## Docker

```sh
docker build -t organzza-debutantes .
docker volume create organzza-data
docker run -d --name organzza -p 4173:4173 --mount source=organzza-data,target=/app/data --env-file /caminho/privado/organzza.env organzza-debutantes
```

O arquivo externo `organzza.env` deve conter `ADMIN_PASSWORD` e ficar fora do repositório. Publique o contêiner atrás de um proxy HTTPS. O volume guarda `appointments.json`; faça backups regulares.

## O que fica compartilhado

Pedidos de prova, aceite, recusa e remarcação são persistidos no servidor e aparecem em dispositivos diferentes. A API pública mostra apenas os horários ocupados.

**O catálogo ainda usa armazenamento do navegador.** Preços, imagens e outros dados alterados no painel aparecem na vitrine desse mesmo navegador; não se propagam para clientes em outros dispositivos. Para publicar mudanças do catálogo na versão atual, atualize os padrões em `catalog-store.js` e publique o código. Uma gestão de catálogo compartilhada requer evolução do backend.

Os preços atuais são demonstrativos e a logo foi recriada a partir da referência enviada. Antes de divulgar comercialmente o site, substitua valores e tamanhos pelos oficiais e aprove a marca com a loja.

## Conferência após publicar

- Abra `/api/health` e confirme a resposta `{"ok":true}`.
- Entre no painel com a senha escolhida.
- Faça uma solicitação de prova em outro navegador e confira o pedido no painel.
- Teste aceitar, recusar e remarcar, além do resumo do WhatsApp.
- Reinicie o serviço e confira se os pedidos continuam no disco.
