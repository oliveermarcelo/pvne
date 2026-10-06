// Conteúdo inicial das páginas institucionais (editável no painel: Admin → Páginas).
// Os textos de Termos e Privacidade são modelos e devem ser revisados por um advogado.

export const PAGE_SEEDS = [
  {
    slug: "quem-somos",
    title: "Quem Somos",
    content: `## Feito por colecionadores, para colecionadores

A **PVNE Cards** nasceu de uma ideia simples: o card raro que falta na sua coleção está na pasta de outro colecionador — e o que sobra na sua é o que outra pessoa procura há anos. Nosso objetivo é conectar essas pessoas em um ambiente seguro, organizado e feito exclusivamente para o mercado de cards colecionáveis.

Pokémon, One Piece, Disney Lorcana, Magic: The Gathering, Yu-Gi-Oh!, Marvel, DC, futebol e muito mais: aqui cada card tem a sua página, com fotos, estado de conservação, edição, idioma e o histórico de quem já tentou levá-lo.

## A comunidade

Mais do que um marketplace, a PVNE é uma comunidade. Cada colecionador tem um perfil público com seus álbuns, e é possível acompanhar coleções, favoritar cards e conversar diretamente com outros colecionadores. Participe também do nosso grupo oficial no WhatsApp e acompanhe o Instagram para ver os destaques da semana.

## Como funciona o marketplace

Todo card cadastrado pode ser oferecido de três formas:

- **Venda direta** — o vendedor define o preço e o primeiro comprador que confirmar leva o card.
- **Aceita propostas** — o vendedor informa um preço de referência e recebe ofertas. Ele pode aceitar, recusar ou fazer uma contraproposta, e todo o histórico fica registrado.
- **Leilão** — o card fica disponível para lances durante um período definido.

## Como funcionam os leilões

O vendedor define o **lance inicial**, o **incremento mínimo** entre lances, a data de início e a de encerramento — e, se quiser, um **lance mínimo de reserva**, abaixo do qual o card não é vendido. Durante o leilão, cada lance precisa superar o lance atual pelo incremento mínimo. No horário de encerramento o sistema fecha o leilão automaticamente: o maior lance válido vence, o card passa para a coleção do vencedor e vendedor e comprador são notificados.

O histórico de lances é **imutável**: nenhum lance pode ser alterado ou apagado, nem mesmo pela equipe.

## Segurança

- Pagamento intermediado: o dinheiro fica com a PVNE até a entrega ser confirmada.
- Vendedores passam por verificação de identidade antes de anunciar.
- Senhas criptografadas e sessões protegidas.
- Lances processados um de cada vez, mesmo quando dois colecionadores clicam no mesmo segundo.
- Ninguém consegue editar ou excluir cards, álbuns ou anúncios de outra pessoa.
- Ações importantes ficam registradas para auditoria.
- Nossa equipe acompanha negociações e pode intervir em caso de problema.

## Negociação entre usuários

As negociações acontecem dentro da plataforma, vinculadas ao card e aos dois colecionadores. Você recebe uma notificação a cada nova proposta, contraproposta, aceite ou recusa. Depois do negócio fechado, o comprador paga via PIX **para a PVNE**. O vendedor só envia o card depois que confirmamos o pagamento, e só recebe o valor quando o comprador confirma a entrega. Assim os dois lados ficam protegidos — e ninguém precisa trocar telefone ou dados pessoais.`,
  },
  {
    slug: "como-funciona",
    title: "Como funciona",
    content: `## 1. Crie sua conta e seus álbuns
Organize sua coleção em álbuns por jogo, coleção ou como preferir.

## 2. Cadastre seus cards
Fotos, código, estado de conservação, edição, idioma e raridade.

## 3. Escolha como oferecer
Venda direta, aceitar propostas ou leilão — um anúncio ativo por card.

## 4. Pague com segurança
O comprador paga via PIX para a PVNE e envia o comprovante. Confirmado o pagamento, o vendedor envia o card com rastreio.

## 5. Receba
Quando o comprador confirma a entrega, o card vai para a coleção dele e o vendedor recebe o repasse (valor − comissão).

## Quero vender
Para anunciar é preciso ser vendedor aprovado: envie seus dados, chave PIX e documento com foto em **Minha conta → Vender na PVNE**.`,
  },
  {
    slug: "termos",
    title: "Termos de Uso",
    content: `> Modelo inicial — revise com sua assessoria jurídica antes de publicar.

## 1. Aceitação
Ao criar uma conta na PVNE Cards você concorda com estes Termos.

## 2. Cadastro
Você é responsável pelas informações fornecidas e pela guarda da sua senha. Contas podem ser bloqueadas em caso de fraude ou violação destes Termos.

## 3. Anúncios
O vendedor declara ser o legítimo proprietário do card anunciado e descreve com fidelidade seu estado de conservação. É proibido anunciar itens falsificados.

## 4. Lances e propostas
Lances são compromissos de compra e não podem ser retirados. Propostas aceitas configuram acordo entre as partes.

## 5. Pagamentos, comissão e vendedores
Todos os pagamentos são feitos à PVNE, que repassa ao vendedor o valor da venda descontada a comissão vigente após a confirmação da entrega. Para vender é necessário passar pela verificação de identidade. É proibido combinar pagamento ou entrega fora da plataforma; contas que tentarem fazê-lo podem ser suspensas.

## 6. Contato
Dúvidas e reclamações podem ser enviadas pela página de Contato.`,
  },
  {
    slug: "privacidade",
    title: "Política de Privacidade",
    content: `> Modelo inicial — revise com sua assessoria jurídica antes de publicar (LGPD).

## Dados que coletamos
Nome, nome de usuário, e-mail, telefone/WhatsApp, cidade, estado e foto de perfil, além dos cards, lances, propostas e mensagens registrados na plataforma.

## Como usamos
Para operar o marketplace, permitir que comprador e vendedor se comuniquem após um negócio fechado, prevenir fraudes e cumprir obrigações legais.

## Compartilhamento
Telefone e e-mail não são exibidos a outros usuários. O endereço de entrega do comprador é mostrado ao vendedor somente após o pagamento confirmado, para o envio. Documentos de verificação ficam em área restrita à equipe PVNE. Não vendemos dados pessoais.

## Seus direitos
Você pode solicitar acesso, correção ou exclusão dos seus dados pela página de Contato. Registros de lances e transações podem ser mantidos de forma anonimizada para garantir a integridade do histórico.`,
  },
];
