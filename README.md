# Conferir

Aplicação para conferir artigos e stock de faturas. Os dados ficam no navegador do dispositivo; o PDF original não é guardado nem enviado para um servidor.

## Executar e publicar

Instale as dependências com `npm install` e inicie com `npm run dev`. Para testar a versão instalável e offline, execute `npm run build` e depois `npm run preview`. A instalação e o modo offline dependem de um navegador compatível e de HTTPS ou localhost.

O GitHub Actions publica automaticamente o conteúdo de `dist` no GitHub Pages quando há um push para a branch `main`. Nas definições do repositório, abra **Pages** e selecione **GitHub Actions** como origem de publicação. O endereço ficará no formato `https://<utilizador>.github.io/<nome-do-repositorio>/`. O build deteta automaticamente esse subcaminho; para um repositório especial `<utilizador>.github.io`, usa a raiz do domínio.

Também é possível publicar a pasta `dist` noutro alojamento HTTPS. Para publicação num subcaminho, defina `VITE_BASE_PATH` durante o build, incluindo as barras inicial e final (por exemplo, `/faturas/`).

## Como utilizar

Importe um PDF na página inicial. A extração automática reconhece tabelas com um formato compatível; outros modelos e PDFs digitalizados podem não ser reconhecidos. Verifique sempre os dados importados e adicione ou edite artigos manualmente. Os campos do fornecedor e número da fatura também podem ser corrigidos.

Preencha a quantidade recebida e os dois valores de stock; zero é um valor válido. Pode adicionar notas a cada artigo. Para concluir, todos os campos de quantidade e referências devem estar preenchidos. As diferenças são assinaladas e é pedida confirmação antes da conclusão. Uma fatura concluída pode ser reaberta.

Ao abrir uma fatura concluída no histórico, cada artigo apresenta a diferença entre a quantidade recebida e a faturada e entre o stock na prateleira e o do sistema. Valores negativos aparecem a vermelho, zero a azul e valores positivos a verde.

Cada referência tem também três estados de verificação: não iniciada, a verificar e verificada. Ao iniciar ou concluir, a aplicação guarda a data e hora; enquanto estiver a verificar, mostra o tempo decorrido. O registo é apresentado junto à nota/descrição e incluído nas cópias de segurança. Repor o estado para «Não iniciada» apaga os horários, após confirmação.

Nas faturas concluídas, o botão «Descarregar PDF» exporta um relatório tabular em formato horizontal com as referências, quantidades, diferenças, nota/descrição, horários e duração de cada verificação. Os cabeçalhos repetem-se nas páginas seguintes.

As definições permitem exportar e restaurar cópias JSON. A restauração substitui os dados existentes. Limpar os dados do navegador ou mudar de dispositivo pode apagar ou tornar inacessíveis as verificações; mantenha cópias de segurança.

Execute os testes com `npm test`.
